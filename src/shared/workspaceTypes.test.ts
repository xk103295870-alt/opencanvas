import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CARD_DEFAULT_SIZES, CARD_KIND_SET, normalizeGridsForTodoBoard } from './workspaceTypes.ts'

test('dashboard is a recognized card kind with default size', () => {
  assert.equal(CARD_KIND_SET.has('dashboard'), true)
  assert.deepEqual(CARD_DEFAULT_SIZES.dashboard, { width: 760, height: 480 })
})

test('normalizeGridsForTodoBoard preserves dashboard state from persisted cards', () => {
  const grids = normalizeGridsForTodoBoard([
    {
      id: 'grid-ai',
      name: 'AI区',
      cards: [
        {
          id: 'card-dashboard',
          kind: 'dashboard',
          title: '销售看板',
          content: '',
          x: 1,
          y: 2,
          width: 760,
          height: 480,
          dashboard: {
            option: { series: [{ type: 'bar', data: [1] }] },
            sourceData: [{ month: '一月', sales: 1 }],
            prompt: '生成销售趋势图',
            generatedBy: 'claude-code',
            updatedAt: '2026-05-10T00:00:00.000Z',
          },
        },
      ],
    },
  ])

  const card = grids[0]?.cards[0]
  assert.equal(card?.kind, 'dashboard')
  assert.deepEqual(card?.dashboard?.option, { series: [{ type: 'bar', data: [1] }] })
  assert.deepEqual(card?.dashboard?.sourceData, [{ month: '一月', sales: 1 }])
  assert.equal(card?.dashboard?.prompt, '生成销售趋势图')
  assert.equal(card?.dashboard?.generatedBy, 'claude-code')
  assert.equal(card?.dashboard?.updatedAt, '2026-05-10T00:00:00.000Z')
})
