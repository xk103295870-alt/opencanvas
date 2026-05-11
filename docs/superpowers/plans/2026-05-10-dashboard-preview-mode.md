# Dashboard Preview Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make dashboard cards behave like normal canvas cards by default, then enable full ECharts interactions only after the user intentionally enters inspect mode.

**Architecture:** `App.tsx` owns a single `inspectedDashboardCardId` UI state and passes mode/callback props into `DashboardCard`. `DashboardCard.tsx` renders the same ECharts preview in both modes, overlays a preview affordance when not inspecting, and shows an exit control when inspecting. `App.css` gates pointer events so preview mode does not continuously claim chart interaction, while inspect mode enables ECharts tooltip/legend/hover.

**Tech Stack:** React 19, TypeScript, Vite, ECharts, Node test source-regression tests, Obsidian plugin build.

---

## File Structure

- Modify `src/dashboardInteractionSource.test.ts`
  - Adds source-regression tests for preview/inspect mode boundaries, Escape/background exit, and chart pointer-event gating.
  - Keeps existing dashboard top-handle, frameless, and 45% zoom tests.

- Modify `src/DashboardCard.tsx`
  - Adds `isInspecting`, `onEnterInspect`, and `onExitInspect` props.
  - Renders preview overlay button in preview mode.
  - Renders `退出查看` button in inspect mode.
  - Applies mode classes to the frame and chart container.

- Modify `src/App.tsx`
  - Tracks one inspected dashboard card id.
  - Passes inspect state/callbacks to each dashboard card.
  - Clears inspect mode on Escape and blank-canvas pointer down.
  - Keeps the top dashboard drag handle as the only drag surface.

- Modify `src/App.css`
  - Adds preview/inspect visual states.
  - Uses CSS to disable chart pointer ownership in preview mode and enable it in inspect mode.
  - Keeps panning cursor override and frameless/photo-style dashboard surface.

- Modify generated Obsidian bundle files after verification:
  - `dist-obsidian/main.js`
  - `dist-obsidian/styles.css`
  - `dist-obsidian/manifest.json`
  - Copy those into `/Users/xk/Documents/Obsidian Vault/.obsidian/plugins/canvas-workbench/`.

## Important Pre-Implementation State

The working tree may already contain approved but uncommitted 45% zoom work:

- `src/App.tsx` contains `const DEFAULT_CANVAS_ZOOM = 0.45`.
- `src/dashboardInteractionSource.test.ts` contains `canvas starts and resets at a 45 percent zoom level to reduce oversized hit areas`.
- `dist-obsidian/main.js` may be rebuilt.
- `dist-obsidian/manifest.json` may be missing after a build and must be restored from root `manifest.json` before committing build output.

Do not overwrite or revert those changes. Either commit them first as Task 0 or include them in the final feature commit if the user wants one combined commit.

---

### Task 0: Preserve Existing 45% Zoom Work

**Files:**
- Modify: `dist-obsidian/manifest.json`
- Verify: `src/App.tsx`
- Verify: `src/dashboardInteractionSource.test.ts`

- [ ] **Step 1: Verify current uncommitted zoom work is present**

Run:

```bash
git -C "/Users/xk/vs开发文件/Canvas-Workbench" status --short
grep -n "DEFAULT_CANVAS_ZOOM\|canvas starts and resets at a 45 percent" "/Users/xk/vs开发文件/Canvas-Workbench/src/App.tsx" "/Users/xk/vs开发文件/Canvas-Workbench/src/dashboardInteractionSource.test.ts"
```

Expected: `src/App.tsx` and `src/dashboardInteractionSource.test.ts` are modified, and grep shows:

```text
src/App.tsx:...:const DEFAULT_CANVAS_ZOOM = 0.45
src/dashboardInteractionSource.test.ts:...:test('canvas starts and resets at a 45 percent zoom level to reduce oversized hit areas', () => {
```

- [ ] **Step 2: Restore Obsidian manifest if the build deleted it**

Run:

```bash
cp "/Users/xk/vs开发文件/Canvas-Workbench/manifest.json" "/Users/xk/vs开发文件/Canvas-Workbench/dist-obsidian/manifest.json"
```

Expected: `dist-obsidian/manifest.json` exists again.

- [ ] **Step 3: Run the focused test that covers the zoom work**

Run:

```bash
npm --prefix "/Users/xk/vs开发文件/Canvas-Workbench" test -- src/dashboardInteractionSource.test.ts
```

Expected: PASS, including:

```text
✔ canvas starts and resets at a 45 percent zoom level to reduce oversized hit areas
```

- [ ] **Step 4: Commit the zoom work separately if the user wants separate commits**

Run only if the user wants the zoom change isolated before dashboard preview mode:

```bash
git -C "/Users/xk/vs开发文件/Canvas-Workbench" add \
  "src/App.tsx" \
  "src/dashboardInteractionSource.test.ts" \
  "dist-obsidian/main.js" \
  "dist-obsidian/styles.css" \
  "dist-obsidian/manifest.json"

git -C "/Users/xk/vs开发文件/Canvas-Workbench" commit -m "$(cat <<'EOF'
fix: default canvas zoom to 45 percent

Keep the canvas at a lower default and reset zoom so cards occupy less pointer area during normal layout work.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: a new commit is created. If the user prefers one combined feature commit, skip this step and include the zoom files in Task 5.

---

### Task 1: Add Failing Tests for Dashboard Preview/Inspect Mode

**Files:**
- Modify: `src/dashboardInteractionSource.test.ts`

- [ ] **Step 1: Add tests describing preview and inspect mode**

Append these tests after the existing dashboard top-handle test in `src/dashboardInteractionSource.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail for the right reason**

Run:

```bash
npm --prefix "/Users/xk/vs开发文件/Canvas-Workbench" test -- src/dashboardInteractionSource.test.ts
```

Expected: FAIL. The new tests should fail because `inspectedDashboardCardId`, `dashboard-preview-trigger`, preview pointer-event CSS, and Escape handling do not exist yet.

---

### Task 2: Add DashboardCard Preview and Inspect UI

**Files:**
- Modify: `src/DashboardCard.tsx`

- [ ] **Step 1: Update the props type**

Replace the current `DashboardCardProps` type with:

```ts
type DashboardCardProps = {
  dashboard?: DashboardState
  title: string
  isInspecting?: boolean
  onEnterInspect?: () => void
  onExitInspect?: () => void
}
```

- [ ] **Step 2: Destructure the new props with preview mode as default**

Replace:

```ts
export function DashboardCard({ dashboard, title }: DashboardCardProps) {
```

with:

```ts
export function DashboardCard({ dashboard, title, isInspecting = false, onEnterInspect, onExitInspect }: DashboardCardProps) {
```

- [ ] **Step 3: Add a shared frame class inside `DashboardCard`**

Add this after `footer` is computed:

```ts
  const frameClassName = `dashboard-card-frame ${isInspecting ? 'is-inspecting' : 'is-previewing'}`
```

- [ ] **Step 4: Use the shared frame class for missing-option state**

Replace:

```tsx
<section className="dashboard-card-frame" aria-label={title || '数据看板'}>
```

in the missing-option branch with:

```tsx
<section className={frameClassName} aria-label={title || '数据看板'}>
```

- [ ] **Step 5: Use the shared frame class for invalid-option state**

Replace:

```tsx
<section className="dashboard-card-frame" aria-label={title || '数据看板'}>
```

in the invalid-option branch with:

```tsx
<section className={frameClassName} aria-label={title || '数据看板'}>
```

- [ ] **Step 6: Replace the valid dashboard return block**

Replace the current valid return block:

```tsx
  return (
    <section className="dashboard-card-frame" aria-label={title || '数据看板'}>
      <div className="dashboard-card-header">
        <span>{title || '数据看板'}</span>
      </div>
      <div className="dashboard-card-viewport">
        <div ref={chartRef} className="dashboard-chart" aria-hidden="true" />
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

- [ ] **Step 7: Run focused tests and confirm remaining failures are App/CSS-related**

Run:

```bash
npm --prefix "/Users/xk/vs开发文件/Canvas-Workbench" test -- src/dashboardInteractionSource.test.ts
```

Expected: Some tests still fail because `App.tsx` state/callbacks and CSS pointer gating are not implemented yet. `dashboard-preview-trigger`, `点击查看 / 交互`, `dashboard-inspect-exit`, and `退出查看` assertions should now pass.

---

### Task 3: Wire Inspect State in App

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add inspect state near other interaction state**

Find nearby state declarations such as `const [isPanning, setIsPanning] = useState(false)` and add:

```ts
  const [inspectedDashboardCardId, setInspectedDashboardCardId] = useState<string | null>(null)
```

- [ ] **Step 2: Add Escape handling**

Add this effect near the existing global pointer lifecycle effects:

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

- [ ] **Step 3: Clear inspect mode on blank canvas pointer down**

In `onCanvasPointerDown`, keep this existing guard:

```ts
    const target = event.target as HTMLElement
    if (target.closest('.card')) return
```

Immediately after it, add:

```ts
    setInspectedDashboardCardId(null)
```

The resulting section should be:

```ts
    const target = event.target as HTMLElement
    if (target.closest('.card')) return
    setInspectedDashboardCardId(null)

    const currentViewport = viewportRef.current
```

- [ ] **Step 4: Pass inspect props into `DashboardCard`**

Find the dashboard render:

```tsx
<DashboardCard dashboard={card.dashboard} title={card.title} />
```

Replace it with:

```tsx
<DashboardCard
  dashboard={card.dashboard}
  title={card.title}
  isInspecting={inspectedDashboardCardId === card.id}
  onEnterInspect={() => setInspectedDashboardCardId(card.id)}
  onExitInspect={() => setInspectedDashboardCardId((current) => current === card.id ? null : current)}
/>
```

- [ ] **Step 5: Run focused tests and confirm remaining failures are CSS-related**

Run:

```bash
npm --prefix "/Users/xk/vs开发文件/Canvas-Workbench" test -- src/dashboardInteractionSource.test.ts
```

Expected: App-related assertions pass. CSS assertions for `.dashboard-card-frame.is-previewing .dashboard-chart`, `.dashboard-card-frame.is-inspecting .dashboard-chart`, and `.dashboard-preview-trigger` may still fail until Task 4.

---

### Task 4: Style Preview/Inspect Pointer Boundaries

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: Replace the always-interactive dashboard chart rule**

Find the existing `.dashboard-chart` rule:

```css
.dashboard-chart {
  width: 100%;
  height: 100%;
  min-height: 180px;
  pointer-events: auto;
  touch-action: manipulation;
}
```

Replace it with:

```css
.dashboard-chart {
  width: 100%;
  height: 100%;
  min-height: 180px;
}

.dashboard-card-frame.is-previewing .dashboard-chart {
  pointer-events: none;
}

.dashboard-card-frame.is-inspecting .dashboard-chart {
  pointer-events: auto;
  touch-action: manipulation;
}
```

- [ ] **Step 2: Ensure the viewport can position overlay controls**

Find `.dashboard-card-viewport` and ensure it contains `position: relative;`:

```css
.dashboard-card-viewport {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
```

- [ ] **Step 3: Add preview trigger styling**

Add after `.dashboard-card-viewport` or near dashboard styles:

```css
.dashboard-preview-trigger {
  position: absolute;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  z-index: 3;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 999px;
  padding: 7px 14px;
  background: rgba(15, 23, 42, 0.62);
  color: rgba(226, 232, 240, 0.92);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 12px 26px rgba(0, 0, 0, 0.26);
  backdrop-filter: blur(14px);
}

.dashboard-preview-trigger:hover {
  border-color: rgba(125, 211, 252, 0.52);
  color: #f8fafc;
  background: rgba(15, 23, 42, 0.78);
}
```

- [ ] **Step 4: Add inspect exit styling**

Add near `.dashboard-card-header` styles:

```css
.dashboard-inspect-exit {
  border: 1px solid rgba(125, 211, 252, 0.38);
  border-radius: 999px;
  padding: 5px 10px;
  background: rgba(14, 165, 233, 0.16);
  color: rgba(224, 242, 254, 0.94);
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
}

.dashboard-inspect-exit:hover {
  background: rgba(14, 165, 233, 0.28);
  color: #f8fafc;
}
```

- [ ] **Step 5: Add subtle inspect state**

Add:

```css
.dashboard-card-frame.is-inspecting {
  box-shadow:
    inset 0 0 0 1px rgba(125, 211, 252, 0.18),
    0 24px 60px rgba(8, 47, 73, 0.28);
}
```

- [ ] **Step 6: Run focused tests and verify they pass**

Run:

```bash
npm --prefix "/Users/xk/vs开发文件/Canvas-Workbench" test -- src/dashboardInteractionSource.test.ts
```

Expected: PASS, including all preview/inspect tests.

---

### Task 5: Full Verification and Obsidian Bundle Update

**Files:**
- Modify generated: `dist/index.html`
- Modify generated: `dist/assets/*`
- Modify generated: `dist-obsidian/main.js`
- Modify generated: `dist-obsidian/styles.css`
- Modify generated: `dist-obsidian/manifest.json`
- Copy to: `/Users/xk/Documents/Obsidian Vault/.obsidian/plugins/canvas-workbench/`

- [ ] **Step 1: Run the full project check**

Run:

```bash
npm --prefix "/Users/xk/vs开发文件/Canvas-Workbench" run check
```

Expected: PASS. Existing non-blocking warnings may appear:

```text
React Hook useEffect has missing dependencies: 'finishEventFlowEdgeDragByPointer' and 'persistCliBridgeCardPatch'
Some chunks are larger than 500 kB after minification
ERROR: failed to copy trust settings of system certificate-25291
```

These warnings are already known and do not fail the command.

- [ ] **Step 2: Restore Obsidian manifest after build**

Run:

```bash
cp "/Users/xk/vs开发文件/Canvas-Workbench/manifest.json" "/Users/xk/vs开发文件/Canvas-Workbench/dist-obsidian/manifest.json"
```

Expected: `dist-obsidian/manifest.json` exists.

- [ ] **Step 3: Copy the rebuilt Obsidian plugin into the vault**

Run:

```bash
mkdir -p "/Users/xk/Documents/Obsidian Vault/.obsidian/plugins/canvas-workbench"
cp "/Users/xk/vs开发文件/Canvas-Workbench/dist-obsidian/main.js" "/Users/xk/Documents/Obsidian Vault/.obsidian/plugins/canvas-workbench/main.js"
cp "/Users/xk/vs开发文件/Canvas-Workbench/dist-obsidian/styles.css" "/Users/xk/Documents/Obsidian Vault/.obsidian/plugins/canvas-workbench/styles.css"
cp "/Users/xk/vs开发文件/Canvas-Workbench/dist-obsidian/manifest.json" "/Users/xk/Documents/Obsidian Vault/.obsidian/plugins/canvas-workbench/manifest.json"
```

Expected: the vault plugin files are updated.

- [ ] **Step 4: Check git status**

Run:

```bash
git -C "/Users/xk/vs开发文件/Canvas-Workbench" status --short
```

Expected: modified source/test/CSS files and generated bundle files are listed. No unexpected secret/config files should be present.

---

### Task 6: Commit and Push

**Files:**
- Stage only relevant source, tests, CSS, docs if changed, and generated Obsidian bundle files.

- [ ] **Step 1: Review the final diff**

Run:

```bash
git -C "/Users/xk/vs开发文件/Canvas-Workbench" diff -- \
  "src/App.tsx" \
  "src/App.css" \
  "src/DashboardCard.tsx" \
  "src/dashboardInteractionSource.test.ts" \
  "dist-obsidian/main.js" \
  "dist-obsidian/styles.css" \
  "dist-obsidian/manifest.json"
```

Expected: diff shows only dashboard preview/inspect mode, 45% zoom if not committed in Task 0, and generated Obsidian bundle updates.

- [ ] **Step 2: Stage relevant files**

Run:

```bash
git -C "/Users/xk/vs开发文件/Canvas-Workbench" add \
  "src/App.tsx" \
  "src/App.css" \
  "src/DashboardCard.tsx" \
  "src/dashboardInteractionSource.test.ts" \
  "dist-obsidian/main.js" \
  "dist-obsidian/styles.css" \
  "dist-obsidian/manifest.json"
```

Expected: files are staged.

- [ ] **Step 3: Commit the dashboard preview mode feature**

Run:

```bash
git -C "/Users/xk/vs开发文件/Canvas-Workbench" commit -m "$(cat <<'EOF'
feat: add dashboard preview inspect mode

Make dashboard cards behave like lightweight previews by default and enable full ECharts interactions only when the user intentionally enters inspect mode.

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

Expected: push succeeds. If the environment reports `CONNECT tunnel failed, response 403`, tell the user to run the same command in their local terminal.

---

## Self-Review

- Spec coverage: The plan covers preview mode by default, click-to-inspect, full ECharts interaction in inspect mode, exit via button/Escape/background, top-handle-only drag, CSS pointer boundaries, tests, Obsidian bundle update, commit, and push.
- Placeholder scan: No `TBD`, `TODO`, `implement later`, or vague "add tests" steps remain. Each code-changing step includes exact code or exact command.
- Type consistency: `DashboardCardProps`, `isInspecting`, `onEnterInspect`, `onExitInspect`, and `inspectedDashboardCardId` names are consistent across tests, component code, and App wiring.
