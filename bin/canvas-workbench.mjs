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
const DEFAULT_API_PORT = 8787

function usage() {
  console.log(`Open Canvas CLI

Usage:
  canvas-workbench start [--open] [--no-open] [--port <web-port>] [--api-port <api-port>]
  canvas-workbench stop [--port <web-port>] [--api-port <api-port>]
  canvas-workbench restart [--open] [--no-open] [--port <web-port>] [--api-port <api-port>]
  canvas-workbench status [--port <web-port>] [--api-port <api-port>]
  canvas-workbench update [--open] [--no-open] [--port <web-port>] [--api-port <api-port>]

Examples:
  canvas-workbench start
  canvas-workbench start --no-open
  canvas-workbench stop
  canvas-workbench status
  canvas-workbench update
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

function parseArgs(argv) {
  const tokens = [...argv]
  const rawCommand = tokens.shift()
  let command = 'start'
  if (rawCommand === '--help' || rawCommand === '-h') {
    command = 'help'
  } else if (rawCommand === '--version' || rawCommand === '-v') {
    command = 'version'
  } else if (rawCommand) {
    command = rawCommand
  }
  const options = {
    port: DEFAULT_WEB_PORT,
    apiPort: DEFAULT_API_PORT,
    open: true,
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

function spawnNodeScript(scriptPath, args, env, logPath) {
  const logFd = fs.openSync(logPath, 'a')
  try {
    const child = spawn(process.execPath, [scriptPath, ...args], {
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

  if (webProcessAlive) {
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

  const viteBin = resolveLocalBin('vite')
  const tsxBin = resolveLocalBin('tsx')

  const startedPids = []
  const shouldOpen = options.open

  try {
    if (!apiAlreadyRunning) {
      const apiPid = spawnNodeScript(
        tsxBin,
        ['--tsconfig', path.join(REPO_ROOT, 'tsconfig.node.json'), path.join(REPO_ROOT, 'server', 'index.ts')],
        {
          CANVAS_WORKBENCH_API_HOST: DEFAULT_API_HOST,
          CANVAS_WORKBENCH_API_PORT: String(options.apiPort),
          CANVAS_WORKBENCH_API_BASE_URL: apiUrl,
          CANVAS_WORKBENCH_WEB_ORIGIN: webUrl,
        },
        apiLogFile,
      )
      writePidFile(apiPidFile, apiPid)
      startedPids.push(apiPid)
    }

    if (!webAlreadyRunning) {
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

    const ready = await waitFor(async () => (await httpReady(webUrl)) && (await apiReady(options.apiPort)), 30000, 300)
    if (!ready) {
      throw new Error(`Timed out waiting for Open Canvas to start. Check logs in ${RUNTIME_DIR}`)
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
  if (command === 'status') {
    await statusCommand(options)
    return
  }

  usage()
  process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
