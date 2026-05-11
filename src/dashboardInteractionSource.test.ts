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

test('dashboard chart enables pointer events only in inspect mode for ECharts tooltip legend and data interactions', () => {
  assert.match(appCss, /\.dashboard-card-frame\.is-inspecting \.dashboard-chart\s*\{[^}]*pointer-events:\s*auto;[^}]*touch-action:\s*manipulation;/s)
  assert.match(appCss, /\.dashboard-card-frame\.is-previewing \.dashboard-chart\s*\{[^}]*pointer-events:\s*none;/s)
})

test('dashboard uses a narrow internal drag handle instead of dragging from the whole chart body', () => {
  assert.match(appSource, /<div\s+className="dashboard-card-drag-handle"\s+onPointerDown=\{\(event\) => onCardDragStart\(event, card\)\}\s+aria-label=\{`拖动\$\{card\.title \|\| '数据看板'\}`\}\s+title=\{card\.title \|\| '数据看板'\}\s*\/?>/s)
  assert.doesNotMatch(appSource, /className="dashboard-drag-surface"\s+onPointerDown=\{\(event\) => \{\s*if \(cardChrome\.dragSurface === 'body'\) onCardDragStart\(event, card\)\s*\}\}/s)
})

test('dashboard cards render preview mode by default and opt into inspect mode intentionally', () => {
  assert.match(appSource, /const \[inspectedDashboardCardId, setInspectedDashboardCardId\] = useState<string \| null>\(null\)/)
  assert.match(appSource, /isInspecting=\{inspectedDashboardCardId === card\.id\}/)
  assert.match(appSource, /onEnterInspect=\{\(\) => setInspectedDashboardCardId\(card\.id\)\}/)
  assert.match(appSource, /onExitInspect=\{\(\) => setInspectedDashboardCardId\(\(current\) => current === card\.id \? null : current\)\}/)
  assert.match(dashboardCardSource, /isInspecting = false/)
  assert.match(dashboardCardSource, /dashboard-preview-trigger/)
  assert.match(dashboardCardSource, /点击查看 \/ 交互/)
  assert.match(dashboardCardSource, /dashboard-inspect-exit/)
  assert.match(dashboardCardSource, /退出查看/)
})

test('dashboard preview mode does not continuously claim chart pointer interactions', () => {
  assert.match(appCss, /\.dashboard-card-frame\.is-previewing \.dashboard-chart\s*\{[^}]*pointer-events:\s*none;/s)
  assert.match(appCss, /\.dashboard-card-frame\.is-inspecting \.dashboard-chart\s*\{[^}]*pointer-events:\s*auto;[^}]*touch-action:\s*manipulation;/s)
  assert.match(appCss, /\.dashboard-preview-trigger\s*\{[^}]*pointer-events:\s*auto;/s)
})

test('dashboard inspect mode exits on Escape or blank canvas pointer down', () => {
  assert.match(appSource, /if \(event\.key === 'Escape'\) setInspectedDashboardCardId\(null\)/)
  assert.match(appSource, /window\.addEventListener\('keydown', handleDashboardInspectKeyDown\)/)
  assert.match(appSource, /window\.removeEventListener\('keydown', handleDashboardInspectKeyDown\)/)
  assert.match(appSource, /if \(target\.closest\('\.card'\)\) return\s*setInspectedDashboardCardId\(null\)/s)
})

test('global pointer lifecycle clears stale drag resize and pan state on cancellation or blur', () => {
  assert.match(appSource, /const clearPointerInteractionState = \(\) => \{\s*eventFlowNodeDragRef\.current = null\s*eventFlowEdgeDragRef\.current = null\s*setEventFlowEdgeDrag\(null\)\s*dragStateRef\.current = null\s*panStateRef\.current = null\s*resizeStateRef\.current = null\s*setDraggingCardId\(null\)\s*setResizingCardId\(null\)\s*setIsPanning\(false\)\s*\}/s)
  assert.match(appSource, /window\.addEventListener\('pointercancel', handlePointerCancel\)/)
  assert.match(appSource, /window\.addEventListener\('blur', clearPointerInteractionState\)/)
})

test('canvas panning keeps grabbing cursor even when pointer crosses dashboard chart children', () => {
  assert.match(appCss, /\.canvas\.is-panning,\s*\.canvas\.is-panning \*\s*\{\s*cursor:\s*grabbing !important;\s*\}/s)
})

test('canvas starts and resets at a 45 percent zoom level to reduce oversized hit areas', () => {
  assert.match(appSource, /const DEFAULT_CANVAS_ZOOM = 0\.45/)
  assert.match(appSource, /zoom:\s*DEFAULT_CANVAS_ZOOM/)
  assert.doesNotMatch(appSource, /zoom:\s*1,\s*x:\s*width \/ 2 - tx,/)
})

test('DashboardCard does not stop pointer propagation before App can start dragging', () => {
  assert.doesNotMatch(dashboardCardSource, /onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/)
})
