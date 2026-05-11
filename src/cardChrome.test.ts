import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getCardChrome } from './cardChrome.ts'

test('image cards render as hover chrome media with body dragging and resize handle', () => {
  assert.deepEqual(getCardChrome('image'), {
    showHeader: false,
    showFileMeta: false,
    showResizeHandle: true,
    frameless: true,
    chromeMode: 'hover',
    dragSurface: 'body',
  })
})

test('dashboard cards render frameless like photo cards with body dragging and resize handle', () => {
  assert.deepEqual(getCardChrome('dashboard'), {
    showHeader: false,
    showFileMeta: false,
    showResizeHandle: true,
    frameless: true,
    chromeMode: 'hover',
    dragSurface: 'body',
  })
})

test('non-image media cards keep the standard card chrome', () => {
  assert.deepEqual(getCardChrome('video'), {
    showHeader: true,
    showFileMeta: true,
    showResizeHandle: true,
    frameless: false,
    chromeMode: 'standard',
    dragSurface: 'header',
  })
})
