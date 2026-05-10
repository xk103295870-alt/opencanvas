import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const serverSource = readFileSync(new URL('../server/index.ts', import.meta.url), 'utf8')

test('Local API create and upload paths preserve dashboard card state', () => {
  assert.match(serverSource, /dashboard\?:\s*CardData\['dashboard'\]/)
  assert.match(serverSource, /if \(kind === 'dashboard'\) card\.dashboard = normalizeDashboardState\(rawCard\.dashboard\)/)
  assert.match(serverSource, /if \(kind === 'dashboard'\) \{\s*card\.dashboard = normalizeDashboardState\(body\.dashboard\)\s*\}/s)
})

test('Local API patch path can update dashboard state', () => {
  assert.match(serverSource, /Pick<CardData, 'title' \| 'content' \| 'x' \| 'y' \| 'width' \| 'height' \| 'fileName' \| 'externalUrl' \| 'todoItems' \| 'calendar' \| 'eventFlow' \| 'dashboard'>/)
  assert.match(serverSource, /if \(body\.dashboard !== undefined\) \{\s*next\.dashboard = normalizeDashboardState\(body\.dashboard\)\s*\}/s)
})
