# Todo Item Recycle Bin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separated deleted-todo section to the existing recycle bin so single Todo items can be restored or permanently deleted for 10 days.

**Architecture:** Extend the existing `trashCards` state model with a parallel `trashTodoItems` state path in `src/App.tsx`. Single Todo item deletion becomes a soft delete into `trashTodoItems`, while restore writes the item back into the original Todo card or a fallback Todo card in the original/current grid. The recycle-bin dialog remains one entry point but renders two sections: deleted cards and deleted todo items.

**Tech Stack:** React, TypeScript, Vite, Node `node:test` source-inspection tests, existing Canvas Workbench IndexedDB/local shadow persistence and CLI bridge patch/create helpers.

---

## Files

- Modify: `/Users/xk/vs开发文件/Canvas-Workbench/src/App.tsx`
  - Add `TrashedTodoItem` type and persisted state fields.
  - Add `trashTodoItems` state and normalization.
  - Convert `removeTodoItem` to soft delete.
  - Add restore, permanent delete, expiry purge, labels, and count helpers.
  - Split recycle-bin modal into deleted-card and deleted-todo sections.
- Modify: `/Users/xk/vs开发文件/Canvas-Workbench/src/App.css`
  - Add section/header/list styles for the separated recycle-bin UI and todo-trash rows.
- Modify: `/Users/xk/vs开发文件/Canvas-Workbench/src/dashboardInteractionSource.test.ts`
  - Add source-inspection tests for todo-item trash state, soft delete, restore/fallback behavior, UI sections, confirmation, and expiry purge.
- Modify after build: `/Users/xk/vs开发文件/Canvas-Workbench/dist-obsidian/main.js`
- Modify after build: `/Users/xk/vs开发文件/Canvas-Workbench/dist-obsidian/styles.css`

---

### Task 1: Persist deleted Todo item state

**Files:**
- Modify: `/Users/xk/vs开发文件/Canvas-Workbench/src/dashboardInteractionSource.test.ts`
- Modify: `/Users/xk/vs开发文件/Canvas-Workbench/src/App.tsx`

- [ ] **Step 1: Write the failing source-inspection test**

Add this test after the existing `card recycle bin has persisted trash card state with a 10 day retention window` test:

```ts
test('todo item recycle bin has persisted trash item state with a 10 day retention window', () => {
  assert.match(appSource, /type TrashedTodoItem = \{\s*id: string\s*item: TodoItem\s*cardId: string\s*cardTitle: string\s*gridId: string\s*gridName: string\s*deletedAt: number\s*expiresAt: number\s*\}/s)
  assert.match(appSource, /type PersistedAppStateWithTrash = PersistedAppState & \{\s*trashCards\?: TrashedCard\[\]\s*trashTodoItems\?: TrashedTodoItem\[\]\s*\}/s)
  assert.match(appSource, /type PersistedAppStateSnapshot = \{[\s\S]*trashCards: TrashedCard\[\][\s\S]*trashTodoItems: TrashedTodoItem\[\][\s\S]*\}/)
  assert.match(appSource, /const \[trashTodoItems, setTrashTodoItems\] = useState<TrashedTodoItem\[\]>\(\[\]\)/)
  assert.match(appSource, /const normalizedTrashTodoItems = Array\.isArray\(raw\.trashTodoItems\) \? normalizeTrashTodoItems\(raw\.trashTodoItems\) : \[\]/)
  assert.match(appSource, /trashTodoItems: normalizedTrashTodoItems/)
  assert.match(appSource, /persistLocalStateSnapshot\(\{[\s\S]*trashCards,[\s\S]*trashTodoItems,[\s\S]*\}\)/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm --prefix "/Users/xk/vs开发文件/Canvas-Workbench" test -- src/dashboardInteractionSource.test.ts
```

Expected: FAIL in `todo item recycle bin has persisted trash item state with a 10 day retention window` because `TrashedTodoItem`, `trashTodoItems`, and `normalizeTrashTodoItems` do not exist.

- [ ] **Step 3: Add the Todo trash type and persistence plumbing**

In `src/App.tsx`, directly after `type TrashedCard = ...`, add:

```ts
type TrashedTodoItem = {
  id: string
  item: TodoItem
  cardId: string
  cardTitle: string
  gridId: string
  gridName: string
  deletedAt: number
  expiresAt: number
}
```

Change `PersistedAppStateWithTrash` to:

```ts
type PersistedAppStateWithTrash = PersistedAppState & {
  trashCards?: TrashedCard[]
  trashTodoItems?: TrashedTodoItem[]
}
```

Change `PersistedAppStateSnapshot` to include `trashTodoItems`:

```ts
type PersistedAppStateSnapshot = {
  version: number
  grids: GridData[]
  activeGridId: string
  viewport: ViewportState
  trashCards: TrashedCard[]
  trashTodoItems: TrashedTodoItem[]
  savedAt: number
}
```

Directly after `normalizeTrashCards`, add:

```ts
const normalizeTrashTodoItems = (input: unknown[]): TrashedTodoItem[] =>
  input
    .filter((item): item is TrashedTodoItem => {
      if (!item || typeof item !== 'object') return false
      const raw = item as Partial<TrashedTodoItem>
      return (
        typeof raw.id === 'string' &&
        raw.item !== undefined &&
        typeof raw.cardId === 'string' &&
        typeof raw.cardTitle === 'string' &&
        typeof raw.gridId === 'string' &&
        typeof raw.gridName === 'string' &&
        Number.isFinite(Number(raw.deletedAt)) &&
        Number.isFinite(Number(raw.expiresAt))
      )
    })
    .map((item) => ({
      ...item,
      deletedAt: Number(item.deletedAt),
      expiresAt: Number(item.expiresAt),
    }))
```

Inside `normalizePersistedStateSnapshot`, after `normalizedTrashCards`, add:

```ts
  const normalizedTrashTodoItems = Array.isArray(raw.trashTodoItems) ? normalizeTrashTodoItems(raw.trashTodoItems) : []
```

In the returned snapshot object, add:

```ts
    trashTodoItems: normalizedTrashTodoItems,
```

In the React component state block near `trashCards`, add:

```ts
  const [trashTodoItems, setTrashTodoItems] = useState<TrashedTodoItem[]>([])
```

In hydration, after computing `persistedTrashCards`, add:

```ts
          const persistedTrashTodoItems =
            'trashTodoItems' in persistedState && Array.isArray(persistedState.trashTodoItems)
              ? normalizeTrashTodoItems(persistedState.trashTodoItems)
              : []
```

After `setTrashCards(persistedTrashCards)`, add:

```ts
          setTrashTodoItems(persistedTrashTodoItems)
```

In the state object passed to `putPersistedState`, add:

```ts
        trashTodoItems,
```

Update that persistence effect dependency list to include `trashTodoItems`:

```ts
  }, [activeGridId, grids, hydrated, trashCards, trashTodoItems, viewport])
```

In `persistLocalStateSnapshot`, add a default:

```ts
      trashTodoItems: state.trashTodoItems ?? [],
```

In the `persistLocalStateSnapshot({...})` call inside `useLayoutEffect`, add:

```ts
      trashTodoItems,
```

Update that layout-effect dependency list to include `trashTodoItems`:

```ts
  }, [activeGridId, grids, hydrated, persistLocalStateSnapshot, trashCards, trashTodoItems, viewport])
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm --prefix "/Users/xk/vs开发文件/Canvas-Workbench" test -- src/dashboardInteractionSource.test.ts
```

Expected: PASS for the new persistence test and existing recycle-bin tests.

---

### Task 2: Soft-delete single Todo items

**Files:**
- Modify: `/Users/xk/vs开发文件/Canvas-Workbench/src/dashboardInteractionSource.test.ts`
- Modify: `/Users/xk/vs开发文件/Canvas-Workbench/src/App.tsx`

- [ ] **Step 1: Write the failing source-inspection test**

Add this test after the persistence test from Task 1:

```ts
test('todo item deletion moves a single item into the todo recycle bin', () => {
  assert.match(appSource, /const moveTodoItemToTrash = \(cardId: string, todoId: string\) => \{[\s\S]*const targetCard = activeGrid\.cards\.find\(\(card\) => card\.id === cardId\)[\s\S]*const targetItem = \(targetCard\.todoItems \?\? \[\]\)\.find\(\(item\) => item\.id === todoId\)[\s\S]*const now = Date\.now\(\)[\s\S]*const trashedTodoItem: TrashedTodoItem = \{[\s\S]*item: targetItem,[\s\S]*cardId: targetCard\.id,[\s\S]*cardTitle: targetCard\.title,[\s\S]*gridId: activeGrid\.id,[\s\S]*gridName: activeGrid\.name,[\s\S]*expiresAt: now \+ TRASH_CARD_RETENTION_MS[\s\S]*\}/)
  assert.match(appSource, /setTrashTodoItems\(\(current\) => \[trashedTodoItem, \.\.\.current\.filter\(\(item\) => item\.id !== todoId\)\]\)/)
  assert.match(appSource, /const nextTodoItems = \(targetCard\.todoItems \?\? \[\]\)\.filter\(\(item\) => item\.id !== todoId\)/)
  assert.match(appSource, /const removeTodoItem = \(cardId: string, todoId: string\) => \{[\s\S]*moveTodoItemToTrash\(cardId, todoId\)[\s\S]*\}/)
  assert.doesNotMatch(appSource, /const removeTodoItem = \(cardId: string, todoId: string\) => \{[\s\S]*const nextTodoItems = \(targetCard\.todoItems \?\? \[\]\)\.filter\(\(item\) => item\.id !== todoId\)[\s\S]*persistCliBridgeCardPatch\(cardId, \{ todoItems: nextTodoItems \}\)[\s\S]*\}/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm --prefix "/Users/xk/vs开发文件/Canvas-Workbench" test -- src/dashboardInteractionSource.test.ts
```

Expected: FAIL because `moveTodoItemToTrash` does not exist and `removeTodoItem` still directly filters and persists items.

- [ ] **Step 3: Implement `moveTodoItemToTrash` and delegate `removeTodoItem`**

Replace the existing `removeTodoItem` function in `src/App.tsx` with these two functions:

```ts
  const moveTodoItemToTrash = (cardId: string, todoId: string) => {
    if (todoDragStateRef.current?.cardId === cardId && todoDragStateRef.current?.itemId === todoId) {
      todoDragStateRef.current = null
    }
    setTodoDropTarget((current) =>
      current && current.cardId === cardId && current.itemId === todoId ? null : current,
    )

    const targetCard = activeGrid.cards.find((card) => card.id === cardId)
    if (!targetCard || targetCard.kind !== 'todo') return

    const targetItem = (targetCard.todoItems ?? []).find((item) => item.id === todoId)
    if (!targetItem) return

    const now = Date.now()
    const trashedTodoItem: TrashedTodoItem = {
      id: todoId,
      item: targetItem,
      cardId: targetCard.id,
      cardTitle: targetCard.title,
      gridId: activeGrid.id,
      gridName: activeGrid.name,
      deletedAt: now,
      expiresAt: now + TRASH_CARD_RETENTION_MS,
    }

    const nextTodoItems = (targetCard.todoItems ?? []).filter((item) => item.id !== todoId)
    updateCliBridgeLayoutSyncMeta({ lastLayoutMutationAt: Date.now() })
    setTrashTodoItems((current) => [trashedTodoItem, ...current.filter((item) => item.id !== todoId)])
    setGrids((current) =>
      current.map((grid) =>
        grid.id !== activeGridId
          ? grid
          : {
              ...grid,
              cards: grid.cards.map((card) => (card.id === cardId ? { ...card, todoItems: nextTodoItems } : card)),
            },
      ),
    )
    void persistCliBridgeCardPatch(cardId, { todoItems: nextTodoItems })
  }

  const removeTodoItem = (cardId: string, todoId: string) => {
    moveTodoItemToTrash(cardId, todoId)
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm --prefix "/Users/xk/vs开发文件/Canvas-Workbench" test -- src/dashboardInteractionSource.test.ts
```

Expected: PASS for the soft-delete test and existing Todo tests.

---

### Task 3: Restore, purge, and permanently delete Todo trash items

**Files:**
- Modify: `/Users/xk/vs开发文件/Canvas-Workbench/src/dashboardInteractionSource.test.ts`
- Modify: `/Users/xk/vs开发文件/Canvas-Workbench/src/App.tsx`

- [ ] **Step 1: Write the failing source-inspection test**

Add this test after the Task 2 soft-delete test:

```ts
test('todo item recycle bin can restore purge and permanently delete todo items', () => {
  assert.match(appSource, /const permanentlyDeleteTrashedTodoItem = \(trashId: string\) => \{\s*setTrashTodoItems\(\(current\) => current\.filter\(\(item\) => item\.id !== trashId\)\)\s*\}/s)
  assert.match(appSource, /const requestPermanentlyDeleteTrashedTodoItem = \(item: TrashedTodoItem\) => \{[\s\S]*window\.confirm\([\s\S]*永久删除这条代办[\s\S]*permanentlyDeleteTrashedTodoItem\(item\.id\)[\s\S]*\}/)
  assert.match(appSource, /const restoreTrashedTodoItem = \(trashId: string\) => \{[\s\S]*const target = trashTodoItems\.find\(\(item\) => item\.id === trashId\)[\s\S]*const destination = resolveTodoRestoreDestination\(target\)[\s\S]*const restoredTodoItem: TodoItem = hasItemConflict\s*\? \{ \.\.\.target\.item, id: uid\('todo'\) \}\s*: target\.item[\s\S]*persistCliBridgeCardPatch\(destination\.cardId, \{ todoItems: nextTodoItems \}\)[\s\S]*setTrashTodoItems\(\(current\) => current\.filter\(\(item\) => item\.id !== trashId\)\)/)
  assert.match(appSource, /const resolveTodoRestoreDestination = \(target: TrashedTodoItem\) => \{[\s\S]*const originalCard = gridsRef\.current[\s\S]*card\.id === target\.cardId && card\.kind === 'todo'[\s\S]*return \{ gridId: originalGrid\.id, cardId: originalCard\.id, todoItems: originalCard\.todoItems \?\? \[\] \}[\s\S]*const fallbackGrid = gridsRef\.current\.find\(\(grid\) => grid\.id === target\.gridId\) \?\? activeGrid[\s\S]*const fallbackTodoCard = fallbackGrid\.cards\.find\(\(card\) => card\.kind === 'todo'\)[\s\S]*const fallbackCard: CardData = \{[\s\S]*kind: 'todo'[\s\S]*todoItems: \[\][\s\S]*\}/)
  assert.match(appSource, /const purgeExpiredTrashTodoItems = \(\) => \{[\s\S]*const now = Date\.now\(\)[\s\S]*trashTodoItems\.filter\(\(item\) => item\.expiresAt <= now\)\.forEach\(\(item\) => permanentlyDeleteTrashedTodoItem\(item\.id\)\)[\s\S]*\}/)
  assert.match(appSource, /useEffect\(\(\) => \{\s*if \(!trashTodoItems\.length\) return\s*purgeExpiredTrashTodoItems\(\)\s*\}, \[trashTodoItems\]\)/s)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm --prefix "/Users/xk/vs开发文件/Canvas-Workbench" test -- src/dashboardInteractionSource.test.ts
```

Expected: FAIL because restore, purge, confirmation, and permanent-delete functions do not exist.

- [ ] **Step 3: Implement Todo trash helpers**

Add these helpers in `src/App.tsx` after `requestPermanentlyDeleteTrashedCard` and before `restoreTrashedCard`:

```ts
  const permanentlyDeleteTrashedTodoItem = (trashId: string) => {
    setTrashTodoItems((current) => current.filter((item) => item.id !== trashId))
  }

  const requestPermanentlyDeleteTrashedTodoItem = (item: TrashedTodoItem) => {
    const confirmed = window.confirm(
      settings.language === 'zh'
        ? `永久删除这条代办「${item.item.text}」？此操作无法恢复。`
        : `Permanently delete this todo item "${item.item.text}"? This cannot be undone.`,
    )
    if (!confirmed) return
    permanentlyDeleteTrashedTodoItem(item.id)
  }

  const resolveTodoRestoreDestination = (target: TrashedTodoItem) => {
    for (const grid of gridsRef.current) {
      const originalCard = grid.cards.find((card) => card.id === target.cardId && card.kind === 'todo')
      if (originalCard && originalCard.kind === 'todo') {
        return { gridId: grid.id, cardId: originalCard.id, todoItems: originalCard.todoItems ?? [] }
      }
    }

    const fallbackGrid = gridsRef.current.find((grid) => grid.id === target.gridId) ?? activeGrid
    const fallbackTodoCard = fallbackGrid.cards.find((card) => card.kind === 'todo')
    if (fallbackTodoCard && fallbackTodoCard.kind === 'todo') {
      return { gridId: fallbackGrid.id, cardId: fallbackTodoCard.id, todoItems: fallbackTodoCard.todoItems ?? [] }
    }

    const fallbackCard: CardData = {
      id: uid('card'),
      kind: 'todo',
      title: settings.language === 'zh' ? '恢复的代办' : 'Restored Todos',
      content: '',
      x: 120,
      y: 120,
      width: CARD_DEFAULT_SIZES.todo.width,
      height: CARD_DEFAULT_SIZES.todo.height,
      todoItems: [],
    }

    updateCliBridgeLayoutSyncMeta({ lastLayoutMutationAt: Date.now() })
    setGrids((current) =>
      current.map((grid) =>
        grid.id === fallbackGrid.id ? { ...grid, cards: [...grid.cards, fallbackCard] } : grid,
      ),
    )
    void persistCliBridgeCardCreate(fallbackGrid.id, fallbackCard, false)

    return { gridId: fallbackGrid.id, cardId: fallbackCard.id, todoItems: [] }
  }

  const restoreTrashedTodoItem = (trashId: string) => {
    const target = trashTodoItems.find((item) => item.id === trashId)
    if (!target) return

    const destination = resolveTodoRestoreDestination(target)
    const hasItemConflict = destination.todoItems.some((item) => item.id === target.item.id)
    const restoredTodoItem: TodoItem = hasItemConflict ? { ...target.item, id: uid('todo') } : target.item
    const nextTodoItems = [...destination.todoItems, restoredTodoItem]

    updateCliBridgeLayoutSyncMeta({ lastLayoutMutationAt: Date.now() })
    setGrids((current) =>
      current.map((grid) =>
        grid.id !== destination.gridId
          ? grid
          : {
              ...grid,
              cards: grid.cards.map((card) =>
                card.id === destination.cardId ? { ...card, todoItems: nextTodoItems } : card,
              ),
            },
      ),
    )
    setTrashTodoItems((current) => current.filter((item) => item.id !== trashId))
    void persistCliBridgeCardPatch(destination.cardId, { todoItems: nextTodoItems })
  }
```

Add this purge helper after `purgeExpiredTrashCards`:

```ts
  const purgeExpiredTrashTodoItems = () => {
    const now = Date.now()
    trashTodoItems.filter((item) => item.expiresAt <= now).forEach((item) => permanentlyDeleteTrashedTodoItem(item.id))
  }

  useEffect(() => {
    if (!trashTodoItems.length) return
    purgeExpiredTrashTodoItems()
  }, [trashTodoItems])
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm --prefix "/Users/xk/vs开发文件/Canvas-Workbench" test -- src/dashboardInteractionSource.test.ts
```

Expected: PASS for the Todo restore/purge/permanent-delete test.

---

### Task 4: Split the recycle-bin UI into deleted-card and deleted-todo sections

**Files:**
- Modify: `/Users/xk/vs开发文件/Canvas-Workbench/src/dashboardInteractionSource.test.ts`
- Modify: `/Users/xk/vs开发文件/Canvas-Workbench/src/App.tsx`
- Modify: `/Users/xk/vs开发文件/Canvas-Workbench/src/App.css`

- [ ] **Step 1: Write the failing source-inspection test**

Add this test after the existing `card recycle bin renders a sidebar entry and modal restore controls` test:

```ts
test('recycle bin separates deleted cards and deleted todo items in one panel', () => {
  assert.match(appSource, /const trashTodoItemCount = trashTodoItems\.length/)
  assert.match(appSource, /const trashTotalCount = trashCardCount \+ trashTodoItemCount/)
  assert.match(appSource, /\{trashTotalCount \? <span className="trash-count-badge">\{trashTotalCount\}<\/span> : null\}/)
  assert.match(appSource, /className="trash-section"[\s\S]*已删除卡片[\s\S]*trashCards\.length === 0 \? \([\s\S]*暂无已删除卡片/)
  assert.match(appSource, /className="trash-section"[\s\S]*已删除代办[\s\S]*trashTodoItems\.length === 0 \? \([\s\S]*暂无已删除代办/)
  assert.match(appSource, /trashTodoItems\.map\(\(item\) => \([\s\S]*className="trash-todo-item"[\s\S]*item\.item\.text[\s\S]*item\.cardTitle[\s\S]*item\.gridName[\s\S]*getTrashTodoRemainingLabel\(item\)[\s\S]*restoreTrashedTodoItem\(item\.id\)[\s\S]*requestPermanentlyDeleteTrashedTodoItem\(item\)/)
  assert.match(appCss, /\.trash-section\s*\{/)
  assert.match(appCss, /\.trash-section-title\s*\{/)
  assert.match(appCss, /\.trash-todo-item\s*\{/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm --prefix "/Users/xk/vs开发文件/Canvas-Workbench" test -- src/dashboardInteractionSource.test.ts
```

Expected: FAIL because `trashTodoItemCount`, `trashTotalCount`, `trash-section`, and todo item UI are missing.

- [ ] **Step 3: Add Todo trash labels and count helpers**

In `src/App.tsx`, replace:

```ts
  const trashCardCount = trashCards.length
```

with:

```ts
  const trashCardCount = trashCards.length
  const trashTodoItemCount = trashTodoItems.length
  const trashTotalCount = trashCardCount + trashTodoItemCount
```

After `getTrashRemainingLabel`, add:

```ts
  const getTrashTodoRemainingLabel = (item: TrashedTodoItem) => {
    const remainingMs = Math.max(0, item.expiresAt - Date.now())
    const remainingDays = Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)))
    return settings.language === 'zh' ? `剩余 ${remainingDays} 天` : `${remainingDays} day${remainingDays === 1 ? '' : 's'} left`
  }

  const formatTrashTodoDeletedAt = (item: TrashedTodoItem) =>
    new Date(item.deletedAt).toLocaleString(settings.language === 'zh' ? 'zh-CN' : 'en-US')
```

In the sidebar recycle-bin button, replace:

```tsx
          {trashCardCount ? <span className="trash-count-badge">{trashCardCount}</span> : null}
```

with:

```tsx
          {trashTotalCount ? <span className="trash-count-badge">{trashTotalCount}</span> : null}
```

- [ ] **Step 4: Replace the recycle-bin modal body with two sections**

Inside the `trashOpen ? (...)` dialog, replace the current conditional body from:

```tsx
            {trashCards.length === 0 ? (
              <div className="trash-empty">
                {settings.language === 'zh' ? '暂无已删除卡片。' : 'No deleted cards.'}
              </div>
            ) : (
              <div className="trash-list">
                {trashCards.map((item) => (
                  <article key={item.id} className="trash-item" aria-label={getTrashCardLabel(item)}>
                    <div className="trash-item-main">
                      <span className={`trash-kind ${item.card.kind}`}>{getNavigatorCardTypeLabel(item.card.kind).slice(0, 1)}</span>
                      <div className="trash-item-copy">
                        <strong>{getTrashCardLabel(item)}</strong>
                        <small>{item.gridName} · {formatTrashDeletedAt(item)} · {getTrashRemainingLabel(item)}</small>
                      </div>
                    </div>
                    <div className="trash-item-actions">
                      <button type="button" className="trash-restore-btn" onClick={() => restoreTrashedCard(item.id)}>
                        {settings.language === 'zh' ? '恢复' : 'Restore'}
                      </button>
                      <button type="button" className="trash-delete-btn" onClick={() => requestPermanentlyDeleteTrashedCard(item)}>
                        {settings.language === 'zh' ? '永久删除' : 'Delete forever'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
```

with:

```tsx
            <div className="trash-sections">
              <section className="trash-section" aria-label={settings.language === 'zh' ? '已删除卡片' : 'Deleted cards'}>
                <header className="trash-section-title">
                  <span>{settings.language === 'zh' ? '已删除卡片' : 'Deleted cards'}</span>
                  <small>{trashCardCount}</small>
                </header>
                {trashCards.length === 0 ? (
                  <div className="trash-empty">
                    {settings.language === 'zh' ? '暂无已删除卡片。' : 'No deleted cards.'}
                  </div>
                ) : (
                  <div className="trash-list">
                    {trashCards.map((item) => (
                      <article key={item.id} className="trash-item" aria-label={getTrashCardLabel(item)}>
                        <div className="trash-item-main">
                          <span className={`trash-kind ${item.card.kind}`}>{getNavigatorCardTypeLabel(item.card.kind).slice(0, 1)}</span>
                          <div className="trash-item-copy">
                            <strong>{getTrashCardLabel(item)}</strong>
                            <small>{item.gridName} · {formatTrashDeletedAt(item)} · {getTrashRemainingLabel(item)}</small>
                          </div>
                        </div>
                        <div className="trash-item-actions">
                          <button type="button" className="trash-restore-btn" onClick={() => restoreTrashedCard(item.id)}>
                            {settings.language === 'zh' ? '恢复' : 'Restore'}
                          </button>
                          <button type="button" className="trash-delete-btn" onClick={() => requestPermanentlyDeleteTrashedCard(item)}>
                            {settings.language === 'zh' ? '永久删除' : 'Delete forever'}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="trash-section" aria-label={settings.language === 'zh' ? '已删除代办' : 'Deleted todos'}>
                <header className="trash-section-title">
                  <span>{settings.language === 'zh' ? '已删除代办' : 'Deleted todos'}</span>
                  <small>{trashTodoItemCount}</small>
                </header>
                {trashTodoItems.length === 0 ? (
                  <div className="trash-empty">
                    {settings.language === 'zh' ? '暂无已删除代办。' : 'No deleted todo items.'}
                  </div>
                ) : (
                  <div className="trash-list">
                    {trashTodoItems.map((item) => (
                      <article key={item.id} className="trash-todo-item" aria-label={item.item.text}>
                        <div className="trash-item-main">
                          <span className={`trash-kind ${normalizeTodoTag(item.item.tag)}`}>✓</span>
                          <div className="trash-item-copy">
                            <strong>{item.item.text}</strong>
                            <small>{item.cardTitle} · {item.gridName} · {formatTrashTodoDeletedAt(item)} · {getTrashTodoRemainingLabel(item)}</small>
                          </div>
                        </div>
                        <div className="trash-item-actions">
                          <button type="button" className="trash-restore-btn" onClick={() => restoreTrashedTodoItem(item.id)}>
                            {settings.language === 'zh' ? '恢复' : 'Restore'}
                          </button>
                          <button type="button" className="trash-delete-btn" onClick={() => requestPermanentlyDeleteTrashedTodoItem(item)}>
                            {settings.language === 'zh' ? '永久删除' : 'Delete forever'}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
```

- [ ] **Step 5: Add CSS for the split sections**

In `src/App.css`, near the existing `.trash-list` styles, add:

```css
.trash-sections {
  display: grid;
  gap: 16px;
  overflow: auto;
  padding-right: 2px;
}

.trash-section {
  display: grid;
  gap: 10px;
}

.trash-section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--text-main);
  font-weight: 800;
}

.trash-section-title small {
  min-width: 22px;
  height: 22px;
  display: inline-grid;
  place-items: center;
  border-radius: 999px;
  background: var(--icon-bg);
  color: var(--text-dim);
  font-size: 12px;
}

.trash-todo-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  border: 1px solid color-mix(in srgb, var(--line) 78%, transparent);
  border-radius: 16px;
  padding: 10px;
  background: color-mix(in srgb, var(--panel) 76%, transparent);
}
```

Extend the mobile rule near the existing `.trash-item` mobile rule to include `.trash-todo-item`:

```css
  .trash-item,
  .trash-todo-item {
    grid-template-columns: 1fr;
  }
```

- [ ] **Step 6: Run test to verify it passes**

Run:

```bash
npm --prefix "/Users/xk/vs开发文件/Canvas-Workbench" test -- src/dashboardInteractionSource.test.ts
```

Expected: PASS for the split UI test and previous recycle-bin tests.

---

### Task 5: Full verification, Obsidian build, deploy, and commit

**Files:**
- Modify after build: `/Users/xk/vs开发文件/Canvas-Workbench/dist-obsidian/main.js`
- Modify after build: `/Users/xk/vs开发文件/Canvas-Workbench/dist-obsidian/styles.css`
- Deploy to: `/Users/xk/Documents/Obsidian Vault/.obsidian/plugins/canvas-workbench/`

- [ ] **Step 1: Run full test suite**

Run:

```bash
npm --prefix "/Users/xk/vs开发文件/Canvas-Workbench" test
```

Expected: PASS, with all Node tests passing.

- [ ] **Step 2: Build Obsidian bundle**

Run:

```bash
npm --prefix "/Users/xk/vs开发文件/Canvas-Workbench" run build:obsidian
```

Expected: PASS. The known macOS `failed to copy trust settings of system certificate-25291` warnings may appear, but Vite should still print generated `dist-obsidian/main.js` and `dist-obsidian/styles.css` sizes and finish successfully.

- [ ] **Step 3: Deploy to the active Obsidian plugin folder**

Run:

```bash
ls "/Users/xk/Documents/Obsidian Vault/.obsidian/plugins/canvas-workbench" && cp "/Users/xk/vs开发文件/Canvas-Workbench/manifest.json" "/Users/xk/vs开发文件/Canvas-Workbench/dist-obsidian/manifest.json" && cp -R "/Users/xk/vs开发文件/Canvas-Workbench/dist-obsidian/." "/Users/xk/Documents/Obsidian Vault/.obsidian/plugins/canvas-workbench/" && cp "/Users/xk/vs开发文件/Canvas-Workbench/manifest.json" "/Users/xk/Documents/Obsidian Vault/.obsidian/plugins/canvas-workbench/manifest.json"
```

Expected: command succeeds and the Obsidian plugin directory contains updated `main.js`, `styles.css`, and `manifest.json`.

- [ ] **Step 4: Review git status and diff summary**

Run:

```bash
git -C "/Users/xk/vs开发文件/Canvas-Workbench" status --short && git -C "/Users/xk/vs开发文件/Canvas-Workbench" diff --stat -- src/App.tsx src/App.css src/dashboardInteractionSource.test.ts dist-obsidian/main.js dist-obsidian/styles.css
```

Expected: only intended source/test/build files are modified.

- [ ] **Step 5: Commit implementation**

Run:

```bash
git -C "/Users/xk/vs开发文件/Canvas-Workbench" add "src/App.tsx" "src/App.css" "src/dashboardInteractionSource.test.ts" "dist-obsidian/main.js" "dist-obsidian/styles.css" && git -C "/Users/xk/vs开发文件/Canvas-Workbench" commit -m "$(cat <<'EOF'
feat: add todo item recycle bin

Single Todo item deletions now enter a separated recycle-bin section so users can restore tasks independently from deleted cards.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: a new commit is created. Do not push unless the user explicitly asks.

- [ ] **Step 6: Verify final status**

Run:

```bash
git -C "/Users/xk/vs开发文件/Canvas-Workbench" status --short
```

Expected: no output, meaning the working tree is clean.

---

## Self-review

- Spec coverage: The plan covers persisted `trashTodoItems`, soft delete, restore to original/fallback Todo card, ID conflict handling, separated UI sections, combined count badge, confirmation before permanent delete, and 10-day purge.
- Placeholder scan: No placeholders, TBDs, or unspecified implementation steps remain.
- Type consistency: `TrashedTodoItem`, `trashTodoItems`, `restoreTrashedTodoItem`, `requestPermanentlyDeleteTrashedTodoItem`, and `permanentlyDeleteTrashedTodoItem` names are consistent across tests, implementation steps, and UI.
