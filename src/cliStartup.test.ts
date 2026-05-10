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

test('CLI documents dashboard add with option file and stdin support', () => {
  assert.match(cliSource, /canvas-workbench dashboard add <title> \[--option <file>\|--stdin\]/)
  assert.match(cliSource, /canvas-workbench dashboard add "销售看板" --option/)
  assert.match(cliSource, /canvas-workbench dashboard add "销售看板" --stdin/)
})

test('CLI parses dashboard add options', () => {
  assert.match(cliSource, /rawCommand === 'dashboard' && tokens\[0\] === 'add'/)
  assert.match(cliSource, /optionPath:\s*''/)
  assert.match(cliSource, /readOptionFromStdin:\s*false/)
  assert.match(cliSource, /sourceDataPath:\s*''/)
  assert.match(cliSource, /generatedBy:\s*''/)
  assert.match(cliSource, /token === '--option'/)
  assert.match(cliSource, /token === '--stdin'/)
  assert.match(cliSource, /token === '--data'/)
  assert.match(cliSource, /token === '--prompt'/)
  assert.match(cliSource, /token === '--generated-by'/)
})

test('CLI creates centered dashboard cards through the Local API', () => {
  assert.match(cliSource, /dashboard:\s*\{ width: 760, height: 480 \}/)
  assert.match(cliSource, /async function dashboardAddCommand\(options\)/)
  assert.match(cliSource, /Exactly one of --option or --stdin must be supplied/)
  assert.match(cliSource, /kind:\s*'dashboard'/)
  assert.match(cliSource, /\.\.\.centeredCardPosition\('dashboard'\)/)
  assert.match(cliSource, /updatedAt:\s*new Date\(\)\.toISOString\(\)/)
})
