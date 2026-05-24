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

test('media cards use one cross-device fallback message when local assets cannot render', () => {
  assert.match(appSource, /mediaImageUnavailable: '此类型暂不支持跨端显示。'/)
  assert.match(appSource, /mediaVideoUnavailable: '此类型暂不支持跨端显示。'/)
  assert.match(appSource, /mediaPdfUnavailable: '此类型暂不支持跨端显示。'/)
  assert.doesNotMatch(appSource, /mediaImageUnavailable: '图片不可用'/)
  assert.doesNotMatch(appSource, /mediaVideoUnavailable: '视频不可用'/)
  assert.doesNotMatch(appSource, /mediaPdfUnavailable: 'PDF 不可用'/)
})

test('image cards expose a floating rename button that opens a rename dialog', () => {
  assert.match(appSource, /const \[renamingImageCardId, setRenamingImageCardId\] = useState<string \| null>\(null\)/)
  assert.match(appSource, /const \[imageCardTitleDraft, setImageCardTitleDraft\] = useState\(''\)/)
  assert.match(appSource, /const openImageCardRenameDialog = \(card: CardData\) => \{[\s\S]*if \(card\.kind !== 'image'\) return[\s\S]*setRenamingImageCardId\(card\.id\)[\s\S]*setImageCardTitleDraft\(card\.title\)[\s\S]*\}/)
  assert.match(appSource, /const submitImageCardRename = \(\) => \{[\s\S]*const nextTitle = imageCardTitleDraft\.trim\(\)[\s\S]*if \(!renamingImageCardId \|\| !nextTitle\) return[\s\S]*updateCardTitle\(renamingImageCardId, nextTitle\)[\s\S]*closeImageCardRenameDialog\(\)[\s\S]*\}/)
  assert.match(appSource, /card\.kind === 'image' \? \([\s\S]*className="card-action image-card-rename"[\s\S]*openImageCardRenameDialog\(card\)[\s\S]*✎/)
  assert.match(appSource, /renamingImageCard \? \([\s\S]*className="image-rename-overlay"[\s\S]*className="image-rename-dialog"[\s\S]*重命名图片卡片[\s\S]*value=\{imageCardTitleDraft\}[\s\S]*autoFocus[\s\S]*submitImageCardRename\(\)[\s\S]*closeImageCardRenameDialog\(\)/)
  assert.match(appCss, /\.image-card-rename\s*\{[^}]*position:\s*absolute;[^}]*top:\s*8px;[^}]*right:\s*76px;/s)
  assert.match(appCss, /\.image-rename-overlay\s*\{/)
  assert.match(appCss, /\.image-rename-dialog\s*\{/)
})

test('card recycle bin has persisted trash card state with a 10 day retention window', () => {
  assert.match(appSource, /const TRASH_CARD_RETENTION_MS = 10 \* 24 \* 60 \* 60 \* 1000/)
  assert.match(appSource, /type TrashedCard = \{\s*id: string\s*card: CardData\s*gridId: string\s*gridName: string\s*deletedAt: number\s*expiresAt: number\s*\}/s)
  assert.match(appSource, /type PersistedAppStateSnapshot = \{[\s\S]*trashCards: TrashedCard\[\][\s\S]*\}/)
  assert.match(appSource, /const \[trashCards, setTrashCards\] = useState<TrashedCard\[\]>\(\[\]\)/)
  assert.match(appSource, /const normalizedTrashCards = Array\.isArray\(raw\.trashCards\) \? normalizeTrashCards\(raw\.trashCards\) : \[\]/)
  assert.match(appSource, /trashCards: normalizedTrashCards/)
  assert.match(appSource, /persistLocalStateSnapshot\(\{[\s\S]*trashCards,[\s\S]*\}\)/)
})

test('card deletion moves cards into the recycle bin before permanent cleanup', () => {
  assert.match(appSource, /const moveCardToTrash = \(cardId: string\) => \{[\s\S]*const now = Date\.now\(\)[\s\S]*const trashedCard: TrashedCard = \{[\s\S]*deletedAt: now,[\s\S]*expiresAt: now \+ TRASH_CARD_RETENTION_MS[\s\S]*\}/)
  assert.match(appSource, /setTrashCards\(\(current\) => \[trashedCard, \.\.\.current\.filter\(\(item\) => item\.id !== cardId\)\]\)/)
  assert.match(appSource, /cards: grid\.cards\.filter\(\(card\) => card\.id !== cardId\)/)
  assert.match(appSource, /const permanentlyDeleteTrashedCard = \(trashId: string\) => \{[\s\S]*setTrashCards\(\(current\) => current\.filter\(\(item\) => item\.id !== trashId\)\)[\s\S]*persistCliBridgeCardDelete\(trashId\)/)
  assert.match(appSource, /const shouldDeleteTrashedAsset = \(fileId: string, trashId: string\) => \{[\s\S]*activeUses[\s\S]*trashUses[\s\S]*return !activeUses && !trashUses[\s\S]*\}/)
  assert.match(appSource, /const confirmDeleteCard = \(\) => \{\s*if \(!pendingDeleteCardId\) return\s*moveCardToTrash\(pendingDeleteCardId\)\s*\}/s)
  assert.doesNotMatch(appSource, /const confirmDeleteCard = \(\) => \{\s*if \(!pendingDeleteCardId\) return\s*removeCardById\(pendingDeleteCardId\)\s*\}/s)
})

test('card recycle bin can restore cards and purge expired items', () => {
  assert.match(appSource, /const restoreTrashedCard = \(trashId: string\) => \{[\s\S]*const target = trashCards\.find\(\(item\) => item\.id === trashId\)[\s\S]*const restoreGridId = grids\.some\(\(grid\) => grid\.id === target\.gridId\) \? target\.gridId : activeGridId/)
  assert.match(appSource, /const restoredCard: CardData = hasIdConflict\s*\? \{ \.\.\.target\.card, id: uid\('card'\), x: target\.card\.x \+ 24, y: target\.card\.y \+ 24 \}\s*: target\.card/s)
  assert.match(appSource, /cards: \[\.\.\.grid\.cards, restoredCard\]/)
  assert.match(appSource, /setTrashCards\(\(current\) => current\.filter\(\(item\) => item\.id !== trashId\)\)/)
  assert.match(appSource, /const purgeExpiredTrashCards = \(\) => \{[\s\S]*const now = Date\.now\(\)[\s\S]*trashCards\.filter\(\(item\) => item\.expiresAt <= now\)\.forEach\(\(item\) => permanentlyDeleteTrashedCard\(item\.id\)\)[\s\S]*\}/)
  assert.match(appSource, /useEffect\(\(\) => \{\s*if \(!trashCards\.length\) return\s*purgeExpiredTrashCards\(\)\s*\}, \[trashCards\]\)/s)
})

test('card recycle bin renders a sidebar entry and modal restore controls', () => {
  assert.match(appSource, /const \[trashOpen, setTrashOpen\] = useState\(false\)/)
  assert.match(appSource, /const trashCardCount = trashCards\.length/)
  assert.match(appSource, /className="trash-entry-btn"[\s\S]*onClick=\{\(\) => setTrashOpen\(true\)\}[\s\S]*回收站[\s\S]*className="trash-count-badge"/)
  assert.match(appSource, /trashOpen \? \([\s\S]*className="trash-overlay"[\s\S]*className="trash-dialog"[\s\S]*className="trash-list"/)
  assert.match(appSource, /trashCards\.map\(\(item\) => \([\s\S]*className="trash-item"[\s\S]*getTrashCardLabel\(item\)[\s\S]*getNavigatorCardTypeLabel\(item\.card\.kind\)[\s\S]*getTrashRemainingLabel\(item\)[\s\S]*restoreTrashedCard\(item\.id\)[\s\S]*requestPermanentlyDeleteTrashedCard\(item\)/)
  assert.match(appSource, /trashCards\.length === 0 \? \([\s\S]*className="trash-empty"/)
  assert.match(appCss, /\.trash-entry-btn\s*\{/)
  assert.match(appCss, /\.trash-overlay\s*\{/)
  assert.match(appCss, /\.trash-dialog\s*\{/)
  assert.match(appCss, /\.trash-item\s*\{/)
})

test('card recycle bin confirms before permanent deletion', () => {
  assert.match(appSource, /const requestPermanentlyDeleteTrashedCard = \(item: TrashedCard\) => \{[\s\S]*window\.confirm\([\s\S]*永久删除[\s\S]*permanentlyDeleteTrashedCard\(item\.id\)[\s\S]*\}/)
  assert.doesNotMatch(appSource, /className="trash-delete-btn" onClick=\{\(\) => permanentlyDeleteTrashedCard\(item\.id\)\}/)
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

test('sidebar grid items avoid nested button markup for React DOM validity', () => {
  assert.doesNotMatch(appSource, /<button\s+key=\{grid\.id\}[\s\S]*className=\{`grid-item/)
  assert.match(appSource, /<div\s+key=\{grid\.id\}[\s\S]*role="button"[\s\S]*tabIndex=\{0\}[\s\S]*className=\{`grid-item/)
  assert.match(appSource, /onKeyDown=\{\(event\) => \{[\s\S]*if \(event\.key === 'Enter' \|\| event\.key === ' '\)[\s\S]*activateGrid\(grid\.id\)/)
  assert.match(appSource, /className="grid-remove-btn"/)
})

test('card navigator stays navigation-only without rename controls', () => {
  assert.match(appSource, /<button\s+key=\{card\.id\}[\s\S]*type="button"[\s\S]*className="card-navigator-row"[\s\S]*onClick=\{\(\) => jumpToNavigatorCard\(card\)\}/)
  assert.match(appSource, /className="card-navigator-copy"[\s\S]*<strong>\{getNavigatorCardLabel\(card\)\}<\/strong>[\s\S]*\{meta \? <small>\{meta\}<\/small> : null\}/)
  assert.doesNotMatch(appSource, /card-navigator-rename-btn/)
  assert.doesNotMatch(appSource, /card-navigator-title-input/)
  assert.doesNotMatch(appSource, /card-navigator-edit-shell/)
  assert.doesNotMatch(appSource, /className="card-navigator-copy"[\s\S]{0,240}onDoubleClick/)
  assert.doesNotMatch(appCss, /\.card-navigator-rename-btn/)
  assert.doesNotMatch(appCss, /\.card-navigator-title-input/)
  assert.doesNotMatch(appCss, /\.card-navigator-edit-shell/)
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
