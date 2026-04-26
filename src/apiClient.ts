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

export type ServerWorkspaceCard = {
  id: string
  kind: 'note' | 'hint' | 'image' | 'video' | 'pdf' | 'todo' | 'calendar'
  title: string
  content: string
  x: number
  y: number
  width: number
  height: number
  fileName?: string
  externalUrl?: string
  todoItems?: Array<{ id: string; text: string; status: 'todo' | 'doing' | 'done' }>
  calendar?: {
    monthCursor: string
    selectedDate: string
    viewMode: 'month' | 'week'
    draftTitle: string
    draftAllDay: boolean
    draftStartTime: string
    draftEndTime: string
    events: Array<{
      id: string
      date: string
      title: string
      allDay: boolean
      startTime?: string
      endTime?: string
    }>
  }
}

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

export type ServerAssetUploadResponse = {
  assetId: string
  assetUrl: string
  asset: ServerAssetRecord
}

export type ServerAssetDeleteResponse = {
  assetId: string
}

export type ServerCardCreatePayload = {
  id?: string
  kind?: ServerWorkspaceCard['kind']
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
  todoItems?: Array<string | { text?: string; done?: boolean; status?: 'todo' | 'doing' | 'done' }>
  calendar?: {
    monthCursor?: string
    selectedDate?: string
    viewMode?: 'month' | 'week'
    draftTitle?: string
    draftAllDay?: boolean
    draftStartTime?: string
    draftEndTime?: string
    events?: Array<{
      title?: string
      date?: string
      allDay?: boolean
      startTime?: string
      endTime?: string
    }>
  }
}

export type ServerCardUpdatePayload = Partial<
  Pick<
    ServerWorkspaceCard,
    'title' | 'content' | 'x' | 'y' | 'width' | 'height' | 'fileName' | 'externalUrl' | 'todoItems' | 'calendar'
  >
>

export type ServerStateResponse = {
  account: ServerAccount
  workspace: {
    id: string
    name: string
    activeGridId: string
    updatedAt: string
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

const API_BASE_URL = (import.meta.env.VITE_CANVAS_WORKBENCH_API_BASE_URL as string | undefined)?.trim() || 'http://127.0.0.1:8787'

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

export async function apiCreateCard(apiKey: string, payload: ServerCardCreatePayload, baseUrl?: string) {
  return requestJson<ServerCardCreateResponse>('/api/v1/cards', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
  }, baseUrl)
}

export async function apiCreateGrid(apiKey: string, payload: ServerGridCreatePayload, baseUrl?: string) {
  return requestJson<ServerGridCreateResponse>('/api/v1/grids', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
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
    headers: { Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(updates),
  }, baseUrl)
}

export async function apiDeleteGrid(apiKey: string, gridId: string, baseUrl?: string) {
  return requestJson<ServerGridDeleteResponse>(`/api/v1/grids/${encodeURIComponent(gridId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${apiKey}` },
  }, baseUrl)
}

export async function apiCreateAsset(apiKey: string, payload: ServerAssetUploadPayload, baseUrl?: string) {
  return requestJson<ServerAssetUploadResponse>('/api/v1/assets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
  }, baseUrl)
}

export async function apiDeleteAsset(apiKey: string, assetId: string, baseUrl?: string) {
  return requestJson<ServerAssetDeleteResponse>(`/api/v1/assets/${encodeURIComponent(assetId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${apiKey}` },
  }, baseUrl)
}

export async function apiGetWorkspaceState(apiKey: string, baseUrl?: string) {
  return requestJson<ServerStateResponse>('/api/v1/state?full=1', {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
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
    headers: { Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(updates),
  }, baseUrl)
}

export async function apiDeleteCard(apiKey: string, cardId: string, baseUrl?: string) {
  return requestJson<ServerCardDeleteResponse>(`/api/v1/cards/${encodeURIComponent(cardId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${apiKey}` },
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

export function getApiBaseUrl() {
  return API_BASE_URL
}
