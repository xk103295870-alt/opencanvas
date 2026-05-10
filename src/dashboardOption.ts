export const DASHBOARD_OPTION_MAX_BYTES = 512 * 1024

export type DashboardOptionValidationResult =
  | { ok: true; option: Record<string, unknown> }
  | { ok: false; message: string; detail: string }

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (Object.prototype.toString.call(value) !== '[object Object]') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function isJsonCompatible(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null) return true
  const valueType = typeof value
  if (valueType === 'string' || valueType === 'boolean') return true
  if (valueType === 'number') return Number.isFinite(value)
  if (valueType === 'function' || valueType === 'symbol' || valueType === 'bigint' || valueType === 'undefined') return false
  if (Array.isArray(value)) {
    if (seen.has(value)) return false
    seen.add(value)
    return value.every((item) => isJsonCompatible(item, seen))
  }
  if (isPlainObject(value)) {
    if (seen.has(value)) return false
    seen.add(value)
    return Object.values(value).every((item) => isJsonCompatible(item, seen))
  }
  return false
}

export function validateDashboardOption(value: unknown): DashboardOptionValidationResult {
  if (!isPlainObject(value)) {
    return { ok: false, message: '图表配置无效', detail: 'option must be a plain object' }
  }

  if (!isJsonCompatible(value)) {
    return { ok: false, message: '图表配置无效', detail: 'option must be JSON-compatible' }
  }

  if ('series' in value && !Array.isArray(value.series)) {
    return { ok: false, message: '图表配置无效', detail: 'series must be an array when present' }
  }

  const serialized = JSON.stringify(value)
  const bytes = new TextEncoder().encode(serialized).byteLength
  if (bytes > DASHBOARD_OPTION_MAX_BYTES) {
    return {
      ok: false,
      message: '图表配置无效',
      detail: `option JSON must be smaller than ${DASHBOARD_OPTION_MAX_BYTES} bytes`,
    }
  }

  return { ok: true, option: value }
}
