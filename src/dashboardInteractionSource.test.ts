import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const appCss = readFileSync(new URL('./App.css', import.meta.url), 'utf8')
const appSource = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const dashboardCardSource = readFileSync(new URL('./DashboardCard.tsx', import.meta.url), 'utf8')
const dashboardInspectModalSource = readFileSync(new URL('./DashboardInspectModal.tsx', import.meta.url), 'utf8')

test('dashboard cards keep the frameless visual surface without using the standard card header', () => {
  assert.match(appCss, /\.card-dashboard\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s)
  assert.match(appCss, /\.card-dashboard \.dashboard-card-frame\s*\{[^}]*flex:\s*1 1 auto;[^}]*height:\s*auto;/s)
})

test('dashboard chart keeps pointer-heavy ECharts interactions out of the canvas preview card', () => {
  assert.match(appCss, /\.dashboard-card-frame\.is-previewing \.dashboard-chart\s*\{[^}]*pointer-events:\s*none;/s)
  assert.doesNotMatch(appCss, /\.dashboard-card-frame\.is-inspecting \.dashboard-chart/)
})

test('rebuilt dashboard preview cards isolate chart interactions until opened', () => {
  assert.doesNotMatch(appSource, /className="dashboard-drag-surface"/)
  assert.doesNotMatch(appCss, /\.dashboard-drag-surface/)
  assert.doesNotMatch(dashboardCardSource, /dashboard-card-header/)
  assert.doesNotMatch(dashboardCardSource, /dashboard-card-footer/)
  assert.match(appCss, /\.dashboard-card-topbar\s*\{[^}]*pointer-events:\s*auto;/s)
  assert.match(appCss, /\.dashboard-card-topbar\s*\{[^}]*cursor:\s*grab;/s)
  assert.match(appCss, /\.dashboard-card-topbar\s*\{[^}]*touch-action:\s*none;/s)
  assert.match(appCss, /\.dashboard-card-menu\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto minmax\(0, 1fr\);/s)
  assert.match(appCss, /\.dashboard-open-inspector\s*\{[^}]*grid-column:\s*2;/s)
  assert.match(appCss, /\.dashboard-card-frame\.is-previewing\s*\{[^}]*pointer-events:\s*none;/s)
  assert.match(appCss, /\.dashboard-card-preview\s*\{[^}]*cursor:\s*grab;[^}]*pointer-events:\s*auto;[^}]*touch-action:\s*none;/s)
  assert.match(appCss, /\.card\.dragging \.dashboard-card-topbar,\s*\.card\.dragging \.dashboard-card-preview\s*\{\s*cursor:\s*grabbing;/s)
  assert.match(dashboardCardSource, /className="dashboard-card-topbar"[\s\S]*onPointerDown=\{\(event\) => onStartDrag\?\.\(event\)\}/)
  assert.match(dashboardCardSource, /className="dashboard-card-preview"[\s\S]*onPointerDown=\{\(event\) => onStartDrag\?\.\(event\)\}/)
  assert.match(dashboardCardSource, /className="dashboard-card-menu"[\s\S]*className="dashboard-open-inspector"/)
  assert.match(appSource, /onStartDrag=\{\(event\) => onCardDragStart\(event, card\)\}/)
  assert.match(appCss, /\.dashboard-open-inspector\s*\{[^}]*pointer-events:\s*auto;/s)
  assert.match(appCss, /\.card-dashboard \.card-resize-handle\s*\{[^}]*pointer-events:\s*auto;/s)
})

test('dashboard cards open full ECharts interaction in a centered popup viewer', () => {
  assert.match(appSource, /const \[inspectedDashboardCardId, setInspectedDashboardCardId\] = useState<string \| null>\(null\)/)
  assert.match(appSource, /const inspectedDashboardCard = activeGrid\?\.cards\.find\(\(card\) => card\.id === inspectedDashboardCardId && card\.kind === 'dashboard'\)/)
  assert.match(appSource, /onOpenInspect=\{\(\) => setInspectedDashboardCardId\(card\.id\)\}/)
  assert.match(appSource, /<DashboardInspectModal\s+card=\{inspectedDashboardCard\}\s+onClose=\{\(\) => setInspectedDashboardCardId\(null\)\}\s+\/?>/s)
  assert.match(dashboardCardSource, /dashboard-open-inspector/)
  assert.match(dashboardCardSource, /查看 \/ 交互/)
  assert.doesNotMatch(dashboardCardSource, /dashboard-inspect-open/)
  assert.doesNotMatch(dashboardCardSource, /dashboard-preview-trigger/)
  assert.doesNotMatch(dashboardCardSource, /dashboard-inspect-exit/)
})

test('dashboard preview mode does not continuously claim chart pointer interactions', () => {
  assert.match(appCss, /\.dashboard-card-frame\.is-previewing \.dashboard-chart\s*\{[^}]*pointer-events:\s*none;/s)
  assert.doesNotMatch(appCss, /\.dashboard-card-frame\.is-inspecting \.dashboard-chart/)
  assert.doesNotMatch(appCss, /\.dashboard-preview-trigger/)
})

test('dashboard popup modal owns full ECharts chart pointer interactions', () => {
  assert.match(dashboardInspectModalSource, /echarts\.init\(container, undefined, \{ renderer: 'canvas' \}\)/)
  assert.match(appCss, /\.dashboard-inspect-chart\s*\{[^}]*pointer-events:\s*auto;[^}]*touch-action:\s*manipulation;/s)
  assert.match(appCss, /\.dashboard-inspect-overlay\s*\{/)
  assert.match(appCss, /\.dashboard-inspect-modal\s*\{/)
})

test('dashboard popup viewer closes through Escape close button and overlay click', () => {
  assert.match(appSource, /if \(event\.key === 'Escape'\) setInspectedDashboardCardId\(null\)/)
  assert.match(appSource, /window\.addEventListener\('keydown', handleDashboardInspectKeyDown\)/)
  assert.match(appSource, /window\.removeEventListener\('keydown', handleDashboardInspectKeyDown\)/)
  assert.match(dashboardInspectModalSource, /className="dashboard-inspect-overlay"/)
  assert.match(dashboardInspectModalSource, /onClick=\{onClose\}/)
  assert.match(dashboardInspectModalSource, /className="dashboard-inspect-modal"/)
  assert.match(dashboardInspectModalSource, /onClick=\{\(event\) => event\.stopPropagation\(\)\}/)
  assert.match(dashboardInspectModalSource, /className="dashboard-inspect-close"/)
  assert.match(dashboardInspectModalSource, /aria-label="关闭数据卡片查看"/)
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
