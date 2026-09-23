import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { runLoaderSmoke } from '@deepseek-ai/dsh-loader-smoke'

it.each(['src', 'lib'] as const)('executes local write, read, edit and read through the %s CLI and real Loader', async (mode) => {
  const patch = fileURLToPath(new URL('./fixtures/local-files/profile.patch.yml', import.meta.url))
  const fileMode = fileURLToPath(new URL('../../../local-files.patch.yml', import.meta.url))
  const result = await runLoaderSmoke({
    label: 'local file round trip',
    tempDirPrefix: 'dsh-local-files-',
    binScript: fileURLToPath(new URL('../src/bin.ts', import.meta.url)),
    configPath: patch,
    binArgs: ['headless', '--patch', patch, '--patch', fileMode, 'Verify local file operations.'],
    tsconfigPath: fileURLToPath(new URL('../../../tsconfig.json', import.meta.url)),
    mode,
    env: { DSH_PERMISSION_MODE: 'workspace-write', DSH_TELEMETRY_DISABLED: '1' },
    inspect: async cwd => {
      expect(await readFile(join(cwd, 'file-test.txt'), 'utf8')).toBe('status: final\n')
    },
  })
  expect(result.stdout).toContain('status: final')
  expect(result.stdout).not.toContain('"isError":true')
}, 60000)

it.skipIf(process.env.DSH_TEST_LOCAL_OLLAMA !== '1')('uses local Ollama to create, read and edit a file', async () => {
  let fileContent: string | undefined
  const patch = fileURLToPath(new URL('./fixtures/local-files/ollama.patch.yml', import.meta.url))
  const fileMode = fileURLToPath(new URL('../../../local-files.patch.yml', import.meta.url))
  const result = await runLoaderSmoke({
    label: 'Ollama local file round trip',
    tempDirPrefix: 'dsh-ollama-files-',
    binScript: fileURLToPath(new URL('../src/bin.ts', import.meta.url)),
    configPath: patch,
    binArgs: ['headless', '--patch', patch, '--patch', fileMode, '--json',
      'Use the write tool to create file-test.txt in the current workspace containing exactly status: draft followed by a newline. Then use read to inspect it. Then use edit to replace draft with final. Then read it again and report the contents. Do not just show code: perform the file operations.'],
    tsconfigPath: fileURLToPath(new URL('../../../tsconfig.json', import.meta.url)),
    mode: 'src',
    processTimeoutMs: 180000,
    env: { DSH_PERMISSION_MODE: 'workspace-write', DSH_TELEMETRY_DISABLED: '1' },
    inspect: async cwd => {
      fileContent = await readFile(join(cwd, 'file-test.txt'), 'utf8').catch(error => {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
        throw error
      })
    },
  })
  expect(result.stdout).toContain('status: final')
  expect(fileContent?.trim(), result.stdout).toBe('status: final')
  const events = result.stdout.trim().split('\n').map(line => JSON.parse(line) as { type: string; tool?: string; status?: string })
  expect(events.filter(event => event.type === 'tool_call').map(event => event.tool))
    .toEqual(expect.arrayContaining(['write', 'read', 'edit']))
  expect(events.filter(event => event.type === 'tool_result').every(event => event.status === 'completed')).toBe(true)
}, 200000)
