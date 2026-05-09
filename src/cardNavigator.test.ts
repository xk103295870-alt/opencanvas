import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  centerViewportOnCard,
  filterNavigatorCards,
  getNavigatorCardLabel,
  getNavigatorCardMeta,
  getNavigatorCardTypeLabel,
} from './cardNavigator.ts'
import type { CardData } from './shared/workspaceTypes.ts'

function card(overrides: Partial<CardData>): CardData {
  return {
    id: 'card-1',
    kind: 'note',
    title: '',
    content: '',
    x: 100,
    y: 200,
    width: 300,
    height: 180,
    ...overrides,
  }
}

test('getNavigatorCardLabel falls back from title to file name to localized kind', () => {
  assert.equal(getNavigatorCardLabel(card({ title: 'Research note' })), 'Research note')
  assert.equal(getNavigatorCardLabel(card({ title: '', fileName: 'generated.png', kind: 'image' })), 'generated.png')
  assert.equal(getNavigatorCardLabel(card({ title: '', fileName: '', kind: 'todo' })), '待办事项')
  assert.equal(getNavigatorCardLabel(card({ title: '', fileName: '', kind: 'eventFlow' })), 'Event Flow')
})

test('getNavigatorCardTypeLabel returns compact localized labels', () => {
  assert.equal(getNavigatorCardTypeLabel('note'), '笔记')
  assert.equal(getNavigatorCardTypeLabel('image'), '图片')
  assert.equal(getNavigatorCardTypeLabel('calendar'), '日历')
  assert.equal(getNavigatorCardTypeLabel('eventFlow'), 'Event Flow')
})

test('getNavigatorCardMeta returns useful secondary metadata', () => {
  assert.equal(getNavigatorCardMeta(card({ kind: 'image', fileName: 'generated.png' })), 'generated.png')
  assert.equal(getNavigatorCardMeta(card({ kind: 'note', content: '  First line of content  ' })), 'First line of content')
  assert.equal(getNavigatorCardMeta(card({ kind: 'todo', todoItems: [{ id: 'a', text: 'Ship it', status: 'doing' }] })), '1 item')
  assert.equal(getNavigatorCardMeta(card({ kind: 'calendar', calendar: { monthCursor: '2026-05', selectedDate: '2026-05-09', viewMode: 'month', draftTitle: '', draftAllDay: true, draftStartTime: '', draftEndTime: '', events: [{ id: 'e', date: '2026-05-09', title: 'Review', allDay: true }] } })), '1 event')
})

test('filterNavigatorCards matches title, file name, content, and card kind label', () => {
  const cards = [
    card({ id: 'note', kind: 'note', title: 'Research', content: 'market signals' }),
    card({ id: 'image', kind: 'image', title: '', fileName: 'generated-concept.png' }),
    card({ id: 'calendar', kind: 'calendar', title: '' }),
  ]

  assert.deepEqual(filterNavigatorCards(cards, 'research').map((item) => item.id), ['note'])
  assert.deepEqual(filterNavigatorCards(cards, 'concept').map((item) => item.id), ['image'])
  assert.deepEqual(filterNavigatorCards(cards, 'market').map((item) => item.id), ['note'])
  assert.deepEqual(filterNavigatorCards(cards, '日历').map((item) => item.id), ['calendar'])
  assert.deepEqual(filterNavigatorCards(cards, '').map((item) => item.id), ['note', 'image', 'calendar'])
})

test('centerViewportOnCard centers a card and preserves readable zoom', () => {
  const target = card({ x: 1000, y: 2000, width: 400, height: 200 })

  assert.deepEqual(centerViewportOnCard({ width: 1200, height: 800 }, target, 1), {
    zoom: 1,
    x: -600,
    y: -1700,
  })

  assert.deepEqual(centerViewportOnCard({ width: 1200, height: 800 }, target, 0.45), {
    zoom: 0.85,
    x: -420,
    y: -1385,
  })
})
