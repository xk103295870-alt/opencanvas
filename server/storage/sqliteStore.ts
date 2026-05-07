import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import type { CardData, GridData } from '../../src/shared/workspaceTypes'

export type AssetRecord = {
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

export type WorkspaceRecord = {
  id: string
  accountId: string
  name: string
  activeGridId: string
  revision: number
  grids: GridData[]
  createdAt: string
  updatedAt: string
}

export type AccountProvider = 'demo' | 'google'

export type AccountRecord = {
  id: string
  name: string
  email: string
  provider: AccountProvider
  avatarUrl?: string
  createdAt: string
  updatedAt: string
}

export type SessionRecord = {
  id: string
  accountId: string
  tokenHash: string
  createdAt: string
  expiresAt: string
  lastUsedAt: string
}

export type ApiKeyRecord = {
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

export type ApiDb = {
  version: number
  accounts: AccountRecord[]
  sessions: SessionRecord[]
  apiKeys: ApiKeyRecord[]
  workspaces: WorkspaceRecord[]
  assets: AssetRecord[]
}

type WorkspaceRow = {
  id: string
  accountId: string
  name: string
  activeGridId: string
  revision: number
  createdAt: string
  updatedAt: string
}

type GridRow = {
  id: string
  workspaceId: string
  name: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

type CardRow = {
  id: string
  workspaceId: string
  gridId: string
  kind: CardData['kind']
  title: string
  content: string
  x: number
  y: number
  width: number
  height: number
  fileId: string | null
  fileName: string | null
  externalUrl: string | null
  todoItemsJson: string | null
  calendarJson: string | null
  eventFlowJson: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

type AccountRow = Omit<AccountRecord, 'avatarUrl'> & { avatarUrl: string | null }
type ApiKeyRow = Omit<ApiKeyRecord, 'scopes' | 'revokedAt'> & { scopesJson: string; revokedAt: string | null }
type AssetRow = AssetRecord

const SCHEMA_VERSION = '1'

const jsonStringify = (value: unknown) => JSON.stringify(value ?? null)

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function ensureDirFor(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

function accountFromRow(row: AccountRow): AccountRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    provider: row.provider,
    ...(row.avatarUrl ? { avatarUrl: row.avatarUrl } : {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function apiKeyFromRow(row: ApiKeyRow): ApiKeyRecord {
  return {
    id: row.id,
    accountId: row.accountId,
    name: row.name,
    keyHash: row.keyHash,
    prefix: row.prefix,
    scopes: parseJson<string[]>(row.scopesJson, []),
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    ...(row.revokedAt ? { revokedAt: row.revokedAt } : {}),
  }
}

function cardFromRow(row: CardRow): CardData {
  const card: CardData = {
    id: row.id,
    kind: row.kind,
    title: row.title,
    content: row.content,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
  }
  if (row.fileId) card.fileId = row.fileId
  if (row.fileName) card.fileName = row.fileName
  if (row.externalUrl) card.externalUrl = row.externalUrl
  if (row.todoItemsJson) card.todoItems = parseJson(row.todoItemsJson, [])
  if (row.calendarJson) card.calendar = parseJson(row.calendarJson, undefined)
  if (row.eventFlowJson) card.eventFlow = parseJson(row.eventFlowJson, undefined)
  return card
}

export class SqliteStore {
  private db: Database.Database

  constructor(
    private readonly dbPath: string,
    private readonly legacyJsonPath: string,
  ) {
    ensureDirFor(dbPath)
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.migrateSchema()
    this.importLegacyJsonIfNeeded()
  }

  get databasePath() {
    return this.dbPath
  }

  private migrateSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        provider TEXT NOT NULL,
        avatarUrl TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        accountId TEXT NOT NULL,
        tokenHash TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        expiresAt TEXT NOT NULL,
        lastUsedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_tokenHash ON sessions(tokenHash);
      CREATE INDEX IF NOT EXISTS idx_sessions_accountId ON sessions(accountId);

      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        accountId TEXT NOT NULL,
        name TEXT NOT NULL,
        keyHash TEXT NOT NULL,
        prefix TEXT NOT NULL,
        scopesJson TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        lastUsedAt TEXT NOT NULL,
        revokedAt TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_api_keys_keyHash ON api_keys(keyHash);
      CREATE INDEX IF NOT EXISTS idx_api_keys_accountId ON api_keys(accountId);

      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        accountId TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        activeGridId TEXT NOT NULL,
        revision INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS grids (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        name TEXT NOT NULL,
        sortOrder INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_grids_workspaceId ON grids(workspaceId, sortOrder);

      CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        gridId TEXT NOT NULL,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        x REAL NOT NULL,
        y REAL NOT NULL,
        width REAL NOT NULL,
        height REAL NOT NULL,
        fileId TEXT,
        fileName TEXT,
        externalUrl TEXT,
        todoItemsJson TEXT,
        calendarJson TEXT,
        eventFlowJson TEXT,
        sortOrder INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cards_gridId ON cards(gridId, sortOrder);
      CREATE INDEX IF NOT EXISTS idx_cards_workspaceId ON cards(workspaceId);

      CREATE TABLE IF NOT EXISTS assets (
        id TEXT NOT NULL,
        workspaceId TEXT NOT NULL,
        accountId TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        size INTEGER NOT NULL,
        publicToken TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        PRIMARY KEY(id, workspaceId)
      );
      CREATE INDEX IF NOT EXISTS idx_assets_workspaceId ON assets(workspaceId);
    `)
    this.ensureColumn('cards', 'eventFlowJson', 'TEXT')
    this.setMeta('schemaVersion', SCHEMA_VERSION)
  }

  private ensureColumn(tableName: string, columnName: string, definition: string) {
    const rows = this.db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>
    if (rows.some((row) => row.name === columnName)) return
    this.db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`).run()
  }

  private importLegacyJsonIfNeeded() {
    const migrated = this.getMeta('jsonMigrationCompletedAt')
    const workspaceCount = this.db.prepare('SELECT COUNT(*) AS count FROM workspaces').get() as { count: number }
    if (migrated || workspaceCount.count > 0 || !fs.existsSync(this.legacyJsonPath)) return

    try {
      const parsed = JSON.parse(fs.readFileSync(this.legacyJsonPath, 'utf8')) as Partial<ApiDb>
      const legacy: ApiDb = {
        version: 1,
        accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        apiKeys: Array.isArray(parsed.apiKeys) ? parsed.apiKeys : [],
        workspaces: Array.isArray(parsed.workspaces) ? parsed.workspaces : [],
        assets: Array.isArray(parsed.assets) ? parsed.assets : [],
      }
      const importAll = this.db.transaction(() => {
        legacy.accounts.forEach((account) => this.upsertAccount(account))
        legacy.sessions.forEach((session) => this.upsertSession(session))
        legacy.apiKeys.forEach((apiKey) => this.upsertApiKey(apiKey))
        legacy.workspaces.forEach((workspace) => this.upsertWorkspace(workspace))
        legacy.assets.forEach((asset) => this.upsertAsset(asset))
        this.setMeta('jsonMigrationCompletedAt', new Date().toISOString())
      })
      importAll()
    } catch (error) {
      console.error('[canvas-workbench-api] failed to import legacy JSON DB:', error)
    }
  }

  getMeta(key: string) {
    const row = this.db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined
    return row?.value ?? null
  }

  setMeta(key: string, value: string) {
    this.db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value)
  }

  get accounts() {
    return this.db.prepare('SELECT * FROM accounts ORDER BY createdAt').all().map((row) => accountFromRow(row as AccountRow))
  }

  get sessions() {
    return this.db.prepare('SELECT * FROM sessions ORDER BY createdAt').all() as SessionRecord[]
  }

  set sessions(items: SessionRecord[]) {
    const replace = this.db.transaction(() => {
      this.db.prepare('DELETE FROM sessions').run()
      items.forEach((item) => this.upsertSession(item))
    })
    replace()
  }

  get apiKeys() {
    return this.db.prepare('SELECT * FROM api_keys ORDER BY createdAt').all().map((row) => apiKeyFromRow(row as ApiKeyRow))
  }

  get workspaces() {
    const rows = this.db.prepare('SELECT * FROM workspaces ORDER BY createdAt').all() as WorkspaceRow[]
    return rows.map((row) => this.workspaceFromRow(row))
  }

  get assets() {
    return this.db.prepare('SELECT * FROM assets ORDER BY createdAt').all() as AssetRecord[]
  }

  snapshot(): ApiDb {
    return {
      version: 1,
      accounts: this.accounts,
      sessions: this.sessions,
      apiKeys: this.apiKeys,
      workspaces: this.workspaces,
      assets: this.assets,
    }
  }

  replaceAll(next: ApiDb) {
    const replace = this.db.transaction(() => {
      this.db.prepare('DELETE FROM assets').run()
      this.db.prepare('DELETE FROM cards').run()
      this.db.prepare('DELETE FROM grids').run()
      this.db.prepare('DELETE FROM workspaces').run()
      this.db.prepare('DELETE FROM api_keys').run()
      this.db.prepare('DELETE FROM sessions').run()
      this.db.prepare('DELETE FROM accounts').run()
      next.accounts.forEach((account) => this.upsertAccount(account))
      next.sessions.forEach((session) => this.upsertSession(session))
      next.apiKeys.forEach((apiKey) => this.upsertApiKey(apiKey))
      next.workspaces.forEach((workspace) => this.upsertWorkspace(workspace))
      next.assets.forEach((asset) => this.upsertAsset(asset))
    })
    replace()
  }

  upsertAccount(account: AccountRecord) {
    this.db
      .prepare(`
        INSERT INTO accounts (id, name, email, provider, avatarUrl, createdAt, updatedAt)
        VALUES (@id, @name, @email, @provider, @avatarUrl, @createdAt, @updatedAt)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          email = excluded.email,
          provider = excluded.provider,
          avatarUrl = excluded.avatarUrl,
          createdAt = excluded.createdAt,
          updatedAt = excluded.updatedAt
      `)
      .run({ ...account, avatarUrl: account.avatarUrl ?? null })
  }

  upsertSession(session: SessionRecord) {
    this.db
      .prepare(`
        INSERT INTO sessions (id, accountId, tokenHash, createdAt, expiresAt, lastUsedAt)
        VALUES (@id, @accountId, @tokenHash, @createdAt, @expiresAt, @lastUsedAt)
        ON CONFLICT(id) DO UPDATE SET
          accountId = excluded.accountId,
          tokenHash = excluded.tokenHash,
          createdAt = excluded.createdAt,
          expiresAt = excluded.expiresAt,
          lastUsedAt = excluded.lastUsedAt
      `)
      .run(session)
  }

  upsertApiKey(apiKey: ApiKeyRecord) {
    this.db
      .prepare(`
        INSERT INTO api_keys (id, accountId, name, keyHash, prefix, scopesJson, createdAt, lastUsedAt, revokedAt)
        VALUES (@id, @accountId, @name, @keyHash, @prefix, @scopesJson, @createdAt, @lastUsedAt, @revokedAt)
        ON CONFLICT(id) DO UPDATE SET
          accountId = excluded.accountId,
          name = excluded.name,
          keyHash = excluded.keyHash,
          prefix = excluded.prefix,
          scopesJson = excluded.scopesJson,
          createdAt = excluded.createdAt,
          lastUsedAt = excluded.lastUsedAt,
          revokedAt = excluded.revokedAt
      `)
      .run({ ...apiKey, scopesJson: jsonStringify(apiKey.scopes), revokedAt: apiKey.revokedAt ?? null })
  }

  upsertWorkspace(workspace: WorkspaceRecord) {
    const now = workspace.updatedAt || new Date().toISOString()
    const insert = this.db.transaction(() => {
      this.db
        .prepare(`
          INSERT INTO workspaces (id, accountId, name, activeGridId, revision, createdAt, updatedAt)
          VALUES (@id, @accountId, @name, @activeGridId, @revision, @createdAt, @updatedAt)
          ON CONFLICT(id) DO UPDATE SET
            accountId = excluded.accountId,
            name = excluded.name,
            activeGridId = excluded.activeGridId,
            revision = excluded.revision,
            createdAt = excluded.createdAt,
            updatedAt = excluded.updatedAt
        `)
        .run({
          id: workspace.id,
          accountId: workspace.accountId,
          name: workspace.name,
          activeGridId: workspace.activeGridId,
          revision: workspace.revision ?? 0,
          createdAt: workspace.createdAt,
          updatedAt: workspace.updatedAt,
        })
      this.replaceWorkspaceGrids(workspace.id, workspace.grids, now)
    })
    insert()
  }

  replaceWorkspace(workspace: WorkspaceRecord) {
    this.upsertWorkspace(workspace)
  }

  upsertAsset(asset: AssetRecord) {
    this.db
      .prepare(`
        INSERT INTO assets (id, workspaceId, accountId, name, type, size, publicToken, createdAt, updatedAt)
        VALUES (@id, @workspaceId, @accountId, @name, @type, @size, @publicToken, @createdAt, @updatedAt)
        ON CONFLICT(id, workspaceId) DO UPDATE SET
          accountId = excluded.accountId,
          name = excluded.name,
          type = excluded.type,
          size = excluded.size,
          publicToken = excluded.publicToken,
          createdAt = excluded.createdAt,
          updatedAt = excluded.updatedAt
      `)
      .run(asset)
  }

  deleteAsset(assetId: string, workspaceId: string) {
    this.db.prepare('DELETE FROM assets WHERE id = ? AND workspaceId = ?').run(assetId, workspaceId)
  }

  replaceWorkspaceGrids(workspaceId: string, grids: GridData[], now = new Date().toISOString()) {
    this.db.prepare('DELETE FROM cards WHERE workspaceId = ?').run(workspaceId)
    this.db.prepare('DELETE FROM grids WHERE workspaceId = ?').run(workspaceId)
    grids.forEach((grid, gridIndex) => {
      this.insertGrid(workspaceId, grid, gridIndex, now)
      grid.cards.forEach((card, cardIndex) => this.insertCard(workspaceId, grid.id, card, cardIndex, now))
    })
  }

  insertGrid(workspaceId: string, grid: GridData, sortOrder: number, now = new Date().toISOString()) {
    this.db
      .prepare(`
        INSERT INTO grids (id, workspaceId, name, sortOrder, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          workspaceId = excluded.workspaceId,
          name = excluded.name,
          sortOrder = excluded.sortOrder,
          updatedAt = excluded.updatedAt
      `)
      .run(grid.id, workspaceId, grid.name, sortOrder, now, now)
  }

  updateGrid(gridId: string, updates: { name?: string }) {
    if (updates.name === undefined) return
    this.db.prepare('UPDATE grids SET name = ?, updatedAt = ? WHERE id = ?').run(updates.name, new Date().toISOString(), gridId)
  }

  deleteGrid(gridId: string) {
    this.db.prepare('DELETE FROM cards WHERE gridId = ?').run(gridId)
    this.db.prepare('DELETE FROM grids WHERE id = ?').run(gridId)
  }

  insertCard(workspaceId: string, gridId: string, card: CardData, sortOrder: number, now = new Date().toISOString()) {
    this.db
      .prepare(`
        INSERT INTO cards (
          id, workspaceId, gridId, kind, title, content, x, y, width, height,
          fileId, fileName, externalUrl, todoItemsJson, calendarJson, eventFlowJson, sortOrder, createdAt, updatedAt
        ) VALUES (
          @id, @workspaceId, @gridId, @kind, @title, @content, @x, @y, @width, @height,
          @fileId, @fileName, @externalUrl, @todoItemsJson, @calendarJson, @eventFlowJson, @sortOrder, @createdAt, @updatedAt
        )
        ON CONFLICT(id) DO UPDATE SET
          workspaceId = excluded.workspaceId,
          gridId = excluded.gridId,
          kind = excluded.kind,
          title = excluded.title,
          content = excluded.content,
          x = excluded.x,
          y = excluded.y,
          width = excluded.width,
          height = excluded.height,
          fileId = excluded.fileId,
          fileName = excluded.fileName,
          externalUrl = excluded.externalUrl,
          todoItemsJson = excluded.todoItemsJson,
          calendarJson = excluded.calendarJson,
          eventFlowJson = excluded.eventFlowJson,
          sortOrder = excluded.sortOrder,
          updatedAt = excluded.updatedAt
      `)
      .run({
        id: card.id,
        workspaceId,
        gridId,
        kind: card.kind,
        title: card.title,
        content: card.content,
        x: card.x,
        y: card.y,
        width: card.width,
        height: card.height,
        fileId: card.fileId ?? null,
        fileName: card.fileName ?? null,
        externalUrl: card.externalUrl ?? null,
        todoItemsJson: card.todoItems ? jsonStringify(card.todoItems) : null,
        calendarJson: card.calendar ? jsonStringify(card.calendar) : null,
        eventFlowJson: card.eventFlow ? jsonStringify(card.eventFlow) : null,
        sortOrder,
        createdAt: now,
        updatedAt: now,
      })
  }

  updateCard(cardId: string, card: CardData) {
    const existing = this.db.prepare('SELECT workspaceId, gridId, sortOrder, createdAt FROM cards WHERE id = ?').get(cardId) as
      | { workspaceId: string; gridId: string; sortOrder: number; createdAt: string }
      | undefined
    if (!existing) return
    this.insertCard(existing.workspaceId, existing.gridId, card, existing.sortOrder, existing.createdAt)
  }

  deleteCard(cardId: string) {
    this.db.prepare('DELETE FROM cards WHERE id = ?').run(cardId)
  }

  setWorkspaceActiveGrid(workspaceId: string, activeGridId: string) {
    this.db.prepare('UPDATE workspaces SET activeGridId = ? WHERE id = ?').run(activeGridId, workspaceId)
  }

  touchWorkspace(workspaceId: string, updatedAt = new Date().toISOString()) {
    const row = this.db
      .prepare('UPDATE workspaces SET updatedAt = ?, revision = revision + 1 WHERE id = ? RETURNING revision, updatedAt')
      .get(updatedAt, workspaceId) as { revision: number; updatedAt: string } | undefined
    return row ?? null
  }

  save() {
    // Kept for compatibility with the previous in-memory JSON store. Writes are immediate in SQLite.
  }

  private workspaceFromRow(row: WorkspaceRow): WorkspaceRecord {
    const gridRows = this.db
      .prepare('SELECT * FROM grids WHERE workspaceId = ? ORDER BY sortOrder, createdAt')
      .all(row.id) as GridRow[]
    const cardRows = this.db
      .prepare('SELECT * FROM cards WHERE workspaceId = ? ORDER BY sortOrder, createdAt')
      .all(row.id) as CardRow[]
    const cardsByGrid = new Map<string, CardData[]>()
    cardRows.forEach((cardRow) => {
      const list = cardsByGrid.get(cardRow.gridId) ?? []
      list.push(cardFromRow(cardRow))
      cardsByGrid.set(cardRow.gridId, list)
    })

    return {
      id: row.id,
      accountId: row.accountId,
      name: row.name,
      activeGridId: row.activeGridId,
      revision: row.revision,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      grids: gridRows.map((grid) => ({
        id: grid.id,
        name: grid.name,
        cards: cardsByGrid.get(grid.id) ?? [],
      })),
    }
  }
}
