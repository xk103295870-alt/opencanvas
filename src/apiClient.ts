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

export type ServerSkillResponse = {
  account: ServerAccount
  skill: {
    name: string
    description: string
    auth: { type: string; header: string; format: string }
    baseUrl: string
    defaultHeaders: Record<string, string>
    endpoints: Record<string, { method: string; path: string }>
    exampleCreateCard: { method: string; path: string; body: Record<string, unknown> }
  }
}

const API_BASE_URL = (import.meta.env.VITE_OPEN_CANVAS_API_BASE_URL as string | undefined)?.trim() || 'http://127.0.0.1:8787'

export type ServerHealthResponse = {
  ok?: boolean
  version?: string
  apiBaseUrl?: string
  webOrigin?: string
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

export async function apiCreateKey(accessToken: string, name = 'OpenClaw Skill Key', baseUrl?: string) {
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

export async function apiGetSkillTemplate(accessToken: string, baseUrl?: string) {
  return requestJson<ServerSkillResponse>('/api/v1/openclaw/skill', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
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

export function buildOpenClawSkillConfig(skillPayload: ServerSkillResponse, apiKey: string) {
  return {
    name: skillPayload.skill.name,
    description: skillPayload.skill.description,
    baseUrl: skillPayload.skill.baseUrl,
    auth: {
      type: 'bearer',
      token: apiKey,
      header: 'Authorization',
      format: 'Bearer {{token}}',
    },
    headers: skillPayload.skill.defaultHeaders,
    endpoints: skillPayload.skill.endpoints,
    examples: {
      createCard: skillPayload.skill.exampleCreateCard,
    },
  }
}

export function getApiBaseUrl() {
  return API_BASE_URL
}
