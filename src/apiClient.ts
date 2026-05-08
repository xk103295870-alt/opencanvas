import type { CardData, CardKind, CalendarState, EventFlowState, TodoItem } from './shared/workspaceTypes'

export type ServerAccount = {
  id: string
  name: string
  email: string
  provider: 'demo' | 'google'
  avatarUrl?: string
}

export type ServerLoginResponse = {
  account: ServerAccount
  accessToken: string
  expiresAt: string
  apiBaseUrl: string
}

export type ServerApiKeyResponse = {
  apiKey: string
  key: {
    id: string
    name: string
    prefix: string
    scopes: string[]
    createdAt: string
  }
}

export type ServerSessionResponse = {
  account: ServerAccount
  session: {
    id: string
    expiresAt: string
    lastUsedAt: string
  }
}

export type ServerWorkspaceCard = CardData

export type ServerCardCreateResponse = {
  cardId: string
  gridId: string
  card: ServerWorkspaceCard
}

export type ServerCardUpdateResponse = {
  cardId: string
  gridId: string
  card: ServerWorkspaceCard
}

export type ServerCardDeleteResponse = {
  cardId: string
  gridId: string
}

export type ServerAssetRecord = {
  id: string
  name: string
  type: string
  size: number
  assetUrl: string
  createdAt: string
  updatedAt: string
}

export type ServerGridCreatePayload = {
  id?: string
  name?: string
  activate?: boolean
}

export type ServerGridCreateResponse = {
  gridId: string
  name: string
  activeGridId: string
}

export type ServerGridUpdatePayload = {
  name?: string
  activate?: boolean
}

export type ServerGridUpdateResponse = {
  gridId: string
  name: string
  activeGridId: string
}

export type ServerGridDeleteResponse = {
  gridId: string
  activeGridId: string
}

export type ServerAssetUploadPayload = {
  id?: string
  name: string
  type: string
  dataUrl: string
}

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

export type ServerAssetUploadResponse = {
  assetId: string
  assetUrl: string
  asset: ServerAssetRecord
}

export type ServerAssetDeleteResponse = {
  assetId: string
}

export type ServerAssetDownloadResponse = {
  blob: Blob
  type: string
}

export type ServerStateUploadPayload = {
  name?: string
  activeGridId?: string
  grids: Array<{
    id: string
    name: string
    cards: CardData[]
  }>
}

export type ServerStateUploadResponse = {
  workspace: ServerStateResponse['workspace']
}

export type ServerCardCreatePayload = {
  id?: string
  kind?: CardKind
  gridId?: string
  title?: string
  content?: string
  x?: number
  y?: number
  width?: number
  height?: number
  activateGrid?: boolean
  fileName?: string
  mediaUrl?: string
  todoItems?: Array<string | { text?: string; done?: boolean; status?: 'todo' | 'doing' | 'done'; tag?: string }>
  calendar?: Partial<Omit<CalendarState, 'events'>> & {
    events?: Array<{
      title?: string
      date?: string
      allDay?: boolean
      startTime?: string
      endTime?: string
    }>
  }
  eventFlow?: EventFlowState
}

export type ServerCardUpdatePayload = Partial<
  Pick<
    ServerWorkspaceCard,
    'title' | 'content' | 'x' | 'y' | 'width' | 'height' | 'fileName' | 'externalUrl' | 'todoItems' | 'calendar' | 'eventFlow'
  >
> & {
  todoItems?: TodoItem[]
}

export type ServerStateResponse = {
  account: ServerAccount
  workspace: {
    id: string
    name: string
    activeGridId: string
    updatedAt: string
    revision?: number
    grids: Array<{
      id: string
      name: string
      cardCount: number
      cards?: ServerWorkspaceCard[]
    }>
  }
  key: {
    id: string
    scopes: string[]
    lastUsedAt: string
  }
}

export type ServerWorkspaceEvent = {
  type: 'hello' | 'workspace.updated'
  workspaceId: string
  revision?: number
  updatedAt?: string
  source?: string
  operation?: string
}

const API_BASE_URL = (import.meta.env.VITE_CANVAS_WORKBENCH_API_BASE_URL as string | undefined)?.trim() || 'http://127.0.0.1:8799'

export type ServerHealthResponse = {
  ok?: boolean
  version?: string
  apiBaseUrl?: string
  webOrigin?: string
  currentRevision?: string | null
  remoteRevision?: string | null
  remoteName?: string | null
  branchName?: string | null
  updateAvailable?: boolean
}

export type ServerUpdateResponse = {
  started: boolean
  pid?: number
  logPath?: string
}

type ApiErrorEnvelope = {
  error?: {
    code?: string
    message?: string
    details?: unknown
  }
  message?: string
}

type ApiSuccessEnvelope<T> = {
  data?: T
  meta?: {
    message?: string
  }
}

function resolveBaseUrl(baseUrl?: string) {
  const value = (baseUrl || API_BASE_URL).trim()
  return value.endsWith('/') ? value.slice(0, -1) : value
}

async function requestJson<T>(path: string, init?: RequestInit, baseUrl?: string): Promise<T> {
  const response = await fetch(`${resolveBaseUrl(baseUrl)}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  const payload = (await response.json().catch(() => null)) as
    | (ApiErrorEnvelope & ApiSuccessEnvelope<T>)
    | T
    | null
  if (!response.ok) {
    const envelope = payload && typeof payload === 'object' ? (payload as ApiErrorEnvelope) : null
    throw new Error(envelope?.error?.message || envelope?.message || `Request failed: ${response.status}`)
  }

  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as ApiSuccessEnvelope<T>).data as T
  }
  return payload as T
}

export async function apiDemoLogin(
  input: {
    name: string
    email: string
    provider: 'demo' | 'google'
    avatarUrl?: string
  },
  baseUrl?: string,
) {
  return requestJson<ServerLoginResponse>('/api/v1/auth/demo-login', {
    method: 'POST',
    body: JSON.stringify(input),
  }, baseUrl)
}

export async function apiCreateKey(accessToken: string, name = 'Open Canvas API Key', baseUrl?: string) {
  return requestJson<ServerApiKeyResponse>('/api/v1/auth/api-keys', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ name, scopes: ['canvas:read', 'canvas:write'] }),
  }, baseUrl)
}

export async function apiGetSessionMe(accessToken: string, baseUrl?: string) {
  return requestJson<ServerSessionResponse>('/api/v1/auth/me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  }, baseUrl)
}

function bearerHeaders(token: string): Record<string, string> {
  const trimmed = token.trim()
  return trimmed ? { Authorization: `Bearer ${trimmed}` } : {}
}

export async function apiCreateCard(apiKey: string, payload: ServerCardCreatePayload, baseUrl?: string) {
  return requestJson<ServerCardCreateResponse>('/api/v1/cards', {
    method: 'POST',
    headers: bearerHeaders(apiKey),
    body: JSON.stringify(payload),
  }, baseUrl)
}

export async function apiCreateGrid(apiKey: string, payload: ServerGridCreatePayload, baseUrl?: string) {
  return requestJson<ServerGridCreateResponse>('/api/v1/grids', {
    method: 'POST',
    headers: bearerHeaders(apiKey),
    body: JSON.stringify(payload),
  }, baseUrl)
}

export async function apiUpdateGrid(
  apiKey: string,
  gridId: string,
  updates: ServerGridUpdatePayload,
  baseUrl?: string,
) {
  return requestJson<ServerGridUpdateResponse>(`/api/v1/grids/${encodeURIComponent(gridId)}`, {
    method: 'PATCH',
    headers: bearerHeaders(apiKey),
    body: JSON.stringify(updates),
  }, baseUrl)
}

export async function apiDeleteGrid(apiKey: string, gridId: string, baseUrl?: string) {
  return requestJson<ServerGridDeleteResponse>(`/api/v1/grids/${encodeURIComponent(gridId)}`, {
    method: 'DELETE',
    headers: bearerHeaders(apiKey),
  }, baseUrl)
}

export async function apiCreateAsset(apiKey: string, payload: ServerAssetUploadPayload, baseUrl?: string) {
  return requestJson<ServerAssetUploadResponse>('/api/v1/assets', {
    method: 'POST',
    headers: bearerHeaders(apiKey),
    body: JSON.stringify(payload),
  }, baseUrl)
}

export async function apiImportImage(apiKey: string, payload: ServerImageImportPayload, baseUrl?: string) {
  return requestJson<ServerImageImportResponse>('/api/v1/images/import', {
    method: 'POST',
    headers: bearerHeaders(apiKey),
    body: JSON.stringify(payload),
  }, baseUrl)
}

export async function apiDeleteAsset(apiKey: string, assetId: string, baseUrl?: string) {
  return requestJson<ServerAssetDeleteResponse>(`/api/v1/assets/${encodeURIComponent(assetId)}`, {
    method: 'DELETE',
    headers: bearerHeaders(apiKey),
  }, baseUrl)
}

export async function apiDownloadAsset(assetUrl: string, timeoutMs = 10000): Promise<ServerAssetDownloadResponse> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), Math.max(1000, timeoutMs))
  try {
    const response = await fetch(assetUrl, { method: 'GET', signal: controller.signal })
    if (!response.ok) {
      throw new Error(`Asset download failed: ${response.status}`)
    }
    const blob = await response.blob()
    return { blob, type: response.headers.get('Content-Type') || blob.type || 'application/octet-stream' }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Asset download timeout')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function apiGetWorkspaceState(apiKey: string, baseUrl?: string) {
  return requestJson<ServerStateResponse>('/api/v1/state?full=1', {
    method: 'GET',
    headers: bearerHeaders(apiKey),
  }, baseUrl)
}

export async function apiUploadWorkspaceState(apiKey: string, payload: ServerStateUploadPayload, baseUrl?: string) {
  return requestJson<ServerStateUploadResponse>('/api/v1/state', {
    method: 'PUT',
    headers: bearerHeaders(apiKey),
    body: JSON.stringify(payload),
  }, baseUrl)
}

export async function apiUpdateCard(
  apiKey: string,
  cardId: string,
  updates: ServerCardUpdatePayload,
  baseUrl?: string,
) {
  return requestJson<ServerCardUpdateResponse>(`/api/v1/cards/${encodeURIComponent(cardId)}`, {
    method: 'PATCH',
    headers: bearerHeaders(apiKey),
    body: JSON.stringify(updates),
  }, baseUrl)
}

export async function apiDeleteCard(apiKey: string, cardId: string, baseUrl?: string) {
  return requestJson<ServerCardDeleteResponse>(`/api/v1/cards/${encodeURIComponent(cardId)}`, {
    method: 'DELETE',
    headers: bearerHeaders(apiKey),
  }, baseUrl)
}

export async function apiCheckHealth(baseUrl?: string, timeoutMs = 2500) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), Math.max(500, timeoutMs))
  try {
    const response = await fetch(`${resolveBaseUrl(baseUrl)}/health`, {
      method: 'GET',
      signal: controller.signal,
    })
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null
    if (!response.ok) {
      const message = typeof payload?.message === 'string' ? payload.message : `Health check failed: ${response.status}`
      throw new Error(message)
    }
    return (payload || {}) as ServerHealthResponse
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('API health check timeout')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function apiTriggerUpdate(accessToken: string, baseUrl?: string) {
  return requestJson<ServerUpdateResponse>('/api/v1/system/update', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  }, baseUrl)
}

export function createWorkspaceEventSource(apiKey: string, baseUrl?: string) {
  const url = new URL(`${resolveBaseUrl(baseUrl)}/api/v1/events/stream`)
  const trimmed = apiKey.trim()
  if (trimmed) url.searchParams.set('apiKey', trimmed)
  return new EventSource(url.toString())
}

export function getApiBaseUrl() {
  return API_BASE_URL
}
