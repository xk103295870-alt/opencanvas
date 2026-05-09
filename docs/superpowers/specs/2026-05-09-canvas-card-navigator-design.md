# Canvas Card Navigator Design

## Goal

Turn the top-left canvas status chip into a compact navigation entry. Users can click the current grid/card-count chip, see the cards in the active grid, and jump the viewport to a selected card.

## User Problem

Large canvas workspaces can contain cards far apart from each other. The current status chip shows the active grid name and card count, but it does not help users find or return to a specific card. Users need a lightweight map/list without opening the full sidebar.

## Product Behavior

### Entry Point

- The existing top-left canvas status chip remains visually compact.
- The chip becomes clickable and keyboard accessible.
- It keeps showing:
  - active grid name
  - active grid card count
- Clicking the chip toggles a floating navigator panel below it.

### Navigator Panel

The panel shows:

1. Header with active grid name and card count.
2. Search input when the active grid has multiple cards.
3. Card list for the active grid.
4. Footer shortcut: “View all cards”.

Each card row shows:

- Card kind icon or text marker.
- Card title, falling back to file name or localized card kind name.
- Optional small metadata, such as image/file type when available.

### Jump-to-Card

When the user selects a card row:

1. Close the navigator panel.
2. Move the viewport so the target card is centered in the visible canvas area.
3. Preserve the current zoom unless it is extremely zoomed out; if zoom is too low, raise it to a readable default.
4. Apply a short highlight state to the target card so the user can visually confirm the destination.

### View All Cards

The footer “View all cards” action closes the panel and recenters the viewport around the active grid’s card cluster using the existing card-center behavior.

### Empty State

When the active grid has no cards, the panel shows a short empty message and no search input.

## Interaction Details

- Click outside the panel closes it.
- Escape closes it.
- The trigger exposes `aria-expanded` and `aria-controls`.
- Card rows are buttons, so keyboard users can tab to a row and press Enter/Space.
- Search filters by card title, file name, content snippet, and card kind label.
- The panel should not block canvas panning outside its bounds.

## Visual Direction

Use the existing floating toolbar style:

- Dark translucent card background.
- Rounded corners matching the current status chip.
- Subtle border and shadow.
- Compact row height, with enough spacing for touch/click use.
- Highlight selected target card with a temporary ring/glow that works in dark and light themes.

## Architecture

Keep the feature local to the canvas UI:

- Add React state for navigator open/closed, search text, and highlighted card id.
- Add helper logic to build card labels from `CardData`.
- Add a viewport helper that centers a card using its `x`, `y`, `width`, and `height`.
- Reuse existing `setViewport`, `canvasRef`, `viewport`, and `activeGrid` data.
- Do not add Local API or database changes; this is purely a client-side navigation feature.

## Testing

Automated tests should cover pure helper behavior:

- Card label fallback chooses title, then file name, then localized kind label.
- Filtering matches title, file name, content, and card kind label.
- Viewport centering computes the expected `x` and `y` for a card and canvas bounds.

Manual verification should cover:

- Clicking the top-left chip opens and closes the panel.
- Clicking a card jumps to it and highlights it.
- “View all cards” returns to the active grid card cluster.
- Empty grid state is clear.
- Keyboard Escape closes the panel.
- Obsidian plugin build includes the UI.
