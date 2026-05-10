# ECharts Dashboard Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a CLI-created `dashboard` card that stores safe ECharts option JSON and renders it as a minimal framed dashboard card in Web and Obsidian.

**Architecture:** Extend the shared card model with a focused `DashboardState`, validate JSON-compatible options in a small helper, render ECharts through a dedicated `DashboardCard` React component, and keep creation in the existing Local API/CLI card flow. The feature does not call any AI API; external tools generate JSON and write cards through `canvas-workbench dashboard add`.

**Tech Stack:** React 19, TypeScript, Vite, ECharts, Node CLI, `node:test`/`assert` tests, existing Canvas Workbench Local API.

---

## File Structure

- Modify: `package.json`
  - Add `echarts` frontend dependency.
- Modify: `package-lock.json`
  - Updated by `npm install echarts`.
- Create: `src/dashboardOption.ts`
  - Own dashboard option validation/sanitization and reusable size limits.
  - Export `validateDashboardOption`, `isPlainObject`, and error types/messages.
- Create: `src/dashboardOption.test.ts`
  - Unit tests for valid options, invalid root values, invalid `series`, oversized payloads, and JSON compatibility.
- Modify: `src/shared/workspaceTypes.ts`
  - Add `dashboard` to `CardKind`, `CARD_KIND_SET`, and `CARD_DEFAULT_SIZES`.
  - Add `DashboardState` and `dashboard?: DashboardState` to `CardData`.
  - Normalize persisted dashboard state in the same path that normalizes other card state.
- Modify: `src/cardNavigator.ts`
  - Add localized dashboard label and metadata preference.
- Modify: `src/cardNavigator.test.ts`
  - Cover dashboard label and metadata.
- Create: `src/DashboardCard.tsx`
  - Own ECharts lifecycle: `init`, `setOption`, `resize`, `dispose`.
  - Show empty, invalid, and render-failure states without crashing.
- Modify: `src/App.tsx`
  - Import and render `DashboardCard` for `kind === 'dashboard'`.
  - Keep existing drag/resize behavior and card chrome.
- Modify: `src/App.css`
  - Add minimal framed dashboard styles that work on the dark canvas.
- Modify: `bin/canvas-workbench.mjs`
  - Add `dashboard add` command.
  - Parse `--option`, `--stdin`, `--data`, `--prompt`, `--generated-by`.
  - Read JSON from file/stdin and call the Local API create-card endpoint.
- Modify: `src/cliStartup.test.ts`
  - Add CLI source checks for dashboard usage, parsing, stdin/file exclusivity, centered default size, and POST payload fields.

---

### Task 1: Install ECharts Dependency

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install dependency**

Run from repository root:

```bash
npm install echarts
```

Expected: `package.json` includes `"echarts"` in `dependencies`, and `package-lock.json` updates.

- [ ] **Step 2: Verify dependency is visible**

Run:

```bash
npm ls echarts
```

Expected: output includes a single installed `echarts` version and exits 0.

- [ ] **Step 3: Commit dependency update**

```bash
git add package.json package-lock.json
git commit -m "chore: add echarts dependency"
```

---

### Task 2: Dashboard Option Validator

**Files:**
- Create: `src/dashboardOption.ts`
- Create: `src/dashboardOption.test.ts`

- [ ] **Step 1: Write failing validator tests**

Create `src/dashboardOption.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DASHBOARD_OPTION_MAX_BYTES, validateDashboardOption } from './dashboardOption.ts'

test('validateDashboardOption accepts JSON-compatible ECharts option objects', () => {
  const option = {
    title: { text: '销售趋势' },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: ['一月', '二月'] },
    yAxis: { type: 'value' },
    series: [{ type: 'line', data: [12, 18] }],
  }

  const result = validateDashboardOption(option)

  assert.equal(result.ok, true)
  if (result.ok) assert.deepEqual(result.option, option)
})

test('validateDashboardOption rejects missing option values', () => {
  const result = validateDashboardOption(undefined)

  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.message, '图表配置无效')
})

test('validateDashboardOption rejects non-object roots', () => {
  for (const value of [null, [], 'option', 42, true]) {
    const result = validateDashboardOption(value)
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.message, '图表配置无效')
  }
})

test('validateDashboardOption rejects series when it is not an array', () => {
  const result = validateDashboardOption({ series: { type: 'bar', data: [1, 2] } })

  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.detail, 'series must be an array when present')
})

test('validateDashboardOption rejects non JSON-compatible values', () => {
  const result = validateDashboardOption({ title: { text: 'Bad' }, formatter: () => 'unsafe' })

  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.detail, 'option must be JSON-compatible')
})

test('validateDashboardOption rejects oversized options', () => {
  const result = validateDashboardOption({ title: { text: 'x'.repeat(DASHBOARD_OPTION_MAX_BYTES) } })

  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.detail, `option JSON must be smaller than ${DASHBOARD_OPTION_MAX_BYTES} bytes`)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- src/dashboardOption.test.ts
```

Expected: FAIL with module-not-found or missing export errors for `./dashboardOption.ts`.

- [ ] **Step 3: Implement validator**

Create `src/dashboardOption.ts`:

```ts
export const DASHBOARD_OPTION_MAX_BYTES = 512 * 1024

export type DashboardOptionValidationResult =
  | { ok: true; option: Record<string, unknown> }
  | { ok: false; message: string; detail: string }

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (Object.prototype.toString.call(value) !== '[object Object]') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function isJsonCompatible(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null) return true
  const valueType = typeof value
  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') return Number.isFinite(value as number) || valueType !== 'number'
  if (valueType === 'function' || valueType === 'symbol' || valueType === 'bigint' || valueType === 'undefined') return false
  if (Array.isArray(value)) {
    if (seen.has(value)) return false
    seen.add(value)
    return value.every((item) => isJsonCompatible(item, seen))
  }
  if (isPlainObject(value)) {
    if (seen.has(value)) return false
    seen.add(value)
    return Object.values(value).every((item) => isJsonCompatible(item, seen))
  }
  return false
}

export function validateDashboardOption(value: unknown): DashboardOptionValidationResult {
  if (!isPlainObject(value)) {
    return { ok: false, message: '图表配置无效', detail: 'option must be a plain object' }
  }

  if (!isJsonCompatible(value)) {
    return { ok: false, message: '图表配置无效', detail: 'option must be JSON-compatible' }
  }

  if ('series' in value && !Array.isArray(value.series)) {
    return { ok: false, message: '图表配置无效', detail: 'series must be an array when present' }
  }

  const serialized = JSON.stringify(value)
  const bytes = new TextEncoder().encode(serialized).byteLength
  if (bytes > DASHBOARD_OPTION_MAX_BYTES) {
    return {
      ok: false,
      message: '图表配置无效',
      detail: `option JSON must be smaller than ${DASHBOARD_OPTION_MAX_BYTES} bytes`,
    }
  }

  return { ok: true, option: value }
}
```

- [ ] **Step 4: Run validator tests to verify green**

Run:

```bash
npm test -- src/dashboardOption.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit validator**

```bash
git add src/dashboardOption.ts src/dashboardOption.test.ts
git commit -m "feat: validate dashboard chart options"
```

---

### Task 3: Shared Dashboard Card Data Model

**Files:**
- Modify: `src/shared/workspaceTypes.ts`
- Test: `src/workspaceTypes.test.ts` if it exists; otherwise add assertions to the closest existing workspace type test. If no workspace type test exists, create `src/shared/workspaceTypes.test.ts`.

- [ ] **Step 1: Locate existing workspace type tests**

Run:

```bash
find src -name '*workspaceTypes*.test.ts' -o -name '*workspace*.test.ts'
```

Expected: identify an existing test file or confirm none exists.

- [ ] **Step 2: Write failing tests for dashboard kind and defaults**

If no suitable test exists, create `src/shared/workspaceTypes.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CARD_DEFAULT_SIZES, CARD_KIND_SET, normalizeCardData } from './workspaceTypes.ts'

test('dashboard is a recognized card kind with default size', () => {
  assert.equal(CARD_KIND_SET.has('dashboard'), true)
  assert.deepEqual(CARD_DEFAULT_SIZES.dashboard, { width: 760, height: 480 })
})

test('normalizeCardData preserves dashboard state from persisted cards', () => {
  const card = normalizeCardData({
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
  })

  assert.equal(card.kind, 'dashboard')
  assert.deepEqual(card.dashboard?.option, { series: [{ type: 'bar', data: [1] }] })
  assert.deepEqual(card.dashboard?.sourceData, [{ month: '一月', sales: 1 }])
  assert.equal(card.dashboard?.prompt, '生成销售趋势图')
  assert.equal(card.dashboard?.generatedBy, 'claude-code')
  assert.equal(card.dashboard?.updatedAt, '2026-05-10T00:00:00.000Z')
})
```

If the existing normalizer is named differently, keep the same assertions and use the existing normalizer name from `src/shared/workspaceTypes.ts`.

- [ ] **Step 3: Run the focused test to verify red**

Run the chosen test file, for example:

```bash
npm test -- src/shared/workspaceTypes.test.ts
```

Expected: FAIL because `dashboard` is not in `CardKind`/defaults or the normalizer does not preserve dashboard state.

- [ ] **Step 4: Add dashboard types and defaults**

In `src/shared/workspaceTypes.ts`, update the relevant sections to include this exact shape:

```ts
export type CardKind = 'note' | 'hint' | 'image' | 'video' | 'pdf' | 'todo' | 'calendar' | 'eventFlow' | 'dashboard'

export type DashboardState = {
  option: unknown
  sourceData?: unknown
  prompt?: string
  generatedBy?: string
  updatedAt?: string
}
```

Add to `CardData`:

```ts
dashboard?: DashboardState
```

Update kind set:

```ts
export const CARD_KIND_SET = new Set<CardKind>([
  'note',
  'hint',
  'image',
  'video',
  'pdf',
  'todo',
  'calendar',
  'eventFlow',
  'dashboard',
])
```

Update default sizes:

```ts
export const CARD_DEFAULT_SIZES: Record<CardKind, { width: number; height: number }> = {
  note: { width: 340, height: 280 },
  hint: { width: 300, height: 420 },
  image: { width: 360, height: 280 },
  video: { width: 420, height: 300 },
  pdf: { width: 460, height: 360 },
  todo: { width: 760, height: 430 },
  calendar: { width: 540, height: 640 },
  eventFlow: { width: 760, height: 480 },
  dashboard: { width: 760, height: 480 },
}
```

Add dashboard normalization near existing calendar/eventFlow normalization. Use the existing helper names for string normalization if present; otherwise use this local logic:

```ts
function normalizeDashboardState(value: unknown): DashboardState | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  return {
    option: raw.option,
    sourceData: raw.sourceData,
    prompt: typeof raw.prompt === 'string' ? raw.prompt : undefined,
    generatedBy: typeof raw.generatedBy === 'string' ? raw.generatedBy : undefined,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
  }
}
```

Then assign it in card normalization:

```ts
dashboard: normalizeDashboardState(raw.dashboard),
```

- [ ] **Step 5: Run workspace type tests**

Run:

```bash
npm test -- src/shared/workspaceTypes.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run all tests to catch type ripple effects**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 7: Commit shared model**

```bash
git add src/shared/workspaceTypes.ts src/shared/workspaceTypes.test.ts
git commit -m "feat: add dashboard card data model"
```

---

### Task 4: Navigator Dashboard Labels and Metadata

**Files:**
- Modify: `src/cardNavigator.ts`
- Modify: `src/cardNavigator.test.ts`

- [ ] **Step 1: Write failing navigator tests**

In `src/cardNavigator.test.ts`, extend the localized label test:

```ts
assert.equal(getNavigatorCardTypeLabel('dashboard'), '数据看板')
```

Extend metadata tests with:

```ts
assert.equal(
  getNavigatorCardMeta(card({
    kind: 'dashboard',
    dashboard: { option: {}, generatedBy: 'claude-code', updatedAt: '2026-05-10T00:00:00.000Z' },
  })),
  'claude-code',
)
assert.equal(
  getNavigatorCardMeta(card({
    kind: 'dashboard',
    dashboard: { option: {}, updatedAt: '2026-05-10T00:00:00.000Z' },
  })),
  '2026-05-10T00:00:00.000Z',
)
```

- [ ] **Step 2: Run navigator tests to verify red**

Run:

```bash
npm test -- src/cardNavigator.test.ts
```

Expected: FAIL because dashboard label/metadata is not implemented.

- [ ] **Step 3: Implement dashboard navigator label and metadata**

In `src/cardNavigator.ts`, add to `CARD_KIND_LABELS`:

```ts
dashboard: '数据看板',
```

Add this branch near todo/calendar metadata handling, before generic content fallback:

```ts
if (card.kind === 'dashboard') {
  const generatedBy = card.dashboard?.generatedBy?.trim()
  if (generatedBy) return generatedBy
  const updatedAt = card.dashboard?.updatedAt?.trim()
  if (updatedAt) return updatedAt
  return ''
}
```

- [ ] **Step 4: Run navigator tests to verify green**

Run:

```bash
npm test -- src/cardNavigator.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit navigator support**

```bash
git add src/cardNavigator.ts src/cardNavigator.test.ts
git commit -m "feat: show dashboard cards in navigator"
```

---

### Task 5: DashboardCard ECharts Component

**Files:**
- Create: `src/DashboardCard.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Create the component with lifecycle and states**

Create `src/DashboardCard.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import * as echarts from 'echarts'
import type { DashboardState } from './shared/workspaceTypes'
import { validateDashboardOption } from './dashboardOption'

type DashboardCardProps = {
  dashboard?: DashboardState
  title: string
}

function shortErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message.slice(0, 120)
  return '请检查 option JSON'
}

export function DashboardCard({ dashboard, title }: DashboardCardProps) {
  const chartRef = useRef<HTMLDivElement | null>(null)
  const instanceRef = useRef<echarts.ECharts | null>(null)
  const [renderError, setRenderError] = useState('')

  const validation = useMemo(() => validateDashboardOption(dashboard?.option), [dashboard?.option])
  const generatedBy = dashboard?.generatedBy?.trim()
  const updatedAt = dashboard?.updatedAt?.trim()
  const footer = generatedBy && updatedAt ? `${generatedBy} · ${updatedAt}` : generatedBy || updatedAt || ''

  useEffect(() => {
    const container = chartRef.current
    if (!container || !validation.ok) return undefined

    setRenderError('')
    const chart = echarts.init(container, undefined, { renderer: 'canvas' })
    instanceRef.current = chart

    try {
      chart.setOption(validation.option, true)
    } catch (error) {
      setRenderError(shortErrorMessage(error))
    }

    const resizeObserver = new ResizeObserver(() => {
      chart.resize()
    })
    resizeObserver.observe(container)
    chart.resize()

    return () => {
      resizeObserver.disconnect()
      chart.dispose()
      if (instanceRef.current === chart) instanceRef.current = null
    }
  }, [validation])

  if (!dashboard?.option) {
    return (
      <section className="dashboard-card-frame" aria-label={title || '数据看板'}>
        <div className="dashboard-card-header">
          <span>{title || '数据看板'}</span>
        </div>
        <div className="dashboard-card-state">
          <strong>等待图表配置</strong>
          <span>请通过 CLI 写入 ECharts option</span>
        </div>
      </section>
    )
  }

  if (!validation.ok) {
    return (
      <section className="dashboard-card-frame" aria-label={title || '数据看板'}>
        <div className="dashboard-card-header">
          <span>{title || '数据看板'}</span>
        </div>
        <div className="dashboard-card-state dashboard-card-state-error">
          <strong>{validation.message}</strong>
          <span>{validation.detail || '请检查 option JSON'}</span>
        </div>
      </section>
    )
  }

  return (
    <section className="dashboard-card-frame" aria-label={title || '数据看板'}>
      <div className="dashboard-card-header">
        <span>{title || '数据看板'}</span>
      </div>
      <div className="dashboard-card-viewport">
        <div ref={chartRef} className="dashboard-chart" />
        {renderError ? (
          <div className="dashboard-card-state dashboard-card-state-error dashboard-card-overlay">
            <strong>图表渲染失败</strong>
            <span>{renderError}</span>
          </div>
        ) : null}
      </div>
      {footer ? <div className="dashboard-card-footer">{footer}</div> : null}
    </section>
  )
}
```

- [ ] **Step 2: Add minimal framed dashboard styles**

Append to `src/App.css`:

```css
.dashboard-card-frame {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--border-strong) 72%, transparent);
  border-radius: 18px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--surface-strong) 92%, transparent), color-mix(in srgb, var(--surface) 88%, transparent));
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, #ffffff 8%, transparent),
    0 18px 38px rgba(0, 0, 0, 0.22);
}

.dashboard-card-header,
.dashboard-card-footer {
  min-width: 0;
  padding: 10px 14px;
  color: var(--text-soft);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border-color: color-mix(in srgb, var(--border) 72%, transparent);
}

.dashboard-card-header {
  border-bottom: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
}

.dashboard-card-footer {
  border-top: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
}

.dashboard-card-viewport {
  position: relative;
  min-height: 0;
  padding: 12px;
  background: color-mix(in srgb, var(--surface) 74%, transparent);
}

.dashboard-chart {
  width: 100%;
  height: 100%;
  min-height: 180px;
}

.dashboard-card-state {
  display: flex;
  min-height: 180px;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 18px;
  text-align: center;
  color: var(--text-muted);
}

.dashboard-card-state strong {
  color: var(--text-main);
  font-size: 15px;
}

.dashboard-card-state span {
  font-size: 12px;
  line-height: 1.45;
}

.dashboard-card-state-error strong {
  color: var(--danger, #ef7777);
}

.dashboard-card-overlay {
  position: absolute;
  inset: 12px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--surface-strong) 90%, transparent);
}
```

If `--danger` is not defined in `App.css`, either keep the fallback above or replace with an existing red token.

- [ ] **Step 3: Run TypeScript build to catch component issues**

Run:

```bash
npm run build
```

Expected: PASS. If `ResizeObserver` types are unavailable, confirm `DOM` is present in `tsconfig` libs rather than adding a local `any` workaround.

- [ ] **Step 4: Commit dashboard component and styles**

```bash
git add src/DashboardCard.tsx src/App.css
git commit -m "feat: render framed echarts dashboard card"
```

---

### Task 6: App Rendering Integration

**Files:**
- Modify: `src/App.tsx`
- Optional test: if a render/source test exists for card kinds, update it; otherwise rely on build in this task.

- [ ] **Step 1: Import the dashboard component**

In `src/App.tsx`, add:

```ts
import { DashboardCard } from './DashboardCard'
```

- [ ] **Step 2: Render dashboard cards in the card body branch**

Find the existing card body switch/conditional that renders `todo`, `calendar`, `eventFlow`, media, and note content. Add a dashboard branch before the generic note/content branch:

```tsx
{card.kind === 'dashboard' ? (
  <DashboardCard dashboard={card.dashboard} title={card.title} />
) : /* existing branches continue here */}
```

Keep the outer card wrapper, chrome, drag handlers, resize handle, and selected/highlighted classes unchanged.

- [ ] **Step 3: Ensure card chrome stays standard**

No special code is required in `src/cardChrome.ts` for first version. Dashboard uses the existing standard chrome:

```ts
return {
  showHeader: true,
  showFileMeta: kind === 'video' || kind === 'pdf',
  showResizeHandle: true,
  frameless: false,
  chromeMode: 'standard',
  dragSurface: 'header',
}
```

Do not add dashboard to the image frameless branch.

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Run Obsidian build**

Run:

```bash
npm run build:obsidian
```

Expected: PASS. Environment may print certificate-copy warnings; only treat TypeScript/Vite failure as task failure.

- [ ] **Step 6: Commit app integration**

```bash
git add src/App.tsx src/cardChrome.ts
git commit -m "feat: integrate dashboard cards into canvas"
```

If `src/cardChrome.ts` was not changed, omit it from `git add`.

---

### Task 7: CLI Dashboard Add Command

**Files:**
- Modify: `bin/canvas-workbench.mjs`
- Modify: `src/cliStartup.test.ts`

- [ ] **Step 1: Write failing CLI source tests**

Append tests to `src/cliStartup.test.ts`:

```ts
test('CLI documents dashboard add with option file and stdin support', () => {
  assert.match(cliSource, /canvas-workbench dashboard add <title> \[--option <file>\|--stdin\]/)
  assert.match(cliSource, /canvas-workbench dashboard add "销售看板" --option/)
  assert.match(cliSource, /canvas-workbench dashboard add "销售看板" --stdin/)
})

test('CLI parses dashboard add options', () => {
  assert.match(cliSource, /rawCommand === 'dashboard' && tokens\[0\] === 'add'/)
  assert.match(cliSource, /optionPath:\s*''/)
  assert.match(cliSource, /readOptionFromStdin:\s*false/)
  assert.match(cliSource, /sourceDataPath:\s*''/)
  assert.match(cliSource, /generatedBy:\s*''/)
  assert.match(cliSource, /token === '--option'/)
  assert.match(cliSource, /token === '--stdin'/)
  assert.match(cliSource, /token === '--data'/)
  assert.match(cliSource, /token === '--prompt'/)
  assert.match(cliSource, /token === '--generated-by'/)
})

test('CLI creates centered dashboard cards through the Local API', () => {
  assert.match(cliSource, /dashboard:\s*\{ width: 760, height: 480 \}/)
  assert.match(cliSource, /async function dashboardAddCommand\(options\)/)
  assert.match(cliSource, /Exactly one of --option or --stdin must be supplied/)
  assert.match(cliSource, /kind:\s*'dashboard'/)
  assert.match(cliSource, /\.\.\.centeredCardPosition\('dashboard'\)/)
  assert.match(cliSource, /updatedAt:\s*new Date\(\)\.toISOString\(\)/)
})
```

- [ ] **Step 2: Run CLI tests to verify red**

Run:

```bash
npm test -- src/cliStartup.test.ts
```

Expected: FAIL because dashboard CLI strings/functions do not exist.

- [ ] **Step 3: Add dashboard size and usage text**

In `bin/canvas-workbench.mjs`, add to `CLI_CARD_DEFAULT_SIZES`:

```js
dashboard: { width: 760, height: 480 },
```

Add usage line:

```text
  canvas-workbench dashboard add <title> [--option <file>|--stdin] [--data <file>] [--prompt <text>] [--generated-by <name>] [--grid <grid-name-or-id>] [--api-url <url>] [--api-key <key>]
```

Add examples:

```text
  canvas-workbench dashboard add "销售看板" --option ./sales-option.json --grid "AI区"
  cat sales-option.json | canvas-workbench dashboard add "销售看板" --stdin --grid "AI区"
```

- [ ] **Step 4: Extend argument parser**

In command detection, add after note/image or near flow:

```js
} else if (rawCommand === 'dashboard' && tokens[0] === 'add') {
  tokens.shift()
  command = 'dashboard:add'
```

Add defaults to `options`:

```js
optionPath: '',
readOptionFromStdin: false,
sourceDataPath: '',
prompt: '',
generatedBy: '',
```

Add token parsing:

```js
if (token === '--option') {
  options.optionPath = String(tokens.shift() || '')
  continue
}
if (token.startsWith('--option=')) {
  options.optionPath = token.slice('--option='.length)
  continue
}
if (token === '--stdin') {
  options.readOptionFromStdin = true
  continue
}
if (token === '--data') {
  options.sourceDataPath = String(tokens.shift() || '')
  continue
}
if (token.startsWith('--data=')) {
  options.sourceDataPath = token.slice('--data='.length)
  continue
}
if (token === '--prompt') {
  options.prompt = String(tokens.shift() || '')
  continue
}
if (token.startsWith('--prompt=')) {
  options.prompt = token.slice('--prompt='.length)
  continue
}
if (token === '--generated-by') {
  options.generatedBy = String(tokens.shift() || '')
  continue
}
if (token.startsWith('--generated-by=')) {
  options.generatedBy = token.slice('--generated-by='.length)
  continue
}
```

Update positional-token condition to include dashboard:

```js
if ((command === 'grid:add' || command === 'note:add' || command === 'image:add' || command === 'todo:add' || command === 'calendar:event:add' || command === 'dashboard:add') && !token.startsWith('-')) {
  options.contentParts.push(token)
  continue
}
```

- [ ] **Step 5: Add JSON reading helpers**

Near other CLI helper functions, add:

```js
function readTextFile(filePath, label) {
  const resolved = path.resolve(process.cwd(), filePath)
  try {
    return fs.readFileSync(resolved, 'utf8')
  } catch (error) {
    throw new Error(`Could not read ${label}: ${resolved}`)
  }
}

function parseJsonInput(raw, label) {
  try {
    return JSON.parse(raw)
  } catch (error) {
    throw new Error(`Invalid JSON in ${label}`)
  }
}

async function readStdinText() {
  let data = ''
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) {
    data += chunk
  }
  return data
}

function readOptionalSourceData(filePath) {
  const rawPath = String(filePath || '').trim()
  if (!rawPath) return undefined
  const raw = readTextFile(rawPath, '--data')
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}
```

- [ ] **Step 6: Implement dashboard command**

Add near `noteAddCommand`/`flowAddCommand`:

```js
async function dashboardAddCommand(options) {
  const title = String(options.contentParts.join(' ') || '').trim()
  if (!title) {
    throw new Error('Dashboard title is required. Example: canvas-workbench dashboard add "销售看板" --option ./sales-option.json')
  }

  const hasOptionPath = Boolean(String(options.optionPath || '').trim())
  const hasStdin = Boolean(options.readOptionFromStdin)
  if (hasOptionPath === hasStdin) {
    throw new Error('Exactly one of --option or --stdin must be supplied')
  }

  const optionRaw = hasStdin ? await readStdinText() : readTextFile(options.optionPath, '--option')
  const option = parseJsonInput(optionRaw, hasStdin ? 'stdin' : '--option')
  const sourceData = readOptionalSourceData(options.sourceDataPath)

  const apiUrl = apiUrlFor(options)
  const gridLookup = String(options.gridId || '').trim()
  const { grid, created } = await ensureGrid(apiUrl, options, gridLookup)
  if (!grid?.id) throw new Error('Could not find or create target grid')

  const dashboard = {
    option,
    updatedAt: new Date().toISOString(),
  }
  if (sourceData !== undefined) dashboard.sourceData = sourceData
  if (String(options.prompt || '').trim()) dashboard.prompt = String(options.prompt).trim()
  if (String(options.generatedBy || '').trim()) dashboard.generatedBy = String(options.generatedBy).trim()

  const payload = {
    kind: 'dashboard',
    title,
    content: '',
    gridId: grid.id,
    activateGrid: true,
    ...centeredCardPosition('dashboard'),
    dashboard,
  }

  const result = await httpJson(`${apiUrl}/api/v1/cards`, {
    method: 'POST',
    body: payload,
    apiKey: options.apiKey,
  })
  const data = result?.data || {}
  console.log('Dashboard created')
  console.log(`  api: ${apiUrl}`)
  console.log(`  grid: ${data.gridId || grid.id}${created ? ' (created)' : ''}`)
  console.log(`  card: ${data.cardId || data.card?.id || 'unknown'}`)
}
```

- [ ] **Step 7: Dispatch dashboard command in main**

In the command dispatch switch/if block near existing `note:add` and `flow:add`, add:

```js
if (command === 'dashboard:add') {
  await dashboardAddCommand(options)
  return
}
```

- [ ] **Step 8: Run CLI source tests to verify green**

Run:

```bash
npm test -- src/cliStartup.test.ts
```

Expected: PASS.

- [ ] **Step 9: Run CLI manually against argument validation only**

Run:

```bash
node ./bin/canvas-workbench.mjs dashboard add "销售看板"
```

Expected: exits with error containing `Exactly one of --option or --stdin must be supplied`. This does not require the Local API because validation happens before API call.

- [ ] **Step 10: Commit CLI support**

```bash
git add bin/canvas-workbench.mjs src/cliStartup.test.ts
git commit -m "feat: add dashboard cli creation"
```

---

### Task 8: End-to-End Verification and Obsidian Build Copy

**Files:**
- Generated build output only if the repository tracks Obsidian build artifacts.
- Copy target outside repo: `/Users/xk/Documents/Obsidian Vault/.obsidian/plugins/canvas-workbench/`

- [ ] **Step 1: Run all tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Run web build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Run Obsidian build**

Run:

```bash
npm run build:obsidian
```

Expected: PASS. Ignore environment certificate-copy warnings if Vite and TypeScript complete successfully.

- [ ] **Step 4: Copy Obsidian plugin build to the vault**

Run:

```bash
cp dist-obsidian/main.js dist-obsidian/styles.css dist-obsidian/manifest.json "/Users/xk/Documents/Obsidian Vault/.obsidian/plugins/canvas-workbench/"
```

Expected: command exits 0.

- [ ] **Step 5: Prepare a local sample option**

Run:

```bash
mkdir -p .runtime/dashboard-samples
cat > .runtime/dashboard-samples/sales-option.json <<'JSON'
{
  "title": { "text": "销售趋势", "left": "center", "textStyle": { "color": "#dbeafe" } },
  "tooltip": { "trigger": "axis" },
  "xAxis": { "type": "category", "data": ["一月", "二月", "三月", "四月"] },
  "yAxis": { "type": "value" },
  "series": [{ "type": "line", "smooth": true, "data": [120, 180, 160, 240] }]
}
JSON
```

Expected: sample JSON file exists. Do not commit `.runtime` files.

- [ ] **Step 6: Manually verify CLI command when Local API is online**

If Local API is running, run:

```bash
node ./bin/canvas-workbench.mjs dashboard add "销售看板" --option .runtime/dashboard-samples/sales-option.json --generated-by claude-code --prompt "生成销售趋势图" --grid "AI区"
```

Expected: output starts with `Dashboard created` and shows a card id. If Local API is not online, stop and tell the user to start/connect Local API; do not retry blindly.

- [ ] **Step 7: Manually verify stdin command when Local API is online**

If Local API is running, run:

```bash
cat .runtime/dashboard-samples/sales-option.json | node ./bin/canvas-workbench.mjs dashboard add "销售看板 stdin" --stdin --generated-by claude-code --grid "AI区"
```

Expected: output starts with `Dashboard created` and shows a card id.

- [ ] **Step 8: Manual UI verification**

Open Web or Obsidian Canvas Workbench and verify:

1. The dashboard card appears in the target grid through existing `workspace.updated`/polling refresh.
2. The card renders with a compact title/header.
3. The chart appears inside a thin framed viewport.
4. Footer metadata shows `claude-code` when provided.
5. Resizing the card resizes the chart.
6. A card with invalid option shows `图表配置无效` or `图表渲染失败` instead of crashing.
7. Card Navigator lists dashboard cards with type label `数据看板`.

- [ ] **Step 9: Run final check**

Run:

```bash
npm run check
```

Expected: PASS.

- [ ] **Step 10: Commit any final tracked verification/build changes**

If the build copy changed tracked files in the repo, commit them:

```bash
git status --short
git add <tracked-build-files-if-any>
git commit -m "build: refresh obsidian dashboard card bundle"
```

If only untracked `.runtime` sample files exist, do not commit them.

---

## Self-Review Checklist

- Spec coverage:
  - `dashboard` card kind: Task 3.
  - Dashboard default size `760 x 480`: Task 3 and Task 7.
  - CLI `--option` and `--stdin`: Task 7.
  - CLI `--data`, `--prompt`, `--generated-by`, `--grid`: Task 7.
  - ECharts lifecycle: Task 5.
  - Resize handling: Task 5 `ResizeObserver`.
  - Empty/invalid/render error states: Task 5.
  - Minimal framed visual style: Task 5.
  - Navigator type label and metadata: Task 4.
  - Existing Local API/sync path: Task 7 uses existing POST `/api/v1/cards`; Task 8 verifies refresh.
  - Web and Obsidian builds: Task 6 and Task 8.
- Safety:
  - No `eval`.
  - No `innerHTML`.
  - Validator rejects non-object roots, non-JSON-compatible values, invalid `series`, and oversized options.
  - CLI parses JSON through `JSON.parse` only.
- Type consistency:
  - `DashboardState.option` remains `unknown` at storage boundary.
  - Rendering narrows options with `validateDashboardOption`.
  - Card property name is consistently `dashboard`.
- Out of scope preserved:
  - No built-in AI API calls.
  - No API key configuration for AI tools.
  - No chart editor, export, live external connector, or JS callback support.
