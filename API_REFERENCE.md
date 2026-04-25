# Open Canvas API Reference

This document summarizes the current API contract implemented in `server/index.ts`.

## 1. Overview

- API version: `0.2.0-api`
- Standard route prefix: `/api/v1`
- Base URL default: `http://127.0.0.1:8787`
- Legacy `/v1/*` routes are removed.

Environment variables:

- `OPEN_CANVAS_API_HOST` (default `127.0.0.1`)
- `OPEN_CANVAS_API_PORT` (default `8787`)
- `OPEN_CANVAS_API_BASE_URL` (optional override)
- `OPEN_CANVAS_WEB_ORIGIN` (default `http://127.0.0.1:5173`)

## 2. Response Contract

For all `/api/v1/*` routes:

- Success: `{ "data": ... , "meta"?: { "message": string } }`
- Error: `{ "error": { "code": string, "message": string, "details"?: any } }`

Error code mapping by HTTP status:

- `400 -> bad_request`
- `401 -> unauthorized`
- `403 -> forbidden`
- `404 -> not_found`
- `409 -> conflict`
- `429 -> rate_limited`
- `5xx -> internal_error`

## 3. Auth Model

Default local mode is no-login for early-stage use:

- Workspace read/write endpoints under `/api/v1/*` accept no `Authorization` header and use the built-in local workspace.
- If an API key is provided, the server still validates it and enforces scopes.
- Session and API-key management endpoints remain available for future authenticated expansion.

Two token types are still supported:

1. Access token (session token)
- Used for account/session endpoints.
- Header: `Authorization: Bearer <ACCESS_TOKEN>`
- Issued by `POST /api/v1/auth/demo-login`
- Session TTL: 30 days.

2. API key
- Optional in default local mode for workspace endpoints.
- Used for authenticated workspace read/write endpoints when provided.
- Header: `Authorization: Bearer <API_KEY>`
- Issued by `POST /api/v1/auth/api-keys`
- Scopes: `canvas:read`, `canvas:write`

## 4. Public Endpoints (No Auth)

### `GET /health`

Returns service health and runtime config.

### `GET /openapi.json`

Returns OpenAPI 3.1 description.

### `GET /llms-api.txt`

Returns plain-text API cheat sheet for LLM/tool usage.

## 5. Session Endpoints (Access Token)

### `POST /api/v1/auth/demo-login`

Request body:

```json
{
  "name": "Open Canvas User",
  "email": "user@example.com",
  "provider": "demo",
  "avatarUrl": "https://..."
}
```

Notes:

- `provider`: `demo | google` (defaults to `demo`)
- If `email` is missing, server creates one from name.
- Creates account if not exists, then creates session.

Response `data`:

```json
{
  "account": {
    "id": "acct-...",
    "name": "Open Canvas User",
    "email": "user@example.com",
    "provider": "demo",
    "avatarUrl": "https://..."
  },
  "accessToken": "oc_at_...",
  "expiresAt": "2026-04-01T00:00:00.000Z",
  "apiBaseUrl": "http://127.0.0.1:8787"
}
```

### `GET /api/v1/auth/me`

Validates current session token and returns account + session.

### `POST /api/v1/auth/api-keys`

Creates API key for current account.

Request body:

```json
{
  "name": "Open Canvas API Key",
  "scopes": ["canvas:read", "canvas:write"]
}
```

Response `data`:

```json
{
  "apiKey": "oc_live_key-..._...",
  "key": {
    "id": "key-...",
    "name": "Open Canvas API Key",
    "prefix": "oc_live_key-...",
    "scopes": ["canvas:read", "canvas:write"],
    "createdAt": "2026-03-01T00:00:00.000Z"
  }
}
```

### `GET /api/v1/auth/api-keys`

Lists current account API keys (with revoke status).

### `POST /api/v1/auth/api-keys/:keyId/revoke`

Revokes a key by id.

## 6. Workspace Endpoints (No Auth in Local Mode, API Key Optional)

### `GET /api/v1/state?full=1`

Scope required when using API key: `canvas:read`

- `full=1`: returns full cards in each grid
- without `full=1`: returns `cardCount` only

### `GET /api/v1/config`

Scope required when using API key: `canvas:read`

Returns:

- `apiBaseUrl`
- `webOrigin`
- `workspaceId`
- `accountId`
- `supportedKinds`
- `cardPolicies.singletonKinds`

### `POST /api/v1/grids`

Scope required when using API key: `canvas:write`

Request body:

```json
{
  "id": "grid-work",
  "name": "Work",
  "activate": true
}
```

Response `data`:

- `gridId`
- `name`
- `activeGridId`

Notes:

- `id` is optional. When provided, the server reuses the client-supplied grid id so local and remote state stay aligned.
- `activate: true` makes the created grid the active grid.

### `PATCH /api/v1/grids/:gridId`

Scope required when using API key: `canvas:write`

Request body:

```json
{
  "name": "Workboard",
  "activate": true
}
```

Notes:

- `name` renames the grid.
- `activate: true` marks this grid as the active grid.

### `DELETE /api/v1/grids/:gridId`

Scope required when using API key: `canvas:write`

Notes:

- Deletes the grid from the workspace.
- If the deleted grid was active, the server promotes a neighboring grid to active.
- The server rejects deleting the last remaining grid.

### `POST /api/v1/assets`

Scope required when using API key: `canvas:write`

Request body:

```json
{
  "id": "asset-image-1",
  "name": "photo.png",
  "type": "image/png",
  "dataUrl": "data:image/png;base64,..."
}
```

Response `data`:

- `assetId`
- `assetUrl`
- `asset`

Notes:

- The server stores the binary asset on disk and returns a public URL with a signed token.
- Use this for images, videos, and PDFs that need to survive refresh and CLI/API sync.

### `GET /api/v1/assets/:assetId`

Public fetch route for stored assets.

Notes:

- Requires the `token` query parameter from the upload response URL.
- Returns the raw file with the stored content type.

### `DELETE /api/v1/assets/:assetId`

Scope required when using API key: `canvas:write`

Notes:

- Deletes the stored asset file and metadata.
- Use it when the last card referencing an uploaded media asset is removed.

### `POST /api/v1/cards`

Scope required when using API key: `canvas:write`

Request body (common):

```json
{
  "kind": "note",
  "gridId": "grid-...",
  "title": "Quick note",
  "content": "Hello",
  "x": 320,
  "y": 180,
  "width": 420,
  "height": 300,
  "activateGrid": true
}
```

Supported kinds:

- `note`
- `hint`
- `image`
- `video`
- `pdf`
- `todo`
- `calendar`

Kind-specific fields:

- media (`image|video|pdf`): `fileName`, `mediaUrl`
- `todo`: `todoItems` (array of string or object `{ text, done?, status? }`)
- `calendar`: `calendar` object with cursor/selected date/view/events

Card policy:

- `note` cards can be created repeatedly.
- `todo` and `calendar` cards are singleton per grid.
- If a singleton card already exists in the target grid, the create endpoint reuses it instead of creating a duplicate.
- Use `PATCH /api/v1/cards/:cardId` to modify the fixed `todo` or `calendar` card.

Card writing guidance for agents:

- `note`: keep `title` short and put the full write-up in `content`.
- `todo`: keep the fixed card title as the project label and mutate `todoItems` for task rows.
- `calendar`: keep the fixed card title as the calendar label and mutate `calendar.events` for events.
- Use `append-note` only for incremental note writing.

Server normalization:

- unknown `kind` -> `note`
- width clamp: `220..1400`
- height clamp: `160..1200`
- x clamp: `-200..6000`
- y clamp: `-200..4000`

### `PATCH /api/v1/cards/:cardId`

Scope required when using API key: `canvas:write`

Updatable fields:

- `title`
- `content`
- `x`
- `y`
- `width`
- `height`

### `POST /api/v1/cards/:cardId/append-note`

Scope required when using API key: `canvas:write`

Request body:

```json
{
  "text": "append this line"
}
```

Appends text to existing card content with newline.

## 7. Quickstart Flow

1. Login to get access token:

```bash
curl -X POST http://127.0.0.1:8787/api/v1/auth/demo-login \
  -H "Content-Type: application/json" \
  -d '{"name":"Demo User","email":"demo@example.com","provider":"demo"}'
```

2. Create API key:

```bash
curl -X POST http://127.0.0.1:8787/api/v1/auth/api-keys \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Open Canvas API Key","scopes":["canvas:read","canvas:write"]}'
```

3. Create card:

```bash
curl -X POST http://127.0.0.1:8787/api/v1/cards \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"kind":"note","title":"From API","content":"Auto created"}'
```

## 8. Data Persistence

- Local runtime DB file: `.runtime/api-db.json`
- Stored entities:
  - accounts
  - sessions
  - apiKeys
  - workspaces

## 9. Compatibility Notes

- Keep using `/api/v1/*` only.
- Do not use removed legacy `/v1/*` endpoints.
- For tooling and contract validation, prefer `GET /openapi.json`.
