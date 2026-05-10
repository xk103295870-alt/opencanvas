import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const sqliteStoreSource = readFileSync(new URL('../server/storage/sqliteStore.ts', import.meta.url), 'utf8')

test('SqliteStore schema includes dashboardJson for dashboard card persistence', () => {
  assert.match(sqliteStoreSource, /dashboardJson:\s*string \| null/)
  assert.match(sqliteStoreSource, /dashboardJson TEXT/)
  assert.match(sqliteStoreSource, /ensureColumn\('cards', 'dashboardJson', 'TEXT'\)/)
})

test('SqliteStore reads and writes dashboard card state', () => {
  assert.match(sqliteStoreSource, /if \(row\.dashboardJson\) card\.dashboard = parseJson\(row\.dashboardJson, undefined\)/)
  assert.match(sqliteStoreSource, /dashboardJson = excluded\.dashboardJson/)
  assert.match(sqliteStoreSource, /dashboardJson: card\.dashboard \? jsonStringify\(card\.dashboard\) : null/)
})
