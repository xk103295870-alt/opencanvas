import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildImageImportPayload, inferImageMimeType } from './imageImportPayload.ts'

test('inferImageMimeType accepts common image extensions', () => {
  assert.equal(inferImageMimeType('portrait.png'), 'image/png')
  assert.equal(inferImageMimeType('portrait.jpg'), 'image/jpeg')
  assert.equal(inferImageMimeType('portrait.jpeg'), 'image/jpeg')
  assert.equal(inferImageMimeType('portrait.webp'), 'image/webp')
  assert.equal(inferImageMimeType('portrait.gif'), 'image/gif')
})

test('inferImageMimeType rejects non-image extensions', () => {
  assert.equal(inferImageMimeType('document.pdf'), null)
  assert.equal(inferImageMimeType('video.mp4'), null)
})

test('buildImageImportPayload preserves original bytes in a data URL', () => {
  const bytes = Buffer.from([0, 1, 2, 250, 255])
  const payload = buildImageImportPayload({
    fileName: 'generated.png',
    bytes,
    title: 'Generated concept',
    gridId: 'AI区',
    mimeType: 'image/png',
  })

  assert.equal(payload.name, 'generated.png')
  assert.equal(payload.title, 'Generated concept')
  assert.equal(payload.gridId, 'AI区')
  assert.equal(payload.type, 'image/png')
  assert.equal(payload.dataUrl, `data:image/png;base64,${bytes.toString('base64')}`)
})
