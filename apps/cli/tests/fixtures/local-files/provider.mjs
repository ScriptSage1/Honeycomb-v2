import { LlmAdapter, ToolCallId } from '@deepseek-ai/dsh-llm'
import { TOOL_RUNTIME_SCHEDULER } from '@deepseek-ai/dsh-tools'

class FileTestAdapter extends LlmAdapter {
  async *stream(options) {
    const names = (options.tools ?? []).map(tool => tool.name).sort()
    if (JSON.stringify(names) !== JSON.stringify(['edit', 'read', 'write'])) throw new Error('Unexpected tools: ' + names.join(', '))
    const results = options.messages.flatMap(message => message.content.filter(block => block.type === 'tool-result'))
    if (results.some(result => result.isError)) throw new Error(JSON.stringify(results))
    const calls = [
      ['write', { file_path: 'file-test.txt', content: 'status: draft\n' }],
      ['read', { file_path: 'file-test.txt' }],
      ['edit', { file_path: 'file-test.txt', old_string: 'draft', new_string: 'final' }],
      ['read', { file_path: 'file-test.txt' }],
    ]
    const call = calls[results.length]
    if (call) {
      const [name, args] = call
      const id = ToolCallId(`file-${results.length}`)
      const argumentsText = JSON.stringify(args)
      yield { type: 'block-start', index: 0, blockType: 'tool-call' }
      yield { type: 'tool-call-delta', index: 0, id, name, argumentsDelta: argumentsText }
      yield { type: 'block-end', index: 0, block: { type: 'tool-call', id, name, arguments: argumentsText } }
      yield { type: 'finish', reason: { kind: 'tool-calls' } }
    } else {
      const text = JSON.stringify(results)
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'text-delta', index: 0, text }
      yield { type: 'block-end', index: 0, block: { type: 'text', text } }
      yield { type: 'finish', reason: { kind: 'stop' } }
    }
  }
}
export const name = 'local-files-test-provider'
export const inject = ['llm', 'tools']
export function apply(ctx) {
  if (!ctx.tools[TOOL_RUNTIME_SCHEDULER]) {
    throw new Error('Scheduler identity mismatch: ' + Object.getOwnPropertySymbols(ctx.tools).map(String).join(', '))
  }
  ctx.llm.registerAdapter(['file-test'], new FileTestAdapter())
}
