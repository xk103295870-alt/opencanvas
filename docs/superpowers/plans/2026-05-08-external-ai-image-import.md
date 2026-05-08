# External AI Image Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first workflow where external AI tools can import a local image into Canvas Workbench as an image card and later download the original imported file losslessly.

**Architecture:** Reuse the existing Local API asset and card model, but make the image import an explicit API operation that saves the original file bytes first and creates the image card second. The CLI reads a local file, sends it to the API, and the UI displays the returned original asset URL while preserving existing image card chrome. Add a small download action for image cards that downloads the original asset URL, not a generated preview.

**Tech Stack:** Node.js ESM CLI, Express 5 Local API, better-sqlite3 metadata store, React 19 + TypeScript, Vite, Node native test runner.

---

## File Structure

- Create `src/imageImportPayload.ts` for shared image MIME inference and data URL payload building.
- Create `src/imageImportPayload.test.ts` for Node tests that prove original bytes are preserved in the import payload.
- Modify `server/index.ts` to add an explicit `POST /api/v1/images/import` endpoint that accepts an original image `dataUrl`, writes original bytes to `.runtime/assets/<workspaceId>/<assetId>`, creates an image card, and returns the card plus original asset URL.
- Modify `src/apiClient.ts` to add typed client definitions for image import and asset download URL use.
- Modify `bin/canvas-workbench.mjs` to add `canvas-workbench image add <file>` command parsing, file validation, base64 data URL creation, API call, and success output.
- Modify `src/App.tsx` to expose a download-original button for image cards and use the existing `externalUrl` as the original asset source.
- Modify `src/App.css` to style the image download control as hover chrome matching the delete and resize controls.
- Modify `API_REFERENCE.md`, `README.md`, and `README.zh-CN.md` to document the new command and original-download behavior.

## Task 1: Extract image import payload helpers

**Files:**
- Create: `src/imageImportPayload.ts`
- Create: `src/imageImportPayload.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/imageImportPayload.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildImageImportPayload, inferImageMimeType } from './imageImportPayload.ts'

test('inferImageMimeType accepts common image extensions', () => {
  assert.equal(inferImageMimeType('portrait.png'), 'image/png')
  assert.equal(inferImageMimeType('portrait.jpg'), 'image/jpeg')
  assert.equal(inferImageMimeType('portrait.jpeg'), 'image/jpeg')
  assert.equal(inferImageMimeType('portrait.webp'), 'image/webp')
  assert.equal(inferImageMimeType('portrait.gif'), 'image/gif')
})

test('inferImageMimeType rejects non-image extensions', () => {
  assert.equal(inferImageMimeType('document.pdf'), null)
  assert.equal(inferImageMimeType('video.mp4'), null)
})

test('buildImageImportPayload preserves original bytes in a data URL', () => {
  const bytes = Buffer.from([0, 1, 2, 250, 255])
  const payload = buildImageImportPayload({
    fileName: 'generated.png',
    bytes,
    title: 'Generated concept',
    gridId: 'AI区',
    mimeType: 'image/png',
  })

  assert.equal(payload.name, 'generated.png')
  assert.equal(payload.title, 'Generated concept')
  assert.equal(payload.gridId, 'AI区')
  assert.equal(payload.type, 'image/png')
  assert.equal(payload.dataUrl, `data:image/png;base64,${bytes.toString('base64')}`)
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- src/imageImportPayload.test.ts
```

Expected: FAIL with module-not-found or missing export for `./imageImportPayload.ts`.

- [ ] **Step 3: Implement the helper**

Create `src/imageImportPayload.ts`:

```ts
export type ImageImportPayloadInput = {
  fileName: string
  bytes: Buffer
  title?: string
  gridId?: string
  mimeType: string
}

export type ImageImportPayload = {
  name: string
  type: string
  dataUrl: string
  title?: string
  gridId?: string
}

const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

export function inferImageMimeType(fileName: string) {
  const normalized = fileName.trim().toLowerCase()
  const extension = Object.keys(IMAGE_MIME_BY_EXTENSION).find((item) => normalized.endsWith(item))
  return extension ? IMAGE_MIME_BY_EXTENSION[extension] : null
}

export function buildImageImportPayload(input: ImageImportPayloadInput): ImageImportPayload {
  const name = input.fileName.trim()
  const title = input.title?.trim()
  const gridId = input.gridId?.trim()
  return {
    name,
    type: input.mimeType,
    dataUrl: `data:${input.mimeType};base64,${input.bytes.toString('base64')}`,
    ...(title ? { title } : {}),
    ...(gridId ? { gridId } : {}),
  }
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run:

```bash
npm test -- src/imageImportPayload.test.ts
```

Expected: PASS for the 3 image import payload tests.

- [ ] **Step 5: Commit**

```bash
git add src/imageImportPayload.ts src/imageImportPayload.test.ts
git commit -m "feat: add image import payload helpers"
```

## Task 2: Add Local API image import endpoint

**Files:**
- Modify: `server/index.ts`
- Modify: `API_REFERENCE.md`

- [ ] **Step 1: Write a failing route-level test by manual curl script**

Because the current server starts on module import and does not expose an in-memory Express app for direct Node tests, use a manual red test against the running API after Task 1.

Start the app if needed:

```bash
npm run cli -- start --no-open
```

Run:

```bash
node -e "const dataUrl='data:image/png;base64,'+Buffer.from([137,80,78,71]).toString('base64'); fetch('http://127.0.0.1:8799/api/v1/images/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'generated.png',type:'image/png',dataUrl,title:'Generated',gridId:'AI区'})}).then(async r=>{console.log(r.status); console.log(await r.text())})"
```

Expected before implementation: `404` or route-not-found response.

- [ ] **Step 2: Add request payload type**

In `server/index.ts`, near `CanvasWorkbenchCreateCardPayload`, add:

```ts
type CanvasWorkbenchImageImportPayload = {
  id?: string
  cardId?: string
  name?: string
  type?: string
  dataUrl?: string
  title?: string
  gridId?: string
  x?: number
  y?: number
  width?: number
  height?: number
  activateGrid?: boolean
}
```

- [ ] **Step 3: Add image-only MIME sanitizer**

In `server/index.ts`, after `sanitizeMimeType`, add:

```ts
function sanitizeImageMimeType(value: unknown) {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (raw === 'image/png') return raw
  if (raw === 'image/jpeg') return raw
  if (raw === 'image/webp') return raw
  if (raw === 'image/gif') return raw
  return null
}
```

- [ ] **Step 4: Add helper to serialize asset records**

In `server/index.ts`, after `toAssetUrl`, add:

```ts
function toPublicAsset(record: AssetRecord) {
  return {
    id: record.id,
    name: record.name,
    type: record.type,
    size: record.size,
    assetUrl: toAssetUrl(record.id, record.publicToken),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}
```

Then update the existing `/api/v1/assets` response to use `toPublicAsset(record)` instead of duplicating the object.

- [ ] **Step 5: Implement the import endpoint**

Add this route after `/api/v1/assets` and before `GET /api/v1/assets/:assetId`:

```ts
app.post('/api/v1/images/import', requireApiKey('canvas:write'), (req, res) => {
  const ctx = ensureCtx(req)
  if (!ctx.workspace || !ctx.account) {
    res.status(500).json({ ok: false, message: 'Workspace context missing' })
    return
  }

  const body = (req.body || {}) as CanvasWorkbenchImageImportPayload
  const parsed = parseDataUrl(body.dataUrl)
  const imageType = sanitizeImageMimeType(body.type || parsed?.mimeType)
  if (!parsed || !imageType) {
    res.status(400).json({ ok: false, message: 'Valid image dataUrl is required' })
    return
  }

  const targetGrid =
    (body.gridId ? ctx.workspace.grids.find((grid) => grid.id === body.gridId || grid.name === body.gridId) : null) ||
    ctx.workspace.grids.find((grid) => grid.id === ctx.workspace.activeGridId) ||
    ctx.workspace.grids[0]

  if (!targetGrid) {
    res.status(400).json({ ok: false, message: 'No grid available' })
    return
  }

  const assetId = normalizeAssetId(body.id) || `asset-${uid(12)}`
  const cardId = normalizeCardId(body.cardId) || `image-${uid(14)}`
  if (targetGrid.cards.some((card) => card.id === cardId)) {
    res.status(409).json({ ok: false, message: `Card already exists: ${cardId}` })
    return
  }

  const now = nowIso()
  const record: AssetRecord = {
    id: assetId,
    accountId: ctx.account.id,
    workspaceId: ctx.workspace.id,
    name: normalizeAssetName(body.name),
    type: imageType,
    size: parsed.buffer.length,
    publicToken: uid(24),
    createdAt: now,
    updatedAt: now,
  }

  ensureAssetDir(ctx.workspace.id)
  fs.writeFileSync(getAssetFilePath(ctx.workspace.id, assetId), parsed.buffer)
  db.assets.push(record)

  const defaultSize = CARD_DEFAULT_SIZES.image
  const width = clamp(toFiniteNumber(body.width, defaultSize.width), 220, 1400)
  const height = clamp(toFiniteNumber(body.height, defaultSize.height), 160, 1200)
  const card: CardData = {
    id: cardId,
    kind: 'image',
    title: String(body.title || '').trim() || record.name,
    content: '',
    x: clamp(toFiniteNumber(body.x, SCENE_CENTER_X - width / 2), -200, SCENE_WIDTH),
    y: clamp(toFiniteNumber(body.y, SCENE_CENTER_Y - height / 2), -200, SCENE_HEIGHT),
    width,
    height,
    fileId: record.id,
    fileName: record.name,
    externalUrl: toAssetUrl(record.id, record.publicToken),
  }
  targetGrid.cards.push(card)
  if (body.activateGrid !== false) ctx.workspace.activeGridId = targetGrid.id
  commitWorkspaceMutation(ctx.workspace, 'image.import')

  res.json({
    ok: true,
    message: 'Image imported',
    data: {
      assetId: record.id,
      assetUrl: toAssetUrl(record.id, record.publicToken),
      asset: toPublicAsset(record),
      cardId: card.id,
      gridId: targetGrid.id,
      card,
    },
  })
})
```

- [ ] **Step 6: Document the endpoint**

In `API_REFERENCE.md`, add `POST /api/v1/images/import` near the asset/card endpoints:

```md
### `POST /api/v1/images/import`

Imports a local image from a data URL, saves the original image bytes as an asset, and creates an image card in the selected grid.

Request body:

```json
{
  "name": "generated.png",
  "type": "image/png",
  "dataUrl": "data:image/png;base64,...",
  "title": "Generated image",
  "gridId": "AI区"
}
```

Response `data` includes `assetId`, `assetUrl`, `asset`, `cardId`, `gridId`, and `card`.

Download the original image from `assetUrl`. The API returns the original stored bytes.
```

- [ ] **Step 7: Run manual red test again and verify it passes**

Restart API if needed:

```bash
npm run cli -- restart --no-open
```

Run the same Node fetch command from Step 1.

Expected: `200` response with `data.card.kind` equal to `image`, `data.asset.type` equal to `image/png`, and `data.asset.size` equal to `4`.

- [ ] **Step 8: Commit**

```bash
git add server/index.ts API_REFERENCE.md
git commit -m "feat: add image import API"
```

## Task 3: Add typed frontend API client support

**Files:**
- Modify: `src/apiClient.ts`

- [ ] **Step 1: Add types**

Add after `ServerAssetUploadPayload`:

```ts
export type ServerImageImportPayload = {
  id?: string
  cardId?: string
  name: string
  type: string
  dataUrl: string
  title?: string
  gridId?: string
  x?: number
  y?: number
  width?: number
  height?: number
  activateGrid?: boolean
}

export type ServerImageImportResponse = {
  assetId: string
  assetUrl: string
  asset: ServerAssetRecord
  cardId: string
  gridId: string
  card: ServerWorkspaceCard
}
```

- [ ] **Step 2: Add client function**

Add after `apiCreateAsset`:

```ts
export async function apiImportImage(apiKey: string, payload: ServerImageImportPayload, baseUrl?: string) {
  return requestJson<ServerImageImportResponse>('/api/v1/images/import', {
    method: 'POST',
    headers: bearerHeaders(apiKey),
    body: JSON.stringify(payload),
  }, baseUrl)
}
```

- [ ] **Step 3: Run type check**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/apiClient.ts
git commit -m "feat: add image import API client"
```

## Task 4: Add CLI image add command

**Files:**
- Modify: `bin/canvas-workbench.mjs`
- Modify: `README.md`
- Modify: `README.zh-CN.md`

- [ ] **Step 1: Add usage text**

In `usage()`, add this line after `flow add`:

```text
  canvas-workbench image add <file> [--title <title>] [--grid <grid-name-or-id>] [--api-url <url>] [--api-key <key>]
```

Add example:

```text
  canvas-workbench image add "./generated.png" --title "Generated concept" --grid "AI区"
```

- [ ] **Step 2: Extend command parsing**

In `parseArgs`, add this branch after `note add`:

```js
  } else if (rawCommand === 'image' && tokens[0] === 'add') {
    tokens.shift()
    command = 'image:add'
```

Update the positional content condition so `image:add` accepts the file path:

```js
    if ((command === 'grid:add' || command === 'note:add' || command === 'image:add' || command === 'todo:add' || command === 'calendar:event:add') && !token.startsWith('-')) {
```

- [ ] **Step 3: Add MIME inference helper**

Near `normalizeCalendarEventOptions`, add:

```js
function inferImageMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase()
  if (extension === '.png') return 'image/png'
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  if (extension === '.webp') return 'image/webp'
  if (extension === '.gif') return 'image/gif'
  return null
}
```

- [ ] **Step 4: Add command implementation**

Add after `noteAddCommand`:

```js
async function imageAddCommand(options) {
  const filePathInput = options.contentParts.join(' ').trim()
  if (!filePathInput) {
    throw new Error('Image file is required. Example: canvas-workbench image add "./generated.png" --grid "AI区"')
  }

  const filePath = path.resolve(process.cwd(), filePathInput)
  if (!fs.existsSync(filePath)) {
    throw new Error(`Image file not found: ${filePath}`)
  }
  const stat = fs.statSync(filePath)
  if (!stat.isFile()) {
    throw new Error(`Image path is not a file: ${filePath}`)
  }
  const mimeType = inferImageMimeType(filePath)
  if (!mimeType) {
    throw new Error('Unsupported image file. Use png, jpg, jpeg, webp, or gif.')
  }

  const bytes = fs.readFileSync(filePath)
  const fileName = path.basename(filePath)
  const apiUrl = apiUrlFor(options)
  const gridLookup = String(options.gridId || '').trim()
  const { grid, created } = await ensureGrid(apiUrl, options, gridLookup)
  if (!grid?.id) throw new Error('Could not find or create target grid')

  const result = await httpJson(`${apiUrl}/api/v1/images/import`, {
    method: 'POST',
    apiKey: options.apiKey,
    body: {
      name: fileName,
      type: mimeType,
      dataUrl: `data:${mimeType};base64,${bytes.toString('base64')}`,
      title: String(options.title || '').trim() || fileName,
      gridId: grid.id,
      activateGrid: true,
      ...centeredCardPosition('image'),
    },
  })
  const data = result?.data || {}
  console.log('Image imported')
  console.log(`  api: ${apiUrl}`)
  console.log(`  grid: ${data.gridId || grid.id}${created ? ' (created)' : ''}`)
  console.log(`  card: ${data.cardId || data.card?.id || 'unknown'}`)
  console.log(`  asset: ${data.assetId || data.asset?.id || 'unknown'}`)
  console.log(`  original: ${filePath}`)
}
```

- [ ] **Step 5: Add command dispatch**

In `main()`, after `note:add`, add:

```js
  if (command === 'image:add') {
    await imageAddCommand(options)
    return
  }
```

- [ ] **Step 6: Fix image default size in CLI**

Update `CLI_CARD_DEFAULT_SIZES` to include image:

```js
  image: { width: 360, height: 280 },
```

- [ ] **Step 7: Run a failing command against offline API to verify CLI validation**

Run:

```bash
node bin/canvas-workbench.mjs image add missing.png
```

Expected: exits non-zero with `Image file not found:` before any API call.

- [ ] **Step 8: Run command against running API**

Create a tiny PNG-like test fixture in the runtime directory:

```bash
node -e "require('node:fs').writeFileSync('.runtime/generated-test.png', Buffer.from([137,80,78,71]))"
```

Run:

```bash
node bin/canvas-workbench.mjs image add .runtime/generated-test.png --title "Generated test" --grid "AI区"
```

Expected output contains `Image imported`, `grid:`, `card:`, `asset:`, and `original:`.

- [ ] **Step 9: Document CLI command**

In `README.md` and `README.zh-CN.md`, add image import to the CLI feature list and examples:

```bash
canvas-workbench image add "./generated.png" --title "Generated concept" --grid "AI区"
```

Explain that the original file is saved locally and download returns the original file.

- [ ] **Step 10: Commit**

```bash
git add bin/canvas-workbench.mjs README.md README.zh-CN.md
git commit -m "feat: add CLI image import"
```

## Task 5: Add original image download action in UI

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Locate image card chrome render**

In `src/App.tsx`, find the image card close button and resize handle render in the card article. The current image cards already have frameless hover chrome, body dragging, and resize handle.

- [ ] **Step 2: Add download handler**

Near `requestRemoveCard`, add:

```ts
const downloadOriginalImage = (card: CardData) => {
  const sourceUrl = card.externalUrl || (card.fileId ? assetUrls[card.fileId] : '')
  if (!sourceUrl) return
  const anchor = document.createElement('a')
  anchor.href = sourceUrl
  anchor.download = card.fileName || card.title || 'image'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}
```

If this function needs `assetUrls`, place it inside the component scope where `assetUrls` is available.

- [ ] **Step 3: Render download button for image cards**

Near the existing `.image-card-close` button, render this before the close button:

```tsx
{card.kind === 'image' ? (
  <button
    className="card-action image-card-download"
    onPointerDown={(event) => event.stopPropagation()}
    onClick={(event) => {
      event.stopPropagation()
      downloadOriginalImage(card)
    }}
    aria-label={settings.language === 'zh' ? '下载原图' : 'Download original image'}
    title={settings.language === 'zh' ? '下载原图' : 'Download original image'}
  >
    ⤓
  </button>
) : null}
```

- [ ] **Step 4: Style the download button**

In `src/App.css`, near `.image-card-close`, add:

```css
.image-card-download {
  position: absolute;
  top: 8px;
  right: 42px;
  z-index: 9;
  opacity: 0.42;
  border-color: color-mix(in srgb, var(--line) 54%, transparent);
  background: color-mix(in srgb, var(--card-header-bg) 76%, transparent);
  box-shadow: 0 8px 18px color-mix(in srgb, var(--card-shadow) 46%, transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  transition:
    opacity 0.16s ease,
    border-color 0.16s ease,
    background 0.16s ease,
    box-shadow 0.16s ease;
}

.card.frameless:hover .image-card-download,
.card.frameless:focus-within .image-card-download,
.image-card-download:hover {
  opacity: 1;
  border-color: var(--line-strong);
  background: var(--icon-bg);
}
```

- [ ] **Step 5: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 6: Verify UI in browser preview**

Start or reuse preview server. In the browser, select a grid with an image card. Expected:

- Image card has hover chrome.
- Right top shows download and delete buttons.
- Download button has title/aria label `下载原图` in Chinese mode or `Download original image` in English mode.
- Existing drag and resize behavior remains available.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/App.css
git commit -m "feat: add original image download control"
```

## Task 6: Full verification and Obsidian build update

**Files:**
- Modify generated: `dist-obsidian/main.js`
- Modify generated: `dist-obsidian/styles.css`
- Ensure exists: `dist-obsidian/manifest.json`

- [ ] **Step 1: Run full check**

Run:

```bash
npm run check
```

Expected: PASS. Existing React hook warning may appear during lint, but there must be no errors and the command must exit 0.

- [ ] **Step 2: Restore Obsidian manifest after build**

If `dist-obsidian/manifest.json` was removed by the build, recreate it with:

```json
{
  "id": "canvas-workbench",
  "name": "Canvas Workbench",
  "version": "0.1.0",
  "minAppVersion": "1.5.0",
  "description": "Built-in todos, schedule management, sticky notes, and related features.",
  "author": "ke xiao",
  "authorUrl": "",
  "isDesktopOnly": false
}
```

- [ ] **Step 3: Copy Obsidian build into the user's vault plugin directory**

Run:

```bash
cp dist-obsidian/main.js "/Users/xk/Documents/Obsidian Vault/.obsidian/plugins/canvas-workbench/main.js"
cp dist-obsidian/styles.css "/Users/xk/Documents/Obsidian Vault/.obsidian/plugins/canvas-workbench/styles.css"
cp dist-obsidian/manifest.json "/Users/xk/Documents/Obsidian Vault/.obsidian/plugins/canvas-workbench/manifest.json"
```

- [ ] **Step 4: Verify CLI import manually**

Run:

```bash
npm run cli -- start --no-open
node -e "require('node:fs').writeFileSync('.runtime/generated-final.png', Buffer.from([137,80,78,71]))"
node bin/canvas-workbench.mjs image add .runtime/generated-final.png --title "Generated final" --grid "AI区"
```

Expected: CLI prints `Image imported` and card/asset IDs. Open UI should receive workspace update and show the image card.

- [ ] **Step 5: Verify original download bytes**

From the CLI output or workspace state, get `assetUrl`, then run a Node fetch to compare bytes:

```bash
node -e "const fs=require('node:fs'); fetch('ASSET_URL_FROM_OUTPUT').then(r=>r.arrayBuffer()).then(b=>{const got=Buffer.from(b); const expected=fs.readFileSync('.runtime/generated-final.png'); console.log(Buffer.compare(got, expected)===0 ? 'bytes match' : 'bytes differ')})"
```

Expected: `bytes match`.

- [ ] **Step 6: Commit generated build artifacts**

```bash
git add dist-obsidian/main.js dist-obsidian/styles.css dist-obsidian/manifest.json
git commit -m "build: update obsidian plugin for image import"
```

## Task 7: Final branch completion

**Files:**
- No code changes unless verification reveals an issue.

- [ ] **Step 1: Run status**

```bash
git status --short --branch
```

Expected: clean working tree, local branch ahead of remote if push is blocked.

- [ ] **Step 2: Attempt push**

```bash
git push origin main
```

Expected in this environment may be failure with `CONNECT tunnel failed, response 403`.

- [ ] **Step 3: Report completion**

If push fails, tell the user to run:

```bash
cd "/Users/xk/vs开发文件/Canvas-Workbench"
git push origin main
```

Also tell them to restart Obsidian or disable/enable the Canvas Workbench plugin to load the copied build.

---

## Self-Review

- Spec coverage: CLI import is covered by Task 4, Local API original asset save and card creation by Task 2, UI original download by Task 5, Obsidian delivery by Task 6, and no cloud/model integration is introduced.
- Placeholder scan: plan text has no unresolved placeholder markers; every code-changing step includes concrete code or exact command.
- Type consistency: `ServerImageImportPayload`, `ServerImageImportResponse`, `CanvasWorkbenchImageImportPayload`, `assetUrl`, `fileId`, `externalUrl`, and card fields match existing naming patterns.
- Scope check: preview generation is intentionally deferred to using the original asset URL as first preview source because the current browser/UI can display original image URLs already; the original/preview boundary remains preserved by not using transformed bytes for download.
