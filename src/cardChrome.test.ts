import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getCardChrome } from './cardChrome.ts'

test('image cards render as frameless media with only delete control', () => {
  assert.deepEqual(getCardChrome('image'), {
    showHeader: false,
    showFileMeta: false,
    showResizeHandle: false,
    frameless: true,
  })
})

test('non-image media cards keep the standard card chrome', () => {
  assert.deepEqual(getCardChrome('video'), {
    showHeader: true,
    showFileMeta: true,
    showResizeHandle: true,
    frameless: false,
  })
})
