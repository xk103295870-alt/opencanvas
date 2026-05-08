import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const css = readFileSync(new URL('./App.css', import.meta.url), 'utf8')

function ruleBody(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))
  assert.ok(match, `Missing CSS rule for ${selector}`)
  return match[1]
}

test('calendar selected-day event rows use larger readable layout', () => {
  const item = ruleBody('.calendar-event-item')
  assert.match(item, /border-radius:\s*12px;/)
  assert.match(item, /padding:\s*10px\s+12px;/)
  assert.match(item, /grid-template-columns:\s*34px\s+minmax\(0,\s*1fr\)\s+34px;/)
  assert.match(item, /gap:\s*12px;/)

  const input = ruleBody('.calendar-event-input')
  assert.match(input, /border-radius:\s*10px;/)
  assert.match(input, /padding:\s*12px\s+16px;/)
  assert.match(input, /font-size:\s*16px;/)

  const time = ruleBody('.calendar-event-time')
  assert.match(time, /font-size:\s*14px;/)
})
