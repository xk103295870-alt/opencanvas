import { ItemView, Plugin, addIcon, type WorkspaceLeaf } from 'obsidian'
import { createRoot, type Root } from 'react-dom/client'
import App from './App'
import './index.css'
import './obsidian.css'

const VIEW_TYPE_CANVAS_WORKBENCH = 'canvas-workbench-view'
const CANVAS_WORKBENCH_ICON = 'canvas-workbench-logo'
const CANVAS_WORKBENCH_ICON_SVG = '<svg viewBox="0 0 256 256" width="100" height="100" preserveAspectRatio="xMidYMid meet"><rect x="18" y="18" width="220" height="220" rx="42" fill="currentColor"/><path d="M62 77H86.5L100.5 163H102.5L116.5 103H140L154 163H156L170 77H194.5L171.5 179H139.5L128.5 128.5H127.5L116.5 179H84.5L62 77Z" fill="var(--background-primary, #050505)"/></svg>'

type StartLocalApiInput = {
  apiBaseUrl: string
}

type LocalApiHealthInput = {
  apiBaseUrl: string
}

type NodeRequire = (id: string) => unknown

declare const require: NodeRequire | undefined

declare const process: {
  env: Record<string, string | undefined>
  execPath: string
}

function portFromApiBaseUrl(apiBaseUrl: string) {
  try {
    const url = new URL(apiBaseUrl)
    return url.port || '8787'
  } catch {
    return '8787'
  }
}

function spawnDetached(command: string, args: string[], cwd?: string) {
  if (typeof require !== 'function') {
    throw new Error('Node require is unavailable in this Obsidian runtime.')
  }
  const { spawn } = require('child_process') as {
    spawn: (
      command: string,
      args: string[],
      options: { detached: boolean; stdio: 'ignore'; env: Record<string, string | undefined>; cwd?: string },
    ) => { pid?: number; unref: () => void }
  }
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    cwd,
    env: {
      ...process.env,
      PATH: [
        process.env.PATH,
        '/opt/homebrew/bin',
        '/usr/local/bin',
        '/usr/bin',
        '/bin',
        '/usr/sbin',
        '/sbin',
      ]
        .filter(Boolean)
        .join(':'),
      FORCE_COLOR: '0',
    },
  })
  child.unref()
  return child.pid
}

function fileExists(filePath: string) {
  if (typeof require !== 'function') return false
  const { existsSync } = require('fs') as { existsSync: (path: string) => boolean }
  return existsSync(filePath)
}

async function checkLocalApiHealthFromObsidian(input: LocalApiHealthInput) {
  if (typeof require !== 'function') {
    return { ok: false, message: 'Node require is unavailable in this Obsidian runtime.' }
  }

  const url = `${input.apiBaseUrl.replace(/\/$/, '')}/health`
  return new Promise<{ ok: boolean; version?: string; apiBaseUrl?: string; message?: string }>((resolve) => {
    const { get } = require(url.startsWith('https:') ? 'https' : 'http') as {
      get: (
        url: string,
        callback: (response: {
          statusCode?: number
          setEncoding: (encoding: string) => void
          on: (event: 'data' | 'end', callback: (chunk?: string) => void) => void
          resume: () => void
        }) => void,
      ) => { on: (event: 'error' | 'timeout', callback: (error?: Error) => void) => void; setTimeout: (ms: number, callback: () => void) => void; destroy: () => void }
    }
    const request = get(url, (response) => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => {
        body += chunk || ''
      })
      response.on('end', () => {
        if ((response.statusCode || 0) < 200 || (response.statusCode || 0) >= 300) {
          resolve({ ok: false, message: `Health check failed: ${response.statusCode || 'unknown'}` })
          return
        }
        try {
          const payload = JSON.parse(body) as { ok?: boolean; version?: string; apiBaseUrl?: string; message?: string }
          resolve({ ok: payload.ok !== false, version: payload.version, apiBaseUrl: payload.apiBaseUrl, message: payload.message })
        } catch {
          resolve({ ok: false, message: 'Health response is not valid JSON.' })
        }
      })
      response.resume()
    })
    request.setTimeout(1800, () => {
      request.destroy()
      resolve({ ok: false, message: 'API health check timeout' })
    })
    request.on('error', (error) => {
      resolve({ ok: false, message: error?.message || 'API health check failed' })
    })
  })
}

async function startLocalApiFromObsidian(input: StartLocalApiInput) {
  const apiPort = portFromApiBaseUrl(input.apiBaseUrl)
  const cliArgs = ['start', '--no-open', '--api-port', apiPort]

  try {
    const pid = spawnDetached('canvas-workbench', cliArgs)
    return { ok: true, pid, message: `Local API start requested on port ${apiPort}.` }
  } catch {
    const fallbackCliPath = '/Users/xk/vs开发文件/Canvas-Workbench/bin/canvas-workbench.mjs'
    if (!fileExists(fallbackCliPath)) {
      return { ok: false, message: 'canvas-workbench command not found and fallback CLI path is unavailable.' }
    }

    const pid = spawnDetached(process.execPath, [fallbackCliPath, ...cliArgs], '/Users/xk/vs开发文件/Canvas-Workbench')
    return { ok: true, pid, message: `Local API start requested on port ${apiPort}.` }
  }
}

class CanvasWorkbenchView extends ItemView {
  private root: Root | null = null

  constructor(leaf: WorkspaceLeaf) {
    super(leaf)
  }

  getViewType() {
    return VIEW_TYPE_CANVAS_WORKBENCH
  }

  getDisplayText() {
    return 'Canvas Workbench'
  }

  getIcon() {
    return CANVAS_WORKBENCH_ICON
  }

  async onOpen() {
    const container = this.containerEl.children[1]
    container.empty()
    container.addClass('canvas-workbench-obsidian-view')

    const mountEl = container.createDiv({ cls: 'canvas-workbench-obsidian-root' })
    this.root = createRoot(mountEl)
    this.root.render(
      <App
        runtime="obsidian"
        onStartLocalApi={startLocalApiFromObsidian}
        onCheckLocalApiHealth={checkLocalApiHealthFromObsidian}
      />,
    )
  }

  async onClose() {
    this.root?.unmount()
    this.root = null
  }
}

export default class CanvasWorkbenchPlugin extends Plugin {
  async onload() {
    addIcon(CANVAS_WORKBENCH_ICON, CANVAS_WORKBENCH_ICON_SVG)
    this.registerView(VIEW_TYPE_CANVAS_WORKBENCH, (leaf) => new CanvasWorkbenchView(leaf))

    this.addRibbonIcon(CANVAS_WORKBENCH_ICON, 'Canvas Workbench', () => {
      void this.activateView()
    })

    this.addCommand({
      id: 'canvas-workbench',
      name: 'Canvas Workbench',
      callback: () => {
        void this.activateView()
      },
    })
  }

  async onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_CANVAS_WORKBENCH)
  }

  private async activateView() {
    const existingLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CANVAS_WORKBENCH)
    if (existingLeaves.length > 0) {
      this.app.workspace.revealLeaf(existingLeaves[0])
      return
    }

    const leaf = this.app.workspace.getLeaf(true)
    await leaf.setViewState({ type: VIEW_TYPE_CANVAS_WORKBENCH, active: true })
    this.app.workspace.revealLeaf(leaf)
  }
}
