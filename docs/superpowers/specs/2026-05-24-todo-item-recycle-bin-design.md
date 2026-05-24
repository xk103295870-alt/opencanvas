# Todo Item Recycle Bin Design

## Goal

Extend the existing Canvas Workbench card recycle bin so deleted Todo card items are recoverable in a separate section inside the same recycle-bin panel.

## Scope

This feature applies to individual `TodoItem` entries inside Todo cards. It does not change grid deletion. It does not split Todo items out when an entire Todo card is deleted; deleting a Todo card still moves the whole card, including its items, into the deleted-card section.

## User Experience

### Recycle-bin layout

The existing sidebar recycle-bin entry remains the single entry point. Opening it shows one dialog with two visually separated sections:

1. Deleted cards
2. Deleted todo items

Each section has its own list and empty state. The sidebar count badge shows the combined total of deleted cards and deleted todo items.

### Deleted cards section

The deleted-card section keeps the current card recycle-bin behavior. Each item shows card label, card kind, original grid name, deletion time, remaining retention time, and restore / permanent-delete actions.

### Deleted todo items section

Each deleted todo item shows:

- todo item text
- todo item status/lane and tag when available
- original Todo card title
- original grid name
- deletion time
- remaining retention time, such as `剩余 9 天`
- actions: restore and permanently delete

If no todo items are deleted, this section shows a clear empty state such as `暂无已删除代办。`.

### Delete flow

When the user deletes a single Todo item inside a Todo card, the item is removed from the active Todo card and added to the deleted-todo section. The deleted item stores enough metadata to restore it later:

- original todo item data
- original Todo card id
- original Todo card title
- original grid id
- original grid name
- deletion timestamp
- expiration timestamp, 10 days after deletion

Deleting an entire Todo card does not create individual deleted-todo records. The whole Todo card stays in the deleted-card section.

### Restore behavior

Restoring a deleted todo item follows this order:

1. If the original Todo card still exists in active grids, append the item back to that card.
2. If the original Todo card no longer exists but the original grid exists, append the item to the first Todo card in that grid.
3. If the original grid exists but has no Todo card, create a new Todo card in the original grid and add the item.
4. If the original grid no longer exists, append the item to the first Todo card in the current active grid.
5. If the current active grid has no Todo card, create a new Todo card in the current active grid and add the item.
6. If the restored item's id conflicts with an existing item in the destination Todo card, generate a new item id.
7. After successful restore, remove the item from the deleted-todo section.

If the original Todo card is itself in the deleted-card section, restoring a single todo item does not force-restores the whole card. The item is restored into an available active Todo card using the fallback rules above, so the user can recover an individual task directly.

### Permanent delete behavior

Permanent deletion is confirmed before it happens:

- deleted card: `永久删除这张卡片？此操作无法恢复。`
- deleted todo item: `永久删除这条代办？此操作无法恢复。`

Permanently deleting a deleted todo item only removes that deleted-todo record. It does not affect other cards, media assets, or active Todo items.

### Retention behavior

Deleted cards and deleted todo items both use the same 10-day retention window. Expired deleted todo items are purged automatically on startup/hydration and after recycle-bin state changes.

## Data Model

Add a persisted app-level array beside the existing `trashCards` array:

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

`id` can use the deleted Todo item's original id for the first implementation. If a future version needs multiple deleted versions of the same item, it can become a separate trash-item id.

Persisted state becomes:

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

## Architecture

Use a separate `trashTodoItems` state path instead of marking active Todo items with `deletedAt`. Active Todo cards remain clean and only contain visible items.

The existing Todo item delete function should split into two flows:

1. Soft delete: move the item into `trashTodoItems` and remove it from the active Todo card.
2. Permanent delete: remove the item from `trashTodoItems` after confirmation or after retention expiry.

Restore writes the item back into a destination Todo card and persists the card patch through the existing CLI bridge card patch path.

Creating a fallback Todo card should reuse existing card defaults and create/persist the card through the same paths used for normal Todo card creation.

## Edge Cases

- Restoring when the original Todo card still exists appends to that card.
- Restoring when the original Todo card is deleted or missing uses the fallback Todo card rules.
- Restoring when the original grid is missing uses the current active grid.
- Restoring into a Todo card that already has an item with the same id generates a new item id.
- Deleting an entire Todo card does not duplicate its internal items into `trashTodoItems`.
- Deleted todo items do not appear in active Todo cards, card navigator search, or normal Todo counts.
- Expired deleted todo items are purged without showing in the UI.
- Existing deleted-card behavior and media cleanup rules remain unchanged.

## Testing

Add source-inspection and behavior-oriented coverage for:

- persisted state includes `trashTodoItems`
- deleting a single Todo item moves it into `trashTodoItems`
- deleting a whole Todo card does not create individual `trashTodoItems`
- restoring a deleted Todo item to the original Todo card when available
- restoring a deleted Todo item to a fallback Todo card when the original card is missing
- generating a new Todo item id when restore would conflict
- recycle-bin UI renders separate deleted-card and deleted-todo sections
- recycle-bin count badge includes both deleted cards and deleted todo items
- permanent deletion of a Todo item requires confirmation
- expired deleted Todo items are purged

## Non-goals

- Grid-level recycle bin
- Version history for edited Todo item text
- Undo stack beyond the 10-day recycle-bin retention
- Separate recycle-bin entry point for Todo items
