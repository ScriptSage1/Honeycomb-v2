/** Local file mode: preserve workspace permissions and restrict the tool set. */
export const name = 'local-files-only'
export const inject = ['tools', 'agents', 'systemPrompt']
export function apply(ctx) {
  ctx.systemPrompt.section({
    name: 'local-file-operations',
    order: ctx.systemPrompt.getSectionOrder('TOOL_WRITE'),
    text: 'Use read, write, and edit to perform local file tasks. Relative file paths resolve inside the current workspace. These tools operate on files, not directory listings. When asked to create or modify a file, call the appropriate tool in the same response rather than stopping after announcing your plan. Read an existing file before replacing or editing it. After a change, read the file back to verify it. Only report completion after successful tool results.',
  })
  ctx.on('agent/created', ({ agent }) => {
    agent.ctx.tools.restrict({ allow: ['read', 'write', 'edit'] })
  })
}
