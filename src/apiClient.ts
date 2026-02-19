export type ServerAccount = {
  id: string
  name: string
  email: string
  provider: 'demo' | 'google'
  avatarUrl?: string
}

export type ServerLoginResponse = {
  ok: boolean
  account: ServerAccount
  accessToken: string
  expiresAt: string
  apiBaseUrl: string
}

export type ServerApiKeyResponse = {
  ok: boolean
  apiKey: string
  key: {
    id: string
    name: string
    prefix: string
    scopes: string[]
    createdAt: string
  }
}

export type ServerSkillResponse = {
  ok: boolean
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

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  const payload = (await response.json().catch(() => null)) as { message?: string } | null
  if (!response.ok) {
    throw new Error(payload?.message || `Request failed: ${response.status}`)
  }
  return payload as T
}

export async function apiDemoLogin(input: {
  name: string
  email: string
  provider: 'demo' | 'google'
  avatarUrl?: string
}) {
  return requestJson<ServerLoginResponse>('/v1/auth/demo-login', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function apiCreateKey(accessToken: string, name = 'OpenClaw Skill Key') {
  return requestJson<ServerApiKeyResponse>('/v1/auth/api-keys', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ name, scopes: ['canvas:read', 'canvas:write'] }),
  })
}

export async function apiGetSkillTemplate(accessToken: string) {
  return requestJson<ServerSkillResponse>('/v1/openclaw/skill', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
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
