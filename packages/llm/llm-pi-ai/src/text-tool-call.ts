/**
 * Promote one text-shaped tool call into a harness tool-call block.
 *
 * Some local models print `{ name, arguments }` in the assistant text instead
 * of the provider tool-call channel. A string `function` field is accepted as
 * the tool name when `name` is absent. This module accepts that spelling only
 * when the finished reply contains exactly one such object, the name is a
 * tool on the request, and the arguments match that tool's schema.
 *
 * @module dsh-llm-pi-ai/text-tool-call
 */

import { randomUUID } from 'node:crypto'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import type { StreamChunk, ToolSchema } from '@deepseek-ai/dsh-llm'

/** One accepted text call, with the surrounding prose kept separately. */
export interface PromotedTextToolCall {
  /** Tool name, equal to one request tool. */
  name: string
  /** Schema-valid arguments, serialized as one JSON object. */
  argumentsText: string
  /** Assistant text after the accepted object is removed. */
  prose: string
}

interface ParsedCall {
  name: string
  argumentsText: string
  arguments: Record<string, unknown>
}

interface CallSpan {
  start: number
  end: number
  call: ParsedCall
}

const UNSUPPORTED_SCHEMA_KEYS = ['oneOf', 'anyOf', 'allOf', '$ref', 'not', 'patternProperties'] as const

/**
 * Accept one text-shaped call from a finished assistant reply.
 * @param text - concatenated assistant text blocks, in stream order.
 * @param tools - tools advertised on the request. An empty list accepts nothing.
 * @returns the call and remaining prose, or `undefined` when the reply is not
 *   exactly one schema-valid call. A justification without a real
 *   `sandbox_permissions` value, and a permission without a justification, are
 *   removed before that check.
 */
export function extractTextToolCall(
  text: string,
  tools: readonly ToolSchema[],
): PromotedTextToolCall | undefined {
  if (tools.length === 0) return undefined
  const fenced = fencedCalls(text)
  const bare = bareCalls(text, fenced.map(span => [span.start, span.end] as const))
  const spans = [...fenced, ...bare]
  if (spans.length !== 1) return undefined
  const span = spans[0]
  if (span === undefined) return undefined
  const tool = tools.find(candidate => candidate.name === span.call.name)
  const args = withoutStrayEscalation(span.call.arguments)
  if (tool === undefined || !argumentsMatchSchema(tool.parameters, args)) return undefined
  const prose = `${text.slice(0, span.start)}${text.slice(span.end)}`.replace(/\n{3,}/g, '\n\n').trim()
  return { name: span.call.name, argumentsText: JSON.stringify(args), prose }
}

/**
 * Hold one provider reply, then either forward it or replace one accepted
 * text call with a tool-call block. Reasoning blocks stay. The finish reason
 * becomes `tool-calls` and provider replay state is omitted, because the
 * provider did not emit the call.
 * @param chunks - harness chunks for one assistant turn.
 * @param tools - tools advertised on that request.
 * @returns the original chunks, or the promoted replacement.
 */
export async function* promoteTextToolCallStream(
  chunks: AsyncIterable<StreamChunk>,
  tools: readonly ToolSchema[] | undefined,
): AsyncGenerator<StreamChunk> {
  const buffered: StreamChunk[] = []
  for await (const chunk of chunks) buffered.push(chunk)
  if (tools === undefined || tools.length === 0) {
    yield* buffered
    return
  }
  const promoted = promotedChunks(buffered, tools)
  yield* promoted ?? buffered
}

function promotedChunks(chunks: readonly StreamChunk[], tools: readonly ToolSchema[]): StreamChunk[] | undefined {
  if (chunks.some(chunk => chunk.type === 'block-start' && chunk.blockType === 'tool-call')) return undefined
  if (chunks.some(chunk => chunk.type === 'block-end' && chunk.block.type === 'tool-call')) return undefined
  const finish = lastFinish(chunks)
  if (finish?.type !== 'finish' || finish.reason.kind !== 'stop') return undefined
  const text = chunks.flatMap(chunk => (
    chunk.type === 'block-end' && chunk.block.type === 'text' ? [chunk.block.text] : []
  )).join('')
  const extracted = extractTextToolCall(text, tools)
  if (extracted === undefined) return undefined

  const rewritten: StreamChunk[] = []
  let index = 0
  for (const chunk of chunks) {
    if (chunk.type !== 'block-end' || chunk.block.type !== 'reasoning') continue
    rewritten.push(...reasoningChunks(index, chunk.block.text))
    index += 1
  }
  if (extracted.prose.length > 0) {
    rewritten.push(...textChunks(index, extracted.prose))
    index += 1
  }
  const id = ToolCallId(`call_${randomUUID()}`)
  rewritten.push(...toolChunks(index, id, extracted.name, extracted.argumentsText))
  for (const chunk of chunks) {
    if (chunk.type === 'usage') rewritten.push(chunk)
  }
  rewritten.push({ type: 'finish', reason: { kind: 'tool-calls' } })
  return rewritten
}

function lastFinish(chunks: readonly StreamChunk[]): Extract<StreamChunk, { type: 'finish' }> | undefined {
  for (let i = chunks.length - 1; i >= 0; i--) {
    const chunk = chunks[i]
    if (chunk?.type === 'finish') return chunk
  }
  return undefined
}

function fencedCalls(text: string): CallSpan[] {
  const spans: CallSpan[] = []
  const pattern = /```(?:json)?\s*([\s\S]*?)```/g
  for (const match of text.matchAll(pattern)) {
    const body = match[1]
    if (body === undefined || match.index === undefined) continue
    const call = parseCall(body.trim())
    if (call === undefined) continue
    spans.push({ start: match.index, end: match.index + match[0].length, call })
  }
  return spans
}

function bareCalls(text: string, occupied: readonly (readonly [number, number])[]): CallSpan[] {
  const spans: CallSpan[] = []
  let inString = false
  let escape = false
  for (let i = 0; i < text.length; i++) {
    const cover = occupied.find(([start, end]) => i >= start && i < end)
    if (cover !== undefined) {
      i = cover[1] - 1
      inString = false
      escape = false
      continue
    }
    const ch = text[i]
    if (inString) {
      if (escape) escape = false
      else if (ch === '\\') escape = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch !== '{') continue
    const end = matchBrace(text, i)
    if (end === undefined) continue
    const call = parseCall(text.slice(i, end))
    if (call !== undefined) spans.push({ start: i, end, call })
    i = end - 1
  }
  return spans
}

function parseCall(source: string): ParsedCall | undefined {
  let value: unknown
  try {
    value = JSON.parse(source)
  } catch (syntaxError: unknown) {
    // A non-JSON span is not a tool call.
    if (!(syntaxError instanceof SyntaxError)) throw syntaxError
    return undefined
  }
  if (!isRecord(value)) return undefined
  const name = toolName(value)
  if (name === undefined) return undefined
  if (!Object.hasOwn(value, 'arguments')) return undefined
  let args: unknown = value.arguments
  if (typeof args === 'string') {
    try {
      args = JSON.parse(args)
    } catch (syntaxError: unknown) {
      // A non-JSON arguments string is not a tool call.
      if (!(syntaxError instanceof SyntaxError)) throw syntaxError
      return undefined
    }
  }
  if (!isRecord(args)) return undefined
  return { name, arguments: args, argumentsText: JSON.stringify(args) }
}

/** `name` wins. A string `function` is the name only when `name` is absent. */
function toolName(value: Record<string, unknown>): string | undefined {
  if (typeof value.name === 'string' && value.name.length > 0) return value.name
  if (typeof value.function === 'string' && value.function.length > 0) return value.function
  return undefined
}

function matchBrace(text: string, open: number): number | undefined {
  let depth = 0
  let inString = false
  let escape = false
  for (let i = open; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escape) escape = false
      else if (ch === '\\') escape = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) return i + 1
    }
  }
  return undefined
}

function argumentsMatchSchema(schema: unknown, args: Record<string, unknown>): boolean {
  if (!isRecord(schema) || schema.type !== 'object' || hasUnsupportedSchema(schema)) return false
  const properties = isRecord(schema.properties) ? schema.properties : undefined
  if (properties === undefined) return false
  const required = Array.isArray(schema.required)
    ? schema.required.filter((key): key is string => typeof key === 'string')
    : []
  for (const key of required) {
    if (!Object.hasOwn(args, key)) return false
  }
  for (const [key, value] of Object.entries(args)) {
    const property = properties[key]
    if (property === undefined) {
      if (schema.additionalProperties === false) return false
      continue
    }
    if (!valueMatches(property, value)) return false
  }
  return true
}

function valueMatches(schema: unknown, value: unknown): boolean {
  if (!isRecord(schema) || hasUnsupportedSchema(schema)) return false
  if (Array.isArray(schema.enum) && !schema.enum.some(item => Object.is(item, value))) return false
  switch (schema.type) {
    case 'string': return typeof value === 'string'
    case 'boolean': return typeof value === 'boolean'
    case 'number': return typeof value === 'number' && Number.isFinite(value)
    case 'integer': return typeof value === 'number' && Number.isInteger(value)
    case 'null': return value === null
    case 'array':
      return Array.isArray(value)
        && (schema.items === undefined || value.every(item => valueMatches(schema.items, item)))
    case 'object': return isRecord(value) && argumentsMatchSchema(schema, value)
    case undefined: return Array.isArray(schema.enum)
    default: return false
  }
}

function hasUnsupportedSchema(schema: Record<string, unknown>): boolean {
  return UNSUPPORTED_SCHEMA_KEYS.some(key => Object.hasOwn(schema, key))
}

const ESCALATION_MODES = ['workspace-write', 'danger-full-access'] as const

/**
 * Drop an escalation pair that cannot be approved.
 * A justification without a real `sandbox_permissions` value, or a permission
 * without a non-empty justification, is not an escalation. Leaving those
 * fields on the call makes the file tool reject the write.
 */
function withoutStrayEscalation(args: Record<string, unknown>): Record<string, unknown> {
  const permissions = args.sandbox_permissions
  const justification = args.justification
  const paired = typeof permissions === 'string'
    && ESCALATION_MODES.some(mode => mode === permissions)
    && typeof justification === 'string'
    && justification.trim().length > 0
  if (paired) return args
  if (!Object.hasOwn(args, 'sandbox_permissions') && !Object.hasOwn(args, 'justification')) return args
  const cleaned: Record<string, unknown> = { ...args }
  delete cleaned.sandbox_permissions
  delete cleaned.justification
  return cleaned
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function textChunks(index: number, text: string): StreamChunk[] {
  return [
    { type: 'block-start', index, blockType: 'text' },
    { type: 'text-delta', index, text },
    { type: 'block-end', index, block: { type: 'text', text } },
  ]
}

function reasoningChunks(index: number, text: string): StreamChunk[] {
  return [
    { type: 'block-start', index, blockType: 'reasoning' },
    { type: 'reasoning-delta', index, text },
    { type: 'block-end', index, block: { type: 'reasoning', text } },
  ]
}

function toolChunks(index: number, id: ToolCallId, name: string, argumentsText: string): StreamChunk[] {
  return [
    { type: 'block-start', index, blockType: 'tool-call' },
    { type: 'tool-call-delta', index, id, name, argumentsDelta: argumentsText },
    {
      type: 'block-end',
      index,
      block: { type: 'tool-call', id, name, arguments: argumentsText },
    },
  ]
}
