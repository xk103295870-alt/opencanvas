# Canvas Card Navigator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the top-left canvas status chip open a card navigator panel that lists active-grid cards and jumps the viewport to a selected card.

**Architecture:** Add a small pure helper module for card navigator labels, filtering, and viewport centering, then wire those helpers into `src/App.tsx` with minimal local state. Style the panel in `src/App.css` using the existing floating toolbar visual language. No server, Local API, or database changes are needed.

**Tech Stack:** React 19, TypeScript, Vite, Node native test runner, CSS.

---

## File Structure

- Create: `src/cardNavigator.ts`
  - Pure helpers for display labels, filtering, and viewport calculations.
- Create: `src/cardNavigator.test.ts`
  - Node tests for helper behavior.
- Modify: `src/App.tsx`
  - Add navigator open/search/highlight state.
  - Convert `.canvas-status` from static div into accessible button.
  - Render the floating navigator panel.
  - Center viewport on card selection.
- Modify: `src/App.css`
  - Add panel, rows, empty state, and highlighted-card styles.

---

### Task 1: Add Pure Card Navigator Helpers

**Files:**
- Create: `src/cardNavigator.ts`
- Create: `src/cardNavigator.test.ts`

- [ ] **Step 1: Write the failing helper tests**

Create `src/cardNavigator.test.ts` with:

```ts
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
  assert.equal(getNavigatorCardLabel(card({ title: 'Research note' }), 'Research note')
  assert.equal(getNavigatorCardLabel(card({ title: '', fileName: 'generated.png', kind: 'image' }), 'generated.png')
  assert.equal(getNavigatorCardLabel(card({ title: '', fileName: '', kind: 'todo' }), '待办事项')
  assert.equal(getNavigatorCardLabel(card({ title: '', fileName: '', kind: 'eventFlow' }), 'Event Flow')
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
    y: -1300,
  })

  assert.deepEqual(centerViewportOnCard({ width: 1200, height: 800 }, target, 0.45), {
    zoom: 0.85,
    x: -420,
    y: -1470,
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm --prefix "/Users/xk/vs开发文件/Canvas-Workbench" test -- src/cardNavigator.test.ts
```

Expected: FAIL with module-not-found or missing export for `./cardNavigator.ts`.

- [ ] **Step 3: Implement the helper module**

Create `src/cardNavigator.ts` with:

```ts
import type { CardData, CardKind, ViewportState } from './shared/workspaceTypes'

const READABLE_CARD_ZOOM = 0.85

const CARD_KIND_LABELS: Record<CardKind, string> = {
  note: '笔记',
  hint: '提示',
  image: '图片',
  video: '视频',
  pdf: 'PDF',
  todo: '待办事项',
  calendar: '日历',
  eventFlow: 'Event Flow',
}

export function getNavigatorCardTypeLabel(kind: CardKind) {
  return CARD_KIND_LABELS[kind]
}

export function getNavigatorCardLabel(card: CardData) {
  const title = card.title.trim()
  if (title) return title
  const fileName = card.fileName?.trim()
  if (fileName) return fileName
  return getNavigatorCardTypeLabel(card.kind)
}

export function getNavigatorCardMeta(card: CardData) {
  if (card.fileName?.trim()) return card.fileName.trim()
  if (card.kind === 'todo') {
    const count = card.todoItems?.length ?? 0
    return `${count} ${count === 1 ? 'item' : 'items'}`
  }
  if (card.kind === 'calendar') {
    const count = card.calendar?.events.length ?? 0
    return `${count} ${count === 1 ? 'event' : 'events'}`
  }
  const content = card.content.trim().replace(/\s+/g, ' ')
  return content ? content.slice(0, 80) : ''
}

export function filterNavigatorCards(cards: CardData[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return cards

  return cards.filter((card) => {
    const haystack = [
      getNavigatorCardLabel(card),
      getNavigatorCardTypeLabel(card.kind),
      card.fileName ?? '',
      card.content,
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(normalizedQuery)
  })
}

export function centerViewportOnCard(
  bounds: { width: number; height: number } | null | undefined,
  card: Pick<CardData, 'x' | 'y' | 'width' | 'height'>,
  currentZoom: number,
): ViewportState {
  const width = bounds?.width && bounds.width > 0 ? bounds.width : 1440
  const height = bounds?.height && bounds.height > 0 ? bounds.height : 900
  const zoom = currentZoom < READABLE_CARD_ZOOM ? READABLE_CARD_ZOOM : currentZoom
  const targetX = card.x + card.width / 2
  const targetY = card.y + card.height / 2

  return {
    zoom,
    x: width / 2 - targetX * zoom,
    y: height / 2 - targetY * zoom,
  }
}
```

- [ ] **Step 4: Run helper tests to verify they pass**

Run:

```bash
npm --prefix "/Users/xk/vs开发文件/Canvas-Workbench" test -- src/cardNavigator.test.ts
```

Expected: PASS for all `cardNavigator` tests.

- [ ] **Step 5: Commit helper module**

Run:

```bash
git -C "/Users/xk/vs开发文件/Canvas-Workbench" add "src/cardNavigator.ts" "src/cardNavigator.test.ts"
git -C "/Users/xk/vs开发文件/Canvas-Workbench" commit -m "$(cat <<'EOF'
feat: add canvas card navigator helpers

Add pure helper logic for card labels, filtering, and viewport centering so the canvas navigator can be tested independently.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Wire the Navigator Into the Canvas UI

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Import helpers in `src/App.tsx`**

Near the existing imports, add:

```ts
import {
  centerViewportOnCard,
  filterNavigatorCards,
  getNavigatorCardLabel,
  getNavigatorCardMeta,
  getNavigatorCardTypeLabel,
} from './cardNavigator'
```

- [ ] **Step 2: Add navigator state in `src/App.tsx`**

Near the existing `useState` declarations around `activeGridId` and `viewport`, add:

```ts
const [cardNavigatorOpen, setCardNavigatorOpen] = useState(false)
const [cardNavigatorQuery, setCardNavigatorQuery] = useState('')
const [highlightedNavigatorCardId, setHighlightedNavigatorCardId] = useState<string | null>(null)
```

- [ ] **Step 3: Add filtered-card data and jump handlers**

After `activeCardCount` is declared, add:

```ts
const navigatorCards = useMemo(
  () => filterNavigatorCards(activeGrid.cards, cardNavigatorQuery),
  [activeGrid.cards, cardNavigatorQuery],
)

const closeCardNavigator = useCallback(() => {
  setCardNavigatorOpen(false)
  setCardNavigatorQuery('')
}, [])

const jumpToNavigatorCard = useCallback((card: CardData) => {
  setViewport(centerViewportOnCard(canvasRef.current?.getBoundingClientRect(), card, viewportRef.current.zoom))
  setHighlightedNavigatorCardId(card.id)
  closeCardNavigator()
  window.setTimeout(() => {
    setHighlightedNavigatorCardId((current) => (current === card.id ? null : current))
  }, 1400)
}, [closeCardNavigator])

const viewAllNavigatorCards = useCallback(() => {
  setViewport(createCenteredViewport(canvasRef.current?.getBoundingClientRect(), getCardsCenter(activeGrid)))
  closeCardNavigator()
}, [activeGrid, closeCardNavigator])
```

- [ ] **Step 4: Close the panel on Escape**

Add this effect near other UI effects:

```ts
useEffect(() => {
  if (!cardNavigatorOpen) return

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') closeCardNavigator()
  }

  window.addEventListener('keydown', onKeyDown)
  return () => window.removeEventListener('keydown', onKeyDown)
}, [cardNavigatorOpen, closeCardNavigator])
```

- [ ] **Step 5: Replace the static canvas status div with an accessible trigger and panel**

Replace the current block:

```tsx
<div className="canvas-status" title={canvasStatusLabel}>
  <strong>{activeGrid.name}</strong>
  <span>{settings.language === 'zh' ? `${activeCardCount} 张卡片` : `${activeCardCount} ${activeCardCount === 1 ? 'card' : 'cards'}`}</span>
</div>
```

with:

```tsx
<div className="canvas-status-wrap">
  <button
    type="button"
    className={`canvas-status ${cardNavigatorOpen ? 'open' : ''}`}
    title={canvasStatusLabel}
    aria-expanded={cardNavigatorOpen}
    aria-controls="canvas-card-navigator"
    onClick={(event) => {
      event.stopPropagation()
      setCardNavigatorOpen((open) => !open)
    }}
  >
    <strong>{activeGrid.name}</strong>
    <span>{settings.language === 'zh' ? `${activeCardCount} 张卡片` : `${activeCardCount} ${activeCardCount === 1 ? 'card' : 'cards'}`}</span>
  </button>

  {cardNavigatorOpen ? (
    <div
      id="canvas-card-navigator"
      className="card-navigator-popover"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="card-navigator-head">
        <div>
          <strong>{activeGrid.name}</strong>
          <span>{settings.language === 'zh' ? `${activeCardCount} 张卡片` : `${activeCardCount} ${activeCardCount === 1 ? 'card' : 'cards'}`}</span>
        </div>
      </div>

      {activeCardCount > 1 ? (
        <input
          className="card-navigator-search"
          value={cardNavigatorQuery}
          onChange={(event) => setCardNavigatorQuery(event.target.value)}
          placeholder={settings.language === 'zh' ? '搜索卡片...' : 'Search cards...'}
          autoFocus
        />
      ) : null}

      <div className="card-navigator-list">
        {activeCardCount === 0 ? (
          <p className="card-navigator-empty">{settings.language === 'zh' ? '当前画布暂无卡片' : 'No cards in this grid yet'}</p>
        ) : navigatorCards.length === 0 ? (
          <p className="card-navigator-empty">{settings.language === 'zh' ? '没有匹配的卡片' : 'No matching cards'}</p>
        ) : (
          navigatorCards.map((card) => {
            const meta = getNavigatorCardMeta(card)
            return (
              <button
                key={card.id}
                type="button"
                className="card-navigator-row"
                onClick={() => jumpToNavigatorCard(card)}
              >
                <span className={`card-navigator-kind ${card.kind}`}>{getNavigatorCardTypeLabel(card.kind).slice(0, 1)}</span>
                <span className="card-navigator-copy">
                  <strong>{getNavigatorCardLabel(card)}</strong>
                  {meta ? <small>{meta}</small> : null}
                </span>
              </button>
            )
          })
        )}
      </div>

      <button type="button" className="card-navigator-footer" onClick={viewAllNavigatorCards}>
        {settings.language === 'zh' ? '⌖ 查看全部卡片' : '⌖ View all cards'}
      </button>
    </div>
  ) : null}
</div>
```

- [ ] **Step 6: Add highlighted-card class to rendered cards**

Find the card element className inside `activeGrid.cards.map((card) => { ... })`. It currently includes `card`, card kind, selection, frameless, hover chrome, and drag-surface classes.

Add this class fragment to the template literal:

```ts
${highlightedNavigatorCardId === card.id ? 'navigator-highlight' : ''}
```

The final className should include `navigator-highlight` only for the selected destination card.

- [ ] **Step 7: Add CSS styles in `src/App.css`**

Append these styles near the existing `.canvas-status` / toolbar styles:

```css
.canvas-status-wrap {
  position: relative;
  display: inline-flex;
}

.canvas-status {
  appearance: none;
  border: 1px solid var(--line);
  cursor: pointer;
  text-align: left;
}

.canvas-status.open,
.canvas-status:hover,
.canvas-status:focus-visible {
  border-color: var(--line-strong);
  background: color-mix(in srgb, var(--card-header-bg) 88%, transparent);
}

.card-navigator-popover {
  position: absolute;
  top: calc(100% + 10px);
  left: 0;
  z-index: 60;
  width: min(320px, calc(100vw - 32px));
  border: 1px solid var(--line);
  border-radius: 18px;
  background: color-mix(in srgb, var(--card-bg-top) 94%, transparent);
  box-shadow: 0 18px 44px color-mix(in srgb, var(--card-shadow) 68%, transparent);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  padding: 12px;
  display: grid;
  gap: 10px;
}

.card-navigator-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--text-main);
}

.card-navigator-head div {
  display: grid;
  gap: 2px;
}

.card-navigator-head span {
  color: var(--text-dim);
  font-size: 12px;
}

.card-navigator-search {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: color-mix(in srgb, var(--app-bg) 86%, transparent);
  color: var(--text-main);
  padding: 9px 11px;
  font-size: 13px;
  outline: none;
}

.card-navigator-search:focus {
  border-color: var(--line-strong);
}

.card-navigator-list {
  max-height: 280px;
  overflow: auto;
  display: grid;
  gap: 6px;
}

.card-navigator-row {
  width: 100%;
  border: 1px solid transparent;
  border-radius: 13px;
  background: transparent;
  color: var(--text-main);
  padding: 8px;
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  gap: 9px;
  align-items: center;
  text-align: left;
  cursor: pointer;
}

.card-navigator-row:hover,
.card-navigator-row:focus-visible {
  border-color: var(--line);
  background: color-mix(in srgb, var(--icon-bg) 74%, transparent);
}

.card-navigator-kind {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--icon-bg);
  color: var(--text-main);
  font-size: 13px;
  font-weight: 700;
}

.card-navigator-copy {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.card-navigator-copy strong,
.card-navigator-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-navigator-copy small {
  color: var(--text-dim);
  font-size: 12px;
}

.card-navigator-empty {
  margin: 0;
  color: var(--text-dim);
  font-size: 13px;
  padding: 10px 4px;
}

.card-navigator-footer {
  border: 1px solid var(--line);
  border-radius: 12px;
  background: color-mix(in srgb, var(--card-bg-bottom) 88%, transparent);
  color: var(--text-main);
  padding: 9px 10px;
  cursor: pointer;
  font-size: 13px;
}

.card-navigator-footer:hover,
.card-navigator-footer:focus-visible {
  border-color: var(--line-strong);
  background: var(--icon-bg);
}

.card.navigator-highlight {
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--accent) 76%, transparent),
    0 0 0 10px color-mix(in srgb, var(--accent) 18%, transparent),
    0 20px 70px color-mix(in srgb, var(--accent) 20%, transparent);
}
```

- [ ] **Step 8: Run the test suite**

Run:

```bash
npm --prefix "/Users/xk/vs开发文件/Canvas-Workbench" test -- src/cardNavigator.test.ts
```

Expected: PASS.

- [ ] **Step 9: Build the web app**

Run:

```bash
npm --prefix "/Users/xk/vs开发文件/Canvas-Workbench" run build
```

Expected: PASS. Certificate trust warnings may appear in this environment; they are acceptable if the build exits 0.

- [ ] **Step 10: Commit UI wiring**

Run:

```bash
git -C "/Users/xk/vs开发文件/Canvas-Workbench" add "src/App.tsx" "src/App.css"
git -C "/Users/xk/vs开发文件/Canvas-Workbench" commit -m "$(cat <<'EOF'
feat: add canvas card navigator

Turn the canvas status chip into a navigator that lists active-grid cards and jumps the viewport to a selected card.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Build and Copy Obsidian Plugin Output

**Files:**
- Modify: `dist-obsidian/main.js`
- Modify: `dist-obsidian/styles.css`
- Modify: `/Users/xk/Documents/Obsidian Vault/.obsidian/plugins/canvas-workbench/main.js`
- Modify: `/Users/xk/Documents/Obsidian Vault/.obsidian/plugins/canvas-workbench/styles.css`
- Modify: `/Users/xk/Documents/Obsidian Vault/.obsidian/plugins/canvas-workbench/manifest.json`

- [ ] **Step 1: Build the Obsidian plugin**

Run:

```bash
npm --prefix "/Users/xk/vs开发文件/Canvas-Workbench" run build:obsidian
```

Expected: PASS. Certificate trust warnings may appear in this environment; they are acceptable if the build exits 0.

- [ ] **Step 2: Restore/copy manifest into `dist-obsidian`**

Run:

```bash
cp "/Users/xk/vs开发文件/Canvas-Workbench/manifest.json" "/Users/xk/vs开发文件/Canvas-Workbench/dist-obsidian/manifest.json"
```

Expected: no output.

- [ ] **Step 3: Copy plugin files to the user's Obsidian vault**

Run:

```bash
cp "/Users/xk/vs开发文件/Canvas-Workbench/dist-obsidian/main.js" "/Users/xk/vs开发文件/Canvas-Workbench/dist-obsidian/styles.css" "/Users/xk/vs开发文件/Canvas-Workbench/dist-obsidian/manifest.json" "/Users/xk/Documents/Obsidian Vault/.obsidian/plugins/canvas-workbench/"
```

Expected: no output.

- [ ] **Step 4: Commit Obsidian build output**

Run:

```bash
git -C "/Users/xk/vs开发文件/Canvas-Workbench" add "dist-obsidian/main.js" "dist-obsidian/styles.css" "dist-obsidian/manifest.json"
git -C "/Users/xk/vs开发文件/Canvas-Workbench" commit -m "$(cat <<'EOF'
build: update obsidian plugin for card navigator

Refresh the Obsidian plugin bundle with the canvas card navigator UI.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

- Spec coverage: Entry point, panel, search, card row labels, jump-to-card, highlight, view-all, empty state, accessibility, and no server changes are covered.
- Placeholder scan: No placeholders or deferred implementation steps remain.
- Type consistency: Helper names used in tests and UI wiring match: `getNavigatorCardLabel`, `getNavigatorCardTypeLabel`, `getNavigatorCardMeta`, `filterNavigatorCards`, `centerViewportOnCard`.
