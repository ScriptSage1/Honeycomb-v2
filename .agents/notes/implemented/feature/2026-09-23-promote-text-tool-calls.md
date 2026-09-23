# Agent Note: Promote text tool calls

Status: implemented

English | [中文](2026-09-23-promote-text-tool-calls.zh.md)

## Problem

A local model can answer a file request by printing `{ name, arguments }` in the assistant text and then describing the file as created. The loop executes only a tool-call block, so that reply creates nothing.

## Decision

`promoteTextToolCalls` on a `dsh-llm-pi-ai` provider route holds the finished reply and, when it contains no provider tool call, promotes exactly one `{ name, arguments }` object into a harness tool call. The object may be bare or inside one fenced block, and `arguments` may be an object or a JSON string. A string `function` field is the tool name when `name` is absent. `name` must be a tool on that request, and `arguments` must match that tool's schema. A justification without a real `sandbox_permissions` value, and a permission without a justification, are removed before that check; a complete pair is kept. The object is removed from the text, reasoning blocks stay, the finish reason is `tool-calls`, and provider replay state is omitted for that turn. Zero matches, several matches, an unknown name, arguments outside the schema, or a schema using `oneOf`, `anyOf`, `allOf`, `$ref`, `not`, or `patternProperties` leave the reply unchanged. The switch defaults off.

## Alternatives considered

- **Prompt instructions alone.** The system prompt already tells the model to call the tool and wait for a result. `qwen2.5-coder:7b` still printed the call as text and reported success.
- **Promote every JSON object in the reply.** A reply that shows an example, or that contains two calls, would execute something the model did not uniquely ask for.
- **Change the agent loop.** The adapter already owns the provider reply. Promoting before the loop sees the chunks keeps sandbox, approval, and tool execution on the existing path.

## Consequences

A route that enables the switch does not stream token deltas; the reply is emitted after the provider finishes. A promoted call is a normal tool call, so workspace permissions and argument checks in the tool still apply. The next request converts that turn from its content because the provider replay state no longer matches. Routes that leave the switch off are unchanged.
