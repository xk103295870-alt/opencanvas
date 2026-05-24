# Card Recycle Bin Design

## Goal

Add a card-level recycle bin to Canvas Workbench so deleting a card no longer immediately destroys it. Deleted cards remain recoverable for 10 days, can be inspected from a recycle-bin panel, can be restored, and can be permanently deleted on demand.

## Scope

This feature applies only to cards. Grid deletion is unchanged and will not enter the recycle bin in this implementation.

Covered card kinds:

- note
- todo
- calendar
- eventFlow
- image
- video
- pdf
- dashboard

## User Experience

### Delete flow

When a user clicks a card delete button and confirms deletion, the card is removed from the active canvas view and moved into the recycle bin. The card data remains stored with metadata:

- original card data
- original grid id
- original grid name
- deletion timestamp
- expiration timestamp, 10 days after deletion

The existing confirmation dialog remains, but the copy should communicate that the card moves to the recycle bin rather than being permanently lost immediately.

### Recycle-bin entry point

Add a visible recycle-bin entry in the app chrome, preferably near the existing navigation/settings controls so it is available without opening a specific card. The entry should show a small count when deleted cards exist.

### Recycle-bin panel

Opening the recycle bin shows a modal or drawer with a list of deleted cards. Each item shows:

- card title, falling back to file name or card kind label
- card kind
- original grid name
- deletion time
- remaining retention time, such as “剩余 9 天”
- actions: restore and permanently delete

If there are no deleted cards, show a clear empty state.

### Restore behavior

Clicking restore returns the card to a canvas:

1. If the original grid still exists, restore the card to that grid.
2. If the original grid no longer exists, restore the card to the current active grid.
3. Preserve the card contents, title, size, kind-specific data, and media references.
4. Preserve the previous position unless a duplicate id conflict exists. If a conflict exists, generate a new card id and offset the restored card slightly so it does not overlap exactly.
5. Remove the item from the recycle bin after successful restore.

### Permanent delete behavior

Clicking permanent delete asks for confirmation. After confirmation, the recycle-bin item is removed permanently. For media cards, the underlying asset should only be deleted if no active card and no other recycle-bin item still references the same file id.

### Retention behavior

Recycle-bin cards are kept for 10 days by default. On app startup/hydration and after recycle-bin changes, expired items are purged automatically. Purging uses the same permanent-delete cleanup rules as manual permanent deletion.

## Data Model

Add a persisted app-level array:

```ts
type TrashedCard = {
  id: string
  card: CardData
  gridId: string
  gridName: string
  deletedAt: number
  expiresAt: number
}
```

`id` can be the card id at deletion time. If future behavior needs multiple deleted versions of the same card id, it can become a separate trash item id, but the first implementation can keep it simple by using the original card id.

Persist this field alongside the existing workspace state so reloads and Obsidian restarts keep deleted cards recoverable.

## Architecture

Implement this as a separate recycle-bin state path instead of adding `deletedAt` to active cards. Active grids remain clean and only contain visible cards. The recycle-bin UI reads from `trashCards`, and restore moves a card back into `grids`.

The existing `removeCardById` behavior should be split into two flows:

1. Soft delete: move card to recycle bin and remove from active grid.
2. Permanent delete: delete from recycle bin and clean up unused media assets.

The existing `persistCliBridgeCardDelete` call should move to permanent delete. Soft delete should persist workspace state so Local API consumers see the card removed from active grids while the recycle-bin data is kept in the app state.

## Edge Cases

- Restoring when the original grid no longer exists restores to the active grid.
- Permanently deleting a media card does not delete the file asset if another active card uses the same `fileId`.
- Permanently deleting a media card does not delete the file asset if another recycle-bin item uses the same `fileId`.
- Deleting a card already being edited cancels its edit state.
- Deleting a minimized card removes it from minimized state.
- Recycle-bin cards do not appear in Card Navigator, canvas rendering, or normal searches.
- Expired recycle-bin items are purged without showing in the UI.

## Testing

Add source-inspection and behavior-oriented coverage for:

- soft delete moves a card into `trashCards` instead of immediately calling permanent delete
- recycle-bin state is persisted with app state
- restore returns a deleted card to the original grid when available
- restore returns a deleted card to the active grid when the original grid is missing
- permanent delete removes the recycle-bin item
- media asset cleanup only happens when no active card or remaining trash item references the file id
- recycle-bin UI exposes restore and permanent delete actions
- expired items older than 10 days are purged

## Non-goals

- Grid-level recycle bin
- Cloud multi-user conflict resolution for recycle-bin items
- Version history for multiple previous versions of the same card
- Undo stack beyond the 10-day recycle-bin retention
