import { describe, expect, it } from 'vitest'
import { BlockAssembler, ToolCallId } from '@deepseek-ai/dsh-llm'
import type { StreamChunk, ToolSchema } from '@deepseek-ai/dsh-llm'
import { extractTextToolCall, promoteTextToolCallStream } from '../src/text-tool-call.ts'

const writeTool: ToolSchema = {
  name: 'write',
  description: 'Create or fully replace a UTF-8 text file.',
  parameters: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: 'Path to write.' },
      content: { type: 'string', description: 'Full UTF-8 text content to write.' },
    },
    required: ['file_path', 'content'],
  },
}

const readTool: ToolSchema = {
  name: 'read',
  description: 'Read a UTF-8 text file.',
  parameters: {
    type: 'object',
    properties: { file_path: { type: 'string' } },
    required: ['file_path'],
  },
}

const captured = `{
  "name": "write",
  "arguments": {
    "file_path": "hello.py",
    "content": "print('hello')"
  }
}

After the file is written, I'll read it back for you.`

function textTurn(text: string, finish: StreamChunk = { type: 'finish', reason: { kind: 'stop' }, replayState: { response: { kind: 'test' } } }): StreamChunk[] {
  return [
    { type: 'block-start', index: 0, blockType: 'text' },
    { type: 'text-delta', index: 0, text },
    { type: 'block-end', index: 0, block: { type: 'text', text } },
    { type: 'usage', usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 } },
    finish,
  ]
}

async function collect(chunks: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> {
  const out: StreamChunk[] = []
  for await (const chunk of chunks) out.push(chunk)
  return out
}

async function* once(chunks: readonly StreamChunk[]): AsyncGenerator<StreamChunk> {
  yield* chunks
}

describe('extractTextToolCall', () => {
  it('accepts the captured bare write and keeps the following sentence', () => {
    expect(extractTextToolCall(captured, [writeTool, readTool])).toEqual({
      name: 'write',
      argumentsText: JSON.stringify({ file_path: 'hello.py', content: "print('hello')" }),
      prose: "After the file is written, I'll read it back for you.",
    })
  })

  it('accepts one fenced call and a string arguments payload', () => {
    const text = '```json\n{ "name": "read", "arguments": "{\\"file_path\\":\\"hello.py\\"}" }\n```'
    expect(extractTextToolCall(text, [readTool])?.name).toBe('read')
    expect(extractTextToolCall(text, [readTool])?.argumentsText).toBe(JSON.stringify({ file_path: 'hello.py' }))
    expect(extractTextToolCall(text, [readTool])?.prose).toBe('')
  })

  it('accepts a string function field when name is absent', () => {
    const text = '```json\n{ "function": "write", "arguments": { "file_path": "hello.py", "content": "print(\'hello\')" } }\n```'
    expect(extractTextToolCall(text, [writeTool])).toEqual({
      name: 'write',
      argumentsText: JSON.stringify({ file_path: 'hello.py', content: "print('hello')" }),
      prose: '',
    })
    expect(extractTextToolCall('{ "name": "read", "function": "write", "arguments": { "file_path": "hello.py" } }', [readTool, writeTool])?.name).toBe('read')
  })

  it('drops an unpaired justification so the write arguments stay executable', () => {
    const escalating: ToolSchema = {
      ...writeTool,
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string' },
          content: { type: 'string' },
          sandbox_permissions: { type: 'string', enum: ['workspace-write', 'danger-full-access'] },
          justification: { type: 'string' },
        },
        required: ['file_path', 'content'],
      },
    }
    const orphan = '{ "name": "write", "arguments": { "file_path": "hello.py", "content": "print(\'hello\')", "justification": "Creating hello.py." } }'
    expect(extractTextToolCall(orphan, [escalating])?.argumentsText).toBe(
      JSON.stringify({ file_path: 'hello.py', content: "print('hello')" }),
    )
    const blank = '{ "name": "write", "arguments": { "file_path": "hello.py", "content": "print(\'hello\')", "justification": "", "sandbox_permissions": "" } }'
    expect(extractTextToolCall(blank, [escalating])?.argumentsText).toBe(
      JSON.stringify({ file_path: 'hello.py', content: "print('hello')" }),
    )
    const paired = '{ "name": "write", "arguments": { "file_path": "hello.py", "content": "print(\'hello\')", "sandbox_permissions": "danger-full-access", "justification": "The file is outside the workspace." } }'
    expect(extractTextToolCall(paired, [escalating])?.argumentsText).toBe(JSON.stringify({
      file_path: 'hello.py',
      content: "print('hello')",
      sandbox_permissions: 'danger-full-access',
      justification: 'The file is outside the workspace.',
    }))
  })

  it('leaves two calls, an unknown name, and schema mismatches as text', () => {
    const two = `${captured}\n{"name":"read","arguments":{"file_path":"hello.py"}}`
    expect(extractTextToolCall(two, [writeTool, readTool])).toBeUndefined()
    expect(extractTextToolCall('{ "name": "bash", "arguments": {} }', [writeTool])).toBeUndefined()
    expect(extractTextToolCall('{ "name": "write", "arguments": { "file_path": "hello.py" } }', [writeTool])).toBeUndefined()
    expect(extractTextToolCall('{ "name": "write", "arguments": { "file_path": 1, "content": "x" } }', [writeTool])).toBeUndefined()
    const closed: ToolSchema = {
      ...writeTool,
      parameters: { ...writeTool.parameters, additionalProperties: false },
    }
    expect(extractTextToolCall(
      '{ "name": "write", "arguments": { "file_path": "a", "content": "b", "extra": true } }',
      [closed],
    )).toBeUndefined()
    const union: ToolSchema = {
      ...writeTool,
      parameters: { oneOf: [{ type: 'object', properties: {}, required: [] }] },
    }
    expect(extractTextToolCall(
      '{ "name": "write", "arguments": { "file_path": "a", "content": "b" } }',
      [union],
    )).toBeUndefined()
    expect(extractTextToolCall('I will create hello.py.', [writeTool])).toBeUndefined()
  })
})

describe('promoteTextToolCallStream', () => {
  it('replaces one text call with a tool call and drops provider replay', async () => {
    const chunks = await collect(promoteTextToolCallStream(once(textTurn(captured)), [writeTool]))
    const assembler = new BlockAssembler()
    for (const chunk of chunks) assembler.push(chunk)
    const blocks = assembler.blocks()
    expect(blocks.map(block => block.type)).toEqual(['text', 'tool-call'])
    expect(blocks[0]).toEqual({ type: 'text', text: "After the file is written, I'll read it back for you." })
    expect(blocks[1]).toMatchObject({
      type: 'tool-call',
      name: 'write',
      arguments: JSON.stringify({ file_path: 'hello.py', content: "print('hello')" }),
    })
    expect(assembler.finish).toEqual({ kind: 'tool-calls' })
    expect(assembler.replayState).toBeUndefined()
    const call = blocks[1]
    if (call?.type !== 'tool-call') throw new Error('expected a tool call')
    expect(ToolCallId(call.id)).toBe(call.id)
  })

  it('forwards a provider tool call and an ordinary answer unchanged', async () => {
    const toolCall: StreamChunk[] = [
      { type: 'block-start', index: 0, blockType: 'tool-call' },
      {
        type: 'block-end',
        index: 0,
        block: { type: 'tool-call', id: ToolCallId('call-1'), name: 'write', arguments: '{}' },
      },
      { type: 'finish', reason: { kind: 'tool-calls' } },
    ]
    const answer = textTurn('hello.py is a Python file.')
    expect(await collect(promoteTextToolCallStream(once(toolCall), [writeTool]))).toEqual(toolCall)
    expect(await collect(promoteTextToolCallStream(once(answer), [writeTool]))).toEqual(answer)
    expect(await collect(promoteTextToolCallStream(once(textTurn(captured)), undefined))).toEqual(textTurn(captured))
  })

  it('keeps reasoning and still promotes the text call', async () => {
    const chunks = await collect(promoteTextToolCallStream(once([
      { type: 'block-start', index: 0, blockType: 'reasoning' },
      { type: 'reasoning-delta', index: 0, text: 'need write' },
      { type: 'block-end', index: 0, block: { type: 'reasoning', text: 'need write' } },
      ...textTurn(captured).map(chunk => chunk.type === 'block-start' || chunk.type === 'text-delta' || (chunk.type === 'block-end' && chunk.block.type === 'text')
        ? { ...chunk, index: 1 } as StreamChunk
        : chunk),
    ]), [writeTool]))
    const assembler = new BlockAssembler()
    for (const chunk of chunks) assembler.push(chunk)
    expect(assembler.blocks().map(block => block.type)).toEqual(['reasoning', 'text', 'tool-call'])
  })
})
