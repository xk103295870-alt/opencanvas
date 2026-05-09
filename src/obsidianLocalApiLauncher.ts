export type StartLocalApiInput = {
  apiBaseUrl: string
}

export type SpawnDetached = (
  command: string,
  args: string[],
  cwd?: string,
  env?: Record<string, string | undefined>,
) => number | undefined

export function portFromApiBaseUrl(apiBaseUrl: string) {
  try {
    const url = new URL(apiBaseUrl)
    return url.port || '8799'
  } catch {
    return '8799'
  }
}

export async function startLocalApiFromObsidian(input: StartLocalApiInput, spawnDetached: SpawnDetached) {
  const apiPort = portFromApiBaseUrl(input.apiBaseUrl)
  const apiBaseUrl = `http://127.0.0.1:${apiPort}`
  const env = {
    CANVAS_WORKBENCH_API_HOST: '127.0.0.1',
    CANVAS_WORKBENCH_API_PORT: apiPort,
    CANVAS_WORKBENCH_API_BASE_URL: apiBaseUrl,
    CANVAS_WORKBENCH_WEB_ORIGIN: 'app://obsidian.md',
  }
  const cliArgs = ['start', '--no-open', '--api-only', '--api-port', apiPort]

  try {
    const pid = spawnDetached('canvas-workbench', cliArgs, undefined, env)
    if (!pid) {
      return { ok: false, message: 'canvas-workbench command not found. Install the Canvas Workbench CLI or start Local API manually.' }
    }
    return { ok: true, pid, message: `Local API start requested on port ${apiPort}.` }
  } catch {
    return { ok: false, message: 'canvas-workbench command not found. Install the Canvas Workbench CLI or start Local API manually.' }
  }
}
