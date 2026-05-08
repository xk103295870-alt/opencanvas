# External AI Image Import Design

## Goal

Canvas Workbench should let an external AI tool generate an image locally and send that image into a selected workspace grid as an image card.

## Product Positioning

Canvas Workbench does not own image generation models or prompt workflows in this feature. External tools generate the image. Canvas Workbench receives the completed local image file, stores it locally, creates a canvas image card, and keeps the original file available for lossless download.

## User Workflow

1. A user asks an external AI tool to generate an image.
2. The AI tool receives or writes a local image file.
3. The AI tool calls Canvas Workbench, for example:

```bash
canvas-workbench image add "/path/to/generated.png" --title "Generated image" --grid "AI区"
```

4. Canvas Workbench Local API imports the file.
5. Canvas Workbench saves the original image asset without changing bytes, format, dimensions, or metadata.
6. Canvas Workbench creates or stores a lightweight preview asset for canvas display.
7. The currently open Web or Obsidian UI receives a workspace update.
8. The selected grid shows a new image card.
9. The user can move, resize, delete, and organize the image card.
10. When the user downloads the image, Canvas Workbench returns the original imported file, not the preview.

## In Scope

- Add a CLI command for importing a local image file into a grid.
- Add a Local API path used by the CLI to import that file.
- Store the original image as a local asset with no lossy transformation.
- Store enough metadata to support original filename, MIME type, size, and download.
- Create an image card that displays the imported picture in the target grid.
- Use preview content for canvas display when available.
- Make download return the original asset.

## Out of Scope

- Built-in prompt UI inside Canvas Workbench.
- Direct model provider integration.
- Cloud upload or cloud-hosted image storage.
- User accounts or remote sharing.
- Editing the original image file from the canvas.

## Asset Model

Each imported image has two conceptual asset layers:

### Original Asset

The original asset is the source of truth.

- Saved from the input file as-is.
- Not compressed.
- Not resized.
- Not converted to another format.
- Not watermarked.
- Used for download.

### Preview Asset

The preview asset exists only for UI performance.

- Used by image cards for canvas display.
- May be resized, compressed, cached, or regenerated.
- Must never replace the original asset.
- Must not be returned by the download action when the user expects the original file.

## Card Behavior

The imported image card should behave like existing image cards:

- No filename strip under the image.
- Frameless visual style by default.
- Hover border and shadow for operation feedback.
- Body dragging.
- Right-top delete button.
- Right-bottom arbitrary resize handle.
- Card resizing changes only canvas display size, not original asset bytes.

## Error Handling

- If the input file cannot be read, the CLI reports the failure and no card is created.
- If the original asset cannot be saved, the import fails and no card is created.
- If preview generation or preview storage fails, the original asset remains saved and the card may use the original asset as a temporary display source.
- If download cannot read the original asset, Canvas Workbench shows a download failure without deleting the card.
- If Local API is offline, the CLI tells the user to start or connect Local API and does not retry blindly.

## Success Criteria

- An external AI agent can generate a local image and insert it into Canvas Workbench with one CLI command.
- The image appears in the requested grid as a normal image card.
- The canvas can display a lightweight preview.
- Download returns the original imported image file with no intentional byte-changing transformation.
- The workflow remains local-first and does not require cloud storage or login.
