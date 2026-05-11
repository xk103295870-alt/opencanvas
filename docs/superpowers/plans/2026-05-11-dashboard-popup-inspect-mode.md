# Dashboard Popup Inspect Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move full ECharts dashboard interaction out of the canvas card and into a centered popup viewer opened from a top-header `查看 / 交互` action.

**Architecture:** Keep `DashboardCard` as a stable preview card with a header action callback. Add a focused `DashboardInspectModal` component that owns the fully interactive ECharts instance inside a centered overlay. `App.tsx` tracks the selected dashboard card id, renders the modal for that card, and closes it from Escape, close button, or overlay click.

**Tech Stack:** React 19, TypeScript, Vite, ECharts, Node test source-regression tests, Obsidian plugin build.

---

## File Structure

- Create `src/DashboardInspectModal.tsx`
  - Renders centered modal overlay.
  - Initializes and disposes a fully interactive ECharts instance.
  - Shows title, close button, footer metadata, and validation/error states.
  - Stops clicks inside the frame from closing the overlay.

- Modify `src/DashboardCard.tsx`
  - Replace card-body preview trigger with a compact header action labeled `查看 / 交互`.
  - Keep preview chart pointer-heavy interactions disabled by CSS.
  - Remove internal `退出查看` state/control from the card preview.

- Modify `src/App.tsx`
  - Keep `inspectedDashboardCardId` state.
  - Pass `onOpenInspect` to dashboard preview cards.
  - Render `DashboardInspectModal` for the selected dashboard card.
  - Close modal on Escape.
  - Remove card-internal inspect props that are no longer needed.

- Modify `src/App.css`
  - Style dashboard header action.
  - Keep dashboard preview chart as non-interactive.
  - Add modal overlay, frame, header, chart viewport, close button, and footer styling.
  - Ensure modal chart enables pointer interaction.

- Modify `src/dashboardInteractionSource.test.ts`
  - Replace card-internal inspect assertions with popup viewer assertions.
  - Keep tests for top handle, preview pointer boundaries, 45% zoom, and panning cursor.

- Modify generated bundle files after verification:
  - `dist-obsidian/main.js`
  - `dist-obsidian/styles.css`
  - `dist-obsidian/manifest.json`
  - Copy into `/Users/xk/Documents/Obsidian Vault/.obsidian/plugins/canvas-workbench/`.

## Important Current State

The local `main` branch is ahead of `origin/main` with dashboard preview-mode and popup-spec commits. GitHub push may fail from this environment with:

```text
CONNECT tunnel failed, response 403
```

If push fails, tell the user to run:

```bash
cd "/Users/xk/vs开发文件/Canvas-Workbench"
git push origin main
```

---

### Task 1: Add Failing Tests for Popup Inspect Mode

**Files:**
- Modify: `src/dashboardInteractionSource.test.ts`

- [ ] **Step 1: Update source reads to include the new modal component**

At the top of `src/dashboardInteractionSource.test.ts`, after:

```ts
const dashboardCardSource = readFileSync(new URL('./DashboardCard.tsx', import.meta.url), 'utf8')
```

add:

```ts
const dashboardInspectModalSource = readFileSync(new URL('./DashboardInspectModal.tsx', import.meta.url), 'utf8')
```

- [ ] **Step 2: Replace the card-internal inspect test**

Replace the existing test named:

```ts
test('dashboard cards render preview mode by default and opt into inspect mode intentionally', () => {
```

with:

```ts
test('dashboard cards open full ECharts interaction in a centered popup viewer', () => {
  assert.match(appSource, /const \[inspectedDashboardCardId, setInspectedDashboardCardId\] = useState<string \| null>\(null\)/)
  assert.match(appSource, /const inspectedDashboardCard = activeGrid\?\.cards\.find\(\(card\) => card\.id === inspectedDashboardCardId && card\.kind === 'dashboard'\)/)
  assert.match(appSource, /onOpenInspect=\{\(\) => setInspectedDashboardCardId\(card\.id\)\}/)
  assert.match(appSource, /<DashboardInspectModal\s+card=\{inspectedDashboardCard\}\s+onClose=\{\(\) => setInspectedDashboardCardId\(null\)\}\s+\/?>/s)
  assert.match(dashboardCardSource, /dashboard-inspect-open/)
  assert.match(dashboardCardSource, /查看 \/ 交互/)
  assert.doesNotMatch(dashboardCardSource, /dashboard-preview-trigger/)
  assert.doesNotMatch(dashboardCardSource, /dashboard-inspect-exit/)
})
```

- [ ] **Step 3: Replace the Escape/background exit test with modal-close assertions**

Replace the existing test named:

```ts
test('dashboard inspect mode exits on Escape or blank canvas pointer down', () => {
```

with:

```ts
test('dashboard popup viewer closes through Escape close button and overlay click', () => {
  assert.match(appSource, /if \(event\.key === 'Escape'\) setInspectedDashboardCardId\(null\)/)
  assert.match(appSource, /window\.addEventListener\('keydown', handleDashboardInspectKeyDown\)/)
  assert.match(appSource, /window\.removeEventListener\('keydown', handleDashboardInspectKeyDown\)/)
  assert.match(dashboardInspectModalSource, /className="dashboard-inspect-overlay"/)
  assert.match(dashboardInspectModalSource, /onClick=\{onClose\}/)
  assert.match(dashboardInspectModalSource, /className="dashboard-inspect-modal"/)
  assert.match(dashboardInspectModalSource, /onClick=\{\(event\) => event\.stopPropagation\(\)\}/)
  assert.match(dashboardInspectModalSource, /className="dashboard-inspect-close"/)
  assert.match(dashboardInspectModalSource, /aria-label="关闭数据看板查看"/)
})
```

- [ ] **Step 4: Add a modal chart interaction test**

After the preview pointer boundary test, add:

```ts
test('dashboard popup modal owns full ECharts chart pointer interactions', () => {
  assert.match(dashboardInspectModalSource, /echarts\.init\(container, undefined, \{ renderer: 'canvas' \}\)/)
  assert.match(appCss, /\.dashboard-inspect-chart\s*\{[^}]*pointer-events:\s*auto;[^}]*touch-action:\s*manipulation;/s)
  assert.match(appCss, /\.dashboard-inspect-overlay\s*\{/)
  assert.match(appCss, /\.dashboard-inspect-modal\s*\{/)
})
```

- [ ] **Step 5: Run tests to verify failure**

Run:

```bash
npm --prefix "/Users/xk/vs开发文件/Canvas-Workbench" test -- src/dashboardInteractionSource.test.ts
```

Expected: FAIL because `src/DashboardInspectModal.tsx`, `DashboardInspectModal`, `dashboard-inspect-open`, and modal CSS do not exist yet.

---

### Task 2: Create DashboardInspectModal Component

**Files:**
- Create: `src/DashboardInspectModal.tsx`

- [ ] **Step 1: Create the modal component file**

Write this complete file to `src/DashboardInspectModal.tsx`:

```tsx
import { useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts'
import { validateDashboardOption } from './dashboardOption'
import type { CardData } from './shared/workspaceTypes'

type DashboardInspectModalProps = {
  card: CardData
  onClose: () => void
}

function shortErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message.slice(0, 120)
  return '请检查 option JSON'
}

export function DashboardInspectModal({ card, onClose }: DashboardInspectModalProps) {
  const chartRef = useRef<HTMLDivElement | null>(null)
  const instanceRef = useRef<echarts.ECharts | null>(null)
  const dashboard = card.dashboard

  const validation = useMemo(() => validateDashboardOption(dashboard?.option), [dashboard?.option])
  const generatedBy = dashboard?.generatedBy?.trim()
  const updatedAt = dashboard?.updatedAt?.trim()
  const footer = generatedBy && updatedAt ? `${generatedBy} · ${updatedAt}` : generatedBy || updatedAt || ''

  useEffect(() => {
    const container = chartRef.current
    if (!container || !validation.ok) return undefined

    const chart = echarts.init(container, undefined, { renderer: 'canvas' })
    instanceRef.current = chart

    const existingOverlay = container.parentElement?.querySelector('.dashboard-card-overlay')
    existingOverlay?.remove()

    try {
      chart.setOption(validation.option, true)
    } catch (error) {
      const overlay = document.createElement('div')
      overlay.className = 'dashboard-card-state dashboard-card-state-error dashboard-card-overlay'
      const heading = document.createElement('strong')
      heading.textContent = '图表渲染失败'
      const detail = document.createElement('span')
      detail.textContent = shortErrorMessage(error)
      overlay.append(heading, detail)
      container.parentElement?.append(overlay)
    }

    const resizeObserver = new ResizeObserver(() => {
      chart.resize()
    })
    resizeObserver.observe(container)
    chart.resize()

    return () => {
      resizeObserver.disconnect()
      container.parentElement?.querySelector('.dashboard-card-overlay')?.remove()
      chart.dispose()
      if (instanceRef.current === chart) instanceRef.current = null
    }
  }, [validation])

  return (
    <div className="dashboard-inspect-overlay" onClick={onClose}>
      <section className="dashboard-inspect-modal" onClick={(event) => event.stopPropagation()} aria-label={card.title || '数据看板'}>
        <header className="dashboard-inspect-modal-header">
          <div>
            <span>数据看板</span>
            <strong>{card.title || '数据看板'}</strong>
          </div>
          <button type="button" className="dashboard-inspect-close" aria-label="关闭数据看板查看" onClick={onClose}>
            关闭
          </button>
        </header>

        <div className="dashboard-inspect-modal-body">
          {!dashboard?.option ? (
            <div className="dashboard-card-state">
              <strong>等待图表配置</strong>
              <span>请通过 CLI 写入 ECharts option</span>
            </div>
          ) : !validation.ok ? (
            <div className="dashboard-card-state dashboard-card-state-error">
              <strong>{validation.message}</strong>
              <span>{validation.detail || '请检查 option JSON'}</span>
            </div>
          ) : (
            <div ref={chartRef} className="dashboard-inspect-chart" aria-hidden="true" />
          )}
        </div>

        {footer ? <footer className="dashboard-inspect-modal-footer">{footer}</footer> : null}
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Run tests and confirm modal file assertions improve**

Run:

```bash
npm --prefix "/Users/xk/vs开发文件/Canvas-Workbench" test -- src/dashboardInteractionSource.test.ts
```

Expected: Some tests still fail because `App.tsx`, `DashboardCard.tsx`, and modal CSS are not wired yet. The `DashboardInspectModal.tsx` read should no longer fail.

---

### Task 3: Change DashboardCard to Header Open Action

**Files:**
- Modify: `src/DashboardCard.tsx`

- [ ] **Step 1: Replace inspect props with open callback**

Replace the props type:

```ts
type DashboardCardProps = {
  dashboard?: DashboardState
  title: string
  isInspecting?: boolean
  onEnterInspect?: () => void
  onExitInspect?: () => void
}
```

with:

```ts
type DashboardCardProps = {
  dashboard?: DashboardState
  title: string
  onOpenInspect?: () => void
}
```

- [ ] **Step 2: Replace function destructuring**

Replace:

```ts
export function DashboardCard({ dashboard, title, isInspecting = false, onEnterInspect, onExitInspect }: DashboardCardProps) {
```

with:

```ts
export function DashboardCard({ dashboard, title, onOpenInspect }: DashboardCardProps) {
```

- [ ] **Step 3: Make the card frame always previewing**

Replace:

```ts
  const frameClassName = `dashboard-card-frame ${isInspecting ? 'is-inspecting' : 'is-previewing'}`
```

with:

```ts
  const frameClassName = 'dashboard-card-frame is-previewing'
```

- [ ] **Step 4: Add the header action to missing-option branch**

In the missing-option branch header, replace:

```tsx
<div className="dashboard-card-header">
  <span>{title || '数据看板'}</span>
</div>
```

with:

```tsx
<div className="dashboard-card-header">
  <span>{title || '数据看板'}</span>
  <button type="button" className="dashboard-inspect-open" onClick={onOpenInspect}>
    查看 / 交互
  </button>
</div>
```

- [ ] **Step 5: Add the header action to invalid-option branch**

Apply the same replacement in the invalid-option branch header.

- [ ] **Step 6: Replace the valid dashboard return block**

Replace the valid return block:

```tsx
  return (
    <section className={frameClassName} aria-label={title || '数据看板'}>
      <div className="dashboard-card-header">
        <span>{title || '数据看板'}</span>
        {isInspecting ? (
          <button type="button" className="dashboard-inspect-exit" onClick={onExitInspect}>
            退出查看
          </button>
        ) : null}
      </div>
      <div className="dashboard-card-viewport">
        <div ref={chartRef} className="dashboard-chart" aria-hidden="true" />
        {!isInspecting ? (
          <button type="button" className="dashboard-preview-trigger" onClick={onEnterInspect}>
            点击查看 / 交互
          </button>
        ) : null}
      </div>
      {footer ? <div className="dashboard-card-footer">{footer}</div> : null}
    </section>
  )
```

with:

```tsx
  return (
    <section className={frameClassName} aria-label={title || '数据看板'}>
      <div className="dashboard-card-header">
        <span>{title || '数据看板'}</span>
        <button type="button" className="dashboard-inspect-open" onClick={onOpenInspect}>
          查看 / 交互
        </button>
      </div>
      <div className="dashboard-card-viewport">
        <div ref={chartRef} className="dashboard-chart" aria-hidden="true" />
      </div>
      {footer ? <div className="dashboard-card-footer">{footer}</div> : null}
    </section>
  )
```

- [ ] **Step 7: Run focused tests and expect App/CSS failures remain**

Run:

```bash
npm --prefix "/Users/xk/vs开发文件/Canvas-Workbench" test -- src/dashboardInteractionSource.test.ts
```

Expected: `dashboard-inspect-open` assertions pass. App modal render and CSS modal assertions still fail.

---

### Task 4: Render the Popup Modal from App

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import the modal component**

Add near the existing `DashboardCard` import:

```ts
import { DashboardInspectModal } from './DashboardInspectModal'
```

- [ ] **Step 2: Add selected dashboard card lookup**

After `activeGrid` is computed in `App`, add:

```ts
  const inspectedDashboardCard = activeGrid?.cards.find((card) => card.id === inspectedDashboardCardId && card.kind === 'dashboard')
```

If `activeGrid` is not directly named, locate the existing active-grid variable and place this immediately after it.

- [ ] **Step 3: Update DashboardCard props**

Replace:

```tsx
<DashboardCard
  dashboard={card.dashboard}
  title={card.title}
  isInspecting={inspectedDashboardCardId === card.id}
  onEnterInspect={() => setInspectedDashboardCardId(card.id)}
  onExitInspect={() => setInspectedDashboardCardId((current) => current === card.id ? null : current)}
/>
```

with:

```tsx
<DashboardCard
  dashboard={card.dashboard}
  title={card.title}
  onOpenInspect={() => setInspectedDashboardCardId(card.id)}
/>
```

- [ ] **Step 4: Render the modal near the app root**

Near the end of the returned JSX, before the closing app shell tag, add:

```tsx
      {inspectedDashboardCard ? (
        <DashboardInspectModal card={inspectedDashboardCard} onClose={() => setInspectedDashboardCardId(null)} />
      ) : null}
```

- [ ] **Step 5: Keep Escape close handling**

Ensure this effect remains:

```ts
  useEffect(() => {
    const handleDashboardInspectKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setInspectedDashboardCardId(null)
    }

    window.addEventListener('keydown', handleDashboardInspectKeyDown)
    return () => {
      window.removeEventListener('keydown', handleDashboardInspectKeyDown)
    }
  }, [])
```

- [ ] **Step 6: Run focused tests and expect CSS failures remain**

Run:

```bash
npm --prefix "/Users/xk/vs开发文件/Canvas-Workbench" test -- src/dashboardInteractionSource.test.ts
```

Expected: App and modal render assertions pass. CSS assertions for `.dashboard-inspect-chart`, `.dashboard-inspect-overlay`, and `.dashboard-inspect-modal` still fail until Task 5.

---

### Task 5: Style Header Action and Centered Popup Viewer

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: Replace old card-internal inspect button CSS**

Remove the old `.dashboard-inspect-exit`, `.dashboard-inspect-exit:hover`, `.dashboard-preview-trigger`, and `.dashboard-preview-trigger:hover` rules.

Add this header action rule near `.dashboard-card-header`:

```css
.dashboard-inspect-open {
  border: 1px solid rgba(125, 211, 252, 0.32);
  border-radius: 999px;
  padding: 5px 10px;
  background: rgba(14, 165, 233, 0.12);
  color: rgba(224, 242, 254, 0.92);
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
  white-space: nowrap;
}

.dashboard-inspect-open:hover {
  background: rgba(14, 165, 233, 0.24);
  border-color: rgba(125, 211, 252, 0.52);
  color: #f8fafc;
}
```

- [ ] **Step 2: Keep preview chart non-interactive**

Ensure these rules exist:

```css
.dashboard-chart {
  width: 100%;
  height: 100%;
  min-height: 180px;
}

.dashboard-card-frame.is-previewing .dashboard-chart {
  pointer-events: none;
}
```

Remove `.dashboard-card-frame.is-inspecting .dashboard-chart` because the card itself no longer has inspect mode.

- [ ] **Step 3: Add modal overlay CSS**

Add near dashboard styles:

```css
.dashboard-inspect-overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 42px;
  background: rgba(2, 6, 23, 0.56);
  backdrop-filter: blur(8px);
}
```

- [ ] **Step 4: Add modal frame CSS**

Add:

```css
.dashboard-inspect-modal {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: min(1080px, calc(100vw - 84px));
  height: min(720px, calc(100vh - 84px));
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 26px;
  background:
    linear-gradient(180deg, rgba(15, 23, 42, 0.94), rgba(2, 6, 23, 0.92));
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.06),
    0 28px 90px rgba(0, 0, 0, 0.5);
}
```

- [ ] **Step 5: Add modal header, body, chart, footer, and close CSS**

Add:

```css
.dashboard-inspect-modal-header,
.dashboard-inspect-modal-footer {
  min-width: 0;
  padding: 16px 20px;
  color: var(--text-soft);
  border-color: rgba(148, 163, 184, 0.2);
}

.dashboard-inspect-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
}

.dashboard-inspect-modal-header div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.dashboard-inspect-modal-header span {
  color: var(--text-dim);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.dashboard-inspect-modal-header strong {
  min-width: 0;
  overflow: hidden;
  color: var(--text-main);
  font-size: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-inspect-close {
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 999px;
  padding: 8px 14px;
  background: rgba(15, 23, 42, 0.72);
  color: rgba(226, 232, 240, 0.9);
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.dashboard-inspect-close:hover {
  border-color: rgba(248, 113, 113, 0.42);
  color: #fecaca;
}

.dashboard-inspect-modal-body {
  position: relative;
  min-height: 0;
  padding: 18px;
}

.dashboard-inspect-chart {
  width: 100%;
  height: 100%;
  min-height: 360px;
  pointer-events: auto;
  touch-action: manipulation;
}

.dashboard-inspect-modal-footer {
  border-top: 1px solid rgba(148, 163, 184, 0.2);
  color: var(--text-dim);
  font-size: 12px;
  font-weight: 700;
}
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm --prefix "/Users/xk/vs开发文件/Canvas-Workbench" test -- src/dashboardInteractionSource.test.ts
```

Expected: PASS.

---

### Task 6: Full Verification and Obsidian Bundle Update

**Files:**
- Modify generated: `dist/index.html`
- Modify generated: `dist/assets/*`
- Modify generated: `dist-obsidian/main.js`
- Modify generated: `dist-obsidian/styles.css`
- Modify generated: `dist-obsidian/manifest.json`
- Copy to: `/Users/xk/Documents/Obsidian Vault/.obsidian/plugins/canvas-workbench/`

- [ ] **Step 1: Run full check**

Run:

```bash
npm --prefix "/Users/xk/vs开发文件/Canvas-Workbench" run check
```

Expected: PASS. Known warnings may appear:

```text
React Hook useEffect has missing dependencies: 'finishEventFlowEdgeDragByPointer' and 'persistCliBridgeCardPatch'
Some chunks are larger than 500 kB after minification
ERROR: failed to copy trust settings of system certificate-25291
```

- [ ] **Step 2: Restore Obsidian manifest**

Run:

```bash
cp "/Users/xk/vs开发文件/Canvas-Workbench/manifest.json" "/Users/xk/vs开发文件/Canvas-Workbench/dist-obsidian/manifest.json"
```

Expected: `dist-obsidian/manifest.json` exists.

- [ ] **Step 3: Copy Obsidian bundle into the vault**

Run:

```bash
mkdir -p "/Users/xk/Documents/Obsidian Vault/.obsidian/plugins/canvas-workbench"
cp "/Users/xk/vs开发文件/Canvas-Workbench/dist-obsidian/main.js" "/Users/xk/Documents/Obsidian Vault/.obsidian/plugins/canvas-workbench/main.js"
cp "/Users/xk/vs开发文件/Canvas-Workbench/dist-obsidian/styles.css" "/Users/xk/Documents/Obsidian Vault/.obsidian/plugins/canvas-workbench/styles.css"
cp "/Users/xk/vs开发文件/Canvas-Workbench/dist-obsidian/manifest.json" "/Users/xk/Documents/Obsidian Vault/.obsidian/plugins/canvas-workbench/manifest.json"
```

Expected: Obsidian plugin files are updated.

---

### Task 7: Commit and Push

**Files:**
- Stage relevant source, test, plan, and generated Obsidian files.

- [ ] **Step 1: Review status**

Run:

```bash
git -C "/Users/xk/vs开发文件/Canvas-Workbench" status --short
```

Expected: modified source/test/CSS files, new `src/DashboardInspectModal.tsx`, new plan file, and generated Obsidian files.

- [ ] **Step 2: Stage files**

Run:

```bash
git -C "/Users/xk/vs开发文件/Canvas-Workbench" add \
  "src/App.tsx" \
  "src/App.css" \
  "src/DashboardCard.tsx" \
  "src/DashboardInspectModal.tsx" \
  "src/dashboardInteractionSource.test.ts" \
  "docs/superpowers/plans/2026-05-11-dashboard-popup-inspect-mode.md" \
  "dist-obsidian/main.js" \
  "dist-obsidian/styles.css" \
  "dist-obsidian/manifest.json"
```

Expected: files are staged.

- [ ] **Step 3: Commit popup viewer implementation**

Run:

```bash
git -C "/Users/xk/vs开发文件/Canvas-Workbench" commit -m "$(cat <<'EOF'
feat: open dashboard interactions in popup viewer

Keep dashboard cards as stable previews and move full ECharts interactions into a centered popup viewer opened from the card header.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: a new commit is created.

- [ ] **Step 4: Push to GitHub**

Run:

```bash
git -C "/Users/xk/vs开发文件/Canvas-Workbench" push origin main
```

Expected: push succeeds. If it fails with `CONNECT tunnel failed, response 403`, report the exact local command for the user to run.

---

## Self-Review

- Spec coverage: The plan covers header `查看 / 交互`, centered popup viewer, full ECharts interaction only in the popup, closing via button/Escape/overlay, preview card stability, top drag handle preservation, tests, Obsidian bundle update, commit, and push.
- Placeholder scan: No placeholders, `TBD`, or vague testing instructions remain.
- Type consistency: `DashboardInspectModal`, `onOpenInspect`, `inspectedDashboardCardId`, `dashboard-inspect-open`, `dashboard-inspect-overlay`, `dashboard-inspect-modal`, and `dashboard-inspect-chart` are named consistently across tasks.
