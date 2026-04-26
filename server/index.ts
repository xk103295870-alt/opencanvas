import { spawn, spawnSync } from 'node:child_process'
import cors from 'cors'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import express, { type NextFunction, type Request, type Response } from 'express'

type CardKind = 'note' | 'hint' | 'image' | 'video' | 'pdf' | 'todo' | 'calendar'
type CalendarViewMode = 'month' | 'week'
type TodoLane = 'todo' | 'doing' | 'done'

type TodoItem = {
  id: string
  text: string
  status: TodoLane
}

type CalendarEvent = {
  id: string
  date: string
  title: string
  allDay: boolean
  startTime?: string
  endTime?: string
}

type CalendarState = {
  monthCursor: string
  selectedDate: string
  viewMode: CalendarViewMode
  draftTitle: string
  draftAllDay: boolean
  draftStartTime: string
  draftEndTime: string
  events: CalendarEvent[]
}

type CardData = {
  id: string
  kind: CardKind
  title: string
  content: string
  x: number
  y: number
  width: number
  height: number
  fileName?: string
  externalUrl?: string
  todoItems?: TodoItem[]
  calendar?: CalendarState
}

type AssetRecord = {
  id: string
  accountId: string
  workspaceId: string
  name: string
  type: string
  size: number
  publicToken: string
  createdAt: string
  updatedAt: string
}

type GridData = {
  id: string
  name: string
  cards: CardData[]
}

type WorkspaceRecord = {
  id: string
  accountId: string
  name: string
  activeGridId: string
  grids: GridData[]
  createdAt: string
  updatedAt: string
}

type AccountProvider = 'demo' | 'google'

type AccountRecord = {
  id: string
  name: string
  email: string
  provider: AccountProvider
  avatarUrl?: string
  createdAt: string
  updatedAt: string
}

type SessionRecord = {
  id: string
  accountId: string
  tokenHash: string
  createdAt: string
  expiresAt: string
  lastUsedAt: string
}

type ApiKeyRecord = {
  id: string
  accountId: string
  name: string
  keyHash: string
  prefix: string
  scopes: string[]
  createdAt: string
  lastUsedAt: string
  revokedAt?: string
}

type ApiDb = {
  version: number
  accounts: AccountRecord[]
  sessions: SessionRecord[]
  apiKeys: ApiKeyRecord[]
  workspaces: WorkspaceRecord[]
  assets: AssetRecord[]
}

type CanvasWorkbenchCreateCardPayload = {
  id?: string
  cardId?: string
  kind?: CardKind | string
  gridId?: string
  title?: string
  content?: string
  x?: number
  y?: number
  width?: number
  height?: number
  activateGrid?: boolean
  fileName?: string
  mediaUrl?: string
  todoItems?: Array<string | { text?: string; done?: boolean; status?: TodoLane | string }>
  calendar?: {
    monthCursor?: string
    selectedDate?: string
    viewMode?: CalendarViewMode
    draftTitle?: string
    draftAllDay?: boolean
    draftStartTime?: string
    draftEndTime?: string
    events?: Array<{
      title?: string
      date?: string
      allDay?: boolean
      startTime?: string
      endTime?: string
    }>
  }
}

type CanvasWorkbenchGridCreatePayload = {
  id?: string
  name?: string
  activate?: boolean
}

type CanvasWorkbenchGridUpdatePayload = {
  name?: string
  activate?: boolean
}

type RequestContext = {
  account?: AccountRecord
  session?: SessionRecord
  apiKey?: ApiKeyRecord
  workspace?: WorkspaceRecord
}

const APP_VERSION = '0.2.0-api'
const API_HOST = process.env.CANVAS_WORKBENCH_API_HOST || '127.0.0.1'
const API_PORT = Number(process.env.CANVAS_WORKBENCH_API_PORT || '8787')
const API_BASE_URL = process.env.CANVAS_WORKBENCH_API_BASE_URL || `http://${API_HOST}:${API_PORT}`
const WEB_ORIGIN = process.env.CANVAS_WORKBENCH_WEB_ORIGIN || 'http://127.0.0.1:5173'
const DB_PATH = path.join(process.cwd(), '.runtime', 'api-db.json')
const ASSET_ROOT = path.join(process.cwd(), '.runtime', 'assets')
const UPDATE_LOG_PATH = path.join(process.cwd(), '.runtime', 'update.log')
const SESSION_TTL_DAYS = 30
const VALID_SCOPES = ['canvas:read', 'canvas:write'] as const
const LOCAL_ACCOUNT_ID = 'acct-local-canvas-workbench'
const LOCAL_ACCOUNT_EMAIL = 'local@canvas-workbench.local'
const LOCAL_ACCOUNT_NAME = 'Local Workspace'
const STANDARD_PREFIX = '/api/v1'

const app = express()
app.use(
  cors({
    origin: true,
    credentials: false,
  }),
)
app.use(express.json({ limit: '50mb' }))

function statusToErrorCode(status: number) {
  if (status === 400) return 'bad_request'
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not_found'
  if (status === 409) return 'conflict'
  if (status === 429) return 'rate_limited'
  if (status >= 500) return 'internal_error'
  return 'request_failed'
}

function toFiniteNumber(value: unknown, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeCardId(value: unknown) {
  const raw = typeof value === 'string' ? value.trim() : ''
  return raw.length > 0 ? raw.slice(0, 120) : null
}

function normalizeGridId(value: unknown) {
  const raw = typeof value === 'string' ? value.trim() : ''
  return raw.length > 0 ? raw.slice(0, 120) : null
}

function normalizeAssetId(value: unknown) {
  const raw = typeof value === 'string' ? value.trim() : ''
  return raw.length > 0 ? raw.slice(0, 120) : null
}

function normalizeAssetName(value: unknown) {
  const raw = typeof value === 'string' ? value.trim() : ''
  return raw.length > 0 ? raw.slice(0, 240) : 'asset'
}

function sanitizeMimeType(value: unknown) {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (raw.startsWith('image/')) return raw
  if (raw.startsWith('video/')) return raw
  if (raw === 'application/pdf') return raw
  return 'application/octet-stream'
}

function parseDataUrl(input: unknown) {
  const raw = String(input || '').trim()
  const match = raw.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/i)
  if (!match) return null
  const mimeType = sanitizeMimeType(match[1] || 'application/octet-stream')
  const base64 = match[2]
  if (!base64) return null

  return {
    mimeType,
    buffer: Buffer.from(base64, 'base64'),
  }
}

function ensureAssetDir(workspaceId: string) {
  fs.mkdirSync(path.join(ASSET_ROOT, workspaceId), { recursive: true })
}

function getAssetFilePath(workspaceId: string, assetId: string) {
  return path.join(ASSET_ROOT, workspaceId, assetId)
}

function toAssetUrl(assetId: string, publicToken: string) {
  return `${API_BASE_URL}/api/v1/assets/${encodeURIComponent(assetId)}?token=${encodeURIComponent(publicToken)}`
}

// For /api/v1 requests, normalize internal { ok, ... } payloads into envelope format:
// success -> { data, meta? }, error -> { error: { code, message, details? } }.
app.use((req, res, next) => {
  const isStandardPath = req.path.startsWith(STANDARD_PREFIX)
  if (!isStandardPath) {
    next()
    return
  }

  const baseJson = res.json.bind(res)
  ;(res as Response & { json: (body: unknown) => Response }).json = ((body: unknown) => {
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const payload = body as Record<string, unknown>
      if (payload.ok === true) {
        const rawData = 'data' in payload ? payload.data : undefined
        const derivedData =
          rawData !== undefined
            ? rawData
            : (() => {
                const clone = { ...payload }
                delete clone.ok
                delete clone.message
                return clone
              })()
        const meta = payload.message ? { message: String(payload.message) } : undefined
        return baseJson({ data: derivedData ?? null, ...(meta ? { meta } : {}) })
      }
      if (payload.ok === false) {
        const error = {
          code: typeof payload.code === 'string' ? payload.code : statusToErrorCode(res.statusCode || 500),
          message: typeof payload.message === 'string' ? payload.message : 'Request failed',
          ...(payload.details !== undefined ? { details: payload.details } : {}),
        }
        return baseJson({ error })
      }
    }
    return baseJson({ data: body ?? null })
  }) as Response['json']

  next()
})

const db = loadDb()

function nowIso() {
  return new Date().toISOString()
}

function sha256(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex')
}

function uid(length = 12) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length)
}

function ensureDirFor(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

function isGitCheckout() {
  return fs.existsSync(path.join(process.cwd(), '.git'))
}

function readGitOutput(args: string[], timeoutMs = 1200) {
  const result = spawnSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: timeoutMs,
    killSignal: 'SIGKILL',
  })

  if (result.error || (typeof result.status === 'number' && result.status !== 0)) {
    return null
  }

  const stdout = String(result.stdout || '').trim()
  return stdout || null
}

function getGitStatus() {
  if (!isGitCheckout()) {
    return {
      isGitCheckout: false,
      currentRevision: null as string | null,
      remoteRevision: null as string | null,
      remoteName: null as string | null,
      branchName: null as string | null,
      updateAvailable: false,
    }
  }

  const currentRevision = readGitOutput(['rev-parse', 'HEAD'])
  const upstreamRef = readGitOutput(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])

  let remoteName: string | null = null
  let branchName: string | null = null

  if (upstreamRef && upstreamRef.includes('/')) {
    const parts = upstreamRef.split('/')
    remoteName = parts.shift() ?? null
    branchName = parts.join('/') || null
  } else {
    branchName = readGitOutput(['rev-parse', '--abbrev-ref', 'HEAD'])
    if (branchName === 'HEAD') branchName = null
  }

  if (!remoteName) {
    const remoteHead = readGitOutput(['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'])
    if (remoteHead && remoteHead.includes('/')) {
      const parts = remoteHead.split('/')
      remoteName = parts.shift() ?? null
      branchName = branchName || (parts.join('/') || null)
    }
  }

  if (!remoteName) remoteName = 'origin'

  let remoteRevision: string | null = null
  if (remoteName && branchName) {
    const remoteBranch = readGitOutput(['ls-remote', remoteName, `refs/heads/${branchName}`], 1500)
    remoteRevision = remoteBranch ? remoteBranch.split(/\s+/)[0] || null : null
  }

  if (!remoteRevision && remoteName) {
    const remoteHead = readGitOutput(['ls-remote', remoteName, 'HEAD'], 1500)
    remoteRevision = remoteHead ? remoteHead.split(/\s+/)[0] || null : null
  }

  return {
    isGitCheckout: true,
    currentRevision,
    remoteRevision,
    remoteName,
    branchName,
    updateAvailable: Boolean(currentRevision && (!remoteRevision || currentRevision !== remoteRevision)),
  }
}

function isWorkingTreeClean() {
  const result = spawnSync('git', ['status', '--porcelain'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })

  if (result.error) {
    throw result.error
  }

  return String(result.stdout || '').trim().length === 0
}

function resolvePortFromOrigin(origin: string, fallback: number) {
  try {
    const parsed = new URL(origin)
    const port = Number(parsed.port)
    return Number.isInteger(port) && port > 0 ? port : fallback
  } catch {
    return fallback
  }
}

function spawnDetachedCommand(command: string, args: string[], env: NodeJS.ProcessEnv, logPath: string) {
  ensureDirFor(logPath)
  const logFd = fs.openSync(logPath, 'a')
  try {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      detached: true,
      env: {
        ...process.env,
        ...env,
        FORCE_COLOR: '0',
      },
      stdio: ['ignore', logFd, logFd],
    })
    if (!child.pid) {
      throw new Error(`Failed to spawn ${path.basename(command)}`)
    }
    child.unref()
    return child.pid
  } finally {
    fs.closeSync(logFd)
  }
}

function loadDb(): ApiDb {
  try {
    if (!fs.existsSync(DB_PATH)) return createEmptyDb()
    const parsed = JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) as Partial<ApiDb>
    if (!parsed || typeof parsed !== 'object') return createEmptyDb()
    return {
      version: 1,
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      apiKeys: Array.isArray(parsed.apiKeys) ? parsed.apiKeys : [],
      workspaces: Array.isArray(parsed.workspaces) ? parsed.workspaces : [],
      assets: Array.isArray(parsed.assets) ? parsed.assets : [],
    }
  } catch {
    return createEmptyDb()
  }
}

function saveDb() {
  ensureDirFor(DB_PATH)
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8')
}

function createEmptyDb(): ApiDb {
  return {
    version: 1,
    accounts: [],
    sessions: [],
    apiKeys: [],
    workspaces: [],
    assets: [],
  }
}

function ensureCtx(req: Request): RequestContext {
  const anyReq = req as Request & { ctx?: RequestContext }
  if (!anyReq.ctx) anyReq.ctx = {}
  return anyReq.ctx
}

function toPublicAccount(account: AccountRecord) {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    provider: account.provider,
    avatarUrl: account.avatarUrl,
  }
}

function parseBearer(req: Request) {
  const value = req.headers.authorization
  if (!value || !value.toLowerCase().startsWith('bearer ')) return null
  return value.slice(7).trim()
}

function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase()
}

function normalizeName(raw: string) {
  const value = raw.trim()
  return value || 'Open Canvas User'
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function parseCardKind(input: unknown): CardKind {
  const value = String(input || '').trim().toLowerCase()
  if (value === 'hint') return 'hint'
  if (value === 'image') return 'image'
  if (value === 'video') return 'video'
  if (value === 'pdf') return 'pdf'
  if (value === 'todo') return 'todo'
  if (value === 'calendar') return 'calendar'
  return 'note'
}

function isSingletonCardKind(kind: CardKind) {
  return kind === 'todo' || kind === 'calendar'
}

function normalizeTodoLane(input: unknown, doneFallback = false): TodoLane {
  const value = String(input || '')
    .trim()
    .toLowerCase()
  if (value === 'todo' || value === 'doing' || value === 'done') return value
  return doneFallback ? 'done' : 'todo'
}

function inferDefaultTitle(kind: CardKind) {
  switch (kind) {
    case 'hint':
      return 'Quick hint'
    case 'image':
      return 'Image'
    case 'video':
      return 'Video'
    case 'pdf':
      return 'PDF'
    case 'todo':
      return 'Todo list'
    case 'calendar':
      return 'Calendar'
    case 'note':
    default:
      return 'Quick note'
  }
}

function defaultCalendarState(): CalendarState {
  const today = new Date().toISOString().slice(0, 10)
  return {
    monthCursor: today.slice(0, 7),
    selectedDate: today,
    viewMode: 'month',
    draftTitle: '',
    draftAllDay: true,
    draftStartTime: '09:00',
    draftEndTime: '10:00',
    events: [],
  }
}

function normalizeTodoItems(input: CanvasWorkbenchCreateCardPayload['todoItems']): TodoItem[] {
  if (!Array.isArray(input)) return []
  const out: TodoItem[] = []
  for (const item of input) {
    if (typeof item === 'string') {
      const text = item.trim()
      if (!text) continue
      out.push({ id: `todo-${uid(10)}`, text, status: 'todo' })
      continue
    }
    if (!item || typeof item !== 'object') continue
    const text = String(item.text || '').trim()
    if (!text) continue
    out.push({
      id: `todo-${uid(10)}`,
      text,
      status: normalizeTodoLane(item.status, Boolean(item.done)),
    })
  }
  return out
}

function normalizeCalendar(input: CanvasWorkbenchCreateCardPayload['calendar']): CalendarState {
  const base = defaultCalendarState()
  if (!input || typeof input !== 'object') return base
  const events: CalendarEvent[] = Array.isArray(input.events)
    ? input.events
        .map((event) => {
          const title = String(event?.title || '').trim()
          if (!title) return null
          const date = String(event?.date || base.selectedDate).slice(0, 10)
          return {
            id: `event-${uid(10)}`,
            title,
            date,
            allDay: event?.allDay !== false,
            startTime: event?.startTime ? String(event.startTime).slice(0, 5) : undefined,
            endTime: event?.endTime ? String(event.endTime).slice(0, 5) : undefined,
          }
        })
        .filter((event): event is CalendarEvent => Boolean(event))
    : []

  return {
    monthCursor: String(input.monthCursor || base.monthCursor).slice(0, 7),
    selectedDate: String(input.selectedDate || base.selectedDate).slice(0, 10),
    viewMode: input.viewMode === 'week' ? 'week' : 'month',
    draftTitle: String(input.draftTitle || ''),
    draftAllDay: input.draftAllDay !== false,
    draftStartTime: String(input.draftStartTime || base.draftStartTime).slice(0, 5),
    draftEndTime: String(input.draftEndTime || base.draftEndTime).slice(0, 5),
    events,
  }
}

function createDefaultWorkspace(accountId: string): WorkspaceRecord {
  const now = nowIso()
  return {
    id: `workspace-${uid(10)}`,
    accountId,
    name: 'My Canvas',
    activeGridId: 'grid-a',
    createdAt: now,
    updatedAt: now,
    grids: [{ id: 'grid-a', name: 'Grid A', cards: [] }],
  }
}

function ensureWorkspace(accountId: string) {
  let workspace = db.workspaces.find((item) => item.accountId === accountId)
  if (!workspace) {
    workspace = createDefaultWorkspace(accountId)
    db.workspaces.push(workspace)
    saveDb()
  }
  return workspace
}

function ensureLocalAccount() {
  const now = nowIso()
  let account = db.accounts.find((item) => item.id === LOCAL_ACCOUNT_ID || item.email === LOCAL_ACCOUNT_EMAIL)
  if (!account) {
    account = {
      id: LOCAL_ACCOUNT_ID,
      name: LOCAL_ACCOUNT_NAME,
      email: LOCAL_ACCOUNT_EMAIL,
      provider: 'demo',
      createdAt: now,
      updatedAt: now,
    }
    db.accounts.push(account)
    saveDb()
  } else {
    let changed = false
    if (account.id !== LOCAL_ACCOUNT_ID) {
      account.id = LOCAL_ACCOUNT_ID
      changed = true
    }
    if (account.name !== LOCAL_ACCOUNT_NAME) {
      account.name = LOCAL_ACCOUNT_NAME
      changed = true
    }
    if (account.email !== LOCAL_ACCOUNT_EMAIL) {
      account.email = LOCAL_ACCOUNT_EMAIL
      changed = true
    }
    if (account.provider !== 'demo') {
      account.provider = 'demo'
      changed = true
    }
    if (changed) {
      account.updatedAt = now
      saveDb()
    }
  }
  ensureWorkspace(account.id)
  return account
}

function cleanupExpiredSessions() {
  const now = Date.now()
  const before = db.sessions.length
  db.sessions = db.sessions.filter((session) => new Date(session.expiresAt).getTime() > now)
  if (db.sessions.length !== before) saveDb()
}

function requireSession(req: Request, res: Response, next: NextFunction) {
  cleanupExpiredSessions()
  const token = parseBearer(req)
  if (!token) {
    res.status(401).json({ ok: false, message: 'Missing access token' })
    return
  }

  const tokenHash = sha256(token)
  const session = db.sessions.find((item) => item.tokenHash === tokenHash)
  if (!session) {
    res.status(401).json({ ok: false, message: 'Invalid session token' })
    return
  }

  const account = db.accounts.find((item) => item.id === session.accountId)
  if (!account) {
    res.status(401).json({ ok: false, message: 'Account not found for session' })
    return
  }

  session.lastUsedAt = nowIso()
  saveDb()

  const ctx = ensureCtx(req)
  ctx.session = session
  ctx.account = account
  next()
}

function requireApiKey(scope: (typeof VALID_SCOPES)[number]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = parseBearer(req)
    if (!token) {
      const account = ensureLocalAccount()
      const workspace = ensureWorkspace(account.id)
      workspace.updatedAt = nowIso()
      saveDb()

      const ctx = ensureCtx(req)
      ctx.account = account
      ctx.workspace = workspace
      next()
      return
    }

    const keyHash = sha256(token)
    const apiKey = db.apiKeys.find((item) => item.keyHash === keyHash && !item.revokedAt)
    if (!apiKey) {
      res.status(401).json({ ok: false, message: 'Invalid API key' })
      return
    }
    if (!apiKey.scopes.includes(scope)) {
      res.status(403).json({ ok: false, message: `API key missing scope: ${scope}` })
      return
    }

    const account = db.accounts.find((item) => item.id === apiKey.accountId)
    if (!account) {
      res.status(401).json({ ok: false, message: 'Account not found for API key' })
      return
    }
    const workspace = ensureWorkspace(account.id)
    apiKey.lastUsedAt = nowIso()
    workspace.updatedAt = nowIso()
    saveDb()

    const ctx = ensureCtx(req)
    ctx.apiKey = apiKey
    ctx.account = account
    ctx.workspace = workspace
    next()
  }
}

app.get('/health', (_req, res) => {
  const gitStatus = getGitStatus()
  res.json({
    ok: true,
    version: APP_VERSION,
    apiBaseUrl: API_BASE_URL,
    webOrigin: WEB_ORIGIN,
    updateAvailable: gitStatus.updateAvailable,
    currentRevision: gitStatus.currentRevision,
    remoteRevision: gitStatus.remoteRevision,
    remoteName: gitStatus.remoteName,
    branchName: gitStatus.branchName,
  })
})

app.get('/openapi.json', (_req, res) => {
  res.json({
    openapi: '3.1.0',
    info: {
      title: 'Open Canvas API',
      version: APP_VERSION,
      description: 'Open Canvas REST API. Standard routes are under /api/v1 and use envelope responses.',
    },
    servers: [{ url: API_BASE_URL }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'API Key / Access Token',
        },
      },
    },
    paths: {
      '/api/v1/auth/demo-login': {
        post: {
          summary: 'Create demo session for account',
        },
      },
      '/api/v1/auth/api-keys': {
        post: {
          summary: 'Create API key',
          security: [{ bearerAuth: [] }],
        },
        get: {
          summary: 'List API keys',
          security: [{ bearerAuth: [] }],
        },
      },
      '/api/v1/state': {
        get: {
          summary: 'Get workspace state',
          security: [{ bearerAuth: [] }],
        },
      },
      '/api/v1/config': {
        get: {
          summary: 'Get API config for current key workspace',
          security: [{ bearerAuth: [] }],
        },
      },
      '/api/v1/system/update': {
        post: {
          summary: 'Start an in-place update',
          security: [{ bearerAuth: [] }],
        },
      },
      '/api/v1/grids': {
        post: {
          summary: 'Create grid',
          security: [{ bearerAuth: [] }],
        },
      },
      '/api/v1/grids/{gridId}': {
        patch: {
          summary: 'Update grid',
          security: [{ bearerAuth: [] }],
        },
        delete: {
          summary: 'Delete grid',
          security: [{ bearerAuth: [] }],
        },
      },
      '/api/v1/assets': {
        post: {
          summary: 'Upload asset',
          security: [{ bearerAuth: [] }],
        },
      },
      '/api/v1/assets/{assetId}': {
        get: {
          summary: 'Fetch asset',
        },
        delete: {
          summary: 'Delete asset',
          security: [{ bearerAuth: [] }],
        },
      },
      '/api/v1/cards': {
        post: {
          summary: 'Create card',
          security: [{ bearerAuth: [] }],
        },
      },
      '/api/v1/cards/{cardId}': {
        patch: {
          summary: 'Update card',
          security: [{ bearerAuth: [] }],
        },
        delete: {
          summary: 'Delete card',
          security: [{ bearerAuth: [] }],
        },
      },
      '/api/v1/cards/{cardId}/append-note': {
        post: {
          summary: 'Append note content',
          security: [{ bearerAuth: [] }],
        },
      },
    },
  })
})

app.get('/llms-api.txt', (_req, res) => {
  const content = `# Open Canvas API Reference
# Base URL: ${API_BASE_URL}
# Standard Prefix: /api/v1

## Auth
- Session token endpoints (settings / key management):
  Authorization: Bearer <ACCESS_TOKEN>
- Canvas operation endpoints:
  Authorization: Bearer <API_KEY>

## Envelope
- Success: { "data": ... , "meta"?: { ... } }
- Error: { "error": { "code": string, "message": string, "details"?: any } }

## Key Endpoints
- POST /api/v1/auth/demo-login
- POST /api/v1/auth/api-keys
- GET  /api/v1/auth/api-keys
- GET  /api/v1/state?full=1
- POST /api/v1/system/update
- POST /api/v1/grids
- PATCH /api/v1/grids/:gridId
- DELETE /api/v1/grids/:gridId
- POST /api/v1/assets
- GET  /api/v1/assets/:assetId
- DELETE /api/v1/assets/:assetId
- POST /api/v1/cards
- PATCH /api/v1/cards/:cardId
- DELETE /api/v1/cards/:cardId
- POST /api/v1/cards/:cardId/append-note

## Card Rules
- note cards can be created repeatedly
- todo and calendar cards are singleton per grid
- if a singleton card already exists, POST /api/v1/cards reuses it instead of creating a duplicate
- use PATCH /api/v1/cards/:cardId to modify the fixed todo/calendar card
- use PATCH /api/v1/grids/:gridId to rename or activate a grid
- use DELETE /api/v1/grids/:gridId to remove a grid
`
  res.type('text/plain').send(content)
})

app.post('/api/v1/auth/demo-login', (req, res) => {
  const body = req.body as { name?: string; email?: string; provider?: AccountProvider; avatarUrl?: string }

  const name = normalizeName(String(body?.name || ''))
  const fallbackEmail = `${name.toLowerCase().replace(/\s+/g, '.')}@canvas-workbench.local`
  const email = normalizeEmail(String(body?.email || fallbackEmail))
  const provider: AccountProvider = body?.provider === 'google' ? 'google' : 'demo'

  let account = db.accounts.find((item) => item.email === email)
  const now = nowIso()

  if (!account) {
    account = {
      id: `acct-${uid(12)}`,
      name,
      email,
      provider,
      avatarUrl: body?.avatarUrl ? String(body.avatarUrl) : undefined,
      createdAt: now,
      updatedAt: now,
    }
    db.accounts.push(account)
  } else {
    account.name = name
    account.provider = provider
    account.avatarUrl = body?.avatarUrl ? String(body.avatarUrl) : account.avatarUrl
    account.updatedAt = now
  }

  ensureWorkspace(account.id)

  const accessToken = `oc_at_${uid(10)}_${uid(24)}`
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const session: SessionRecord = {
    id: `sess-${uid(12)}`,
    accountId: account.id,
    tokenHash: sha256(accessToken),
    createdAt: now,
    expiresAt,
    lastUsedAt: now,
  }
  db.sessions.push(session)
  saveDb()

  res.json({
    ok: true,
    account: toPublicAccount(account),
    accessToken,
    expiresAt,
    apiBaseUrl: API_BASE_URL,
  })
})

app.get('/api/v1/auth/me', requireSession, (req, res) => {
  const ctx = ensureCtx(req)
  if (!ctx.account || !ctx.session) {
    res.status(500).json({ ok: false, message: 'Session context missing' })
    return
  }
  res.json({
    ok: true,
    account: toPublicAccount(ctx.account),
    session: {
      id: ctx.session.id,
      expiresAt: ctx.session.expiresAt,
      lastUsedAt: ctx.session.lastUsedAt,
    },
  })
})

app.post('/api/v1/auth/api-keys', requireSession, (req, res) => {
  const ctx = ensureCtx(req)
  if (!ctx.account) {
    res.status(500).json({ ok: false, message: 'Account context missing' })
    return
  }

  const body = req.body as { name?: string; scopes?: string[] }
  const name = String(body?.name || 'Open Canvas API Key').trim() || 'Open Canvas API Key'
  const scopesInput = Array.isArray(body?.scopes) ? body.scopes : [...VALID_SCOPES]
  const scopes = Array.from(new Set(scopesInput.filter((scope) => VALID_SCOPES.includes(scope as never))))
  if (scopes.length === 0) {
    res.status(400).json({ ok: false, message: 'No valid scopes provided' })
    return
  }

  const id = `key-${uid(10)}`
  const secret = uid(32)
  const apiKeyValue = `oc_live_${id}_${secret}`
  const record: ApiKeyRecord = {
    id,
    accountId: ctx.account.id,
    name,
    keyHash: sha256(apiKeyValue),
    prefix: apiKeyValue.slice(0, 18),
    scopes,
    createdAt: nowIso(),
    lastUsedAt: nowIso(),
  }

  db.apiKeys.push(record)
  saveDb()

  res.json({
    ok: true,
    apiKey: apiKeyValue,
    key: {
      id: record.id,
      name: record.name,
      prefix: record.prefix,
      scopes: record.scopes,
      createdAt: record.createdAt,
    },
  })
})

app.get('/api/v1/auth/api-keys', requireSession, (req, res) => {
  const ctx = ensureCtx(req)
  if (!ctx.account) {
    res.status(500).json({ ok: false, message: 'Account context missing' })
    return
  }

  const keys = db.apiKeys
    .filter((item) => item.accountId === ctx.account?.id)
    .map((item) => ({
      id: item.id,
      name: item.name,
      prefix: item.prefix,
      scopes: item.scopes,
      createdAt: item.createdAt,
      lastUsedAt: item.lastUsedAt,
      revokedAt: item.revokedAt ?? null,
    }))

  res.json({ ok: true, keys })
})

app.post('/api/v1/auth/api-keys/:keyId/revoke', requireSession, (req, res) => {
  const ctx = ensureCtx(req)
  if (!ctx.account) {
    res.status(500).json({ ok: false, message: 'Account context missing' })
    return
  }

  const keyId = String(req.params.keyId || '')
  const target = db.apiKeys.find((item) => item.id === keyId && item.accountId === ctx.account?.id)
  if (!target) {
    res.status(404).json({ ok: false, message: 'API key not found' })
    return
  }

  target.revokedAt = nowIso()
  saveDb()
  res.json({ ok: true, keyId: target.id, revokedAt: target.revokedAt })
})

app.get('/api/v1/state', requireApiKey('canvas:read'), (req, res) => {
  const ctx = ensureCtx(req)
  if (!ctx.workspace || !ctx.account) {
    res.status(500).json({ ok: false, message: 'Workspace context missing' })
    return
  }
  const full = String(req.query.full || '') === '1'
  res.json({
    ok: true,
    account: toPublicAccount(ctx.account),
    workspace: {
      id: ctx.workspace.id,
      name: ctx.workspace.name,
      activeGridId: ctx.workspace.activeGridId,
      updatedAt: ctx.workspace.updatedAt,
      grids: ctx.workspace.grids.map((grid) => ({
        id: grid.id,
        name: grid.name,
        cardCount: grid.cards.length,
        ...(full ? { cards: grid.cards } : {}),
      })),
    },
    key: ctx.apiKey
      ? {
          id: ctx.apiKey.id,
          scopes: ctx.apiKey.scopes,
          lastUsedAt: ctx.apiKey.lastUsedAt,
        }
      : null,
  })
})

app.get('/api/v1/config', requireApiKey('canvas:read'), (req, res) => {
  const ctx = ensureCtx(req)
  if (!ctx.workspace || !ctx.account) {
    res.status(500).json({ ok: false, message: 'Workspace context missing' })
    return
  }
  res.json({
    ok: true,
    config: {
      apiBaseUrl: API_BASE_URL,
      webOrigin: WEB_ORIGIN,
      workspaceId: ctx.workspace.id,
      accountId: ctx.account.id,
      supportedKinds: ['note', 'hint', 'image', 'video', 'pdf', 'todo', 'calendar'],
      cardPolicies: {
        singletonKinds: ['todo', 'calendar'],
      },
    },
  })
})

app.post('/api/v1/grids', requireApiKey('canvas:write'), (req, res) => {
  const ctx = ensureCtx(req)
  if (!ctx.workspace) {
    res.status(500).json({ ok: false, message: 'Workspace context missing' })
    return
  }

  const body = req.body as CanvasWorkbenchGridCreatePayload
  const requestedGridId = normalizeGridId(body?.id)
  const gridId = requestedGridId || `grid-${uid(10)}`
  const name = String(body?.name || '').trim() || `Grid ${ctx.workspace.grids.length + 1}`

  if (ctx.workspace.grids.some((grid) => grid.id === gridId)) {
    res.status(409).json({ ok: false, message: `Grid already exists: ${gridId}` })
    return
  }

  const grid: GridData = { id: gridId, name, cards: [] }
  ctx.workspace.grids.push(grid)
  if (body?.activate !== false) ctx.workspace.activeGridId = gridId
  ctx.workspace.updatedAt = nowIso()
  saveDb()

  res.json({
    ok: true,
    message: 'Grid created',
    data: {
      gridId,
      name,
      activeGridId: ctx.workspace.activeGridId,
    },
  })
})

app.patch('/api/v1/grids/:gridId', requireApiKey('canvas:write'), (req, res) => {
  const ctx = ensureCtx(req)
  if (!ctx.workspace) {
    res.status(500).json({ ok: false, message: 'Workspace context missing' })
    return
  }

  const gridId = String(req.params.gridId || '').trim()
  if (!gridId) {
    res.status(400).json({ ok: false, message: 'gridId is required' })
    return
  }

  const body = req.body as CanvasWorkbenchGridUpdatePayload
  const grid = ctx.workspace.grids.find((item) => item.id === gridId)
  if (!grid) {
    res.status(404).json({ ok: false, message: `Grid not found: ${gridId}` })
    return
  }

  const hasName = Object.prototype.hasOwnProperty.call(body || {}, 'name')
  const hasActivate = body?.activate === true
  if (!hasName && !hasActivate) {
    res.status(400).json({ ok: false, message: 'Grid update payload required' })
    return
  }

  if (hasName) {
    grid.name = String(body?.name || '').trim() || grid.name
  }
  if (hasActivate) {
    ctx.workspace.activeGridId = grid.id
  }

  ctx.workspace.updatedAt = nowIso()
  saveDb()

  res.json({
    ok: true,
    message: hasName ? 'Grid updated' : 'Grid activated',
    data: {
      gridId: grid.id,
      name: grid.name,
      activeGridId: ctx.workspace.activeGridId,
    },
  })
})

app.delete('/api/v1/grids/:gridId', requireApiKey('canvas:write'), (req, res) => {
  const ctx = ensureCtx(req)
  if (!ctx.workspace) {
    res.status(500).json({ ok: false, message: 'Workspace context missing' })
    return
  }

  const gridId = String(req.params.gridId || '').trim()
  if (!gridId) {
    res.status(400).json({ ok: false, message: 'gridId is required' })
    return
  }

  if (ctx.workspace.grids.length <= 1) {
    res.status(409).json({ ok: false, message: 'At least one grid must remain' })
    return
  }

  const index = ctx.workspace.grids.findIndex((grid) => grid.id === gridId)
  if (index < 0) {
    res.status(404).json({ ok: false, message: `Grid not found: ${gridId}` })
    return
  }

  ctx.workspace.grids.splice(index, 1)
  if (ctx.workspace.activeGridId === gridId) {
    const fallbackGrid = ctx.workspace.grids[Math.max(0, index - 1)] ?? ctx.workspace.grids[0]
    if (fallbackGrid) {
      ctx.workspace.activeGridId = fallbackGrid.id
    }
  }

  ctx.workspace.updatedAt = nowIso()
  saveDb()

  res.json({
    ok: true,
    message: 'Grid deleted',
    data: {
      gridId,
      activeGridId: ctx.workspace.activeGridId,
    },
  })
})

app.post('/api/v1/assets', requireApiKey('canvas:write'), (req, res) => {
  const ctx = ensureCtx(req)
  if (!ctx.workspace || !ctx.account) {
    res.status(500).json({ ok: false, message: 'Workspace context missing' })
    return
  }

  const body = req.body as { id?: string; name?: string; type?: string; dataUrl?: string }
  const parsed = parseDataUrl(body?.dataUrl)
  if (!parsed) {
    res.status(400).json({ ok: false, message: 'Valid dataUrl is required' })
    return
  }

  const assetId = normalizeAssetId(body?.id) || `asset-${uid(12)}`
  const now = nowIso()
  const existingIndex = db.assets.findIndex(
    (asset) => asset.id === assetId && asset.workspaceId === ctx.workspace?.id,
  )
  const record: AssetRecord = {
    id: assetId,
    accountId: ctx.account.id,
    workspaceId: ctx.workspace.id,
    name: normalizeAssetName(body?.name),
    type: sanitizeMimeType(body?.type || parsed.mimeType),
    size: parsed.buffer.length,
    publicToken: existingIndex >= 0 ? db.assets[existingIndex].publicToken : uid(24),
    createdAt: existingIndex >= 0 ? db.assets[existingIndex].createdAt : now,
    updatedAt: now,
  }

  ensureAssetDir(ctx.workspace.id)
  const filePath = getAssetFilePath(ctx.workspace.id, assetId)
  fs.writeFileSync(filePath, parsed.buffer)

  if (existingIndex >= 0) {
    db.assets[existingIndex] = record
  } else {
    db.assets.push(record)
  }
  saveDb()

  res.json({
    ok: true,
    message: 'Asset uploaded',
    data: {
      assetId: record.id,
      assetUrl: toAssetUrl(record.id, record.publicToken),
      asset: {
        id: record.id,
        name: record.name,
        type: record.type,
        size: record.size,
        assetUrl: toAssetUrl(record.id, record.publicToken),
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
    },
  })
})

app.get('/api/v1/assets/:assetId', (req, res) => {
  const assetId = String(req.params.assetId || '').trim()
  const token = String(req.query.token || '').trim()
  if (!assetId || !token) {
    res.status(400).json({ ok: false, message: 'assetId and token are required' })
    return
  }

  const record = db.assets.find((asset) => asset.id === assetId)
  if (!record) {
    res.status(404).json({ ok: false, message: `Asset not found: ${assetId}` })
    return
  }

  if (record.publicToken !== token) {
    res.status(403).json({ ok: false, message: 'Invalid asset token' })
    return
  }

  const filePath = getAssetFilePath(record.workspaceId, record.id)
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ ok: false, message: 'Asset file missing' })
    return
  }

  res.setHeader('Content-Type', record.type || 'application/octet-stream')
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  fs.createReadStream(filePath).pipe(res)
})

app.delete('/api/v1/assets/:assetId', requireApiKey('canvas:write'), (req, res) => {
  const ctx = ensureCtx(req)
  if (!ctx.workspace) {
    res.status(500).json({ ok: false, message: 'Workspace context missing' })
    return
  }

  const assetId = String(req.params.assetId || '').trim()
  if (!assetId) {
    res.status(400).json({ ok: false, message: 'assetId is required' })
    return
  }

  const index = db.assets.findIndex((asset) => asset.id === assetId && asset.workspaceId === ctx.workspace?.id)
  if (index < 0) {
    res.status(404).json({ ok: false, message: `Asset not found: ${assetId}` })
    return
  }

  const record = db.assets[index]
  const filePath = getAssetFilePath(record.workspaceId, record.id)
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }

  db.assets.splice(index, 1)
  saveDb()

  res.json({ ok: true, message: 'Asset deleted', data: { assetId } })
})

app.post('/api/v1/system/update', requireSession, (req, res) => {
  if (!isGitCheckout()) {
    res.status(400).json({
      ok: false,
      message:
        'Online update is only available for git checkout installs. Reinstall from the repository to enable in-place updates.',
    })
    return
  }

  if (!isWorkingTreeClean()) {
    res.status(409).json({
      ok: false,
      message: 'Working tree has local changes. Commit or stash them before updating.',
    })
    return
  }

  const webPort = resolvePortFromOrigin(WEB_ORIGIN, 5173)
  const logPath = UPDATE_LOG_PATH
  const cliBinPath = path.resolve(process.cwd(), 'bin', 'canvas-workbench.mjs')
  if (!fs.existsSync(cliBinPath)) {
    res.status(500).json({ ok: false, message: 'CLI entry point not found' })
    return
  }

  try {
    const pid = spawnDetachedCommand(
      process.execPath,
      [cliBinPath, 'update', '--no-open', '--port', String(webPort), '--api-port', String(API_PORT)],
      {
        CANVAS_WORKBENCH_API_HOST: API_HOST,
        CANVAS_WORKBENCH_API_PORT: String(API_PORT),
        CANVAS_WORKBENCH_API_BASE_URL: API_BASE_URL,
        CANVAS_WORKBENCH_WEB_ORIGIN: WEB_ORIGIN,
      },
      logPath,
    )

    res.json({
      ok: true,
      message: 'Update started',
      data: {
        started: true,
        pid,
        logPath,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    res.status(500).json({ ok: false, message: `Failed to start update: ${message}` })
  }
})

app.post('/api/v1/cards', requireApiKey('canvas:write'), (req, res) => {
  const ctx = ensureCtx(req)
  if (!ctx.workspace) {
    res.status(500).json({ ok: false, message: 'Workspace context missing' })
    return
  }

  const body = (req.body || {}) as CanvasWorkbenchCreateCardPayload
  const kind = parseCardKind(body.kind)
  const requestedCardId = normalizeCardId(body.id ?? body.cardId)

  const targetGrid =
    (body.gridId ? ctx.workspace.grids.find((grid) => grid.id === body.gridId) : null) ||
    ctx.workspace.grids.find((grid) => grid.id === ctx.workspace.activeGridId) ||
    ctx.workspace.grids[0]

  if (!targetGrid) {
    res.status(400).json({ ok: false, message: 'No grid available' })
    return
  }

  const existingSingletonCard = isSingletonCardKind(kind)
    ? targetGrid.cards.find((card) => card.kind === kind) ?? null
    : null
  if (existingSingletonCard) {
    if (body.activateGrid) {
      ctx.workspace.activeGridId = targetGrid.id
      saveDb()
    }

    res.json({
      ok: true,
      message: 'Card reused',
      data: { cardId: existingSingletonCard.id, gridId: targetGrid.id, card: existingSingletonCard },
    })
    return
  }

  const cardId = requestedCardId || `${kind}-${uid(14)}`
  if (targetGrid.cards.some((card) => card.id === cardId)) {
    res.status(409).json({ ok: false, message: `Card already exists: ${cardId}` })
    return
  }

  const width = clamp(toFiniteNumber(body.width, kind === 'calendar' ? 760 : kind === 'todo' ? 760 : 420), 220, 1400)
  const height = clamp(toFiniteNumber(body.height, kind === 'calendar' ? 520 : kind === 'todo' ? 420 : 300), 160, 1200)
  const x = clamp(toFiniteNumber(body.x, randomInt(120, 860)), -200, 6000)
  const y = clamp(toFiniteNumber(body.y, randomInt(120, 860)), -200, 4000)

  const card: CardData = {
    id: cardId,
    kind,
    title: String(body.title || '').trim() || inferDefaultTitle(kind),
    content: String(body.content || ''),
    x,
    y,
    width,
    height,
  }

  if (kind === 'image' || kind === 'video' || kind === 'pdf') {
    card.fileName = String(body.fileName || '').trim() || `${kind}-${uid(6)}`
    card.externalUrl = String(body.mediaUrl || '').trim()
  }
  if (kind === 'todo') {
    card.todoItems = normalizeTodoItems(body.todoItems)
  }
  if (kind === 'calendar') {
    card.calendar = normalizeCalendar(body.calendar)
  }

  targetGrid.cards.push(card)
  if (body.activateGrid) ctx.workspace.activeGridId = targetGrid.id
  ctx.workspace.updatedAt = nowIso()
  saveDb()

  res.json({
    ok: true,
    message: 'Card created',
    data: { cardId: card.id, gridId: targetGrid.id, card },
  })
})

app.patch('/api/v1/cards/:cardId', requireApiKey('canvas:write'), (req, res) => {
  const ctx = ensureCtx(req)
  if (!ctx.workspace) {
    res.status(500).json({ ok: false, message: 'Workspace context missing' })
    return
  }

  const cardId = String(req.params.cardId || '').trim()
  if (!cardId) {
    res.status(400).json({ ok: false, message: 'cardId is required' })
    return
  }

  const body = req.body as Partial<
    Pick<CardData, 'title' | 'content' | 'x' | 'y' | 'width' | 'height' | 'fileName' | 'externalUrl' | 'todoItems' | 'calendar'>
  > & {
    mediaUrl?: string
  }
  let updatedCard: CardData | null = null
  let targetGridId: string | null = null

  for (const grid of ctx.workspace.grids) {
    const index = grid.cards.findIndex((card) => card.id === cardId)
    if (index < 0) continue
    const current = grid.cards[index]
    const next: CardData = {
      ...current,
      title: body.title !== undefined ? String(body.title || '').trim() || current.title : current.title,
      content: body.content !== undefined ? String(body.content || '') : current.content,
      x: body.x !== undefined ? clamp(toFiniteNumber(body.x, current.x), -200, 6000) : current.x,
      y: body.y !== undefined ? clamp(toFiniteNumber(body.y, current.y), -200, 4000) : current.y,
      width: body.width !== undefined ? clamp(toFiniteNumber(body.width, current.width), 220, 1400) : current.width,
      height: body.height !== undefined ? clamp(toFiniteNumber(body.height, current.height), 160, 1200) : current.height,
    }
    if (body.fileName !== undefined) {
      next.fileName = String(body.fileName || '').trim() || undefined
    }
    if (body.externalUrl !== undefined || body.mediaUrl !== undefined) {
      next.externalUrl = String(body.externalUrl ?? body.mediaUrl ?? '').trim() || undefined
    }
    if (body.todoItems !== undefined) {
      next.todoItems = normalizeTodoItems(body.todoItems)
    }
    if (body.calendar !== undefined) {
      next.calendar = normalizeCalendar(body.calendar)
    }
    grid.cards[index] = next
    updatedCard = next
    targetGridId = grid.id
    break
  }

  if (!updatedCard || !targetGridId) {
    res.status(404).json({ ok: false, message: `Card not found: ${cardId}` })
    return
  }

  ctx.workspace.updatedAt = nowIso()
  saveDb()
  res.json({ ok: true, message: 'Card updated', data: { cardId, gridId: targetGridId, card: updatedCard } })
})

app.delete('/api/v1/cards/:cardId', requireApiKey('canvas:write'), (req, res) => {
  const ctx = ensureCtx(req)
  if (!ctx.workspace) {
    res.status(500).json({ ok: false, message: 'Workspace context missing' })
    return
  }

  const cardId = String(req.params.cardId || '').trim()
  if (!cardId) {
    res.status(400).json({ ok: false, message: 'cardId is required' })
    return
  }

  for (const grid of ctx.workspace.grids) {
    const index = grid.cards.findIndex((card) => card.id === cardId)
    if (index < 0) continue

    grid.cards.splice(index, 1)
    ctx.workspace.updatedAt = nowIso()
    saveDb()
    res.json({ ok: true, message: 'Card deleted', data: { cardId, gridId: grid.id } })
    return
  }

  res.status(404).json({ ok: false, message: `Card not found: ${cardId}` })
})

app.post('/api/v1/cards/:cardId/append-note', requireApiKey('canvas:write'), (req, res) => {
  const ctx = ensureCtx(req)
  if (!ctx.workspace) {
    res.status(500).json({ ok: false, message: 'Workspace context missing' })
    return
  }

  const cardId = String(req.params.cardId || '').trim()
  const text = String((req.body as { text?: string })?.text || '')
  if (!cardId || !text.trim()) {
    res.status(400).json({ ok: false, message: 'cardId and text are required' })
    return
  }

  for (const grid of ctx.workspace.grids) {
    const card = grid.cards.find((item) => item.id === cardId)
    if (!card) continue
    card.content = card.content ? `${card.content}\n${text}` : text
    ctx.workspace.updatedAt = nowIso()
    saveDb()
    res.json({ ok: true, message: 'Content appended', data: { cardId, gridId: grid.id } })
    return
  }

  res.status(404).json({ ok: false, message: `Card not found: ${cardId}` })
})

app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  void next
  const message = error instanceof Error ? error.message : String(error)
  res.status(500).json({ ok: false, message })
})

app.listen(API_PORT, API_HOST, () => {
  console.log(`[canvas-workbench-api] v${APP_VERSION} listening on ${API_BASE_URL}`)
  console.log(`[canvas-workbench-api] web origin: ${WEB_ORIGIN}`)
  console.log(`[canvas-workbench-api] db: ${DB_PATH}`)
})
