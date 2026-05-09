import assert from 'node:assert/strict'
import { test } from 'node:test'
import { startLocalApiFromObsidian } from './obsidianLocalApiLauncher.ts'

test('starts Local API through the portable canvas-workbench CLI command', async () => {
  const calls: Array<{
    command: string
    args: string[]
    cwd?: string
    env?: Record<string, string | undefined>
  }> = []
  const result = await startLocalApiFromObsidian({ apiBaseUrl: 'http://127.0.0.1:8799' }, (command, args, cwd, env) => {
    calls.push({ command, args, cwd, env })
    return 1234
  })

  assert.equal(result.ok, true)
  assert.equal(result.pid, 1234)
  assert.deepEqual(calls, [
    {
      command: 'canvas-workbench',
      args: ['start', '--no-open', '--api-only', '--api-port', '8799'],
      cwd: undefined,
      env: {
        CANVAS_WORKBENCH_API_HOST: '127.0.0.1',
        CANVAS_WORKBENCH_API_PORT: '8799',
        CANVAS_WORKBENCH_API_BASE_URL: 'http://127.0.0.1:8799',
        CANVAS_WORKBENCH_WEB_ORIGIN: 'app://obsidian.md',
      },
    },
  ])
})

test('reports missing CLI when the launcher cannot start a process', async () => {
  const result = await startLocalApiFromObsidian({ apiBaseUrl: 'http://127.0.0.1:8799' }, () => undefined)

  assert.equal(result.ok, false)
  assert.match(result.message, /canvas-workbench command not found/i)
})

test('reports missing CLI instead of falling back to a developer machine path', async () => {
  const result = await startLocalApiFromObsidian({ apiBaseUrl: 'http://127.0.0.1:8799' }, () => {
    throw new Error('ENOENT')
  })

  assert.equal(result.ok, false)
  assert.match(result.message, /canvas-workbench command not found/i)
})
