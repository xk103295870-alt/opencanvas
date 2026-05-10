import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const appCss = readFileSync(new URL('./App.css', import.meta.url), 'utf8')
const appSource = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const dashboardCardSource = readFileSync(new URL('./DashboardCard.tsx', import.meta.url), 'utf8')

test('dashboard cards keep the frameless visual surface without using the standard card header', () => {
  assert.match(appCss, /\.card-dashboard\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s)
  assert.match(appCss, /\.card-dashboard \.dashboard-card-frame\s*\{[^}]*flex:\s*1 1 auto;[^}]*height:\s*auto;/s)
})

test('dashboard chart canvas does not capture card drag or resize pointer gestures', () => {
  assert.match(appCss, /\.dashboard-chart\s*\{[^}]*pointer-events:\s*none;[^}]*touch-action:\s*none;/s)
})

test('dashboard uses a narrow internal drag handle instead of dragging from the whole chart body', () => {
  assert.match(appSource, /<div\s+className="dashboard-card-drag-handle"\s+onPointerDown=\{\(event\) => onCardDragStart\(event, card\)\}\s+aria-label=\{`拖动\$\{card\.title \|\| '数据看板'\}`\}\s+title=\{card\.title \|\| '数据看板'\}\s*\/?>/s)
  assert.doesNotMatch(appSource, /className="dashboard-drag-surface"\s+onPointerDown=\{\(event\) => \{\s*if \(cardChrome\.dragSurface === 'body'\) onCardDragStart\(event, card\)\s*\}\}/s)
})

test('global pointer lifecycle clears stale drag resize and pan state on cancellation or blur', () => {
  assert.match(appSource, /const clearPointerInteractionState = \(\) => \{\s*eventFlowNodeDragRef\.current = null\s*eventFlowEdgeDragRef\.current = null\s*setEventFlowEdgeDrag\(null\)\s*dragStateRef\.current = null\s*panStateRef\.current = null\s*resizeStateRef\.current = null\s*setDraggingCardId\(null\)\s*setResizingCardId\(null\)\s*setIsPanning\(false\)\s*\}/s)
  assert.match(appSource, /window\.addEventListener\('pointercancel', handlePointerCancel\)/)
  assert.match(appSource, /window\.addEventListener\('blur', clearPointerInteractionState\)/)
})

test('DashboardCard does not stop pointer propagation before App can start dragging', () => {
  assert.doesNotMatch(dashboardCardSource, /onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/)
})
