import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const cliSource = readFileSync(new URL('../bin/canvas-workbench.mjs', import.meta.url), 'utf8')

test('CLI starts Local API through tsx loader instead of tsx CLI IPC server', () => {
  assert.match(cliSource, /function resolveTsxLoader\(\)/)
  assert.match(cliSource, /const tsxLoader = resolveTsxLoader\(\)/)
  assert.match(cliSource, /spawnNodeScript\(\s*path\.join\(REPO_ROOT, 'server', 'index\.ts'\),\s*\[\],/)
  assert.match(cliSource, /nodeArgs:\s*\['--import', tsxLoader\]/)
  assert.doesNotMatch(cliSource, /spawnNodeScript\(\s*tsxBin,\s*\[\s*'--tsconfig'/)
})

test('CLI supports API-only start without launching or waiting for Vite web server', () => {
  assert.match(cliSource, /canvas-workbench start \[--open\] \[--no-open\] \[--api-only\]/)
  assert.match(cliSource, /apiOnly:\s*false/)
  assert.match(cliSource, /if \(token === '--api-only'\)/)
  assert.match(cliSource, /if \(!options\.apiOnly && !webAlreadyRunning\)/)
  assert.match(cliSource, /options\.apiOnly\s*\?\s*apiReady\(options\.apiPort\)/)
})
