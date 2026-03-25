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
}

type OpenCanvasCreateCardPayload = {
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

type RequestContext = {
  account?: AccountRecord
  session?: SessionRecord
  apiKey?: ApiKeyRecord
  workspace?: WorkspaceRecord
}

const APP_VERSION = '0.2.0-api'
const API_HOST = process.env.OPEN_CANVAS_API_HOST || '127.0.0.1'
const API_PORT = Number(process.env.OPEN_CANVAS_API_PORT || '8787')
const API_BASE_URL = process.env.OPEN_CANVAS_API_BASE_URL || `http://${API_HOST}:${API_PORT}`
const WEB_ORIGIN = process.env.OPEN_CANVAS_WEB_ORIGIN || 'http://127.0.0.1:5173'
const DB_PATH = path.join(process.cwd(), '.runtime', 'api-db.json')
const UPDATE_LOG_PATH = path.join(process.cwd(), '.runtime', 'update.log')
const SESSION_TTL_DAYS = 30
const VALID_SCOPES = ['canvas:read', 'canvas:write'] as const
const STANDARD_PREFIX = '/api/v1'

const app = express()
app.use(
  cors({
    origin: true,
    credentials: false,
  }),
)
app.use(express.json({ limit: '2mb' }))

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

function normalizeTodoItems(input: OpenCanvasCreateCardPayload['todoItems']): TodoItem[] {
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

function normalizeCalendar(input: OpenCanvasCreateCardPayload['calendar']): CalendarState {
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
      res.status(401).json({ ok: false, message: 'Missing API key' })
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
  res.json({
    ok: true,
    version: APP_VERSION,
    apiBaseUrl: API_BASE_URL,
    webOrigin: WEB_ORIGIN,
    updateAvailable: isGitCheckout(),
  })
})

app.get('/openapi.json', (_req, res) => {
  res.json({
    openapi: '3.1.0',
    info: {
      title: 'Open Canvas API',
      version: APP_VERSION,
      description:
        'Open Canvas REST API for OpenClaw integrations. Standard routes are under /api/v1 and use envelope responses.',
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
      '/api/v1/openclaw/skill': {
        get: {
          summary: 'Get OpenClaw skill template',
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
- GET  /api/v1/openclaw/skill
- GET  /api/v1/state?full=1
- POST /api/v1/system/update
- POST /api/v1/grids
- POST /api/v1/cards
- PATCH /api/v1/cards/:cardId
- POST /api/v1/cards/:cardId/append-note
`
  res.type('text/plain').send(content)
})

app.post('/api/v1/auth/demo-login', (req, res) => {
  const body = req.body as { name?: string; email?: string; provider?: AccountProvider; avatarUrl?: string }

  const name = normalizeName(String(body?.name || ''))
  const fallbackEmail = `${name.toLowerCase().replace(/\s+/g, '.')}@open-canvas.local`
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
  const name = String(body?.name || 'OpenClaw Skill Key').trim() || 'OpenClaw Skill Key'
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

app.get('/api/v1/openclaw/skill', requireSession, (req, res) => {
  const ctx = ensureCtx(req)
  if (!ctx.account) {
    res.status(500).json({ ok: false, message: 'Account context missing' })
    return
  }

  const skill = {
    name: 'open-canvas-api',
    description: 'Open Canvas API skill for account bound automation',
    auth: { type: 'bearer', header: 'Authorization', format: 'Bearer <API_KEY>' },
    baseUrl: API_BASE_URL,
    defaultHeaders: {
      'Content-Type': 'application/json',
      'X-Open-Canvas-Source': 'openclaw',
    },
    endpoints: {
      createGrid: { method: 'POST', path: '/api/v1/grids' },
      createCard: { method: 'POST', path: '/api/v1/cards' },
      updateCard: { method: 'PATCH', path: '/api/v1/cards/:cardId' },
      appendNote: { method: 'POST', path: '/api/v1/cards/:cardId/append-note' },
      getState: { method: 'GET', path: '/api/v1/state?full=1' },
    },
    exampleCreateCard: {
      method: 'POST',
      path: '/api/v1/cards',
      body: { kind: 'note', title: 'From OpenClaw', content: 'Auto created by API skill' },
    },
  }

  res.json({
    ok: true,
    account: toPublicAccount(ctx.account),
    skill,
    setup: {
      step1: 'Generate API key from /api/v1/auth/api-keys.',
      step2: 'Put API key into OpenClaw skill auth bearer token.',
      step3: 'Call /api/v1/cards or /api/v1/grids directly from skill.',
    },
  })
})

app.get('/api/v1/state', requireApiKey('canvas:read'), (req, res) => {
  const ctx = ensureCtx(req)
  if (!ctx.workspace || !ctx.account || !ctx.apiKey) {
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
    key: {
      id: ctx.apiKey.id,
      scopes: ctx.apiKey.scopes,
      lastUsedAt: ctx.apiKey.lastUsedAt,
    },
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
    },
  })
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
  const cliBinPath = path.resolve(process.cwd(), 'bin', 'open-canvas.mjs')
  if (!fs.existsSync(cliBinPath)) {
    res.status(500).json({ ok: false, message: 'CLI entry point not found' })
    return
  }

  try {
    const pid = spawnDetachedCommand(
      process.execPath,
      [cliBinPath, 'update', '--no-open', '--port', String(webPort), '--api-port', String(API_PORT)],
      {
        OPEN_CANVAS_API_HOST: API_HOST,
        OPEN_CANVAS_API_PORT: String(API_PORT),
        OPEN_CANVAS_API_BASE_URL: API_BASE_URL,
        OPEN_CANVAS_WEB_ORIGIN: WEB_ORIGIN,
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

app.post('/api/v1/grids', requireApiKey('canvas:write'), (req, res) => {
  const ctx = ensureCtx(req)
  if (!ctx.workspace) {
    res.status(500).json({ ok: false, message: 'Workspace context missing' })
    return
  }

  const body = req.body as { name?: string; activate?: boolean }
  const name = String(body?.name || '').trim() || `Grid ${ctx.workspace.grids.length + 1}`
  const gridId = `grid-${uid(10)}`
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

app.post('/api/v1/cards', requireApiKey('canvas:write'), (req, res) => {
  const ctx = ensureCtx(req)
  if (!ctx.workspace) {
    res.status(500).json({ ok: false, message: 'Workspace context missing' })
    return
  }

  const body = (req.body || {}) as OpenCanvasCreateCardPayload
  const kind = parseCardKind(body.kind)

  const targetGrid =
    (body.gridId ? ctx.workspace.grids.find((grid) => grid.id === body.gridId) : null) ||
    ctx.workspace.grids.find((grid) => grid.id === ctx.workspace.activeGridId) ||
    ctx.workspace.grids[0]

  if (!targetGrid) {
    res.status(400).json({ ok: false, message: 'No grid available' })
    return
  }

  const width = clamp(Number(body.width) || (kind === 'calendar' ? 760 : kind === 'todo' ? 760 : 420), 220, 1400)
  const height = clamp(Number(body.height) || (kind === 'calendar' ? 520 : kind === 'todo' ? 420 : 300), 160, 1200)
  const x = clamp(Number(body.x) || randomInt(120, 860), -200, 6000)
  const y = clamp(Number(body.y) || randomInt(120, 860), -200, 4000)

  const card: CardData = {
    id: `${kind}-${uid(14)}`,
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

  const body = req.body as Partial<Pick<CardData, 'title' | 'content' | 'x' | 'y' | 'width' | 'height'>>
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
      x: body.x !== undefined ? clamp(Number(body.x) || current.x, -200, 6000) : current.x,
      y: body.y !== undefined ? clamp(Number(body.y) || current.y, -200, 4000) : current.y,
      width: body.width !== undefined ? clamp(Number(body.width) || current.width, 220, 1400) : current.width,
      height: body.height !== undefined ? clamp(Number(body.height) || current.height, 160, 1200) : current.height,
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
  console.log(`[open-canvas-api] v${APP_VERSION} listening on ${API_BASE_URL}`)
  console.log(`[open-canvas-api] web origin: ${WEB_ORIGIN}`)
  console.log(`[open-canvas-api] db: ${DB_PATH}`)
})
