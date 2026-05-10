#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..')
const RUNTIME_DIR = path.join(REPO_ROOT, '.runtime')
const DEFAULT_WEB_HOST = '127.0.0.1'
const DEFAULT_WEB_PORT = 5173
const DEFAULT_API_HOST = '127.0.0.1'
const DEFAULT_API_PORT = 8799
const SCENE_WIDTH = 20_000_000
const SCENE_HEIGHT = 20_000_000
const CLI_CARD_DEFAULT_SIZES = {
  note: { width: 340, height: 280 },
  image: { width: 360, height: 280 },
  todo: { width: 760, height: 430 },
  calendar: { width: 480, height: 560 },
  eventFlow: { width: 760, height: 480 },
  dashboard: { width: 760, height: 480 },
}

function centeredCardPosition(kind) {
  const size = CLI_CARD_DEFAULT_SIZES[kind] || CLI_CARD_DEFAULT_SIZES.note
  return {
    x: SCENE_WIDTH / 2 - size.width / 2,
    y: SCENE_HEIGHT / 2 - size.height / 2,
    width: size.width,
    height: size.height,
  }
}

function usage() {
  console.log(`Canvas Workbench CLI

Usage:
  canvas-workbench start [--open] [--no-open] [--api-only] [--port <web-port>] [--api-port <api-port>]
  canvas-workbench stop [--port <web-port>] [--api-port <api-port>]
  canvas-workbench restart [--open] [--no-open] [--api-only] [--port <web-port>] [--api-port <api-port>]
  canvas-workbench status [--port <web-port>] [--api-port <api-port>]
  canvas-workbench update [--open] [--no-open] [--api-only] [--port <web-port>] [--api-port <api-port>]
  canvas-workbench grid list [--api-url <url>] [--api-key <key>]
  canvas-workbench grid add <name> [--api-url <url>] [--api-key <key>]
  canvas-workbench note add <content> [--title <title>] [--grid <grid-name-or-id>] [--api-url <url>] [--api-key <key>]
  canvas-workbench todo add <text> [--status todo|doing|done] [--tag event|feature|important|plan|bug|idea] [--grid <grid-name-or-id>] [--api-url <url>] [--api-key <key>]
  canvas-workbench calendar event add <title> [--date YYYY-MM-DD] [--time HH:MM] [--end HH:MM] [--all-day] [--grid <grid-name-or-id>] [--api-url <url>] [--api-key <key>]
  canvas-workbench flow add <title> [--grid <grid-name-or-id>] [--api-url <url>] [--api-key <key>]
  canvas-workbench dashboard add <title> [--option <file>|--stdin] [--data <file>] [--prompt <text>] [--generated-by <name>] [--grid <grid-name-or-id>] [--api-url <url>] [--api-key <key>]
  canvas-workbench image add <file> [--title <title>] [--grid <grid-name-or-id>] [--api-url <url>] [--api-key <key>]

Examples:
  canvas-workbench start
  canvas-workbench start --no-open
  canvas-workbench stop
  canvas-workbench status
  canvas-workbench update
  canvas-workbench grid list
  canvas-workbench grid add "B"
  canvas-workbench note add "Meeting summary" --title "Meeting" --grid "B"
  canvas-workbench todo add "Prepare homepage copy" --status doing --tag plan --grid "B"
  canvas-workbench calendar event add "Design review" --date 2026-05-01 --time 11:00 --end 12:00 --grid "B"
  canvas-workbench flow add "User onboarding flow" --grid "B"
  canvas-workbench dashboard add "销售看板" --option ./sales-option.json --prompt "根据自然语言生成销售趋势图" --generated-by claude-code --grid "AI区"
  cat sales-option.json | canvas-workbench dashboard add "销售看板" --stdin --prompt "生成渠道占比环形图" --generated-by claude-code --grid "AI区"
  canvas-workbench image add "./generated.png" --title "Generated concept" --grid "AI区"

Dashboard requirements for AI / agents:
  - Canvas Workbench does not require an AI API key for dashboard generation.
  - External AI/agents should turn natural language into JSON-only ECharts option objects.
  - Do not include JS functions, formatter callbacks, event handlers, or runtime code in option JSON.
  - If series exists, it must be an array; keep option JSON under 512 KiB.
  - Use --prompt to preserve the natural-language request and --generated-by to record the producer.
`)
}

function normalizePort(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback
  const port = Number.parseInt(String(value), 10)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid port: ${value}`)
  }
  return port
}

function normalizeApiUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) throw new Error('API URL cannot be empty')
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`
  try {
    const url = new URL(withProtocol)
    return url.href.replace(/\/$/, '')
  } catch {
    throw new Error(`Invalid API URL: ${value}`)
  }
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function todayDateKey(now = new Date()) {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

function monthKeyFromDateKey(dateKey) {
  return String(dateKey || '').slice(0, 7)
}

function uid(prefix = 'id') {
  const crypto = globalThis.crypto
  const randomId = crypto && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replaceAll('-', '').slice(0, 14)
    : Math.random().toString(16).slice(2, 16)
  return `${prefix}-${randomId}`
}

function normalizeTodoStatus(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'todo' || raw === 'doing' || raw === 'done') return raw
  throw new Error('Invalid todo status. Use one of: todo, doing, done')
}

function normalizeTodoTag(value) {
  const raw = String(value || '').trim().toLowerCase()
  const allowed = new Set(['event', 'feature', 'important', 'plan', 'bug', 'idea'])
  if (allowed.has(raw)) return raw
  throw new Error('Invalid todo tag. Use one of: event, feature, important, plan, bug, idea')
}

function normalizeDateKey(value) {
  const raw = String(value || '').trim()
  if (!raw) return todayDateKey()
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  throw new Error('Invalid date. Use YYYY-MM-DD')
}

function normalizeTimeValue(value, fieldName) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^\d{2}:\d{2}$/.test(raw)) return raw
  throw new Error(`Invalid ${fieldName}. Use HH:MM`)
}

function normalizeCalendarEventOptions(options) {
  const date = normalizeDateKey(options.date)
  const startTime = normalizeTimeValue(options.startTime, 'start time')
  const endTime = normalizeTimeValue(options.endTime, 'end time')
  const allDay = options.allDay === null ? !startTime && !endTime : Boolean(options.allDay)
  if (!allDay && (!startTime || !endTime)) {
    throw new Error('Timed calendar events require --time HH:MM and --end HH:MM')
  }
  return { date, allDay, startTime, endTime }
}

function inferImageMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase()
  if (extension === '.png') return 'image/png'
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  if (extension === '.webp') return 'image/webp'
  if (extension === '.gif') return 'image/gif'
  return null
}

function apiUrlFor(options) {
  return options.apiUrl || `http://${DEFAULT_API_HOST}:${options.apiPort}`
}

function parseArgs(argv) {
  const tokens = [...argv]
  const rawCommand = tokens.shift()
  let command = 'start'
  if (rawCommand === '--help' || rawCommand === '-h') {
    command = 'help'
  } else if (rawCommand === '--version' || rawCommand === '-v') {
    command = 'version'
  } else if (rawCommand === 'grid' && tokens[0] === 'list') {
    tokens.shift()
    command = 'grid:list'
  } else if (rawCommand === 'grid' && tokens[0] === 'add') {
    tokens.shift()
    command = 'grid:add'
  } else if (rawCommand === 'note' && tokens[0] === 'add') {
    tokens.shift()
    command = 'note:add'
  } else if (rawCommand === 'image' && tokens[0] === 'add') {
    tokens.shift()
    command = 'image:add'
  } else if (rawCommand === 'dashboard' && tokens[0] === 'add') {
    tokens.shift()
    command = 'dashboard:add'
  } else if (rawCommand === 'todo' && tokens[0] === 'add') {
    tokens.shift()
    command = 'todo:add'
  } else if (rawCommand === 'calendar' && tokens[0] === 'event' && tokens[1] === 'add') {
    tokens.shift()
    tokens.shift()
    command = 'calendar:event:add'
  } else if (rawCommand === 'flow' && tokens[0] === 'add') {
    tokens.shift()
    command = 'flow:add'
  } else if (rawCommand) {
    command = rawCommand
  }
  const options = {
    port: DEFAULT_WEB_PORT,
    apiPort: DEFAULT_API_PORT,
    open: true,
    apiOnly: false,
    apiUrl: null,
    apiKey: process.env.CANVAS_WORKBENCH_API_KEY || '',
    title: '',
    gridId: '',
    status: 'todo',
    tag: 'event',
    date: '',
    startTime: '',
    endTime: '',
    allDay: null,
    optionPath: '',
    readOptionFromStdin: false,
    sourceDataPath: '',
    prompt: '',
    generatedBy: '',
    contentParts: [],
  }

  while (tokens.length > 0) {
    const token = tokens.shift()
    if (!token) continue

    if (token === '-h' || token === '--help') {
      return { command: 'help', options }
    }
    if (token === '-v' || token === '--version') {
      return { command: 'version', options }
    }
    if (token === '--open') {
      options.open = true
      continue
    }
    if (token === '--no-open') {
      options.open = false
      continue
    }
    if (token === '--api-only') {
      options.apiOnly = true
      options.open = false
      continue
    }
    if (token === '--port') {
      options.port = normalizePort(tokens.shift(), DEFAULT_WEB_PORT)
      continue
    }
    if (token.startsWith('--port=')) {
      options.port = normalizePort(token.slice('--port='.length), DEFAULT_WEB_PORT)
      continue
    }
    if (token === '--api-port') {
      options.apiPort = normalizePort(tokens.shift(), DEFAULT_API_PORT)
      continue
    }
    if (token.startsWith('--api-port=')) {
      options.apiPort = normalizePort(token.slice('--api-port='.length), DEFAULT_API_PORT)
      continue
    }
    if (token === '--api-url') {
      options.apiUrl = normalizeApiUrl(tokens.shift())
      continue
    }
    if (token.startsWith('--api-url=')) {
      options.apiUrl = normalizeApiUrl(token.slice('--api-url='.length))
      continue
    }
    if (token === '--api-key') {
      options.apiKey = String(tokens.shift() || '')
      continue
    }
    if (token.startsWith('--api-key=')) {
      options.apiKey = token.slice('--api-key='.length)
      continue
    }
    if (token === '--title') {
      options.title = String(tokens.shift() || '')
      continue
    }
    if (token.startsWith('--title=')) {
      options.title = token.slice('--title='.length)
      continue
    }
    if (token === '--grid' || token === '--grid-id') {
      options.gridId = String(tokens.shift() || '')
      continue
    }
    if (token.startsWith('--grid=')) {
      options.gridId = token.slice('--grid='.length)
      continue
    }
    if (token.startsWith('--grid-id=')) {
      options.gridId = token.slice('--grid-id='.length)
      continue
    }
    if (token === '--status') {
      options.status = String(tokens.shift() || '')
      continue
    }
    if (token.startsWith('--status=')) {
      options.status = token.slice('--status='.length)
      continue
    }
    if (token === '--tag') {
      options.tag = String(tokens.shift() || '')
      continue
    }
    if (token.startsWith('--tag=')) {
      options.tag = token.slice('--tag='.length)
      continue
    }
    if (token === '--date') {
      options.date = String(tokens.shift() || '')
      continue
    }
    if (token.startsWith('--date=')) {
      options.date = token.slice('--date='.length)
      continue
    }
    if (token === '--time' || token === '--start' || token === '--start-time') {
      options.startTime = String(tokens.shift() || '')
      continue
    }
    if (token.startsWith('--time=')) {
      options.startTime = token.slice('--time='.length)
      continue
    }
    if (token.startsWith('--start=')) {
      options.startTime = token.slice('--start='.length)
      continue
    }
    if (token.startsWith('--start-time=')) {
      options.startTime = token.slice('--start-time='.length)
      continue
    }
    if (token === '--end' || token === '--end-time') {
      options.endTime = String(tokens.shift() || '')
      continue
    }
    if (token.startsWith('--end=')) {
      options.endTime = token.slice('--end='.length)
      continue
    }
    if (token.startsWith('--end-time=')) {
      options.endTime = token.slice('--end-time='.length)
      continue
    }
    if (token === '--all-day') {
      options.allDay = true
      continue
    }
    if (token === '--no-all-day') {
      options.allDay = false
      continue
    }
    if (token === '--option') {
      options.optionPath = String(tokens.shift() || '')
      continue
    }
    if (token.startsWith('--option=')) {
      options.optionPath = token.slice('--option='.length)
      continue
    }
    if (token === '--stdin') {
      options.readOptionFromStdin = true
      continue
    }
    if (token === '--data') {
      options.sourceDataPath = String(tokens.shift() || '')
      continue
    }
    if (token.startsWith('--data=')) {
      options.sourceDataPath = token.slice('--data='.length)
      continue
    }
    if (token === '--prompt') {
      options.prompt = String(tokens.shift() || '')
      continue
    }
    if (token.startsWith('--prompt=')) {
      options.prompt = token.slice('--prompt='.length)
      continue
    }
    if (token === '--generated-by') {
      options.generatedBy = String(tokens.shift() || '')
      continue
    }
    if (token.startsWith('--generated-by=')) {
      options.generatedBy = token.slice('--generated-by='.length)
      continue
    }

    if ((command === 'grid:add' || command === 'note:add' || command === 'image:add' || command === 'todo:add' || command === 'calendar:event:add' || command === 'dashboard:add') && !token.startsWith('-')) {
      options.contentParts.push(token)
      continue
    }

    throw new Error(`Unknown option: ${token}`)
  }

  return { command, options }
}

function ensureRuntimeDir() {
  fs.mkdirSync(RUNTIME_DIR, { recursive: true })
}

function pidFileFor(prefix, port) {
  return path.join(RUNTIME_DIR, `${prefix}-${port}.pid`)
}

function logFileFor(prefix, port) {
  return path.join(RUNTIME_DIR, `${prefix}-${port}.log`)
}

function readPidFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8').trim()
    const pid = Number.parseInt(raw, 10)
    return Number.isInteger(pid) && pid > 0 ? pid : null
  } catch {
    return null
  }
}

function writePidFile(filePath, pid) {
  fs.writeFileSync(filePath, `${pid}\n`, 'utf8')
}

function removeFileIfExists(filePath) {
  try {
    fs.rmSync(filePath, { force: true })
  } catch {
    // Ignore.
  }
}

function isProcessAlive(pid) {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error && typeof error === 'object' && 'code' in error && error.code !== 'ESRCH'
  }
}

function killProcess(pid) {
  if (!pid) return false
  try {
    process.kill(pid, 'SIGTERM')
  } catch {
    return false
  }
  return true
}

async function waitFor(predicate, timeoutMs = 30000, intervalMs = 250) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (await predicate()) {
      return true
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  return false
}

async function httpReady(url, timeoutMs = 1200) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

async function apiReady(apiPort) {
  const url = `http://${DEFAULT_API_HOST}:${apiPort}/health`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 1200)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) return false
    const payload = await response.json().catch(() => null)
    return Boolean(payload && typeof payload === 'object' && payload.ok === true)
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

function resolveLocalBin(packageName) {
  const packageJsonPath = require.resolve(`${packageName}/package.json`, { paths: [REPO_ROOT] })
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  const binField = packageJson.bin
  let relativeBin = null

  if (typeof binField === 'string') {
    relativeBin = binField
  } else if (binField && typeof binField === 'object') {
    relativeBin = binField[packageName] || Object.values(binField)[0] || null
  }

  if (!relativeBin || typeof relativeBin !== 'string') {
    throw new Error(`Could not resolve bin entry for ${packageName}`)
  }

  return path.resolve(path.dirname(packageJsonPath), relativeBin)
}

function resolveTsxLoader() {
  return require.resolve('tsx', { paths: [REPO_ROOT] })
}

function runSyncCommand(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...extraEnv,
      FORCE_COLOR: process.stdout.isTTY ? '1' : '0',
    },
  })

  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    const code = result.status ?? result.signal ?? 'unknown'
    throw new Error(`${command} ${args.join(' ')} failed (exit ${code})`)
  }
}

function isGitCheckout() {
  return fs.existsSync(path.join(REPO_ROOT, '.git'))
}

function isWorkingTreeClean() {
  const result = spawnSync('git', ['status', '--porcelain'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  })

  if (result.error) {
    throw result.error
  }

  return String(result.stdout || '').trim().length === 0
}

function spawnNodeScript(scriptPath, args, env, logPath, options = {}) {
  const logFd = fs.openSync(logPath, 'a')
  try {
    const child = spawn(process.execPath, [...(options.nodeArgs || []), scriptPath, ...args], {
      cwd: REPO_ROOT,
      detached: true,
      env: {
        ...process.env,
        ...env,
        FORCE_COLOR: process.stdout.isTTY ? '1' : '0',
      },
      stdio: ['ignore', logFd, logFd],
    })
    if (!child.pid) {
      throw new Error(`Failed to spawn ${path.basename(scriptPath)}`)
    }
    child.unref()
    return child.pid
  } finally {
    fs.closeSync(logFd)
  }
}

async function stopByPidFile(pidFilePath) {
  const pid = readPidFile(pidFilePath)
  if (!pid) {
    removeFileIfExists(pidFilePath)
    return false
  }

  removeFileIfExists(pidFilePath)
  if (!isProcessAlive(pid)) {
    return false
  }

  killProcess(pid)
  await waitFor(async () => !isProcessAlive(pid), 5000, 150)
  if (isProcessAlive(pid)) {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      // Ignore.
    }
  }
  return true
}

async function stopCommand(options) {
  ensureRuntimeDir()
  const webPidFile = pidFileFor('vite', options.port)
  const apiPidFile = pidFileFor('api', options.apiPort)
  const webStopped = await stopByPidFile(webPidFile)
  const apiStopped = await stopByPidFile(apiPidFile)

  if (webStopped || apiStopped) {
    console.log(`Open Canvas stopped (web:${options.port} api:${options.apiPort}).`)
  } else {
    console.log(`No running Open Canvas services found (web:${options.port} api:${options.apiPort}).`)
  }
}

async function statusCommand(options) {
  ensureRuntimeDir()
  const webPidFile = pidFileFor('vite', options.port)
  const apiPidFile = pidFileFor('api', options.apiPort)
  const webPid = readPidFile(webPidFile)
  const apiPid = readPidFile(apiPidFile)
  const webRunning = await httpReady(`http://${DEFAULT_WEB_HOST}:${options.port}`)
  const apiRunning = await apiReady(options.apiPort)

  const webState = webRunning ? `running${webPid ? ` (pid ${webPid})` : ''}` : 'stopped'
  const apiState = apiRunning ? `running${apiPid ? ` (pid ${apiPid})` : ''}` : 'stopped'

  console.log('Open Canvas status')
  console.log(`  web: ${webState} http://${DEFAULT_WEB_HOST}:${options.port}`)
  console.log(`  api: ${apiState} http://${DEFAULT_API_HOST}:${options.apiPort}`)
}

function openBrowser(url) {
  try {
    if (process.platform === 'darwin') {
      const child = spawn('open', [url], { detached: true, stdio: 'ignore' })
      child.on('error', () => {})
      child.unref()
      return true
    }
    if (process.platform === 'win32') {
      const child = spawn('cmd.exe', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' })
      child.on('error', () => {})
      child.unref()
      return true
    }
    const child = spawn('xdg-open', [url], { detached: true, stdio: 'ignore' })
    child.on('error', () => {})
    child.unref()
    return true
  } catch {
    return false
  }
}

async function startCommand(options) {
  ensureRuntimeDir()

  const webPidFile = pidFileFor('vite', options.port)
  const apiPidFile = pidFileFor('api', options.apiPort)
  const webLogFile = logFileFor('vite', options.port)
  const apiLogFile = logFileFor('api', options.apiPort)
  const webUrl = `http://${DEFAULT_WEB_HOST}:${options.port}`
  const apiUrl = `http://${DEFAULT_API_HOST}:${options.apiPort}`

  const preexistingWebPid = readPidFile(webPidFile)
  const preexistingApiPid = readPidFile(apiPidFile)
  const webProcessAlive = isProcessAlive(preexistingWebPid)
  const apiProcessAlive = isProcessAlive(preexistingApiPid)

  if (preexistingWebPid && !webProcessAlive) {
    removeFileIfExists(webPidFile)
  }
  if (preexistingApiPid && !apiProcessAlive) {
    removeFileIfExists(apiPidFile)
  }

  if (!options.apiOnly && webProcessAlive) {
    const webReadyNow = await waitFor(() => httpReady(webUrl), 15000, 300)
    if (!webReadyNow) {
      throw new Error(`Web process is already running but not ready on ${webUrl}`)
    }
  }
  if (apiProcessAlive) {
    const apiReadyNow = await waitFor(() => apiReady(options.apiPort), 15000, 300)
    if (!apiReadyNow) {
      throw new Error(`API process is already running but not ready on ${apiUrl}`)
    }
  }

  const webAlreadyRunning = webProcessAlive
  const apiAlreadyRunning = apiProcessAlive

  if (webAlreadyRunning && apiAlreadyRunning) {
    console.log(`Open Canvas already running. Web: ${webUrl} | API: ${apiUrl}`)
    if (options.open) {
      openBrowser(webUrl)
    }
    return
  }

  if (options.apiOnly && apiAlreadyRunning) {
    console.log(`Canvas Workbench Local API already running. API: ${apiUrl}`)
    return
  }

  const viteBin = options.apiOnly ? null : resolveLocalBin('vite')
  const tsxLoader = resolveTsxLoader()

  const startedPids = []
  const shouldOpen = options.open

  try {
    if (!apiAlreadyRunning) {
      const apiPid = spawnNodeScript(
        path.join(REPO_ROOT, 'server', 'index.ts'),
        [],
        {
          CANVAS_WORKBENCH_API_HOST: DEFAULT_API_HOST,
          CANVAS_WORKBENCH_API_PORT: String(options.apiPort),
          CANVAS_WORKBENCH_API_BASE_URL: apiUrl,
          CANVAS_WORKBENCH_WEB_ORIGIN: webUrl,
        },
        apiLogFile,
        { nodeArgs: ['--import', tsxLoader] },
      )
      writePidFile(apiPidFile, apiPid)
      startedPids.push(apiPid)
    }

    if (!options.apiOnly && !webAlreadyRunning) {
      const webPid = spawnNodeScript(
        viteBin,
        ['--host', DEFAULT_WEB_HOST, '--port', String(options.port), '--strictPort'],
        {
          VITE_CANVAS_WORKBENCH_API_BASE_URL: apiUrl,
        },
        webLogFile,
      )
      writePidFile(webPidFile, webPid)
      startedPids.push(webPid)
    }

    const ready = await waitFor(async () => options.apiOnly ? apiReady(options.apiPort) : (await httpReady(webUrl)) && (await apiReady(options.apiPort)), 30000, 300)
    if (!ready) {
      throw new Error(`Timed out waiting for Open Canvas to start. Check logs in ${RUNTIME_DIR}`)
    }

    if (options.apiOnly) {
      console.log(`Canvas Workbench Local API started. API: ${apiUrl}`)
      return
    }

    console.log(`Open Canvas started. Web: ${webUrl} | API: ${apiUrl}`)
    if (shouldOpen) {
      openBrowser(webUrl)
    }
  } catch (error) {
    for (const pid of startedPids) {
      if (isProcessAlive(pid)) {
        try {
          process.kill(pid, 'SIGTERM')
        } catch {
          // Ignore.
        }
      }
    }
    if (startedPids.length > 0) {
      await waitFor(async () => startedPids.every((pid) => !isProcessAlive(pid)), 5000, 150)
    }
    removeFileIfExists(webPidFile)
    removeFileIfExists(apiPidFile)
    throw error
  }
}

async function httpJson(url, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 8000)
  try {
    const headers = {
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}),
      ...(options.headers || {}),
    }
    const response = await fetch(url, {
      method: options.method || 'GET',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      headers,
      signal: controller.signal,
    })
    const text = await response.text()
    let payload = null
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      payload = { ok: false, message: text }
    }
    if (!response.ok || payload?.ok === false) {
      const message = payload?.message || `${response.status} ${response.statusText}`
      throw new Error(message)
    }
    return payload
  } finally {
    clearTimeout(timeout)
  }
}

function slugifyGridName(value) {
  const raw = String(value || '').trim().toLowerCase()
  const ascii = raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return ascii || uid('grid').replace(/^grid-/, '')
}

function normalizeGridLookup(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^画布\s*/i, '')
    .replace(/^grid\s+/i, '')
    .replace(/\s+/g, ' ')
}

function gridMatchesLookup(grid, lookup) {
  const raw = String(lookup || '').trim()
  if (!raw) return false
  const normalized = normalizeGridLookup(raw)
  const id = String(grid?.id || '').trim()
  const name = String(grid?.name || '').trim()
  return (
    id === raw ||
    name === raw ||
    normalizeGridLookup(id) === normalized ||
    normalizeGridLookup(name) === normalized ||
    normalizeGridLookup(name) === normalizeGridLookup(`Grid ${raw}`) ||
    normalizeGridLookup(`Grid ${name}`) === normalized
  )
}

function createGridIdFromName(name, existingGrids = []) {
  const base = `grid-${slugifyGridName(name)}`
  const existingIds = new Set(existingGrids.map((grid) => String(grid?.id || '')))
  if (!existingIds.has(base)) return base
  let index = 2
  while (existingIds.has(`${base}-${index}`)) index += 1
  return `${base}-${index}`
}

function normalizeUploadedWorkspace(workspace, updates = {}) {
  const grids = Array.isArray(updates.grids)
    ? updates.grids
    : Array.isArray(workspace?.grids)
      ? workspace.grids
      : []
  const activeGridId = String(updates.activeGridId || workspace?.activeGridId || grids[0]?.id || '').trim()
  return {
    name: String(updates.name || workspace?.name || 'My Canvas').trim() || 'My Canvas',
    activeGridId: grids.some((grid) => grid?.id === activeGridId) ? activeGridId : grids[0]?.id,
    grids,
  }
}

async function uploadWorkspace(apiUrl, options, workspace, updates = {}) {
  const payload = normalizeUploadedWorkspace(workspace, updates)
  const result = await httpJson(`${apiUrl}/api/v1/state`, {
    method: 'PUT',
    apiKey: options.apiKey,
    body: payload,
  })
  return result?.data?.workspace
}

async function ensureGrid(apiUrl, options, gridNameOrId) {
  const workspace = await getWorkspace(apiUrl, options)
  const grids = Array.isArray(workspace?.grids) ? workspace.grids : []
  const lookup = String(gridNameOrId || '').trim()

  if (!lookup) {
    const activeGrid = grids.find((grid) => grid.id === workspace?.activeGridId) || grids[0] || null
    return { workspace, grid: activeGrid, created: false }
  }

  const matchedGrid = grids.find((grid) => gridMatchesLookup(grid, lookup)) || null
  if (matchedGrid) return { workspace, grid: matchedGrid, created: false }

  const newGrid = {
    id: createGridIdFromName(lookup, grids),
    name: lookup,
    cards: [],
  }
  const nextWorkspace = await uploadWorkspace(apiUrl, options, workspace, {
    grids: [...grids, newGrid],
    activeGridId: newGrid.id,
  })
  return { workspace: nextWorkspace || { ...workspace, grids: [...grids, newGrid], activeGridId: newGrid.id }, grid: newGrid, created: true }
}

function printGridLine(grid, activeGridId) {
  const marker = grid.id === activeGridId ? '*' : ' '
  const name = String(grid.name || '(untitled)').padEnd(18, ' ')
  const id = String(grid.id || '').padEnd(20, ' ')
  const cardCount = Array.isArray(grid.cards) ? grid.cards.length : Number(grid.cardCount || 0)
  console.log(`${marker} ${name} ${id} ${cardCount} cards`)
}

function readTextFile(filePath, label) {
  const resolved = path.resolve(process.cwd(), filePath)
  try {
    return fs.readFileSync(resolved, 'utf8')
  } catch {
    throw new Error(`Could not read ${label}: ${resolved}`)
  }
}

function parseJsonInput(raw, label) {
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error(`Invalid JSON in ${label}`)
  }
}

async function readStdinText() {
  let data = ''
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) {
    data += chunk
  }
  return data
}

function readOptionalSourceData(filePath) {
  const rawPath = String(filePath || '').trim()
  if (!rawPath) return undefined
  const raw = readTextFile(rawPath, '--data')
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

async function gridListCommand(options) {
  const apiUrl = apiUrlFor(options)
  const workspace = await getWorkspace(apiUrl, options)
  const grids = Array.isArray(workspace?.grids) ? workspace.grids : []

  console.log('Canvas Workbench grids')
  console.log(`  api: ${apiUrl}`)
  if (!grids.length) {
    console.log('  no grids')
    return
  }
  for (const grid of grids) {
    printGridLine(grid, workspace?.activeGridId)
  }
}

async function gridAddCommand(options) {
  const name = options.contentParts.join(' ').trim()
  if (!name) {
    throw new Error('Grid name is required. Example: canvas-workbench grid add "B"')
  }

  const apiUrl = apiUrlFor(options)
  const { grid, created } = await ensureGrid(apiUrl, options, name)
  console.log(created ? 'Grid created' : 'Grid already exists')
  console.log(`  api: ${apiUrl}`)
  console.log(`  grid: ${grid?.id || 'unknown'}`)
  console.log(`  name: ${grid?.name || name}`)
}

async function noteAddCommand(options) {
  const content = options.contentParts.join(' ').trim()
  if (!content) {
    throw new Error('Note content is required. Example: canvas-workbench note add "Meeting summary"')
  }

  const apiUrl = apiUrlFor(options)
  const gridLookup = String(options.gridId || '').trim()
  const { grid, created } = await ensureGrid(apiUrl, options, gridLookup)
  if (!grid?.id) throw new Error('Could not find or create target grid')
  const payload = {
    kind: 'note',
    title: String(options.title || '').trim() || undefined,
    content,
    gridId: grid.id,
    activateGrid: true,
    ...centeredCardPosition('note'),
  }

  const result = await httpJson(`${apiUrl}/api/v1/cards`, {
    method: 'POST',
    body: payload,
    apiKey: options.apiKey,
  })
  const data = result?.data || {}
  console.log('Note created')
  console.log(`  api: ${apiUrl}`)
  console.log(`  grid: ${data.gridId || grid.id}${created ? ' (created)' : ''}`)
  console.log(`  card: ${data.cardId || data.card?.id || 'unknown'}`)
}

async function dashboardAddCommand(options) {
  const title = String(options.contentParts.join(' ') || '').trim()
  if (!title) {
    throw new Error('Dashboard title is required. Example: canvas-workbench dashboard add "销售看板" --option ./sales-option.json')
  }

  const hasOptionPath = Boolean(String(options.optionPath || '').trim())
  const hasStdin = Boolean(options.readOptionFromStdin)
  if (hasOptionPath === hasStdin) {
    throw new Error('Exactly one of --option or --stdin must be supplied')
  }

  const optionRaw = hasStdin ? await readStdinText() : readTextFile(options.optionPath, '--option')
  const option = parseJsonInput(optionRaw, hasStdin ? 'stdin' : '--option')
  const sourceData = readOptionalSourceData(options.sourceDataPath)

  const apiUrl = apiUrlFor(options)
  const gridLookup = String(options.gridId || '').trim()
  const { grid, created } = await ensureGrid(apiUrl, options, gridLookup)
  if (!grid?.id) throw new Error('Could not find or create target grid')

  const dashboard = {
    option,
    updatedAt: new Date().toISOString(),
  }
  if (sourceData !== undefined) dashboard.sourceData = sourceData
  if (String(options.prompt || '').trim()) dashboard.prompt = String(options.prompt).trim()
  if (String(options.generatedBy || '').trim()) dashboard.generatedBy = String(options.generatedBy).trim()

  const payload = {
    kind: 'dashboard',
    title,
    content: '',
    gridId: grid.id,
    activateGrid: true,
    ...centeredCardPosition('dashboard'),
    dashboard,
  }

  const result = await httpJson(`${apiUrl}/api/v1/cards`, {
    method: 'POST',
    body: payload,
    apiKey: options.apiKey,
  })
  const data = result?.data || {}
  console.log('Dashboard created')
  console.log(`  api: ${apiUrl}`)
  console.log(`  grid: ${data.gridId || grid.id}${created ? ' (created)' : ''}`)
  console.log(`  card: ${data.cardId || data.card?.id || 'unknown'}`)
}

async function imageAddCommand(options) {
  const filePathInput = options.contentParts.join(' ').trim()
  if (!filePathInput) {
    throw new Error('Image file is required. Example: canvas-workbench image add "./generated.png" --grid "AI区"')
  }

  const filePath = path.resolve(process.cwd(), filePathInput)
  if (!fs.existsSync(filePath)) {
    throw new Error(`Image file not found: ${filePath}`)
  }
  const stat = fs.statSync(filePath)
  if (!stat.isFile()) {
    throw new Error(`Image path is not a file: ${filePath}`)
  }
  const mimeType = inferImageMimeType(filePath)
  if (!mimeType) {
    throw new Error('Unsupported image file. Use png, jpg, jpeg, webp, or gif.')
  }

  const bytes = fs.readFileSync(filePath)
  const fileName = path.basename(filePath)
  const apiUrl = apiUrlFor(options)
  const gridLookup = String(options.gridId || '').trim()
  const { grid, created } = await ensureGrid(apiUrl, options, gridLookup)
  if (!grid?.id) throw new Error('Could not find or create target grid')

  const result = await httpJson(`${apiUrl}/api/v1/images/import`, {
    method: 'POST',
    apiKey: options.apiKey,
    body: {
      name: fileName,
      type: mimeType,
      dataUrl: `data:${mimeType};base64,${bytes.toString('base64')}`,
      title: String(options.title || '').trim() || fileName,
      gridId: grid.id,
      activateGrid: true,
      ...centeredCardPosition('image'),
    },
  })
  const data = result?.data || {}
  console.log('Image imported')
  console.log(`  api: ${apiUrl}`)
  console.log(`  grid: ${data.gridId || grid.id}${created ? ' (created)' : ''}`)
  console.log(`  card: ${data.cardId || data.card?.id || 'unknown'}`)
  console.log(`  asset: ${data.assetId || data.asset?.id || 'unknown'}`)
  console.log(`  original: ${filePath}`)
}

async function flowAddCommand(options) {
  const title = String(options.title || options.contentParts.join(' ') || '').trim()
  if (!title) {
    throw new Error('Flow title is required. Example: canvas-workbench flow add "User onboarding flow"')
  }

  const apiUrl = apiUrlFor(options)
  const gridLookup = String(options.gridId || '').trim()
  const { grid, created } = await ensureGrid(apiUrl, options, gridLookup)
  if (!grid?.id) throw new Error('Could not find or create target grid')
  const payload = {
    kind: 'eventFlow',
    title,
    content: '',
    gridId: grid.id,
    activateGrid: true,
    ...centeredCardPosition('eventFlow'),
    eventFlow: {
      draftTitle: '',
      nodes: [
        {
          id: `flow-node-${uid()}`,
          title: '',
          kind: 'start',
          x: 72,
          y: 150,
        },
      ],
      edges: [],
    },
  }

  const result = await httpJson(`${apiUrl}/api/v1/cards`, {
    method: 'POST',
    body: payload,
    apiKey: options.apiKey,
  })
  const data = result?.data || {}
  console.log('Event flow created')
  console.log(`  api: ${apiUrl}`)
  console.log(`  grid: ${data.gridId || grid.id}${created ? ' (created)' : ''}`)
  console.log(`  card: ${data.cardId || data.card?.id || 'unknown'}`)
}

async function getWorkspace(apiUrl, options) {
  const result = await httpJson(`${apiUrl}/api/v1/state?full=1`, {
    method: 'GET',
    apiKey: options.apiKey,
  })
  return result?.data?.workspace
}

async function createSingletonCard(apiUrl, options, kind, title, gridId = '') {
  const result = await httpJson(`${apiUrl}/api/v1/cards`, {
    method: 'POST',
    apiKey: options.apiKey,
    body: {
      kind,
      title,
      gridId: String(gridId || options.gridId || '').trim() || undefined,
      activateGrid: true,
      ...centeredCardPosition(kind),
    },
  })
  return result?.data || {}
}

async function updateCard(apiUrl, options, cardId, updates) {
  const result = await httpJson(`${apiUrl}/api/v1/cards/${encodeURIComponent(cardId)}`, {
    method: 'PATCH',
    apiKey: options.apiKey,
    body: updates,
  })
  return result?.data || {}
}

function findTargetGrid(workspace, gridId) {
  const grids = Array.isArray(workspace?.grids) ? workspace.grids : []
  if (gridId) return grids.find((grid) => gridMatchesLookup(grid, gridId)) || null
  return grids.find((grid) => grid.id === workspace?.activeGridId) || grids[0] || null
}

async function todoAddCommand(options) {
  const text = options.contentParts.join(' ').trim()
  if (!text) {
    throw new Error('Todo text is required. Example: canvas-workbench todo add "Prepare homepage copy"')
  }

  const apiUrl = apiUrlFor(options)
  const status = normalizeTodoStatus(options.status || 'todo')
  const tag = normalizeTodoTag(options.tag || 'event')
  const gridId = String(options.gridId || '').trim()

  let workspace = await getWorkspace(apiUrl, options)
  let targetGrid = findTargetGrid(workspace, gridId)
  let createdGrid = false
  if (!targetGrid && gridId) {
    const ensured = await ensureGrid(apiUrl, options, gridId)
    workspace = ensured.workspace
    targetGrid = ensured.grid
    createdGrid = ensured.created
  }
  let todoCard = targetGrid?.cards?.find((card) => card.kind === 'todo') || null

  if (!todoCard) {
    const created = await createSingletonCard(apiUrl, options, 'todo', 'Todo list', targetGrid?.id || gridId)
    todoCard = created.card
    targetGrid = { ...(targetGrid || {}), id: created.gridId || targetGrid?.id || gridId || workspace?.activeGridId || 'grid-a' }
  }

  if (!todoCard?.id) throw new Error('Could not find or create todo card')

  const nextItem = {
    id: uid('todo-item'),
    text,
    status,
    tag,
  }
  const todoItems = [...(Array.isArray(todoCard.todoItems) ? todoCard.todoItems : []), nextItem]
  await updateCard(apiUrl, options, todoCard.id, { todoItems })

  console.log('Todo item created')
  console.log(`  api: ${apiUrl}`)
  console.log(`  grid: ${targetGrid?.id || 'active'}${createdGrid ? ' (created)' : ''}`)
  console.log(`  card: ${todoCard.id}`)
  console.log(`  item: ${nextItem.id}`)
  console.log(`  status: ${status}`)
  console.log(`  tag: ${tag}`)
}

async function calendarEventAddCommand(options) {
  const title = options.contentParts.join(' ').trim()
  if (!title) {
    throw new Error('Calendar event title is required. Example: canvas-workbench calendar event add "Design review"')
  }

  const apiUrl = apiUrlFor(options)
  const { date, allDay, startTime, endTime } = normalizeCalendarEventOptions(options)
  const gridId = String(options.gridId || '').trim()

  let workspace = await getWorkspace(apiUrl, options)
  let targetGrid = findTargetGrid(workspace, gridId)
  let createdGrid = false
  if (!targetGrid && gridId) {
    const ensured = await ensureGrid(apiUrl, options, gridId)
    workspace = ensured.workspace
    targetGrid = ensured.grid
    createdGrid = ensured.created
  }
  let calendarCard = targetGrid?.cards?.find((card) => card.kind === 'calendar') || null

  if (!calendarCard) {
    const created = await createSingletonCard(apiUrl, options, 'calendar', 'Calendar', targetGrid?.id || gridId)
    calendarCard = created.card
    targetGrid = { ...(targetGrid || {}), id: created.gridId || targetGrid?.id || gridId || workspace?.activeGridId || 'grid-a' }
  }

  if (!calendarCard?.id) throw new Error('Could not find or create calendar card')

  const currentCalendar = calendarCard.calendar || {}
  const nextEvent = {
    id: uid('event'),
    date,
    title,
    allDay,
    ...(allDay ? {} : { startTime, endTime }),
  }
  const calendar = {
    monthCursor: currentCalendar.monthCursor || monthKeyFromDateKey(date),
    selectedDate: date,
    viewMode: currentCalendar.viewMode === 'week' ? 'week' : 'month',
    draftTitle: currentCalendar.draftTitle || '',
    draftAllDay: typeof currentCalendar.draftAllDay === 'boolean' ? currentCalendar.draftAllDay : true,
    draftStartTime: currentCalendar.draftStartTime || '09:00',
    draftEndTime: currentCalendar.draftEndTime || '10:00',
    events: [...(Array.isArray(currentCalendar.events) ? currentCalendar.events : []), nextEvent],
  }
  await updateCard(apiUrl, options, calendarCard.id, { calendar })

  console.log('Calendar event created')
  console.log(`  api: ${apiUrl}`)
  console.log(`  grid: ${targetGrid?.id || 'active'}${createdGrid ? ' (created)' : ''}`)
  console.log(`  card: ${calendarCard.id}`)
  console.log(`  event: ${nextEvent.id}`)
  console.log(`  date: ${date}`)
  console.log(`  time: ${allDay ? 'all-day' : `${startTime}-${endTime}`}`)
}

async function restartCommand(options) {
  await stopCommand(options)
  await startCommand(options)
}

async function updateCommand(options) {
  ensureRuntimeDir()

  if (!isGitCheckout()) {
    throw new Error(
      'Online update is only available for git checkout installs. Reinstall from the repository to enable in-place updates.',
    )
  }

  if (!isWorkingTreeClean()) {
    throw new Error('Working tree has local changes. Commit or stash them before updating.')
  }

  console.log(`Updating Open Canvas in ${REPO_ROOT}...`)
  console.log('Pulling the latest changes...')
  runSyncCommand('git', ['pull', '--ff-only'])
  console.log('Installing dependencies...')
  runSyncCommand('npm', ['install'])

  console.log('Restarting Open Canvas services...')
  await stopCommand(options)
  await startCommand(options)
  console.log('Update complete.')
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2))

  if (command === 'help') {
    usage()
    return
  }
  if (command === 'version') {
    const packageJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'))
    console.log(packageJson.version || '0.0.0')
    return
  }

  if (command === 'start') {
    await startCommand(options)
    return
  }
  if (command === 'stop') {
    await stopCommand(options)
    return
  }
  if (command === 'restart') {
    await restartCommand(options)
    return
  }
  if (command === 'update') {
    await updateCommand(options)
    return
  }
  if (command === 'grid:list') {
    await gridListCommand(options)
    return
  }
  if (command === 'grid:add') {
    await gridAddCommand(options)
    return
  }
  if (command === 'status') {
    await statusCommand(options)
    return
  }
  if (command === 'note:add') {
    await noteAddCommand(options)
    return
  }
  if (command === 'dashboard:add') {
    await dashboardAddCommand(options)
    return
  }
  if (command === 'image:add') {
    await imageAddCommand(options)
    return
  }
  if (command === 'todo:add') {
    await todoAddCommand(options)
    return
  }
  if (command === 'calendar:event:add') {
    await calendarEventAddCommand(options)
    return
  }
  if (command === 'flow:add') {
    await flowAddCommand(options)
    return
  }

  usage()
  process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
