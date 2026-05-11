# Dashboard Popup Inspect Mode Design

## Context

Canvas Workbench dashboard cards support AI/agent-generated ECharts options. The latest implementation makes dashboard cards default to preview mode and enables chart interaction only after an intentional inspect action.

The user wants one refinement: the full chart interaction should not happen inside the canvas card itself. Instead, the canvas card should remain a stable preview card, and clicking a top-menu action should open a separate centered viewing frame.

## Goal

Keep dashboard cards as ordinary canvas preview cards during layout work, and move full ECharts interaction into a dedicated centered popup viewer.

## Chosen direction

Use **方案 A：居中大弹窗查看器**.

The entry point is a top-menu button in the dashboard card header, labeled `查看 / 交互`.

## Non-goals

- Do not add built-in AI calls or AI API keys.
- Do not change the dashboard storage schema.
- Do not make the whole dashboard card draggable.
- Do not enable full ECharts pointer interaction inside the canvas card preview.
- Do not use a side drawer or card-adjacent floating frame for the first version.

## Interaction model

### Canvas card preview

The dashboard card on the canvas remains a preview card.

```text
┌──────────────────────────────┐
│ 销售趋势看板        查看/交互 │
├──────────────────────────────┤
│                              │
│          图表预览             │
│                              │
└──────────────────────────────┘
```

Rules:

- The top internal handle remains responsible for moving the card.
- The header contains a `查看 / 交互` action on the right.
- The chart body renders as a preview.
- The chart body does not provide full ECharts pointer interaction.
- The preview card should feel consistent with other card types when panning, dragging, and arranging the canvas.

### Popup viewer

Clicking `查看 / 交互` opens a centered modal-style viewer.

```text
背景画布轻微变暗

┌────────────────────────────────────┐
│ 销售趋势看板                 关闭 X │
├────────────────────────────────────┤
│                                    │
│          ECharts 完整交互区          │
│     tooltip / legend / hover / zoom │
│                                    │
└────────────────────────────────────┘
```

Rules:

- The popup shows the dashboard title.
- The popup contains a full interactive ECharts chart.
- Tooltip hover works inside the popup.
- Legend clicks work inside the popup.
- Future ECharts interactions such as dataZoom, brush, and selection can work inside the popup.
- The original canvas card remains unchanged behind the overlay.

### Closing the popup

The popup can be closed by:

- Clicking the close button.
- Pressing `Escape`.
- Clicking the dimmed overlay outside the popup frame.

After closing, the dashboard card remains in preview mode.

## Pointer boundaries

The intended pointer ownership becomes:

```text
Dashboard top drag handle      -> drag dashboard card
Dashboard header action        -> open popup viewer
Dashboard preview chart body   -> preview only, no full chart interaction
Centered popup chart           -> full ECharts interactions
Dimmed overlay                 -> close popup when clicked outside frame
Blank canvas background        -> pan canvas when no popup is open
```

This cleanly separates canvas layout work from chart inspection.

## Visual design

- The dashboard card keeps the existing frameless/photo-card style.
- The top `查看 / 交互` action should be compact and visually aligned with the dashboard header.
- The popup should use the same dark glass visual language as the rest of Canvas Workbench.
- The popup should be large enough for chart reading, roughly `min(1080px, viewport - margins)` wide and `min(720px, viewport - margins)` tall.
- The overlay should dim the canvas without hiding it completely.

## Implementation notes

- `App.tsx` should track `inspectedDashboardCardId` or an equivalent selected dashboard card id.
- `DashboardCard` should expose a top-header action callback such as `onOpenInspect`.
- The chart preview in `DashboardCard` should keep pointer-heavy chart interactions disabled.
- A separate popup viewer component can reuse `DashboardCard` rendering logic only if it does not reintroduce preview pointer restrictions. Prefer a focused `DashboardInspectModal` component if it keeps responsibilities clearer.
- Only one dashboard popup should be open at a time.
- Opening another dashboard viewer replaces the current one.
- Escape handling should close the popup.
- Overlay clicks should close the popup, but clicks inside the popup frame should not propagate to the overlay close handler.

## Testing requirements

Add source or behavior tests covering:

- Dashboard preview cards render a header action labeled `查看 / 交互`.
- Dashboard preview chart body does not enable full ECharts pointer interaction.
- Clicking/opening the header action sets the inspected dashboard card id.
- App renders a centered dashboard inspect modal when a dashboard card is selected for inspection.
- The modal chart enables ECharts pointer interactions.
- The modal can close through close button, Escape, and overlay click.
- The top dashboard drag handle remains the only card drag surface.
- The canvas card stays frameless and does not use the standard card header.

## Documentation requirements

The public AI/CLI generation docs do not need to change unless they mention chart interaction behavior. This is primarily a UI interaction refinement.

## Approval

Approved direction: use a top-menu `查看 / 交互` action on the dashboard card and open a centered popup viewer for full ECharts interaction.
