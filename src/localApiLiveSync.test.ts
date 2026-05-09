import assert from 'node:assert/strict'
import { test } from 'node:test'
import { shouldPollLocalApiInRuntime } from './localApiLiveSync.ts'

test('shouldPollLocalApiInRuntime keeps polling enabled in Obsidian because EventSource can be unreliable there', () => {
  assert.equal(shouldPollLocalApiInRuntime(true), true)
})

test('shouldPollLocalApiInRuntime keeps polling enabled in the web runtime as a fallback to live events', () => {
  assert.equal(shouldPollLocalApiInRuntime(false), true)
})
