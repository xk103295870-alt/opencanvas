import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const appCss = readFileSync(new URL('./App.css', import.meta.url), 'utf8')
const appSource = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const dashboardCardSource = readFileSync(new URL('./DashboardCard.tsx', import.meta.url), 'utf8')
const dashboardInspectModalSource = readFileSync(new URL('./DashboardInspectModal.tsx', import.meta.url), 'utf8')

test('sidebar and canvas keep a visible divider with room for the collapse handle', () => {
  assert.match(appCss, /\.app-shell\s*\{[^}]*grid-template-columns:\s*292px minmax\(0, 1fr\);/s)
  assert.match(appCss, /\.sidebar\s*\{[^}]*border-right:\s*1px solid var\(--line\);[^}]*box-shadow:\s*12px 0 28px/s)
  assert.match(appCss, /\.canvas\s*\{[^}]*border-left:\s*1px solid/s)
  assert.match(appCss, /\.sidebar-toggle-inside\s*\{[^}]*right:\s*-17px;/s)
})

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

test('canvas pointer mode defaults to V card mode and can switch with keyboard H and V', () => {
  assert.match(appSource, /type PointerMode = 'card' \| 'canvas'/)
  assert.match(appSource, /const \[pointerMode, setPointerMode\] = useState<PointerMode>\('card'\)/)
  assert.match(appSource, /if \(isEditableKeyboardTarget\(event\.target\)\) return/)
  assert.match(appSource, /if \(event\.key\.toLowerCase\(\) === 'h'\) setPointerMode\('canvas'\)/)
  assert.match(appSource, /if \(event\.key\.toLowerCase\(\) === 'v'\) setPointerMode\('card'\)/)
})

test('canvas pointer mode switch renders bottom centered H and V controls with hover tips', () => {
  assert.match(appSource, /data-pointer-mode=\{pointerMode\}/)
  assert.match(appSource, /className="canvas-pointer-mode-switch"/)
  assert.match(appSource, /aria-label=\{settings\.language === 'zh' \? '鼠标模式' : 'Pointer mode'\}/)
  assert.match(appSource, /className=\{`pointer-mode-btn \$\{pointerMode === 'canvas' \? 'active' : ''\}`\}/)
  assert.match(appSource, /className=\{`pointer-mode-btn \$\{pointerMode === 'card' \? 'active' : ''\}`\}/)
  assert.match(appSource, />H<\/span>/)
  assert.match(appSource, />V<\/span>/)
  assert.match(appSource, /className="pointer-mode-tip"/)
  assert.match(appCss, /\.canvas-pointer-mode-switch\s*\{[^}]*position:\s*absolute;[^}]*bottom:\s*18px;[^}]*left:\s*50%;[^}]*transform:\s*translateX\(-50%\);/s)
  assert.match(appCss, /\.pointer-mode-btn:hover \.pointer-mode-tip,\s*\.pointer-mode-btn:focus-visible \.pointer-mode-tip\s*\{[^}]*opacity:\s*1;[^}]*transform:\s*translate\(-50%, -6px\);/s)
})

test('H canvas mode supports whole app-shell wheel zoom while V mode ignores shell wheel zoom', () => {
  assert.match(appSource, /const onAppShellWheel = \(event: ReactWheelEvent<HTMLElement>\) => \{\s*if \(pointerMode !== 'canvas'\) return\s*if \(\(event\.target as HTMLElement\)\.closest\('\.sidebar, \.sidebar-toggle, \.canvas-pointer-mode-switch, \.canvas-toolbar, \.settings-overlay, \.settings-dialog'\)\) return/s)
  assert.match(appSource, /const onAppShellWheel = \(event: ReactWheelEvent<HTMLElement>\) => \{[\s\S]*event\.preventDefault\(\)[\s\S]*event\.stopPropagation\(\)[\s\S]*setCenteredZoom\(nextZoom, event\.clientX, event\.clientY\)[\s\S]*\}/)
  assert.match(appSource, /onWheel=\{onAppShellWheel\}/)
})
test('H canvas mode only drags the canvas while V mode disables background canvas dragging', () => {
  assert.match(appSource, /if \(pointerMode !== 'canvas'\) return/)
  assert.match(appSource, /if \(event\.button !== 0\) return/)
  assert.match(appSource, /event\.stopPropagation\(\)/)
  assert.match(appSource, /event\.currentTarget\.setPointerCapture\(event\.pointerId\)/)
  assert.match(appSource, /onPointerDownCapture=\{onCanvasPointerDown\}/)
  assert.doesNotMatch(appSource, /pointerMode === 'canvas' && event\.button === 1/)
  assert.doesNotMatch(appSource, /onAuxClick=\{onCanvasAuxClick\}/)
  assert.match(appSource, /className=\{`canvas canvas-workbench-stage /)
  assert.match(appCss, /\.canvas\s*\{[^}]*cursor:\s*default;/s)
  assert.match(appCss, /\.canvas-workbench-stage\[data-pointer-mode='canvas'\],\s*\.canvas-workbench-stage\[data-pointer-mode='canvas'\] \.scene,\s*\.canvas-workbench-stage\[data-pointer-mode='canvas'\] \.canvas-grid\s*\{\s*cursor:\s*grab;\s*\}/s)
  assert.match(appCss, /\.canvas-workbench-stage\[data-pointer-mode='canvas'\] \.scene\s*\{[^}]*pointer-events:\s*none;/s)
  assert.match(appCss, /\.canvas-workbench-stage\[data-pointer-mode='canvas'\]\.is-panning,\s*\.canvas-workbench-stage\[data-pointer-mode='canvas'\]\.is-panning \*\s*\{\s*cursor:\s*grabbing !important;\s*\}/s)
  assert.doesNotMatch(appCss, /\.canvas-workbench-stage\[data-pointer-mode='canvas'\]\.is-panning,\s*\.canvas-workbench-stage\[data-pointer-mode='canvas'\]\.is-panning \*\s*\{\s*cursor:\s*default !important;/s)
  assert.doesNotMatch(appCss, /\.canvas-workbench-stage\[data-pointer-mode='canvas'\] \.card\s*\{[^}]*cursor:\s*grab;/s)
})
