import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent as ReactDragEvent, FormEvent, PointerEvent as ReactPointerEvent, WheelEvent } from 'react'
import './App.css'
import {
  apiCheckHealth,
  apiCreateKey,
  apiDemoLogin,
  apiGetSessionMe,
  apiGetSkillTemplate,
  buildOpenClawSkillConfig,
  getApiBaseUrl,
} from './apiClient'

type LanguageCode = 'zh' | 'en'
type ThemeMode = 'system' | 'light' | 'dark'
type SyncStatus = 'idle' | 'syncing' | 'ok' | 'error'
type ApiHealthState = 'idle' | 'checking' | 'online' | 'offline'
type CardKind = 'note' | 'hint' | 'image' | 'video' | 'pdf' | 'todo' | 'calendar'
type CalendarViewMode = 'month' | 'week'
type TodoLane = 'todo' | 'doing' | 'done'

type TodoItem = {
  id: string
  text: string
  status: TodoLane
}

type CalendarEvent = {
  id: string
  date: string
  title: string
  allDay: boolean
  startTime?: string
  endTime?: string
}

type CalendarState = {
  monthCursor: string
  selectedDate: string
  viewMode: CalendarViewMode
  draftTitle: string
  draftAllDay: boolean
  draftStartTime: string
  draftEndTime: string
  events: CalendarEvent[]
}

type CardData = {
  id: string
  kind: CardKind
  title: string
  content: string
  x: number
  y: number
  width: number
  height: number
  fileId?: string
  fileName?: string
  externalUrl?: string
  todoItems?: TodoItem[]
  calendar?: CalendarState
}

type GridData = {
  id: string
  name: string
  cards: CardData[]
}

type ViewportState = {
  x: number
  y: number
  zoom: number
}

type DragState = {
  gridId: string
  cardId: string
  pointerOffsetX: number
  pointerOffsetY: number
} | null

type PanState = {
  startClientX: number
  startClientY: number
  startX: number
  startY: number
} | null

type ResizeState = {
  gridId: string
  cardId: string
  startWidth: number
  startHeight: number
  startPointerWorldX: number
  startPointerWorldY: number
} | null

type CalendarDragState = {
  cardId: string
  eventId: string
} | null

type TodoDragState = {
  cardId: string
  itemId: string
} | null

type StoredAsset = {
  id: string
  blob: Blob
  name: string
  type: string
  createdAt: number
}

type PersistedAppState = {
  version: number
  grids: GridData[]
  activeGridId: string
  viewport: ViewportState
}

type AppSettings = {
  language: LanguageCode
  themeMode: ThemeMode
  autoSync: boolean
  syncOnStartup: boolean
  syncDebounceMs: number
}

type AccountProvider = 'demo' | 'google'

type AccountUser = {
  id: string
  name: string
  email: string
  provider: AccountProvider
  avatarUrl?: string
}

type OpenClawConfig = {
  gatewayUrl: string
  gatewayPort: string
  gatewayToken: string
  sessionKey: string
  sessionKeys: string
  source: string
  googleClientId: string
}

type ServerAuthState = {
  accessToken: string
  expiresAt: string
  apiBaseUrl: string
  accountId: string
  lastApiKey?: string
  lastApiKeyId?: string
}

type SyncMeta = {
  lastLocalUpdateAt: number
  lastSyncAt: number | null
}

type CloudAssetSnapshot = {
  id: string
  name: string
  type: string
  createdAt: number
  dataUrl: string
}

type CloudSnapshot = {
  version: number
  userId: string
  savedAt: number
  state: PersistedAppState
  assets: CloudAssetSnapshot[]
}

type CalendarDayCell = {
  dateKey: string
  inMonth: boolean
}

type I18nText = {
  settings: string
  syncTitle: string
  ready: string
  syncing: string
  synced: string
  syncError: string
  syncNeedLogin: string
  syncPleaseSignIn: string
  syncingWorkspace: string
  syncCloudCreated: string
  syncPulledPrefix: string
  syncPushedPrefix: string
  syncFailedPrefix: string
  syncNow: string
  lastSyncPrefix: string
  lastSyncNever: string
  accountPrefix: string
  accountSignedOutHint: string
  newNoteCard: string
  newTodoCard: string
  newCalendarCard: string
  newGridAria: string
  grids: string
  reset: string
  resizeCardAria: string
  removeCardAria: string
  notePlaceholder: string
  mediaImageUnavailable: string
  mediaVideoUnavailable: string
  mediaPdfUnavailable: string
  hintItems: string[]
  dropFilesLabel: string
  accountTitle: string
  loginDisplayNamePlaceholder: string
  loginEmailPlaceholder: string
  signIn: string
  cancel: string
  demoLoginLabel: string
  fakeLogin: string
  fakeLoginSuccess: string
  googleQuickSignIn: string
  googleSigningIn: string
  googleLoginSuccess: string
  googleLoginFailedPrefix: string
  googleClientIdLabel: string
  googleClientIdHint: string
  googleClientIdRequired: string
  signedOut: string
  logout: string
  loginHintInSettings: string
  providerPrefix: string
  providerDemo: string
  providerGoogle: string
  languageTitle: string
  languageHint: string
  languageZh: string
  languageEn: string
  themeTitle: string
  themeHint: string
  themeSystem: string
  themeLight: string
  themeDark: string
  unnamedGrid: string
  unnamedCard: string
  demoUser: string
  gridPrefix: string
  syncSettingsTitle: string
  autoSyncLabel: string
  syncOnStartupLabel: string
  syncDebounceLabel: string
  openclawTitle: string
  openclawHint: string
  openclawGatewayUrl: string
  openclawGatewayPort: string
  openclawGatewayToken: string
  openclawSessionKey: string
  openclawSessionKeys: string
  openclawSource: string
  openclawSave: string
  openclawSaved: string
  openclawCopyConfig: string
  openclawConfigCopied: string
  openclawConfigCopyFailed: string
  futureTitle: string
  futureLine1: string
  futureLine2: string
}

type TodoI18n = {
  newCardButton: string
  title: string
  placeholder: string
  addButton: string
  emptyHint: string
  removeItemAria: string
  laneTodo: string
  laneDoing: string
  laneDone: string
  laneAddCard: string
  defaultItems: string[]
}

type CalendarI18n = {
  newCardButton: string
  title: string
  placeholder: string
  addButton: string
  emptyHint: string
  selectedPrefix: string
  weekdays: string[]
  viewMonth: string
  viewWeek: string
  prevMonthAria: string
  nextMonthAria: string
  allDay: string
  startTime: string
  endTime: string
  invalidTimeHint: string
  dragHint: string
}

type ParticleRuntime = {
  energy: number
  originX: number
  originY: number
  shiftX: number
  shiftY: number
  dotAlpha: number
  bloomAlpha: number
  bloomRadius: number
}

type ExternalTodoInput = string | { text: string; done?: boolean; status?: TodoLane }

type ExternalCalendarEventInput = {
  title: string
  date?: string
  allDay?: boolean
  startTime?: string
  endTime?: string
}

type ExternalCalendarInput = Partial<Omit<CalendarState, 'events'>> & {
  events?: ExternalCalendarEventInput[]
}

type OpenCanvasCreateCardPayload = {
  kind?: CardKind | string
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
  todoItems?: ExternalTodoInput[]
  calendar?: ExternalCalendarInput
}

type OpenCanvasSetConfigPayload = Partial<OpenClawConfig>

type OpenCanvasCommand =
  | {
      type: 'ping'
      requestId?: string
    }
  | {
      type: 'create-grid'
      requestId?: string
      payload?: { name?: string; activate?: boolean }
    }
  | {
      type: 'create-card'
      requestId?: string
      payload?: OpenCanvasCreateCardPayload
    }
  | {
      type: 'update-card'
      requestId?: string
      payload?: {
        cardId: string
        title?: string
        content?: string
        x?: number
        y?: number
        width?: number
        height?: number
      }
    }
  | {
      type: 'append-note'
      requestId?: string
      payload?: { cardId: string; text: string }
    }
  | {
      type: 'get-state'
      requestId?: string
    }
  | {
      type: 'get-config'
      requestId?: string
    }
  | {
      type: 'set-config'
      requestId?: string
      payload?: OpenCanvasSetConfigPayload
    }

type OpenCanvasCommandResult = {
  ok: boolean
  requestId?: string
  message?: string
  data?: unknown
}

type OpenCanvasPostMessageEnvelope = {
  source?: string
  type: 'open-canvas.command'
  command: OpenCanvasCommand
}

type OpenCanvasPostMessageResult = {
  source: 'open-canvas'
  type: 'open-canvas.result'
  result: OpenCanvasCommandResult
}

type OpenCanvasGlobalApi = {
  invoke: (command: OpenCanvasCommand) => Promise<OpenCanvasCommandResult>
  createGrid: (payload?: { name?: string; activate?: boolean; requestId?: string }) => Promise<OpenCanvasCommandResult>
  createCard: (payload?: OpenCanvasCreateCardPayload & { requestId?: string }) => Promise<OpenCanvasCommandResult>
  updateCard: (payload: {
    cardId: string
    title?: string
    content?: string
    x?: number
    y?: number
    width?: number
    height?: number
    requestId?: string
  }) => Promise<OpenCanvasCommandResult>
  getState: (requestId?: string) => Promise<OpenCanvasCommandResult>
  getConfig: (requestId?: string) => Promise<OpenCanvasCommandResult>
  setConfig: (payload?: OpenCanvasSetConfigPayload & { requestId?: string }) => Promise<OpenCanvasCommandResult>
}

type GoogleTokenResponse = {
  access_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

type GoogleTokenClient = {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void
}

type GoogleIdentity = {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string
        scope: string
        callback: (response: GoogleTokenResponse) => void
      }) => GoogleTokenClient
    }
  }
}

declare global {
  interface Window {
    openCanvas?: OpenCanvasGlobalApi
    google?: GoogleIdentity
  }
}

const DB_NAME = 'open-canvas-db'
const DB_VERSION = 1
const STORE_APP = 'app_state'
const STORE_ASSETS = 'assets'
const APP_STATE_KEY = 'main'
const AUTH_STORAGE_KEY = 'open-canvas-fake-auth'
const SETTINGS_STORAGE_KEY = 'open-canvas-settings'
const OPENCLAW_SETTINGS_KEY = 'open-canvas-openclaw-settings'
const SYNC_META_KEY = 'open-canvas-sync-meta'
const SERVER_AUTH_STORAGE_KEY = 'open-canvas-server-auth'
const CLOUD_KEY_PREFIX = 'open-canvas-cloud-'
const GOOGLE_IDENTITY_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

const SCENE_WIDTH = 6000
const SCENE_HEIGHT = 4000
const ZOOM_MIN = 0.45
const ZOOM_MAX = 2.4
const CARD_MIN_WIDTH = 220
const CARD_MIN_HEIGHT = 160
const CARD_MAX_WIDTH = 1400
const CARD_MAX_HEIGHT = 1200

const DEFAULT_SETTINGS: AppSettings = {
  language: 'zh',
  themeMode: 'system',
  autoSync: true,
  syncOnStartup: true,
  syncDebounceMs: 2400,
}

const DEFAULT_OPENCLAW_CONFIG: OpenClawConfig = {
  gatewayUrl: 'ws://localhost:18789',
  gatewayPort: '18789',
  gatewayToken: '',
  sessionKey: '',
  sessionKeys: '',
  source: 'openclaw',
  googleClientId: '',
}

const DEFAULT_SYNC_META: SyncMeta = {
  lastLocalUpdateAt: Date.now(),
  lastSyncAt: null,
}

const I18N: Record<LanguageCode, I18nText> = {
  zh: {
    settings: '设置',
    syncTitle: '同步',
    ready: '就绪',
    syncing: '同步中...',
    synced: '已同步',
    syncError: '同步失败',
    syncNeedLogin: '登录后可启用云同步。',
    syncPleaseSignIn: '请先在设置中登录。',
    syncingWorkspace: '正在同步当前画布...',
    syncCloudCreated: '已创建云端副本。',
    syncPulledPrefix: '已拉取云端版本（',
    syncPushedPrefix: '已推送本地更新（',
    syncFailedPrefix: '同步失败：',
    syncNow: '立即同步',
    lastSyncPrefix: '上次同步：',
    lastSyncNever: '上次同步：从未',
    accountPrefix: '账号',
    accountSignedOutHint: '账号：未登录（请在设置中登录）',
    newNoteCard: '+ 新建笔记卡',
    newTodoCard: '+ 待办卡片',
    newCalendarCard: '+ 日历卡片',
    newGridAria: '新建画布',
    grids: '画布',
    reset: '重置',
    resizeCardAria: '缩放卡片',
    removeCardAria: '删除卡片',
    notePlaceholder: '可用 Markdown 书写...',
    mediaImageUnavailable: '图片不可用',
    mediaVideoUnavailable: '视频不可用',
    mediaPdfUnavailable: 'PDF 不可用',
    hintItems: ['Markdown', '链接', '图片', '视频', 'PDF', '代码', '任务', '表格'],
    dropFilesLabel: '拖放文件以创建卡片',
    accountTitle: '账号',
    loginDisplayNamePlaceholder: '显示名称',
    loginEmailPlaceholder: '邮箱（可选）',
    signIn: '登录',
    cancel: '取消',
    demoLoginLabel: '演示登录',
    fakeLogin: '模拟登录',
    fakeLoginSuccess: '模拟登录成功。',
    googleQuickSignIn: 'Google 快捷登录',
    googleSigningIn: 'Google 登录中...',
    googleLoginSuccess: 'Google 登录成功。',
    googleLoginFailedPrefix: 'Google 登录失败：',
    googleClientIdLabel: 'Google Client ID',
    googleClientIdHint: '用于 Google 快捷登录（OAuth）。',
    googleClientIdRequired: '请先在设置中填写 Google Client ID。',
    signedOut: '已退出登录。',
    logout: '退出登录',
    loginHintInSettings: '登录入口在设置中，后续会替换为真实登录。',
    providerPrefix: '登录方式',
    providerDemo: '演示账号',
    providerGoogle: 'Google',
    languageTitle: '语言',
    languageHint: '当前支持中英文切换',
    languageZh: '中文',
    languageEn: 'English',
    themeTitle: '主题',
    themeHint: '可跟随系统，也可手动切换浅色或深色',
    themeSystem: '跟随系统',
    themeLight: '浅色',
    themeDark: '深色',
    unnamedGrid: '未命名画布',
    unnamedCard: '未命名卡片',
    demoUser: '演示用户',
    gridPrefix: '画布',
    syncSettingsTitle: '同步策略',
    autoSyncLabel: '自动同步（本地改动后自动执行）',
    syncOnStartupLabel: '启动后自动检查云端版本',
    syncDebounceLabel: '自动同步延迟（毫秒）',
    openclawTitle: 'OpenClaw 集成',
    openclawHint: '在这里配置网关与会话参数，供 OpenClaw 调用。',
    openclawGatewayUrl: '网关 URL',
    openclawGatewayPort: '网关端口',
    openclawGatewayToken: '网关 Token',
    openclawSessionKey: 'Session Key',
    openclawSessionKeys: 'Session Keys（逗号分隔）',
    openclawSource: '消息源标识',
    openclawSave: '保存配置',
    openclawSaved: '配置已保存。',
    openclawCopyConfig: '复制 JSON',
    openclawConfigCopied: '已复制 OpenClaw 配置。',
    openclawConfigCopyFailed: '复制配置失败。',
    futureTitle: '未来扩展',
    futureLine1: '登录、同步、安装器会逐步替换为真实服务。',
    futureLine2: '当前结构已支持 Web + 桌面 + 多平台扩展。',
  },
  en: {
    settings: 'Settings',
    syncTitle: 'SYNC',
    ready: 'Ready',
    syncing: 'Syncing...',
    synced: 'Synced',
    syncError: 'Sync failed',
    syncNeedLogin: 'Sign in to enable cloud sync.',
    syncPleaseSignIn: 'Please sign in from Settings first.',
    syncingWorkspace: 'Syncing workspace...',
    syncCloudCreated: 'Cloud snapshot created.',
    syncPulledPrefix: 'Pulled cloud snapshot (',
    syncPushedPrefix: 'Pushed local snapshot (',
    syncFailedPrefix: 'Sync failed: ',
    syncNow: 'Sync now',
    lastSyncPrefix: 'Last sync: ',
    lastSyncNever: 'Last sync: never',
    accountPrefix: 'Account',
    accountSignedOutHint: 'Account: not signed in (use Settings)',
    newNoteCard: '+ New note card',
    newTodoCard: '+ New todo card',
    newCalendarCard: '+ New calendar card',
    newGridAria: 'New grid',
    grids: 'GRIDS',
    reset: 'Reset',
    resizeCardAria: 'Resize card',
    removeCardAria: 'Remove card',
    notePlaceholder: 'Write with markdown...',
    mediaImageUnavailable: 'Image unavailable',
    mediaVideoUnavailable: 'Video unavailable',
    mediaPdfUnavailable: 'PDF unavailable',
    hintItems: ['Markdown', 'Links', 'Images', 'Videos', 'PDFs', 'Code', 'Tasks', 'Tables'],
    dropFilesLabel: 'Drop files to create cards',
    accountTitle: 'Account',
    loginDisplayNamePlaceholder: 'Display name',
    loginEmailPlaceholder: 'Email (optional)',
    signIn: 'Sign in',
    cancel: 'Cancel',
    demoLoginLabel: 'Demo login',
    fakeLogin: 'Fake login',
    fakeLoginSuccess: 'Fake login successful.',
    googleQuickSignIn: 'Google quick sign-in',
    googleSigningIn: 'Signing in with Google...',
    googleLoginSuccess: 'Signed in with Google.',
    googleLoginFailedPrefix: 'Google sign-in failed: ',
    googleClientIdLabel: 'Google Client ID',
    googleClientIdHint: 'Used for Google OAuth quick sign-in.',
    googleClientIdRequired: 'Please configure Google Client ID in Settings first.',
    signedOut: 'Signed out.',
    logout: 'Log out',
    loginHintInSettings: 'Login entry is in Settings. Real auth will replace this later.',
    providerPrefix: 'Provider',
    providerDemo: 'Demo account',
    providerGoogle: 'Google',
    languageTitle: 'Language',
    languageHint: 'Currently supports Chinese and English',
    languageZh: '中文',
    languageEn: 'English',
    themeTitle: 'Theme',
    themeHint: 'Follow system or switch manually between light and dark',
    themeSystem: 'System',
    themeLight: 'Light',
    themeDark: 'Dark',
    unnamedGrid: 'Untitled Grid',
    unnamedCard: 'Untitled Card',
    demoUser: 'Demo User',
    gridPrefix: 'Grid',
    syncSettingsTitle: 'Sync Strategy',
    autoSyncLabel: 'Auto sync (after local changes)',
    syncOnStartupLabel: 'Check cloud snapshot on startup',
    syncDebounceLabel: 'Auto sync debounce (ms)',
    openclawTitle: 'OpenClaw Integration',
    openclawHint: 'Configure gateway and session parameters for OpenClaw calls.',
    openclawGatewayUrl: 'Gateway URL',
    openclawGatewayPort: 'Gateway Port',
    openclawGatewayToken: 'Gateway Token',
    openclawSessionKey: 'Session Key',
    openclawSessionKeys: 'Session Keys (comma separated)',
    openclawSource: 'Message Source',
    openclawSave: 'Save config',
    openclawSaved: 'Config saved.',
    openclawCopyConfig: 'Copy JSON',
    openclawConfigCopied: 'OpenClaw config copied.',
    openclawConfigCopyFailed: 'Failed to copy config.',
    futureTitle: 'Future Extension',
    futureLine1: 'Auth, sync and installers will be replaced with real services.',
    futureLine2: 'Current architecture already supports Web + Desktop + multi-platform.',
  },
}

const TODO_I18N: Record<LanguageCode, TodoI18n> = {
  zh: {
    newCardButton: '+ 待办卡片',
    title: '待办事项',
    placeholder: '输入任务后按回车添加',
    addButton: '添加',
    emptyHint: '暂无任务，输入后按回车添加。',
    removeItemAria: '删除事项',
    laneTodo: '待办',
    laneDoing: '进行中',
    laneDone: '已完成',
    laneAddCard: '新增卡片',
    defaultItems: ['整理想法', '安排下一步'],
  },
  en: {
    newCardButton: '+ New todo card',
    title: 'Todo',
    placeholder: 'Type a task and press Enter',
    addButton: 'Add',
    emptyHint: 'No tasks yet. Type above and press Enter.',
    removeItemAria: 'Remove item',
    laneTodo: 'To-do',
    laneDoing: 'Doing',
    laneDone: 'Done',
    laneAddCard: 'Add card',
    defaultItems: ['Organize ideas', 'Plan next step'],
  },
}

const CALENDAR_I18N: Record<LanguageCode, CalendarI18n> = {
  zh: {
    newCardButton: '+ 日历卡片',
    title: '日历',
    placeholder: '输入日程标题',
    addButton: '添加',
    emptyHint: '当日暂无日程。',
    selectedPrefix: '选中日期：',
    weekdays: ['日', '一', '二', '三', '四', '五', '六'],
    viewMonth: '月',
    viewWeek: '周',
    prevMonthAria: '上一页',
    nextMonthAria: '下一页',
    allDay: '全天',
    startTime: '开始',
    endTime: '结束',
    invalidTimeHint: '时间段无效：结束时间必须晚于开始时间。',
    dragHint: '拖拽到日期格子改期',
  },
  en: {
    newCardButton: '+ New calendar card',
    title: 'Calendar',
    placeholder: 'Schedule title',
    addButton: 'Add',
    emptyHint: 'No events for this day.',
    selectedPrefix: 'Selected: ',
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    viewMonth: 'Month',
    viewWeek: 'Week',
    prevMonthAria: 'Previous period',
    nextMonthAria: 'Next period',
    allDay: 'All day',
    startTime: 'Start',
    endTime: 'End',
    invalidTimeHint: 'Invalid range: end time must be after start time.',
    dragHint: 'Drag onto day cell to reschedule',
  },
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const pad2 = (value: number) => String(value).padStart(2, '0')
const toDateKey = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
const toMonthKey = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-01`

const parseDateKey = (value: string): Date => {
  const [yearRaw, monthRaw, dayRaw] = value.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return new Date()
  return new Date(year, month - 1, day)
}

const shiftDateKey = (dateKey: string, deltaDays: number) => {
  const date = parseDateKey(dateKey)
  date.setDate(date.getDate() + deltaDays)
  return toDateKey(date)
}

const shiftMonthKey = (monthKey: string, delta: number) => {
  const date = parseDateKey(monthKey)
  date.setDate(1)
  date.setMonth(date.getMonth() + delta)
  return toMonthKey(date)
}

const isValidTimeValue = (value: string) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(value)

const normalizeTimeRange = (start: string, end: string): [string, string] | null => {
  if (!isValidTimeValue(start) || !isValidTimeValue(end)) return null
  if (start >= end) return null
  return [start, end]
}

const formatLocalDateTime = (timestamp: number, language: LanguageCode) =>
  new Date(timestamp).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US')

const getWeekStart = (date: Date) => {
  const output = new Date(date)
  output.setDate(date.getDate() - date.getDay())
  output.setHours(0, 0, 0, 0)
  return output
}

const buildMonthCells = (monthCursor: string): CalendarDayCell[] => {
  const cursor = parseDateKey(monthCursor)
  cursor.setDate(1)
  const firstDay = cursor.getDay()
  const start = new Date(cursor)
  start.setDate(cursor.getDate() - firstDay)

  const cells: CalendarDayCell[] = []
  for (let index = 0; index < 42; index += 1) {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    cells.push({
      dateKey: toDateKey(day),
      inMonth: day.getMonth() === cursor.getMonth(),
    })
  }
  return cells
}

const buildWeekCells = (selectedDate: string): CalendarDayCell[] => {
  const selected = parseDateKey(selectedDate)
  const weekStart = getWeekStart(selected)
  const monthOfSelected = selected.getMonth()

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart)
    day.setDate(weekStart.getDate() + index)
    return {
      dateKey: toDateKey(day),
      inMonth: day.getMonth() === monthOfSelected,
    }
  })
}

const formatMonthLabel = (monthCursor: string, language: LanguageCode) => {
  const date = parseDateKey(monthCursor)
  return date.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'long',
  })
}

const formatWeekLabel = (selectedDate: string, language: LanguageCode) => {
  const selected = parseDateKey(selectedDate)
  const start = getWeekStart(selected)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)

  const locale = language === 'zh' ? 'zh-CN' : 'en-US'
  const startLabel = start.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
  const endLabel = end.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
  return `${startLabel} - ${endLabel}`
}

const formatCalendarEventTime = (eventItem: CalendarEvent, language: LanguageCode) => {
  if (eventItem.allDay) return language === 'zh' ? '全天' : 'All day'
  if (eventItem.startTime && eventItem.endTime) return `${eventItem.startTime}-${eventItem.endTime}`
  return language === 'zh' ? '未设时间' : 'No time'
}

const TODO_LANES: TodoLane[] = ['todo', 'doing', 'done']

const normalizeTodoLane = (value: unknown, doneFallback = false): TodoLane => {
  const lane = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (lane === 'todo' || lane === 'doing' || lane === 'done') return lane
  return doneFallback ? 'done' : 'todo'
}

const createTodoItem = (text: string, status: TodoLane = 'todo'): TodoItem => ({
  id: uid('todo-item'),
  text,
  status,
})

const normalizeTodoItemsForCard = (items: TodoItem[] | undefined): TodoItem[] => {
  if (!Array.isArray(items)) return []
  return items
    .map((item) => {
      const text = String(item?.text ?? '').trim()
      if (!text) return null
      const rawDone = item && typeof item === 'object' && 'done' in item ? Boolean((item as { done?: boolean }).done) : false
      return {
        id: String(item?.id || uid('todo-item')),
        text,
        status: normalizeTodoLane(item?.status, rawDone),
      } satisfies TodoItem
    })
    .filter((item): item is TodoItem => Boolean(item))
}

const normalizeGridsForTodoBoard = (input: GridData[]): GridData[] => {
  if (!Array.isArray(input)) return []
  return input.map((grid) => ({
    ...grid,
    cards: grid.cards.map((card) =>
      card.kind === 'todo'
        ? {
            ...card,
            todoItems: normalizeTodoItemsForCard(card.todoItems),
          }
        : card,
    ),
  }))
}

const createDefaultCalendarState = (): CalendarState => {
  const today = toDateKey(new Date())
  return {
    monthCursor: toMonthKey(new Date()),
    selectedDate: today,
    viewMode: 'month',
    draftTitle: '',
    draftAllDay: true,
    draftStartTime: '09:00',
    draftEndTime: '10:00',
    events: [],
  }
}

const withCalendarDefaults = (calendar?: CalendarState): CalendarState => {
  const fallback = createDefaultCalendarState()
  if (!calendar) return fallback

  return {
    monthCursor: calendar.monthCursor || fallback.monthCursor,
    selectedDate: calendar.selectedDate || fallback.selectedDate,
    viewMode: calendar.viewMode === 'week' ? 'week' : 'month',
    draftTitle: calendar.draftTitle ?? '',
    draftAllDay: calendar.draftAllDay ?? true,
    draftStartTime: calendar.draftStartTime || fallback.draftStartTime,
    draftEndTime: calendar.draftEndTime || fallback.draftEndTime,
    events: (calendar.events ?? []).map((eventItem) => ({
      ...eventItem,
      allDay: eventItem.allDay ?? true,
    })),
  }
}

const initialViewport: ViewportState = { x: 0, y: 0, zoom: 1 }

const initialGrids: GridData[] = [
  {
    id: 'grid-a',
    name: 'Grid A',
    cards: [
      {
        id: 'note-1',
        kind: 'note',
        title: 'Quick note',
        content: 'Type something...',
        x: 72,
        y: 54,
        width: 380,
        height: 320,
      },
      {
        id: 'hint-1',
        kind: 'hint',
        title: 'Drag and drop any file',
        content: '',
        x: 470,
        y: 54,
        width: 300,
        height: 420,
      },
    ],
  },
]

const mediaCardKindFromFile = (file: File): Extract<CardKind, 'image' | 'video' | 'pdf'> | null => {
  const lowerName = file.name.toLowerCase()
  if (file.type.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp|svg|avif)$/.test(lowerName)) return 'image'
  if (file.type.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi|m4v)$/.test(lowerName)) return 'video'
  if (file.type === 'application/pdf' || lowerName.endsWith('.pdf')) return 'pdf'
  return null
}

const isFileDrag = (dataTransfer: DataTransfer | null | undefined) => {
  if (!dataTransfer) return false
  if (dataTransfer.files && dataTransfer.files.length > 0) return true

  if (dataTransfer.items && dataTransfer.items.length > 0) {
    return Array.from(dataTransfer.items).some((item) => item.kind === 'file')
  }

  return Array.from(dataTransfer.types ?? []).some((type) => type.toLowerCase() === 'files')
}

const mediaCardPreset = (
  kind: Extract<CardKind, 'image' | 'video' | 'pdf'>,
  fileName: string,
  text: I18nText,
): Pick<CardData, 'title' | 'width' | 'height'> => {
  if (kind === 'image') return { title: fileName || text.mediaImageUnavailable, width: 360, height: 280 }
  if (kind === 'video') return { title: fileName || text.mediaVideoUnavailable, width: 420, height: 300 }
  return { title: fileName || text.mediaPdfUnavailable, width: 460, height: 360 }
}

const readJson = <T,>(key: string): T | null => {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

const writeJson = <T,>(key: string, value: T) => {
  window.localStorage.setItem(key, JSON.stringify(value))
}

const maskSecret = (value: string, visible = 18) => (value.length > visible ? `${value.slice(0, visible)}...` : value)

const trimConfigValue = (value: unknown, maxLength = 260) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : ''

const normalizeThemeMode = (value: unknown): ThemeMode => {
  const mode = String(value || '')
    .trim()
    .toLowerCase()
  if (mode === 'light') return 'light'
  if (mode === 'dark') return 'dark'
  return 'system'
}

const normalizeSettings = (input: Partial<AppSettings> | null | undefined): AppSettings => {
  const language = input?.language === 'en' ? 'en' : 'zh'
  const themeMode = normalizeThemeMode(input?.themeMode)
  const autoSync = typeof input?.autoSync === 'boolean' ? input.autoSync : DEFAULT_SETTINGS.autoSync
  const syncOnStartup = typeof input?.syncOnStartup === 'boolean' ? input.syncOnStartup : DEFAULT_SETTINGS.syncOnStartup
  const syncDebounceMsRaw = Number(input?.syncDebounceMs)
  const syncDebounceMs = Number.isFinite(syncDebounceMsRaw)
    ? Math.max(500, Math.min(12_000, Math.round(syncDebounceMsRaw)))
    : DEFAULT_SETTINGS.syncDebounceMs

  return {
    language,
    themeMode,
    autoSync,
    syncOnStartup,
    syncDebounceMs,
  }
}

const normalizeOpenClawConfig = (input: Partial<OpenClawConfig> | null | undefined): OpenClawConfig => {
  const gatewayUrl = trimConfigValue(input?.gatewayUrl || DEFAULT_OPENCLAW_CONFIG.gatewayUrl, 280)
  const gatewayPort = trimConfigValue(input?.gatewayPort || DEFAULT_OPENCLAW_CONFIG.gatewayPort, 12)
  const gatewayToken = trimConfigValue(input?.gatewayToken, 512)
  const sessionKey = trimConfigValue(input?.sessionKey, 256)
  const sessionKeys = trimConfigValue(input?.sessionKeys, 1024)
  const source = trimConfigValue(input?.source || DEFAULT_OPENCLAW_CONFIG.source, 64)
  const googleClientId = trimConfigValue(input?.googleClientId, 240)

  return {
    gatewayUrl: gatewayUrl || DEFAULT_OPENCLAW_CONFIG.gatewayUrl,
    gatewayPort: gatewayPort || DEFAULT_OPENCLAW_CONFIG.gatewayPort,
    gatewayToken,
    sessionKey,
    sessionKeys,
    source: source || DEFAULT_OPENCLAW_CONFIG.source,
    googleClientId,
  }
}

const normalizeAccount = (raw: unknown): AccountUser | null => {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Partial<AccountUser>
  const id = trimConfigValue(value.id, 140)
  const name = trimConfigValue(value.name, 120)
  const email = trimConfigValue(value.email, 180).toLowerCase()
  if (!id || !name || !email) return null

  return {
    id,
    name,
    email,
    provider: value.provider === 'google' ? 'google' : 'demo',
    avatarUrl: trimConfigValue(value.avatarUrl, 500) || undefined,
  }
}

const normalizeServerAuth = (raw: unknown): ServerAuthState | null => {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Partial<ServerAuthState>
  const accessToken = trimConfigValue(value.accessToken, 1024)
  const expiresAt = trimConfigValue(value.expiresAt, 120)
  const apiBaseUrl = trimConfigValue(value.apiBaseUrl, 320) || getApiBaseUrl()
  const accountId = trimConfigValue(value.accountId, 140)
  if (!accessToken || !expiresAt || !accountId) return null

  return {
    accessToken,
    expiresAt,
    apiBaseUrl,
    accountId,
    lastApiKey: trimConfigValue(value.lastApiKey, 1024) || undefined,
    lastApiKeyId: trimConfigValue(value.lastApiKeyId, 120) || undefined,
  }
}

let googleIdentityPromise: Promise<GoogleIdentity> | null = null

const loadGoogleIdentityApi = (): Promise<GoogleIdentity> => {
  const existingGoogle = window.google
  if (existingGoogle?.accounts?.oauth2) return Promise.resolve(existingGoogle)
  if (googleIdentityPromise) return googleIdentityPromise

  const pending = new Promise<GoogleIdentity>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_IDENTITY_SCRIPT_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.google?.accounts?.oauth2) resolve(window.google)
        else reject(new Error('Google Identity API is unavailable'))
      })
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity API')))
      return
    }

    const script = document.createElement('script')
    script.src = GOOGLE_IDENTITY_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => {
      if (window.google?.accounts?.oauth2) {
        resolve(window.google)
        return
      }
      reject(new Error('Google Identity API is unavailable'))
    }
    script.onerror = () => reject(new Error('Failed to load Google Identity API'))
    document.head.appendChild(script)
  }).catch((error) => {
    googleIdentityPromise = null
    throw error
  })

  googleIdentityPromise = pending
  return pending
}

const requestGoogleToken = (google: GoogleIdentity, clientId: string) =>
  new Promise<GoogleTokenResponse>((resolve, reject) => {
    try {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'openid email profile',
        callback: (response) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error))
            return
          }
          resolve(response)
        },
      })

      tokenClient.requestAccessToken({ prompt: 'select_account' })
    } catch (error) {
      reject(error)
    }
  })

type GoogleProfile = {
  sub?: string
  name?: string
  email?: string
  picture?: string
}

const fetchGoogleProfile = async (accessToken: string) => {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Google profile request failed (${response.status})`)
  }

  return (await response.json()) as GoogleProfile
}

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }
      reject(new Error('Failed to serialize blob'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'))
    reader.readAsDataURL(blob)
  })

const dataUrlToBlob = async (dataUrl: string) => {
  const response = await fetch(dataUrl)
  return response.blob()
}

const cloudKey = (userId: string) => `${CLOUD_KEY_PREFIX}${userId}`

const CARD_KIND_SET = new Set<CardKind>(['note', 'hint', 'image', 'video', 'pdf', 'todo', 'calendar'])

const normalizeCardKind = (value: unknown): CardKind => {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return CARD_KIND_SET.has(raw as CardKind) ? (raw as CardKind) : 'note'
}

const toFiniteNumber = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const toDateKeyOrFallback = (value: string | undefined, fallback: string) =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : fallback

const toTodoItems = (input: ExternalTodoInput[] | undefined) =>
  Array.isArray(input)
    ? input
        .map((item) => {
          if (typeof item === 'string') {
            const text = item.trim()
            return text ? createTodoItem(text) : null
          }

          const text = String(item?.text ?? '').trim()
          if (!text) return null
          const doneFallback = item?.done === true
          return {
            id: uid('todo-item'),
            text,
            status: normalizeTodoLane(item?.status, doneFallback),
          } satisfies TodoItem
        })
        .filter((item): item is TodoItem => Boolean(item))
    : []

const toCalendarEvents = (input: ExternalCalendarEventInput[] | undefined, fallbackDate: string) =>
  Array.isArray(input)
    ? input
        .map((eventItem) => {
          const title = String(eventItem?.title ?? '').trim()
          if (!title) return null

          const dateKey = toDateKeyOrFallback(eventItem?.date, fallbackDate)
          const allDay = eventItem?.allDay !== false
          const range = normalizeTimeRange(
            String(eventItem?.startTime ?? ''),
            String(eventItem?.endTime ?? ''),
          )

          return {
            id: uid('event'),
            date: dateKey,
            title,
            allDay,
            ...(allDay
              ? {}
              : {
                  startTime: range?.[0],
                  endTime: range?.[1],
                }),
          } satisfies CalendarEvent
        })
        .filter((eventItem): eventItem is CalendarEvent => Boolean(eventItem))
    : []

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_APP)) {
        db.createObjectStore(STORE_APP)
      }
      if (!db.objectStoreNames.contains(STORE_ASSETS)) {
        db.createObjectStore(STORE_ASSETS, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
  })

const getPersistedState = async () => {
  const db = await openDatabase()

  return new Promise<PersistedAppState | null>((resolve, reject) => {
    const tx = db.transaction(STORE_APP, 'readonly')
    const store = tx.objectStore(STORE_APP)
    const request = store.get(APP_STATE_KEY)

    request.onsuccess = () => {
      const raw = request.result as unknown
      if (!raw || typeof raw !== 'object') {
        resolve(null)
        return
      }

      // Backward compatibility:
      // legacy shape: { key: "main", value: PersistedAppState }
      const legacyValue = (raw as { value?: unknown }).value
      if (legacyValue && typeof legacyValue === 'object') {
        resolve(legacyValue as PersistedAppState)
        return
      }

      // current shape: PersistedAppState
      resolve(raw as PersistedAppState)
    }
    request.onerror = () => reject(request.error ?? new Error('Failed to read app state'))
  })
}

const putPersistedState = async (state: PersistedAppState) => {
  const db = await openDatabase()

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_APP, 'readwrite')
    const store = tx.objectStore(STORE_APP)
    const request =
      store.keyPath === null
        ? store.put(state, APP_STATE_KEY)
        : store.put({
            key: APP_STATE_KEY,
            value: state,
          })

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('Failed to write app state'))
  })
}

const getAllAssets = async () => {
  const db = await openDatabase()

  return new Promise<StoredAsset[]>((resolve, reject) => {
    const tx = db.transaction(STORE_ASSETS, 'readonly')
    const store = tx.objectStore(STORE_ASSETS)
    const request = store.getAll()

    request.onsuccess = () => resolve((request.result as StoredAsset[]) ?? [])
    request.onerror = () => reject(request.error ?? new Error('Failed to load assets'))
  })
}

const putAsset = async (asset: StoredAsset) => {
  const db = await openDatabase()

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_ASSETS, 'readwrite')
    const store = tx.objectStore(STORE_ASSETS)
    const request = store.put(asset)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('Failed to save asset'))
  })
}

const removeAsset = async (assetId: string) => {
  const db = await openDatabase()

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_ASSETS, 'readwrite')
    const store = tx.objectStore(STORE_ASSETS)
    const request = store.delete(assetId)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('Failed to remove asset'))
  })
}

const clearAssets = async () => {
  const db = await openDatabase()

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_ASSETS, 'readwrite')
    const store = tx.objectStore(STORE_ASSETS)
    const request = store.clear()

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('Failed to clear assets'))
  })
}

function App() {
  const [grids, setGrids] = useState<GridData[]>(initialGrids)
  const [activeGridId, setActiveGridId] = useState(initialGrids[0].id)
  const [viewport, setViewport] = useState<ViewportState>(initialViewport)
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null)
  const [resizingCardId, setResizingCardId] = useState<string | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [isFileOver, setIsFileOver] = useState(false)
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({})
  const [hydrated, setHydrated] = useState(false)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showLoginForm, setShowLoginForm] = useState(false)
  const [loginName, setLoginName] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [googleLoginPending, setGoogleLoginPending] = useState(false)
  const [openClawNotice, setOpenClawNotice] = useState('')
  const [apiHealthState, setApiHealthState] = useState<ApiHealthState>('idle')
  const [serverAuth, setServerAuth] = useState<ServerAuthState | null>(null)
  const [apiKeyMasked, setApiKeyMasked] = useState('')
  const [apiActionPending, setApiActionPending] = useState(false)

  const [account, setAccount] = useState<AccountUser | null>(null)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [openClawConfig, setOpenClawConfig] = useState<OpenClawConfig>(DEFAULT_OPENCLAW_CONFIG)

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [syncMessage, setSyncMessage] = useState('')
  const [syncMeta, setSyncMeta] = useState<SyncMeta>(DEFAULT_SYNC_META)

  const [editingGridId, setEditingGridId] = useState<string | null>(null)
  const [gridNameDraft, setGridNameDraft] = useState('')

  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [cardTitleDraft, setCardTitleDraft] = useState('')

  const [calendarDropTarget, setCalendarDropTarget] = useState<string | null>(null)
  const [todoDropTarget, setTodoDropTarget] = useState<{ cardId: string; lane: TodoLane; itemId: string | null } | null>(null)

  const canvasRef = useRef<HTMLElement | null>(null)
  const viewportRef = useRef(viewport)
  const assetUrlsRef = useRef(assetUrls)
  const syncMetaRef = useRef(syncMeta)

  const dragStateRef = useRef<DragState>(null)
  const panStateRef = useRef<PanState>(null)
  const resizeStateRef = useRef<ResizeState>(null)
  const calendarDragStateRef = useRef<CalendarDragState>(null)
  const todoDragStateRef = useRef<TodoDragState>(null)

  const persistTimerRef = useRef<number | null>(null)
  const skipLocalSyncMetaUpdateRef = useRef(false)
  const startupSyncUserRef = useRef<string | null>(null)
  const particleRuntimeRef = useRef<ParticleRuntime>({
    energy: 0,
    originX: 50,
    originY: 50,
    shiftX: 0,
    shiftY: 0,
    dotAlpha: 10,
    bloomAlpha: 8,
    bloomRadius: 360,
  })
  const particleFrameRef = useRef<number | null>(null)

  const activeGrid = useMemo(() => grids.find((grid) => grid.id === activeGridId) ?? grids[0], [activeGridId, grids])

  const text = I18N[settings.language]
  const todoText = TODO_I18N[settings.language]
  const calendarText = CALENDAR_I18N[settings.language]
  const todoLaneLabels: Record<TodoLane, string> = {
    todo: todoText.laneTodo,
    doing: todoText.laneDoing,
    done: todoText.laneDone,
  }

  useEffect(() => {
    viewportRef.current = viewport
  }, [viewport])

  useEffect(() => {
    syncMetaRef.current = syncMeta
  }, [syncMeta])

  useEffect(() => {
    assetUrlsRef.current = assetUrls
  }, [assetUrls])

  useEffect(() => {
    if (!activeGrid) return
    if (activeGrid.id !== activeGridId) setActiveGridId(activeGrid.id)
  }, [activeGrid, activeGridId])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = () => {
      const mode = settings.themeMode || 'system'
      const resolvedTheme = mode === 'system' ? (media.matches ? 'dark' : 'light') : mode
      document.documentElement.dataset.theme = resolvedTheme
    }

    const onSystemThemeChange = () => {
      if ((settings.themeMode || 'system') !== 'system') return
      applyTheme()
    }

    applyTheme()

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onSystemThemeChange)
      return () => media.removeEventListener('change', onSystemThemeChange)
    }

    media.addListener(onSystemThemeChange)
    return () => media.removeListener(onSystemThemeChange)
  }, [settings.themeMode])

  useEffect(() => {
    const auth = readJson<unknown>(AUTH_STORAGE_KEY)
    const setting = readJson<AppSettings>(SETTINGS_STORAGE_KEY)
    const openClaw = readJson<Partial<OpenClawConfig>>(OPENCLAW_SETTINGS_KEY)
    const meta = readJson<SyncMeta>(SYNC_META_KEY)
    const serverSession = readJson<unknown>(SERVER_AUTH_STORAGE_KEY)
    const normalizedAccount = normalizeAccount(auth)
    const normalizedServerAuth = normalizeServerAuth(serverSession)

    if (normalizedAccount) {
      setAccount(normalizedAccount)
      writeJson(AUTH_STORAGE_KEY, normalizedAccount)
    }
    if (normalizedServerAuth) {
      setServerAuth(normalizedServerAuth)
      setApiKeyMasked(normalizedServerAuth.lastApiKey ? maskSecret(normalizedServerAuth.lastApiKey) : '')
    }
    if (setting) setSettings(normalizeSettings(setting))
    if (openClaw) setOpenClawConfig(normalizeOpenClawConfig({ ...DEFAULT_OPENCLAW_CONFIG, ...openClaw }))
    if (meta) setSyncMeta(meta)
  }, [])

  useEffect(() => {
    if (syncStatus !== 'idle') return
    setSyncMessage(account ? text.ready : text.syncNeedLogin)
  }, [account, syncStatus, text.ready, text.syncNeedLogin])

  useEffect(() => {
    let cancelled = false

    const hydrate = async () => {
      try {
        const [stateFromDb, assetsFromDb] = await Promise.all([getPersistedState(), getAllAssets()])
        if (cancelled) return

        if (stateFromDb && stateFromDb.grids.length > 0) {
          const normalizedGrids = normalizeGridsForTodoBoard(stateFromDb.grids)
          setGrids(normalizedGrids)
          setActiveGridId(stateFromDb.activeGridId || normalizedGrids[0].id)
          setViewport(stateFromDb.viewport ?? initialViewport)
        }

        const urls: Record<string, string> = {}
        for (const asset of assetsFromDb) {
          urls[asset.id] = URL.createObjectURL(asset.blob)
        }
        setAssetUrls(urls)
      } catch (error) {
        console.error('Failed to hydrate from IndexedDB:', error)
      } finally {
        if (!cancelled) setHydrated(true)
      }
    }

    void hydrate()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(
    () => () => {
      Object.values(assetUrlsRef.current).forEach((url) => URL.revokeObjectURL(url))
    },
    [],
  )

  useEffect(() => {
    if (!hydrated) return

    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current)
    }

    persistTimerRef.current = window.setTimeout(() => {
      const state: PersistedAppState = {
        version: 1,
        grids,
        activeGridId,
        viewport,
      }

      putPersistedState(state)
        .then(() => {
          if (skipLocalSyncMetaUpdateRef.current) return
          setSyncMeta((current) => {
            const next: SyncMeta = { ...current, lastLocalUpdateAt: Date.now() }
            writeJson(SYNC_META_KEY, next)
            return next
          })
        })
        .catch((error) => {
          console.error('Failed to persist app state:', error)
        })
    }, 180)

    return () => {
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current)
      }
    }
  }, [activeGridId, grids, hydrated, viewport])

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings((current) => {
      const next = normalizeSettings({ ...current, ...partial })
      writeJson(SETTINGS_STORAGE_KEY, next)
      return next
    })
  }, [])

  const saveOpenClawConfig = useCallback((nextConfig: OpenClawConfig) => {
    setOpenClawConfig(nextConfig)
    writeJson(OPENCLAW_SETTINGS_KEY, nextConfig)
  }, [])

  const updateOpenClawConfig = useCallback((partial: Partial<OpenClawConfig>) => {
    setOpenClawConfig((current) => {
      const next = normalizeOpenClawConfig({ ...current, ...partial })
      writeJson(OPENCLAW_SETTINGS_KEY, next)
      return next
    })
  }, [])

  const updateSyncMeta = useCallback((partial: Partial<SyncMeta>) => {
    setSyncMeta((current) => {
      const next = { ...current, ...partial }
      writeJson(SYNC_META_KEY, next)
      return next
    })
  }, [])

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('open-canvas:config', {
        detail: {
          openclaw: openClawConfig,
        },
      }),
    )
  }, [openClawConfig])

  useEffect(() => {
    if (!openClawNotice) return
    const timer = window.setTimeout(() => setOpenClawNotice(''), 2600)
    return () => window.clearTimeout(timer)
  }, [openClawNotice])

  useEffect(() => {
    setApiKeyMasked(serverAuth?.lastApiKey ? maskSecret(serverAuth.lastApiKey) : '')
  }, [serverAuth?.lastApiKey])

  const persistServerAuth = useCallback((next: ServerAuthState | null) => {
    setServerAuth(next)
    if (next) {
      writeJson(SERVER_AUTH_STORAGE_KEY, next)
      return
    }
    window.localStorage.removeItem(SERVER_AUTH_STORAGE_KEY)
  }, [])

  const resolveApiBaseUrl = useCallback(() => (serverAuth?.apiBaseUrl || getApiBaseUrl()).trim(), [serverAuth?.apiBaseUrl])

  const checkApiService = useCallback(async () => {
    const baseUrl = resolveApiBaseUrl()
    setApiHealthState('checking')
    try {
      await apiCheckHealth(baseUrl)
      setApiHealthState('online')
      return { ok: true, baseUrl }
    } catch {
      setApiHealthState('offline')
      return { ok: false, baseUrl }
    }
  }, [resolveApiBaseUrl])

  const assertApiService = useCallback(async () => {
    const result = await checkApiService()
    if (result.ok) return result.baseUrl

    throw new Error(
      settings.language === 'zh'
        ? `本地 API 服务不可用，请先启动：npm run api:dev（地址：${result.baseUrl}）`
        : `Local API is unavailable. Start it first with: npm run api:dev (base URL: ${result.baseUrl})`,
    )
  }, [checkApiService, settings.language])

  useEffect(() => {
    if (!settingsOpen) return

    let cancelled = false
    const run = async () => {
      const status = await checkApiService()
      if (cancelled) return
      setApiHealthState(status.ok ? 'online' : 'offline')
    }

    void run()
    const timer = window.setInterval(() => {
      void run()
    }, 12000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [checkApiService, settingsOpen])

  const bindAccountToApi = useCallback(
    async (user: AccountUser) => {
      setApiActionPending(true)
      try {
        const apiBaseUrl = await assertApiService()
        const response = await apiDemoLogin({
          name: user.name,
          email: user.email,
          provider: user.provider,
          avatarUrl: user.avatarUrl,
        }, apiBaseUrl)

        const nextAuth: ServerAuthState = {
          accountId: response.account.id,
          accessToken: response.accessToken,
          expiresAt: response.expiresAt,
          apiBaseUrl: response.apiBaseUrl || getApiBaseUrl(),
          lastApiKey: serverAuth?.accountId === response.account.id ? serverAuth.lastApiKey : undefined,
          lastApiKeyId: serverAuth?.accountId === response.account.id ? serverAuth.lastApiKeyId : undefined,
        }

        persistServerAuth(nextAuth)
        setOpenClawNotice(settings.language === 'zh' ? 'API 会话已连接。' : 'API session connected.')
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setOpenClawNotice(settings.language === 'zh' ? `API 登录失败：${message}` : `API login failed: ${message}`)
      } finally {
        setApiActionPending(false)
      }
    },
    [assertApiService, persistServerAuth, serverAuth?.accountId, serverAuth?.lastApiKey, serverAuth?.lastApiKeyId, settings.language],
  )

  const ensureApiSession = useCallback(async () => {
    if (!account) {
      setShowLoginForm(true)
      throw new Error(
        settings.language === 'zh'
          ? '请先在账号区域登录（演示登录或 Google 登录），再生成 API Key。'
          : 'Please sign in from the Account section first, then generate API key.',
      )
    }
    const apiBaseUrl = await assertApiService()

    if (serverAuth && serverAuth.accountId === account.id && new Date(serverAuth.expiresAt).getTime() > Date.now() + 5_000) {
      try {
        await apiGetSessionMe(serverAuth.accessToken, serverAuth.apiBaseUrl || apiBaseUrl)
        return serverAuth
      } catch {
        // Session may be stale on server side; fallback to re-login below.
      }
    }

    const response = await apiDemoLogin({
      name: account.name,
      email: account.email,
      provider: account.provider,
      avatarUrl: account.avatarUrl,
    }, apiBaseUrl)

    const nextAuth: ServerAuthState = {
      accountId: response.account.id,
      accessToken: response.accessToken,
      expiresAt: response.expiresAt,
      apiBaseUrl: response.apiBaseUrl || getApiBaseUrl(),
      lastApiKey: serverAuth?.lastApiKey,
      lastApiKeyId: serverAuth?.lastApiKeyId,
    }
    persistServerAuth(nextAuth)
    return nextAuth
  }, [account, assertApiService, persistServerAuth, serverAuth, settings.language])

  const generateApiKeyForSkill = useCallback(async () => {
    setApiActionPending(true)
    try {
      const session = await ensureApiSession()
      const created = await apiCreateKey(session.accessToken, 'OpenClaw Skill Key', session.apiBaseUrl)
      const nextAuth: ServerAuthState = {
        ...session,
        lastApiKey: created.apiKey,
        lastApiKeyId: created.key.id,
      }
      persistServerAuth(nextAuth)
      setApiKeyMasked(maskSecret(created.apiKey))
      setOpenClawNotice(settings.language === 'zh' ? '已生成 API Key（仅本地保存）。' : 'API key generated and saved locally.')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setOpenClawNotice(settings.language === 'zh' ? `生成 API Key 失败：${message}` : `Failed to generate API key: ${message}`)
    } finally {
      setApiActionPending(false)
    }
  }, [ensureApiSession, persistServerAuth, settings.language])

  const copyOpenClawSkillJson = useCallback(async () => {
    setApiActionPending(true)
    try {
      const session = await ensureApiSession()
      let apiKey = session.lastApiKey
      let nextSession = session
      if (!apiKey) {
        const created = await apiCreateKey(session.accessToken, 'OpenClaw Skill Key', session.apiBaseUrl)
        apiKey = created.apiKey
        nextSession = { ...session, lastApiKey: created.apiKey, lastApiKeyId: created.key.id }
        persistServerAuth(nextSession)
        setApiKeyMasked(maskSecret(created.apiKey))
      }

      const skillTemplate = await apiGetSkillTemplate(nextSession.accessToken, nextSession.apiBaseUrl)
      const config = buildOpenClawSkillConfig(skillTemplate, apiKey)
      await navigator.clipboard.writeText(JSON.stringify(config, null, 2))
      setOpenClawNotice(settings.language === 'zh' ? '已复制 OpenClaw Skill JSON。' : 'OpenClaw skill JSON copied.')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setOpenClawNotice(settings.language === 'zh' ? `复制 Skill 失败：${message}` : `Failed to copy skill config: ${message}`)
    } finally {
      setApiActionPending(false)
    }
  }, [ensureApiSession, persistServerAuth, settings.language])

  const serializeAssetsForCloud = useCallback(async () => {
    const assets = await getAllAssets()
    return Promise.all(
      assets.map(async (asset): Promise<CloudAssetSnapshot> => ({
        id: asset.id,
        name: asset.name,
        type: asset.type,
        createdAt: asset.createdAt,
        dataUrl: await blobToDataUrl(asset.blob),
      })),
    )
  }, [])

  const restoreFromCloud = useCallback(
    async (snapshot: CloudSnapshot) => {
      skipLocalSyncMetaUpdateRef.current = true

      try {
        Object.values(assetUrlsRef.current).forEach((url) => URL.revokeObjectURL(url))
        setAssetUrls({})

        await clearAssets()

        const restoredUrls: Record<string, string> = {}
        for (const asset of snapshot.assets) {
          const blob = await dataUrlToBlob(asset.dataUrl)
          await putAsset({
            id: asset.id,
            blob,
            name: asset.name,
            type: asset.type,
            createdAt: asset.createdAt,
          })
          restoredUrls[asset.id] = URL.createObjectURL(blob)
        }

        setAssetUrls(restoredUrls)
        setGrids(normalizeGridsForTodoBoard(snapshot.state.grids))
        setActiveGridId(snapshot.state.activeGridId)
        setViewport(snapshot.state.viewport ?? initialViewport)
        updateSyncMeta({
          lastLocalUpdateAt: snapshot.savedAt,
          lastSyncAt: Date.now(),
        })
      } finally {
        window.setTimeout(() => {
          skipLocalSyncMetaUpdateRef.current = false
        }, 0)
      }
    },
    [updateSyncMeta],
  )

  const performSync = useCallback(
    async (silentAuto = false) => {
      if (!account) {
        if (!silentAuto) {
          setSyncStatus('error')
          setSyncMessage(text.syncPleaseSignIn)
        }
        return
      }

      if (
        silentAuto &&
        syncMetaRef.current.lastSyncAt !== null &&
        syncMetaRef.current.lastLocalUpdateAt <= syncMetaRef.current.lastSyncAt
      ) {
        return
      }

      try {
        setSyncStatus('syncing')
        if (!silentAuto) setSyncMessage(text.syncingWorkspace)

        const localState: PersistedAppState = {
          version: 1,
          grids,
          activeGridId,
          viewport,
        }

        const remote = readJson<CloudSnapshot>(cloudKey(account.id))

        if (!remote) {
          const assets = await serializeAssetsForCloud()
          const payload: CloudSnapshot = {
            version: 1,
            userId: account.id,
            savedAt: Date.now(),
            state: localState,
            assets,
          }

          writeJson(cloudKey(account.id), payload)
          updateSyncMeta({ lastSyncAt: Date.now() })
          setSyncStatus('ok')
          setSyncMessage(text.syncCloudCreated)
          return
        }

        if (remote.savedAt > syncMetaRef.current.lastLocalUpdateAt + 1000) {
          await restoreFromCloud(remote)
          setSyncStatus('ok')
          setSyncMessage(`${text.syncPulledPrefix}${formatLocalDateTime(remote.savedAt, settings.language)}).`)
          return
        }

        const assets = await serializeAssetsForCloud()
        const payload: CloudSnapshot = {
          version: 1,
          userId: account.id,
          savedAt: Date.now(),
          state: localState,
          assets,
        }

        writeJson(cloudKey(account.id), payload)
        updateSyncMeta({ lastSyncAt: Date.now() })

        setSyncStatus('ok')
        if (!silentAuto) {
          setSyncMessage(`${text.syncPushedPrefix}${formatLocalDateTime(payload.savedAt, settings.language)}).`)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setSyncStatus('error')
        if (!silentAuto) setSyncMessage(`${text.syncFailedPrefix}${message}`)
        console.error('Sync failed:', error)
      }
    },
    [
      activeGridId,
      account,
      grids,
      restoreFromCloud,
      serializeAssetsForCloud,
      settings.language,
      text.syncCloudCreated,
      text.syncFailedPrefix,
      text.syncPleaseSignIn,
      text.syncPulledPrefix,
      text.syncPushedPrefix,
      text.syncingWorkspace,
      updateSyncMeta,
      viewport,
    ],
  )

  useEffect(() => {
    if (!hydrated || !account || !settings.syncOnStartup) return
    if (startupSyncUserRef.current === account.id) return
    startupSyncUserRef.current = account.id
    void performSync(true)
  }, [account, hydrated, performSync, settings.syncOnStartup])

  useEffect(() => {
    if (!hydrated || !account || !settings.autoSync) return

    const timer = window.setTimeout(() => {
      if (!skipLocalSyncMetaUpdateRef.current) {
        void performSync(true)
      }
    }, Math.max(500, settings.syncDebounceMs))

    return () => {
      window.clearTimeout(timer)
    }
  }, [activeGridId, account, grids, hydrated, performSync, settings.autoSync, settings.syncDebounceMs, viewport])

  const toWorldPoint = useCallback((clientX: number, clientY: number) => {
    const bounds = canvasRef.current?.getBoundingClientRect()
    const currentViewport = viewportRef.current

    if (!bounds) return { x: clientX, y: clientY }

    const localX = clientX - bounds.left
    const localY = clientY - bounds.top

    return {
      x: (localX - currentViewport.x) / currentViewport.zoom,
      y: (localY - currentViewport.y) / currentViewport.zoom,
    }
  }, [])

  const applyParticleVisual = useCallback(() => {
    const canvasElement = canvasRef.current
    if (!canvasElement) return

    const runtime = particleRuntimeRef.current
    canvasElement.style.setProperty('--particle-energy', runtime.energy.toFixed(3))
    canvasElement.style.setProperty('--particle-origin-x', `${runtime.originX.toFixed(2)}%`)
    canvasElement.style.setProperty('--particle-origin-y', `${runtime.originY.toFixed(2)}%`)
    canvasElement.style.setProperty('--particle-shift-x', `${runtime.shiftX.toFixed(2)}px`)
    canvasElement.style.setProperty('--particle-shift-y', `${runtime.shiftY.toFixed(2)}px`)
    canvasElement.style.setProperty('--particle-dot-alpha', `${runtime.dotAlpha.toFixed(1)}%`)
    canvasElement.style.setProperty('--particle-bloom-alpha', `${runtime.bloomAlpha.toFixed(1)}%`)
    canvasElement.style.setProperty('--particle-bloom-radius', `${runtime.bloomRadius.toFixed(0)}px`)
  }, [])

  const pushParticleImpulse = useCallback(
    (worldX: number, worldY: number, strength = 0.1) => {
      const runtime = particleRuntimeRef.current

      const nx = clamp((worldX / SCENE_WIDTH) * 100, 0, 100)
      const ny = clamp((worldY / SCENE_HEIGHT) * 100, 0, 100)
      const impulse = clamp(strength, 0.03, 0.4)

      runtime.energy = clamp(runtime.energy + impulse, 0, 1.2)
      runtime.originX = clamp(runtime.originX * 0.72 + nx * 0.28, 0, 100)
      runtime.originY = clamp(runtime.originY * 0.72 + ny * 0.28, 0, 100)
      runtime.shiftX = clamp(runtime.shiftX * 0.6 + (nx - 50) * 0.28, -26, 26)
      runtime.shiftY = clamp(runtime.shiftY * 0.6 + (ny - 50) * 0.28, -26, 26)
      runtime.dotAlpha = clamp(10 + runtime.energy * 18, 10, 38)
      runtime.bloomAlpha = clamp(7 + runtime.energy * 24, 7, 46)
      runtime.bloomRadius = clamp(340 + runtime.energy * 460, 340, 980)

      applyParticleVisual()
    },
    [applyParticleVisual],
  )

  useEffect(() => {
    applyParticleVisual()

    const tick = () => {
      const runtime = particleRuntimeRef.current
      runtime.energy = Math.max(0, runtime.energy * 0.92 - 0.002)
      runtime.shiftX *= 0.9
      runtime.shiftY *= 0.9
      runtime.dotAlpha = clamp(10 + runtime.energy * 18, 10, 38)
      runtime.bloomAlpha = clamp(7 + runtime.energy * 24, 7, 46)
      runtime.bloomRadius = clamp(340 + runtime.energy * 460, 340, 980)
      applyParticleVisual()
      particleFrameRef.current = window.requestAnimationFrame(tick)
    }

    particleFrameRef.current = window.requestAnimationFrame(tick)

    return () => {
      if (particleFrameRef.current !== null) {
        window.cancelAnimationFrame(particleFrameRef.current)
      }
    }
  }, [applyParticleVisual])

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const resizeState = resizeStateRef.current
      if (resizeState) {
        const world = toWorldPoint(event.clientX, event.clientY)
        const deltaX = world.x - resizeState.startPointerWorldX
        const deltaY = world.y - resizeState.startPointerWorldY

        const nextWidth = clamp(resizeState.startWidth + deltaX, CARD_MIN_WIDTH, CARD_MAX_WIDTH)
        const nextHeight = clamp(resizeState.startHeight + deltaY, CARD_MIN_HEIGHT, CARD_MAX_HEIGHT)

        setGrids((current) =>
          current.map((grid) => {
            if (grid.id !== resizeState.gridId) return grid
            return {
              ...grid,
              cards: grid.cards.map((card) =>
                card.id === resizeState.cardId ? { ...card, width: nextWidth, height: nextHeight } : card,
              ),
            }
          }),
        )
        const movement = Math.abs(deltaX) + Math.abs(deltaY)
        pushParticleImpulse(world.x, world.y, 0.08 + movement / 960)
        return
      }

      const dragState = dragStateRef.current
      if (dragState) {
        const world = toWorldPoint(event.clientX, event.clientY)
        const nextX = clamp(world.x - dragState.pointerOffsetX, -200, SCENE_WIDTH - 60)
        const nextY = clamp(world.y - dragState.pointerOffsetY, -200, SCENE_HEIGHT - 60)

        setGrids((current) =>
          current.map((grid) => {
            if (grid.id !== dragState.gridId) return grid
            return {
              ...grid,
              cards: grid.cards.map((card) => (card.id === dragState.cardId ? { ...card, x: nextX, y: nextY } : card)),
            }
          }),
        )
        pushParticleImpulse(world.x, world.y, 0.07)
        return
      }

      const panState = panStateRef.current
      if (panState) {
        const dx = event.clientX - panState.startClientX
        const dy = event.clientY - panState.startClientY
        setViewport((current) => ({ ...current, x: panState.startX + dx, y: panState.startY + dy }))
      }
    }

    const handlePointerUp = () => {
      dragStateRef.current = null
      panStateRef.current = null
      resizeStateRef.current = null
      setDraggingCardId(null)
      setResizingCardId(null)
      setIsPanning(false)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [pushParticleImpulse, toWorldPoint])

  const closeSettings = () => {
    setSettingsOpen(false)
    setShowLoginForm(false)
    setOpenClawNotice('')
  }

  const beginDemoLogin = () => {
    setShowLoginForm(true)
    setLoginName(account?.name ?? '')
    setLoginEmail(account?.email ?? '')
  }

  const submitDemoLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const name = loginName.trim() || text.demoUser
    const email = (loginEmail.trim() || `${name.toLowerCase().replace(/\s+/g, '.')}@open-canvas.local`).toLowerCase()

    const user: AccountUser = {
      id: `fake-${email}`,
      name,
      email,
      provider: 'demo',
    }

    writeJson(AUTH_STORAGE_KEY, user)
    setAccount(user)
    setShowLoginForm(false)
    setSyncStatus('idle')
    setSyncMessage(text.fakeLoginSuccess)
    void bindAccountToApi(user)
  }

  const signInWithGoogle = useCallback(async () => {
    const clientId = openClawConfig.googleClientId.trim()
    if (!clientId) {
      setSyncStatus('error')
      setSyncMessage(text.googleClientIdRequired)
      return
    }

    setGoogleLoginPending(true)

    try {
      const google = await loadGoogleIdentityApi()
      const token = await requestGoogleToken(google, clientId)
      const accessToken = token.access_token
      if (!accessToken) throw new Error('No access token returned')

      const profile = await fetchGoogleProfile(accessToken)
      const email = trimConfigValue(profile.email, 180).toLowerCase()
      const name = trimConfigValue(profile.name, 120) || text.demoUser
      const idSuffix = trimConfigValue(profile.sub, 120) || email
      if (!idSuffix || !email) throw new Error('Google profile missing required fields')

      const user: AccountUser = {
        id: `google-${idSuffix}`,
        name,
        email,
        provider: 'google',
        avatarUrl: trimConfigValue(profile.picture, 600) || undefined,
      }

      writeJson(AUTH_STORAGE_KEY, user)
      setAccount(user)
      setShowLoginForm(false)
      setSyncStatus('idle')
      setSyncMessage(text.googleLoginSuccess)
      void bindAccountToApi(user)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setSyncStatus('error')
      setSyncMessage(`${text.googleLoginFailedPrefix}${message}`)
    } finally {
      setGoogleLoginPending(false)
    }
  }, [
    bindAccountToApi,
    openClawConfig.googleClientId,
    text.demoUser,
    text.googleClientIdRequired,
    text.googleLoginFailedPrefix,
    text.googleLoginSuccess,
  ])

  const logout = () => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    window.localStorage.removeItem(SERVER_AUTH_STORAGE_KEY)
    setAccount(null)
    setServerAuth(null)
    setApiKeyMasked('')
    startupSyncUserRef.current = null
    setShowLoginForm(false)
    setSyncStatus('idle')
    setSyncMessage(text.signedOut)
  }

  const saveOpenClawSettings = () => {
    const normalized = normalizeOpenClawConfig(openClawConfig)
    saveOpenClawConfig(normalized)
    setOpenClawNotice(text.openclawSaved)
  }

  const copyOpenClawConfig = async () => {
    const payload = JSON.stringify(openClawConfig, null, 2)

    try {
      await navigator.clipboard.writeText(payload)
      setOpenClawNotice(text.openclawConfigCopied)
    } catch {
      setOpenClawNotice(text.openclawConfigCopyFailed)
    }
  }

  const copyTextWithNotice = useCallback(
    async (value: string, successZh: string, successEn: string, errorZhPrefix: string, errorEnPrefix: string) => {
      try {
        await navigator.clipboard.writeText(value)
        setOpenClawNotice(settings.language === 'zh' ? successZh : successEn)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setOpenClawNotice(
          settings.language === 'zh' ? `${errorZhPrefix}${message}` : `${errorEnPrefix}${message}`,
        )
      }
    },
    [settings.language],
  )

  const downloadSkillMarkdown = useCallback(
    (content: string) => {
      try {
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = 'SKILL.md'
        document.body.appendChild(anchor)
        anchor.click()
        document.body.removeChild(anchor)
        URL.revokeObjectURL(url)
        setOpenClawNotice(settings.language === 'zh' ? '已下载 SKILL.md。' : 'SKILL.md downloaded.')
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setOpenClawNotice(
          settings.language === 'zh' ? `下载 SKILL.md 失败：${message}` : `Failed to download SKILL.md: ${message}`,
        )
      }
    },
    [settings.language],
  )

  const beginEditGrid = (grid: GridData) => {
    setEditingGridId(grid.id)
    setGridNameDraft(grid.name)
  }

  const commitGridName = () => {
    if (!editingGridId) return

    const nextName = gridNameDraft.trim() || text.unnamedGrid
    setGrids((current) =>
      current.map((grid) => (grid.id === editingGridId ? { ...grid, name: nextName } : grid)),
    )
    setEditingGridId(null)
    setGridNameDraft('')
  }

  const cancelGridName = () => {
    setEditingGridId(null)
    setGridNameDraft('')
  }

  const beginEditCardTitle = (card: CardData) => {
    setEditingCardId(card.id)
    setCardTitleDraft(card.title)
  }

  const commitCardTitle = () => {
    if (!editingCardId) return

    const nextTitle = cardTitleDraft.trim() || text.unnamedCard
    setGrids((current) =>
      current.map((grid) => {
        if (grid.id !== activeGridId) return grid
        return {
          ...grid,
          cards: grid.cards.map((card) => (card.id === editingCardId ? { ...card, title: nextTitle } : card)),
        }
      }),
    )
    setEditingCardId(null)
    setCardTitleDraft('')
  }

  const cancelCardTitle = () => {
    setEditingCardId(null)
    setCardTitleDraft('')
  }

  const createGridInternal = useCallback(
    (payload?: { name?: string; activate?: boolean }) => {
      const count = grids.length + 1
      const newGrid: GridData = {
        id: uid('grid'),
        name: payload?.name?.trim() || `${text.gridPrefix} ${count}`,
        cards: [],
      }

      setGrids((current) => [...current, newGrid])
      if (payload?.activate !== false) {
        setActiveGridId(newGrid.id)
      }

      return newGrid
    },
    [grids.length, text.gridPrefix],
  )

  const createCardInternal = useCallback(
    (payload?: OpenCanvasCreateCardPayload) => {
      const targetGridId =
        payload?.gridId && grids.some((grid) => grid.id === payload.gridId) ? payload.gridId : activeGridId
      const targetGrid = grids.find((grid) => grid.id === targetGridId)
      if (!targetGrid) return null

      const kind = normalizeCardKind(payload?.kind)
      const baseX = clamp(toFiniteNumber(payload?.x, 140), -200, SCENE_WIDTH - 60)
      const baseY = clamp(toFiniteNumber(payload?.y, 140), -200, SCENE_HEIGHT - 60)
      const defaultTitle =
        kind === 'todo'
          ? todoText.title
          : kind === 'calendar'
            ? calendarText.title
            : kind === 'hint'
              ? 'Hints'
              : kind === 'note'
                ? text.newNoteCard.replace('+ ', '')
                : text.unnamedCard

      const defaultSize =
        kind === 'todo'
          ? { width: 760, height: 420 }
          : kind === 'calendar'
            ? { width: 440, height: 460 }
            : kind === 'hint'
              ? { width: 300, height: 420 }
              : kind === 'image'
                ? { width: 360, height: 280 }
                : kind === 'video'
                  ? { width: 420, height: 300 }
                  : kind === 'pdf'
                    ? { width: 460, height: 360 }
                    : { width: 340, height: 280 }

      const width = clamp(toFiniteNumber(payload?.width, defaultSize.width), CARD_MIN_WIDTH, CARD_MAX_WIDTH)
      const height = clamp(toFiniteNumber(payload?.height, defaultSize.height), CARD_MIN_HEIGHT, CARD_MAX_HEIGHT)
      const title = String(payload?.title ?? '').trim() || defaultTitle
      const content = String(payload?.content ?? '').trim()
      const cardId = uid(kind)
      const externalTodoItems = toTodoItems(payload?.todoItems)

      const cardBase: CardData = {
        id: cardId,
        kind,
        title,
        content: kind === 'note' ? content || text.notePlaceholder : content,
        x: baseX,
        y: baseY,
        width,
        height,
        fileName: payload?.fileName,
        externalUrl: typeof payload?.mediaUrl === 'string' ? payload.mediaUrl.trim() : undefined,
      }

      const cardWithTypeData =
        kind === 'todo'
          ? {
              ...cardBase,
              content,
              todoItems:
                externalTodoItems.length > 0
                  ? externalTodoItems
                  : content
                    ? []
                    : todoText.defaultItems.map((item) => createTodoItem(item)),
            }
          : kind === 'calendar'
            ? (() => {
                const today = toDateKey(new Date())
                const calendarInput = payload?.calendar
                const selectedDate = toDateKeyOrFallback(calendarInput?.selectedDate, today)
                const monthCursor = toDateKeyOrFallback(calendarInput?.monthCursor, toMonthKey(parseDateKey(selectedDate)))
                const calendarState = withCalendarDefaults({
                  ...createDefaultCalendarState(),
                  ...calendarInput,
                  selectedDate,
                  monthCursor,
                  events: toCalendarEvents(calendarInput?.events, selectedDate),
                })
                return {
                  ...cardBase,
                  content: '',
                  calendar: calendarState,
                }
              })()
            : kind === 'hint'
              ? {
                  ...cardBase,
                  title: title || 'Drag and drop any file',
                  content: '',
                }
              : cardBase

      setGrids((current) =>
        current.map((grid) => (grid.id === targetGridId ? { ...grid, cards: [...grid.cards, cardWithTypeData] } : grid)),
      )
      if (payload?.activateGrid) {
        setActiveGridId(targetGridId)
      }
      pushParticleImpulse(baseX, baseY, 0.22)

      return { cardId, gridId: targetGridId }
    },
    [
      activeGridId,
      calendarText.title,
      grids,
      pushParticleImpulse,
      text.newNoteCard,
      text.notePlaceholder,
      text.unnamedCard,
      todoText.defaultItems,
      todoText.title,
    ],
  )

  const addGrid = () => {
    createGridInternal({ activate: true })
  }

  const addNoteCard = () => {
    createCardInternal({
      kind: 'note',
      x: 92,
      y: 92,
      width: 340,
      height: 280,
    })
  }

  const addTodoCard = () => {
    createCardInternal({
      kind: 'todo',
      x: 132,
      y: 132,
      width: 360,
      height: 320,
    })
  }

  const addCalendarCard = () => {
    createCardInternal({
      kind: 'calendar',
      x: 180,
      y: 180,
      width: 440,
      height: 460,
    })
  }

  const updateCardInternal = useCallback((payload: NonNullable<Extract<OpenCanvasCommand, { type: 'update-card' }>['payload']>) => {
    const cardId = String(payload.cardId || '').trim()
    if (!cardId) {
      return { ok: false, message: 'cardId is required' } satisfies OpenCanvasCommandResult
    }

    const exists = grids.some((grid) => grid.cards.some((card) => card.id === cardId))
    if (!exists) {
      return { ok: false, message: `Card not found: ${cardId}` } satisfies OpenCanvasCommandResult
    }

    setGrids((current) =>
      current.map((grid) => ({
        ...grid,
        cards: grid.cards.map((card) => {
          if (card.id !== cardId) return card

          return {
            ...card,
            ...(typeof payload.title === 'string' ? { title: payload.title.trim() || card.title } : {}),
            ...(typeof payload.content === 'string' ? { content: payload.content } : {}),
            ...(typeof payload.x === 'number' ? { x: clamp(payload.x, -200, SCENE_WIDTH - 60) } : {}),
            ...(typeof payload.y === 'number' ? { y: clamp(payload.y, -200, SCENE_HEIGHT - 60) } : {}),
            ...(typeof payload.width === 'number'
              ? { width: clamp(payload.width, CARD_MIN_WIDTH, CARD_MAX_WIDTH) }
              : {}),
            ...(typeof payload.height === 'number'
              ? { height: clamp(payload.height, CARD_MIN_HEIGHT, CARD_MAX_HEIGHT) }
              : {}),
          }
        }),
      })),
    )

    return { ok: true, message: 'Card updated', data: { cardId } } satisfies OpenCanvasCommandResult
  }, [grids])

  const handleOpenCanvasCommand = useCallback(
    (command: OpenCanvasCommand): OpenCanvasCommandResult => {
      const requestId = command?.requestId

      if (!command || typeof command !== 'object' || typeof command.type !== 'string') {
        return { ok: false, requestId, message: 'Invalid command format' }
      }

      if (command.type === 'ping') {
        return { ok: true, requestId, message: 'pong' }
      }

      if (command.type === 'create-grid') {
        const grid = createGridInternal(command.payload)
        return { ok: true, requestId, message: 'Grid created', data: { gridId: grid.id, name: grid.name } }
      }

      if (command.type === 'create-card') {
        const created = createCardInternal(command.payload)
        if (!created) {
          return { ok: false, requestId, message: 'Failed to create card (grid not found)' }
        }
        return { ok: true, requestId, message: 'Card created', data: created }
      }

      if (command.type === 'update-card') {
        const result = updateCardInternal(command.payload ?? { cardId: '' })
        return { ...result, requestId }
      }

      if (command.type === 'append-note') {
        const cardId = String(command.payload?.cardId || '').trim()
        const appendText = String(command.payload?.text || '')
        if (!cardId || !appendText.trim()) {
          return { ok: false, requestId, message: 'cardId and text are required' }
        }

        const exists = grids.some((grid) => grid.cards.some((card) => card.id === cardId))
        if (!exists) {
          return { ok: false, requestId, message: `Card not found: ${cardId}` }
        }

        setGrids((current) =>
          current.map((grid) => ({
            ...grid,
            cards: grid.cards.map((card) =>
              card.id === cardId
                ? {
                    ...card,
                    content: card.content ? `${card.content}\n${appendText}` : appendText,
                  }
                : card,
            ),
          })),
        )
        return { ok: true, requestId, message: 'Content appended', data: { cardId } }
      }

      if (command.type === 'get-state') {
        return {
          ok: true,
          requestId,
          data: {
            activeGridId,
            grids: grids.map((grid) => ({
              id: grid.id,
              name: grid.name,
              cardCount: grid.cards.length,
            })),
            account: account
              ? {
                  id: account.id,
                  name: account.name,
                  email: account.email,
                  provider: account.provider,
                }
              : null,
            openclaw: openClawConfig,
          },
        }
      }

      if (command.type === 'get-config') {
        return {
          ok: true,
          requestId,
          data: {
            openclaw: openClawConfig,
            account: account
              ? {
                  id: account.id,
                  name: account.name,
                  email: account.email,
                  provider: account.provider,
                }
              : null,
          },
        }
      }

      if (command.type === 'set-config') {
        const partial = command.payload ?? {}
        const next = normalizeOpenClawConfig({ ...openClawConfig, ...partial })
        saveOpenClawConfig(next)

        return {
          ok: true,
          requestId,
          message: 'Config updated',
          data: {
            openclaw: next,
          },
        }
      }

      return { ok: false, requestId, message: 'Unsupported command' }
    },
    [account, activeGridId, createCardInternal, createGridInternal, grids, openClawConfig, saveOpenClawConfig, updateCardInternal],
  )

  useEffect(() => {
    const api: OpenCanvasGlobalApi = {
      invoke: async (command) => handleOpenCanvasCommand(command),
      createGrid: async (payload) =>
        handleOpenCanvasCommand({
          type: 'create-grid',
          requestId: payload?.requestId,
          payload: { name: payload?.name, activate: payload?.activate },
        }),
      createCard: async (payload) =>
        handleOpenCanvasCommand({
          type: 'create-card',
          requestId: payload?.requestId,
          payload,
        }),
      updateCard: async (payload) =>
        handleOpenCanvasCommand({
          type: 'update-card',
          requestId: payload?.requestId,
          payload,
        }),
      getState: async (requestId) =>
        handleOpenCanvasCommand({
          type: 'get-state',
          requestId,
        }),
      getConfig: async (requestId) =>
        handleOpenCanvasCommand({
          type: 'get-config',
          requestId,
        }),
      setConfig: async (payload) =>
        handleOpenCanvasCommand({
          type: 'set-config',
          requestId: payload?.requestId,
          payload: payload
            ? {
                gatewayUrl: payload.gatewayUrl,
                gatewayPort: payload.gatewayPort,
                gatewayToken: payload.gatewayToken,
                sessionKey: payload.sessionKey,
                sessionKeys: payload.sessionKeys,
                source: payload.source,
                googleClientId: payload.googleClientId,
              }
            : undefined,
        }),
    }

    window.openCanvas = api
    return () => {
      if (window.openCanvas === api) {
        delete window.openCanvas
      }
    }
  }, [handleOpenCanvasCommand])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as OpenCanvasPostMessageEnvelope | null
      if (!data || typeof data !== 'object' || data.type !== 'open-canvas.command') return

      if (
        data.source &&
        !['openclaw', 'openclaw-assistant', 'open-canvas-bridge'].includes(String(data.source).toLowerCase())
      ) {
        return
      }

      const result = handleOpenCanvasCommand(data.command)
      const response: OpenCanvasPostMessageResult = {
        source: 'open-canvas',
        type: 'open-canvas.result',
        result,
      }

      const source = event.source as WindowProxy | null
      if (source?.postMessage) {
        source.postMessage(response, '*')
      }

      window.dispatchEvent(new CustomEvent('open-canvas:result', { detail: response }))
    }

    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('message', onMessage)
    }
  }, [handleOpenCanvasCommand])

  const removeCardById = (cardId: string) => {
    const targetCard = activeGrid.cards.find((card) => card.id === cardId)

    if (editingCardId === cardId) {
      setEditingCardId(null)
      setCardTitleDraft('')
    }

    setGrids((current) =>
      current.map((grid) => {
        if (grid.id !== activeGridId) return grid
        return { ...grid, cards: grid.cards.filter((card) => card.id !== cardId) }
      }),
    )

    if (!targetCard?.fileId) return

    const fileId = targetCard.fileId
    const stillUsed = grids.some((grid) =>
      grid.cards.some((card) => card.id !== cardId && card.fileId === fileId),
    )

    if (stillUsed) return

    setAssetUrls((current) => {
      const next = { ...current }
      if (next[fileId]) {
        URL.revokeObjectURL(next[fileId])
        delete next[fileId]
      }
      return next
    })

    void removeAsset(fileId).catch((error) => {
      console.error('Failed to remove asset:', error)
    })
  }

  const onCardDragStart = (event: ReactPointerEvent<HTMLElement>, card: CardData) => {
    event.preventDefault()
    event.stopPropagation()

    resizeStateRef.current = null
    setResizingCardId(null)

    event.currentTarget.setPointerCapture(event.pointerId)

    const world = toWorldPoint(event.clientX, event.clientY)
    dragStateRef.current = {
      gridId: activeGridId,
      cardId: card.id,
      pointerOffsetX: world.x - card.x,
      pointerOffsetY: world.y - card.y,
    }

    setDraggingCardId(card.id)
    pushParticleImpulse(world.x, world.y, 0.2)
  }

  const onCardResizeStart = (event: ReactPointerEvent<HTMLButtonElement>, card: CardData) => {
    event.preventDefault()
    event.stopPropagation()

    dragStateRef.current = null
    setDraggingCardId(null)

    event.currentTarget.setPointerCapture(event.pointerId)

    const world = toWorldPoint(event.clientX, event.clientY)
    resizeStateRef.current = {
      gridId: activeGridId,
      cardId: card.id,
      startWidth: card.width,
      startHeight: card.height,
      startPointerWorldX: world.x,
      startPointerWorldY: world.y,
    }

    setResizingCardId(card.id)
    pushParticleImpulse(world.x, world.y, 0.22)
  }

  const onCanvasPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return

    const target = event.target as HTMLElement
    if (target.closest('.card')) return

    const currentViewport = viewportRef.current
    panStateRef.current = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: currentViewport.x,
      startY: currentViewport.y,
    }

    setIsPanning(true)
  }

  const updateCardContent = (cardId: string, content: string) => {
    setGrids((current) =>
      current.map((grid) => {
        if (grid.id !== activeGridId) return grid
        return {
          ...grid,
          cards: grid.cards.map((card) => (card.id === cardId ? { ...card, content } : card)),
        }
      }),
    )
  }

  const addTodoItem = (cardId: string, lane: TodoLane = 'todo') => {
    setGrids((current) =>
      current.map((grid) => {
        if (grid.id !== activeGridId) return grid

        return {
          ...grid,
          cards: grid.cards.map((card) => {
            if (card.id !== cardId || card.kind !== 'todo') return card

            const textValue = card.content.trim()
            if (!textValue) return card

            return {
              ...card,
              content: '',
              todoItems: [...(card.todoItems ?? []), createTodoItem(textValue, lane)],
            }
          }),
        }
      }),
    )
  }

  const moveTodoItem = (cardId: string, itemId: string, nextLane: TodoLane, targetItemId: string | null = null) => {
    setGrids((current) =>
      current.map((grid) => {
        if (grid.id !== activeGridId) return grid

        return {
          ...grid,
          cards: grid.cards.map((card) => {
            if (card.id !== cardId || card.kind !== 'todo') return card
            if (targetItemId === itemId) return card

            const lanes: Record<TodoLane, TodoItem[]> = { todo: [], doing: [], done: [] }
            let movingItem: TodoItem | null = null

            for (const todoItem of card.todoItems ?? []) {
              const normalizedLane = normalizeTodoLane(todoItem.status)
              if (todoItem.id === itemId) {
                movingItem = { ...todoItem, status: nextLane }
                continue
              }
              lanes[normalizedLane].push({ ...todoItem, status: normalizedLane })
            }

            if (!movingItem) return card

            const targetLaneItems = lanes[nextLane]
            if (targetItemId) {
              const targetIndex = targetLaneItems.findIndex((todoItem) => todoItem.id === targetItemId)
              if (targetIndex >= 0) {
                targetLaneItems.splice(targetIndex, 0, movingItem)
              } else {
                targetLaneItems.push(movingItem)
              }
            } else {
              targetLaneItems.push(movingItem)
            }

            return {
              ...card,
              todoItems: [...lanes.todo, ...lanes.doing, ...lanes.done],
            }
          }),
        }
      }),
    )
  }

  const onTodoDragStart = (
    event: ReactDragEvent<HTMLElement>,
    cardId: string,
    itemId: string,
    lane: TodoLane,
  ) => {
    event.stopPropagation()
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', JSON.stringify({ cardId, itemId, lane }))
    todoDragStateRef.current = { cardId, itemId }
    setTodoDropTarget({ cardId, lane, itemId: null })
  }

  const onTodoDragEnd = () => {
    todoDragStateRef.current = null
    setTodoDropTarget(null)
  }

  const onTodoLaneDragOver = (event: ReactDragEvent<HTMLElement>, cardId: string, lane: TodoLane) => {
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'
    setTodoDropTarget((current) =>
      current && current.cardId === cardId && current.lane === lane && current.itemId === null
        ? current
        : { cardId, lane, itemId: null },
    )
  }

  const onTodoItemDragOver = (event: ReactDragEvent<HTMLElement>, cardId: string, lane: TodoLane, itemId: string) => {
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'
    setTodoDropTarget((current) =>
      current && current.cardId === cardId && current.lane === lane && current.itemId === itemId
        ? current
        : { cardId, lane, itemId },
    )
  }

  const onTodoDrop = (event: ReactDragEvent<HTMLElement>, cardId: string, lane: TodoLane, itemId: string | null = null) => {
    event.preventDefault()
    event.stopPropagation()
    const currentDrag = todoDragStateRef.current
    if (!currentDrag || currentDrag.cardId !== cardId) return
    moveTodoItem(cardId, currentDrag.itemId, lane, itemId)
    todoDragStateRef.current = null
    setTodoDropTarget(null)
  }

  const removeTodoItem = (cardId: string, todoId: string) => {
    if (todoDragStateRef.current?.cardId === cardId && todoDragStateRef.current?.itemId === todoId) {
      todoDragStateRef.current = null
    }
    setTodoDropTarget((current) =>
      current && current.cardId === cardId && current.itemId === todoId ? null : current,
    )

    setGrids((current) =>
      current.map((grid) => {
        if (grid.id !== activeGridId) return grid

        return {
          ...grid,
          cards: grid.cards.map((card) => {
            if (card.id !== cardId || card.kind !== 'todo') return card

            return {
              ...card,
              todoItems: (card.todoItems ?? []).filter((item) => item.id !== todoId),
            }
          }),
        }
      }),
    )
  }

  const updateTodoText = (cardId: string, todoId: string, value: string) => {
    setGrids((current) =>
      current.map((grid) => {
        if (grid.id !== activeGridId) return grid

        return {
          ...grid,
          cards: grid.cards.map((card) => {
            if (card.id !== cardId || card.kind !== 'todo') return card

            return {
              ...card,
              todoItems: (card.todoItems ?? []).map((item) =>
                item.id === todoId ? { ...item, text: value } : item,
              ),
            }
          }),
        }
      }),
    )
  }

  const updateCalendarCard = (cardId: string, updater: (state: CalendarState) => CalendarState) => {
    setGrids((current) =>
      current.map((grid) => {
        if (grid.id !== activeGridId) return grid

        return {
          ...grid,
          cards: grid.cards.map((card) => {
            if (card.id !== cardId || card.kind !== 'calendar') return card
            const baseState = withCalendarDefaults(card.calendar)
            return { ...card, calendar: withCalendarDefaults(updater(baseState)) }
          }),
        }
      }),
    )
  }

  const setCalendarViewMode = (cardId: string, mode: CalendarViewMode) => {
    updateCalendarCard(cardId, (calendarState) => ({
      ...calendarState,
      viewMode: mode,
      monthCursor: toMonthKey(parseDateKey(calendarState.selectedDate)),
    }))
  }

  const navigateCalendar = (cardId: string, delta: number) => {
    updateCalendarCard(cardId, (calendarState) => {
      if (calendarState.viewMode === 'week') {
        const nextSelected = shiftDateKey(calendarState.selectedDate, delta * 7)
        return {
          ...calendarState,
          selectedDate: nextSelected,
          monthCursor: toMonthKey(parseDateKey(nextSelected)),
        }
      }

      return {
        ...calendarState,
        monthCursor: shiftMonthKey(calendarState.monthCursor, delta),
      }
    })
  }

  const selectCalendarDate = (cardId: string, dateKey: string) => {
    updateCalendarCard(cardId, (calendarState) => ({
      ...calendarState,
      selectedDate: dateKey,
      monthCursor: toMonthKey(parseDateKey(dateKey)),
    }))
  }

  const addCalendarEvent = (cardId: string) => {
    updateCalendarCard(cardId, (calendarState) => {
      const title = calendarState.draftTitle.trim()
      if (!title) return calendarState

      const normalizedRange = normalizeTimeRange(calendarState.draftStartTime, calendarState.draftEndTime)
      if (!calendarState.draftAllDay && !normalizedRange) return calendarState

      const nextEvent: CalendarEvent = {
        id: uid('event'),
        date: calendarState.selectedDate,
        title,
        allDay: calendarState.draftAllDay,
        startTime: normalizedRange?.[0],
        endTime: normalizedRange?.[1],
      }

      return {
        ...calendarState,
        draftTitle: '',
        events: [...calendarState.events, nextEvent],
      }
    })
  }

  const updateCalendarEventTitle = (cardId: string, eventId: string, value: string) => {
    updateCalendarCard(cardId, (calendarState) => ({
      ...calendarState,
      events: calendarState.events.map((eventItem) =>
        eventItem.id === eventId ? { ...eventItem, title: value } : eventItem,
      ),
    }))
  }

  const removeCalendarEvent = (cardId: string, eventId: string) => {
    updateCalendarCard(cardId, (calendarState) => ({
      ...calendarState,
      events: calendarState.events.filter((eventItem) => eventItem.id !== eventId),
    }))
  }

  const moveCalendarEvent = (cardId: string, eventId: string, dateKey: string) => {
    updateCalendarCard(cardId, (calendarState) => ({
      ...calendarState,
      selectedDate: dateKey,
      monthCursor: toMonthKey(parseDateKey(dateKey)),
      events: calendarState.events.map((eventItem) =>
        eventItem.id === eventId ? { ...eventItem, date: dateKey } : eventItem,
      ),
    }))
  }

  const onCalendarEventDragStart = (
    event: ReactDragEvent<HTMLSpanElement>,
    cardId: string,
    eventId: string,
  ) => {
    event.stopPropagation()
    calendarDragStateRef.current = { cardId, eventId }
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', `${cardId}:${eventId}`)
  }

  const onCalendarEventDragEnd = () => {
    calendarDragStateRef.current = null
    setCalendarDropTarget(null)
  }

  const onCalendarDayDragOver = (event: ReactDragEvent<HTMLButtonElement>, cardId: string, dateKey: string) => {
    const currentDrag = calendarDragStateRef.current
    if (!currentDrag || currentDrag.cardId !== cardId) return

    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'
    setCalendarDropTarget(`${cardId}:${dateKey}`)
  }

  const onCalendarDayDragLeave = (cardId: string, dateKey: string) => {
    const key = `${cardId}:${dateKey}`
    setCalendarDropTarget((current) => (current === key ? null : current))
  }

  const onCalendarDayDrop = (event: ReactDragEvent<HTMLButtonElement>, cardId: string, dateKey: string) => {
    event.preventDefault()
    event.stopPropagation()

    const currentDrag = calendarDragStateRef.current
    if (!currentDrag || currentDrag.cardId !== cardId) return

    moveCalendarEvent(cardId, currentDrag.eventId, dateKey)
    calendarDragStateRef.current = null
    setCalendarDropTarget(null)
  }

  const setCenteredZoom = (nextZoomValue: number) => {
    const bounds = canvasRef.current?.getBoundingClientRect()
    if (!bounds) return

    const centerX = bounds.width / 2
    const centerY = bounds.height / 2
    const currentViewport = viewportRef.current

    const worldX = (centerX - currentViewport.x) / currentViewport.zoom
    const worldY = (centerY - currentViewport.y) / currentViewport.zoom

    const nextZoom = clamp(nextZoomValue, ZOOM_MIN, ZOOM_MAX)

    setViewport({
      zoom: nextZoom,
      x: centerX - worldX * nextZoom,
      y: centerY - worldY * nextZoom,
    })
  }

  const onCanvasWheel = (event: WheelEvent<HTMLElement>) => {
    event.preventDefault()

    const bounds = canvasRef.current?.getBoundingClientRect()
    if (!bounds) return

    const localX = event.clientX - bounds.left
    const localY = event.clientY - bounds.top
    const currentViewport = viewportRef.current

    const worldX = (localX - currentViewport.x) / currentViewport.zoom
    const worldY = (localY - currentViewport.y) / currentViewport.zoom

    const scale = Math.exp(-event.deltaY * 0.0015)
    const nextZoom = clamp(currentViewport.zoom * scale, ZOOM_MIN, ZOOM_MAX)

    if (Math.abs(nextZoom - currentViewport.zoom) < 0.0001) return

    setViewport({
      zoom: nextZoom,
      x: localX - worldX * nextZoom,
      y: localY - worldY * nextZoom,
    })
  }

  const onCanvasDrop = async (event: ReactDragEvent<HTMLElement>) => {
    event.preventDefault()
    setIsFileOver(false)
    if (!isFileDrag(event.dataTransfer)) return

    const files = Array.from(event.dataTransfer.files ?? []).filter((file) => mediaCardKindFromFile(file) !== null)
    if (!files.length) return

    const world = toWorldPoint(event.clientX, event.clientY)
    const now = Date.now()

    const nextUrls: Record<string, string> = {}
    const newCards: CardData[] = []

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]
      const kind = mediaCardKindFromFile(file)
      if (!kind) continue

      const assetId = uid('asset')
      const cardId = uid('card')
      const preset = mediaCardPreset(kind, file.name, text)
      const offset = index * 24

      await putAsset({
        id: assetId,
        blob: file,
        name: file.name,
        type: file.type,
        createdAt: now,
      })

      nextUrls[assetId] = URL.createObjectURL(file)

      newCards.push({
        id: cardId,
        kind,
        title: preset.title,
        content: '',
        x: clamp(world.x + offset, -200, SCENE_WIDTH - 60),
        y: clamp(world.y + offset, -200, SCENE_HEIGHT - 60),
        width: preset.width,
        height: preset.height,
        fileId: assetId,
        fileName: file.name,
      })
    }

    if (!newCards.length) return

    setAssetUrls((current) => ({ ...current, ...nextUrls }))
    setGrids((current) =>
      current.map((grid) => (grid.id === activeGridId ? { ...grid, cards: [...grid.cards, ...newCards] } : grid)),
    )
    pushParticleImpulse(world.x, world.y, 0.24)
  }

  const zoomPercent = `${Math.round(viewport.zoom * 100)}%`
  const accountProviderLabel = account?.provider === 'google' ? text.providerGoogle : text.providerDemo
  const apiSessionConnected =
    Boolean(account && serverAuth && serverAuth.accountId === account.id) &&
    new Date(serverAuth?.expiresAt || 0).getTime() > Date.now()
  const apiSessionLabel =
    settings.language === 'zh'
      ? apiSessionConnected
        ? 'API 已连接'
        : 'API 未连接'
      : apiSessionConnected
        ? 'API connected'
        : 'API not connected'
  const apiBaseLabel = resolveApiBaseUrl()
  const apiHealthLabel =
    apiHealthState === 'online'
      ? settings.language === 'zh'
        ? '在线'
        : 'Online'
      : apiHealthState === 'checking'
        ? settings.language === 'zh'
          ? '检测中...'
          : 'Checking...'
        : apiHealthState === 'offline'
          ? settings.language === 'zh'
            ? '离线'
            : 'Offline'
          : settings.language === 'zh'
            ? '未检测'
            : 'Unchecked'
  const webOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:5173'
  const apiKeyPreview = serverAuth?.lastApiKey ? maskSecret(serverAuth.lastApiKey) : '<your-api-key>'
  const openClawInstallCmd = 'mkdir -p ~/.openclaw/skills/open-canvas && cp SKILL.md ~/.openclaw/skills/open-canvas/SKILL.md'
  const openClawBotConfigSnippet = useMemo(
    () =>
      JSON.stringify(
        {
          skills: {
            'open-canvas': {
              enabled: true,
              env: {
                OPEN_CANVAS_API_URL: apiBaseLabel,
                OPEN_CANVAS_API_KEY: apiKeyPreview,
              },
            },
          },
        },
        null,
        2,
      ),
    [apiBaseLabel, apiKeyPreview],
  )
  const openClawSkillMarkdown = useMemo(
    () => `---
name: open-canvas
description: Create and manage Open Canvas grids and cards through REST API.
homepage: ${webOrigin}
user-invocable: true
metadata:
  clawdbot:
    requires:
      env:
        - OPEN_CANVAS_API_URL
        - OPEN_CANVAS_API_KEY
---

# Open Canvas Skill

You can control Open Canvas via REST API.

## Configuration

- Base URL: \`$OPEN_CANVAS_API_URL\` (example: \`${apiBaseLabel}\`)
- Auth: Bearer token via \`$OPEN_CANVAS_API_KEY\`
- Header: \`Authorization: Bearer $OPEN_CANVAS_API_KEY\`

## Endpoints

- \`GET /api/v1/state?full=1\` Read full workspace state
- \`POST /api/v1/grids\` Create grid
- \`POST /api/v1/cards\` Create card (note | hint | image | video | pdf | todo | calendar)
- \`PATCH /api/v1/cards/:cardId\` Update card fields
- \`POST /api/v1/cards/:cardId/append-note\` Append note content

## Best Practices

1. Read \`/api/v1/state?full=1\` before write operations.
2. Confirm destructive or batch changes with the user first.
3. Keep \`kind\` explicit when creating cards.
4. Prefer \`append-note\` for incremental writing.
`,
    [apiBaseLabel, webOrigin],
  )

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-meta">
            <div className="brand-logo" aria-hidden>
              OC
            </div>
            <span className="brand-name">Open Canvas</span>
          </div>
          <button className="brand-settings-btn" onClick={() => setSettingsOpen(true)}>
            {text.settings}
          </button>
        </div>

        <button className="action-btn" onClick={addNoteCard}>
          {text.newNoteCard}
        </button>
        <button className="action-btn" onClick={addTodoCard}>
          {todoText.newCardButton}
        </button>
        <button className="action-btn" onClick={addCalendarCard}>
          {calendarText.newCardButton}
        </button>

        <section className="panel-block">
          <header className="panel-title">{text.syncTitle}</header>
          <p className={`sync-state sync-${syncStatus}`}>
            {syncStatus === 'syncing'
              ? text.syncing
              : syncStatus === 'ok'
                ? text.synced
                : syncStatus === 'error'
                  ? text.syncError
                  : text.ready}
          </p>
          <p className="sync-hint">{syncMessage}</p>
          <p className="sync-hint">
            {syncMeta.lastSyncAt ? `${text.lastSyncPrefix}${formatLocalDateTime(syncMeta.lastSyncAt, settings.language)}` : text.lastSyncNever}
          </p>
          <p className="sync-hint">
            {account ? `${text.accountPrefix}: ${account.email}` : text.accountSignedOutHint}
          </p>
          <div className="panel-actions">
            <button
              className="action-btn compact"
              disabled={!account || syncStatus === 'syncing'}
              onClick={() => {
                void performSync(false)
              }}
            >
              {text.syncNow}
            </button>
            <button className="action-btn compact" onClick={() => setSettingsOpen(true)}>
              {text.settings}
            </button>
          </div>
        </section>

        <section className="grid-panel">
          <header className="grid-panel-header">
            <span>{text.grids}</span>
            <button className="icon-btn" aria-label={text.newGridAria} onClick={addGrid}>
              +
            </button>
          </header>

          <div className="grid-list">
            {grids.map((grid, index) => (
              <button
                key={grid.id}
                className={`grid-item ${grid.id === activeGridId ? 'active' : ''}`}
                onClick={() => {
                  setActiveGridId(grid.id)
                  if (editingGridId && editingGridId !== grid.id) cancelGridName()
                }}
              >
                {editingGridId === grid.id ? (
                  <input
                    className="grid-name-input"
                    value={gridNameDraft}
                    autoFocus
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => setGridNameDraft(event.target.value)}
                    onBlur={commitGridName}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        commitGridName()
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault()
                        cancelGridName()
                      }
                    }}
                  />
                ) : (
                  <span
                    className="grid-name-label"
                    onDoubleClick={(event) => {
                      event.stopPropagation()
                      beginEditGrid(grid)
                    }}
                  >
                    {grid.name}
                  </span>
                )}
                <span className="grid-badge">{index + 1}</span>
              </button>
            ))}
          </div>
        </section>
      </aside>

      <section
        ref={canvasRef}
        className={`canvas ${isPanning ? 'is-panning' : ''} ${isFileOver ? 'is-file-over' : ''}`}
        data-drop-label={text.dropFilesLabel}
        onPointerDown={onCanvasPointerDown}
        onWheel={onCanvasWheel}
        onDragOver={(event) => {
          if (!isFileDrag(event.dataTransfer)) return
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
          setIsFileOver(true)
        }}
        onDragLeave={(event) => {
          if (!isFileDrag(event.dataTransfer)) return
          const relatedTarget = event.relatedTarget as Node | null
          if (!relatedTarget || !event.currentTarget.contains(relatedTarget)) {
            setIsFileOver(false)
          }
        }}
        onDrop={(event) => {
          void onCanvasDrop(event)
        }}
      >
        <div className="canvas-toolbar">
          <button className="zoom-btn" onClick={() => setCenteredZoom(viewport.zoom - 0.1)}>
            -
          </button>
          <span className="zoom-label">{zoomPercent}</span>
          <button className="zoom-btn" onClick={() => setCenteredZoom(viewport.zoom + 0.1)}>
            +
          </button>
          <button className="zoom-btn reset" onClick={() => setViewport(initialViewport)}>
            {text.reset}
          </button>
          <button className="zoom-btn reset" onClick={() => setSettingsOpen(true)}>
            {text.settings}
          </button>
        </div>

        <div
          className="scene"
          style={{
            width: `${SCENE_WIDTH}px`,
            height: `${SCENE_HEIGHT}px`,
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          }}
        >
          <div className="canvas-grid" />

          {activeGrid.cards.map((card) => {
            const fileUrl = card.fileId ? assetUrls[card.fileId] : card.externalUrl

            return (
              <article
                key={card.id}
                className={`card ${draggingCardId === card.id ? 'dragging' : ''} ${resizingCardId === card.id ? 'resizing' : ''} card-${card.kind}`}
                style={{
                  transform: `translate(${card.x}px, ${card.y}px)`,
                  width: `${card.width}px`,
                  height: `${card.height}px`,
                  zIndex: draggingCardId === card.id || resizingCardId === card.id ? 10 : 1,
                }}
              >
                <header
                  className="card-header"
                  onPointerDown={(event) => {
                    const target = event.target as HTMLElement
                    if (
                      target.closest('.card-title-input') ||
                      target.closest('.card-title-text') ||
                      target.closest('.card-close')
                    ) {
                      return
                    }
                    onCardDragStart(event, card)
                  }}
                >
                  {editingCardId === card.id ? (
                    <input
                      className="card-title-input"
                      value={cardTitleDraft}
                      autoFocus
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => setCardTitleDraft(event.target.value)}
                      onBlur={commitCardTitle}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          commitCardTitle()
                        }
                        if (event.key === 'Escape') {
                          event.preventDefault()
                          cancelCardTitle()
                        }
                      }}
                    />
                  ) : (
                    <button
                      className="card-title-text"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation()
                        beginEditCardTitle(card)
                      }}
                    >
                      {card.title}
                    </button>
                  )}

                  <button
                    className="card-close"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation()
                      removeCardById(card.id)
                    }}
                    aria-label={text.removeCardAria}
                  >
                    x
                  </button>
                </header>

                {card.kind === 'note' ? (
                  <textarea
                    className="note-editor"
                    value={card.content}
                    onChange={(event) => updateCardContent(card.id, event.target.value)}
                    placeholder={text.notePlaceholder}
                  />
                ) : null}

                {card.kind === 'todo' ? (
                  <div className="todo-card-body">
                    <form
                      className="todo-entry"
                      onSubmit={(event) => {
                        event.preventDefault()
                        addTodoItem(card.id, 'todo')
                      }}
                    >
                      <input
                        className="todo-entry-input"
                        value={card.content}
                        onChange={(event) => updateCardContent(card.id, event.target.value)}
                        placeholder={todoText.placeholder}
                      />
                      <button
                        type="submit"
                        className="todo-add-btn"
                        disabled={!card.content.trim()}
                        onPointerDown={(event) => event.stopPropagation()}
                      >
                        {todoText.addButton}
                      </button>
                    </form>

                    <div className="todo-board">
                      {TODO_LANES.map((lane) => {
                        const laneItems = (card.todoItems ?? []).filter((item) => normalizeTodoLane(item.status) === lane)
                        const isLaneDropTarget =
                          todoDropTarget?.cardId === card.id && todoDropTarget.lane === lane && todoDropTarget.itemId === null

                        return (
                          <section
                            key={lane}
                            className={`todo-lane ${isLaneDropTarget ? 'drop-target' : ''}`}
                            onDragOver={(event) => onTodoLaneDragOver(event, card.id, lane)}
                            onDrop={(event) => onTodoDrop(event, card.id, lane)}
                          >
                            <header className="todo-lane-header">
                              <span>{todoLaneLabels[lane]}</span>
                              <span className="todo-lane-count">{laneItems.length}</span>
                            </header>

                            <div className="todo-lane-list">
                              {laneItems.length ? (
                                laneItems.map((item) => {
                                  const isItemDropTarget =
                                    todoDropTarget?.cardId === card.id &&
                                    todoDropTarget.lane === lane &&
                                    todoDropTarget.itemId === item.id

                                  return (
                                    <div
                                      key={item.id}
                                      className={`todo-board-item ${isItemDropTarget ? 'drop-before' : ''}`}
                                      draggable
                                      onPointerDown={(event) => event.stopPropagation()}
                                      onDragStart={(event) => onTodoDragStart(event, card.id, item.id, lane)}
                                      onDragEnd={onTodoDragEnd}
                                      onDragOver={(event) => onTodoItemDragOver(event, card.id, lane, item.id)}
                                      onDrop={(event) => onTodoDrop(event, card.id, lane, item.id)}
                                    >
                                      <span className="todo-board-grip">::</span>
                                      <input
                                        className="todo-item-input"
                                        value={item.text}
                                        onPointerDown={(event) => event.stopPropagation()}
                                        onChange={(event) => updateTodoText(card.id, item.id, event.target.value)}
                                        placeholder={todoText.placeholder}
                                      />
                                      <button
                                        type="button"
                                        className="todo-item-delete"
                                        draggable={false}
                                        onPointerDown={(event) => event.stopPropagation()}
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          removeTodoItem(card.id, item.id)
                                        }}
                                        aria-label={todoText.removeItemAria}
                                      >
                                        x
                                      </button>
                                    </div>
                                  )
                                })
                              ) : (
                                <p className="todo-empty">{todoText.emptyHint}</p>
                              )}
                            </div>

                            <button
                              type="button"
                              className="todo-lane-add-btn"
                              disabled={!card.content.trim()}
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={() => addTodoItem(card.id, lane)}
                            >
                              + {todoText.laneAddCard}
                            </button>
                          </section>
                        )
                      })}
                    </div>
                  </div>
                ) : null}

                {card.kind === 'calendar'
                  ? (() => {
                      const calendar = withCalendarDefaults(card.calendar)
                      const days =
                        calendar.viewMode === 'month'
                          ? buildMonthCells(calendar.monthCursor)
                          : buildWeekCells(calendar.selectedDate)

                      const eventsByDate = calendar.events.reduce<Record<string, CalendarEvent[]>>((acc, eventItem) => {
                        if (!acc[eventItem.date]) acc[eventItem.date] = []
                        acc[eventItem.date].push(eventItem)
                        return acc
                      }, {})

                      const selectedEvents = [...(eventsByDate[calendar.selectedDate] ?? [])].sort((a, b) => {
                        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
                        return (a.startTime ?? '').localeCompare(b.startTime ?? '')
                      })

                      const selectedLabel = parseDateKey(calendar.selectedDate).toLocaleDateString(
                        settings.language === 'zh' ? 'zh-CN' : 'en-US',
                        {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                        },
                      )

                      const canSubmitEvent =
                        calendar.draftAllDay || normalizeTimeRange(calendar.draftStartTime, calendar.draftEndTime) !== null

                      const periodLabel =
                        calendar.viewMode === 'month'
                          ? formatMonthLabel(calendar.monthCursor, settings.language)
                          : formatWeekLabel(calendar.selectedDate, settings.language)

                      const todayKey = toDateKey(new Date())

                      return (
                        <div className="calendar-card-body">
                          <div className="calendar-topbar">
                            <button
                              type="button"
                              className="calendar-nav-btn"
                              aria-label={calendarText.prevMonthAria}
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={() => navigateCalendar(card.id, -1)}
                            >
                              {'<'}
                            </button>

                            <div className="calendar-month-label">{periodLabel}</div>

                            <button
                              type="button"
                              className="calendar-nav-btn"
                              aria-label={calendarText.nextMonthAria}
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={() => navigateCalendar(card.id, 1)}
                            >
                              {'>'}
                            </button>
                          </div>

                          <div className="calendar-view-switch">
                            <button
                              type="button"
                              className={`calendar-view-btn ${calendar.viewMode === 'month' ? 'active' : ''}`}
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={() => setCalendarViewMode(card.id, 'month')}
                            >
                              {calendarText.viewMonth}
                            </button>
                            <button
                              type="button"
                              className={`calendar-view-btn ${calendar.viewMode === 'week' ? 'active' : ''}`}
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={() => setCalendarViewMode(card.id, 'week')}
                            >
                              {calendarText.viewWeek}
                            </button>
                          </div>

                          <div className="calendar-weekdays">
                            {calendarText.weekdays.map((weekday) => (
                              <span key={weekday}>{weekday}</span>
                            ))}
                          </div>

                          <div className={`calendar-grid ${calendar.viewMode === 'week' ? 'week-mode' : ''}`}>
                            {days.map((day, dayIndex) => {
                              const isSelected = day.dateKey === calendar.selectedDate
                              const isToday = day.dateKey === todayKey
                              const dayEvents = eventsByDate[day.dateKey] ?? []
                              const eventCount = dayEvents.length
                              const dropKey = `${card.id}:${day.dateKey}`

                              return (
                                <button
                                  key={day.dateKey}
                                  type="button"
                                  className={`calendar-day ${day.inMonth ? '' : 'outside'} ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${calendarDropTarget === dropKey ? 'drop-target' : ''}`}
                                  onPointerDown={(event) => event.stopPropagation()}
                                  onClick={() => selectCalendarDate(card.id, day.dateKey)}
                                  onDragOver={(event) => onCalendarDayDragOver(event, card.id, day.dateKey)}
                                  onDragLeave={() => onCalendarDayDragLeave(card.id, day.dateKey)}
                                  onDrop={(event) => onCalendarDayDrop(event, card.id, day.dateKey)}
                                >
                                  <span className="calendar-day-top">
                                    {calendar.viewMode === 'week' ? (
                                      <span className="calendar-day-week">{calendarText.weekdays[dayIndex]}</span>
                                    ) : null}
                                    <span className="calendar-day-number">{Number(day.dateKey.slice(8, 10))}</span>
                                  </span>

                                  {eventCount > 0 ? <span className="calendar-day-count">{eventCount}</span> : null}

                                  {calendar.viewMode === 'week' ? (
                                    <span className="calendar-day-preview">
                                      {dayEvents.slice(0, 2).map((eventItem) => (
                                        <span key={eventItem.id} className="calendar-day-preview-item">
                                          {eventItem.title}
                                        </span>
                                      ))}
                                      {eventCount > 2 ? (
                                        <span className="calendar-day-preview-more">+{eventCount - 2}</span>
                                      ) : null}
                                    </span>
                                  ) : null}
                                </button>
                              )
                            })}
                          </div>

                          <form
                            className="calendar-entry"
                            onSubmit={(event) => {
                              event.preventDefault()
                              addCalendarEvent(card.id)
                            }}
                          >
                            <p className="calendar-selected-date">{`${calendarText.selectedPrefix}${selectedLabel}`}</p>

                            <div className="calendar-entry-row">
                              <input
                                className="calendar-entry-input"
                                value={calendar.draftTitle}
                                onChange={(event) =>
                                  updateCalendarCard(card.id, (state) => ({ ...state, draftTitle: event.target.value }))
                                }
                                placeholder={calendarText.placeholder}
                              />
                              <button
                                type="submit"
                                className="calendar-add-btn"
                                disabled={!calendar.draftTitle.trim() || !canSubmitEvent}
                                onPointerDown={(event) => event.stopPropagation()}
                              >
                                {calendarText.addButton}
                              </button>
                            </div>

                            <div className="calendar-entry-meta">
                              <label className="calendar-all-day">
                                <input
                                  type="checkbox"
                                  checked={calendar.draftAllDay}
                                  onChange={(event) =>
                                    updateCalendarCard(card.id, (state) => ({ ...state, draftAllDay: event.target.checked }))
                                  }
                                />
                                <span>{calendarText.allDay}</span>
                              </label>

                              {calendar.draftAllDay ? null : (
                                <div className="calendar-time-range">
                                  <label>
                                    <span>{calendarText.startTime}</span>
                                    <input
                                      type="time"
                                      value={calendar.draftStartTime}
                                      onChange={(event) =>
                                        updateCalendarCard(card.id, (state) => ({ ...state, draftStartTime: event.target.value }))
                                      }
                                    />
                                  </label>
                                  <label>
                                    <span>{calendarText.endTime}</span>
                                    <input
                                      type="time"
                                      value={calendar.draftEndTime}
                                      onChange={(event) =>
                                        updateCalendarCard(card.id, (state) => ({ ...state, draftEndTime: event.target.value }))
                                      }
                                    />
                                  </label>
                                </div>
                              )}
                            </div>

                            {canSubmitEvent ? null : <p className="calendar-time-error">{calendarText.invalidTimeHint}</p>}
                          </form>

                          <div className="calendar-event-list">
                            {selectedEvents.length ? (
                              selectedEvents.map((eventItem) => (
                                <div key={eventItem.id} className="calendar-event-item">
                                  <span
                                    className="calendar-event-drag"
                                    draggable
                                    title={calendarText.dragHint}
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onDragStart={(event) => onCalendarEventDragStart(event, card.id, eventItem.id)}
                                    onDragEnd={onCalendarEventDragEnd}
                                  >
                                    ::
                                  </span>

                                  <div className="calendar-event-main">
                                    <span className="calendar-event-time">
                                      {formatCalendarEventTime(eventItem, settings.language)}
                                    </span>
                                    <input
                                      className="calendar-event-input"
                                      value={eventItem.title}
                                      onChange={(event) =>
                                        updateCalendarEventTitle(card.id, eventItem.id, event.target.value)
                                      }
                                      placeholder={calendarText.placeholder}
                                    />
                                  </div>

                                  <button
                                    type="button"
                                    className="calendar-event-remove"
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onClick={() => removeCalendarEvent(card.id, eventItem.id)}
                                    aria-label={text.removeCardAria}
                                  >
                                    x
                                  </button>
                                </div>
                              ))
                            ) : (
                              <p className="calendar-empty">{calendarText.emptyHint}</p>
                            )}
                          </div>
                        </div>
                      )
                    })()
                  : null}

                {card.kind === 'hint' ? (
                  <div className="hint-list">
                    {text.hintItems.map((item) => (
                      <p key={item}>{item}</p>
                    ))}
                  </div>
                ) : null}

                {card.kind === 'image' ? (
                  <div className="media-block">
                    {fileUrl ? (
                      <img src={fileUrl} alt={card.fileName ?? card.title} className="media-image" />
                    ) : (
                      <div className="media-missing">{text.mediaImageUnavailable}</div>
                    )}
                    <div className="file-meta">{card.fileName}</div>
                  </div>
                ) : null}

                {card.kind === 'video' ? (
                  <div className="media-block">
                    {fileUrl ? (
                      <video src={fileUrl} controls className="media-video" />
                    ) : (
                      <div className="media-missing">{text.mediaVideoUnavailable}</div>
                    )}
                    <div className="file-meta">{card.fileName}</div>
                  </div>
                ) : null}

                {card.kind === 'pdf' ? (
                  <div className="media-block">
                    {fileUrl ? (
                      <iframe src={fileUrl} title={card.fileName ?? card.title} className="pdf-viewer" />
                    ) : (
                      <div className="media-missing">{text.mediaPdfUnavailable}</div>
                    )}
                    <div className="file-meta">{card.fileName}</div>
                  </div>
                ) : null}

                <button
                  type="button"
                  className="card-resize-handle"
                  onPointerDown={(event) => onCardResizeStart(event, card)}
                  aria-label={text.resizeCardAria}
                  title={text.resizeCardAria}
                />
              </article>
            )
          })}
        </div>
      </section>

      {settingsOpen ? (
        <div className="settings-overlay" onClick={closeSettings}>
          <section className="settings-dialog" onClick={(event) => event.stopPropagation()}>
            <header className="settings-header">
              <h2>{text.settings}</h2>
              <button className="settings-close" onClick={closeSettings}>
                x
              </button>
            </header>

            <div className="settings-group">
              <h3>{text.languageTitle}</h3>
              <p>{text.languageHint}</p>
              <div className="language-switch">
                <button
                  className={`lang-option ${settings.language === 'zh' ? 'active' : ''}`}
                  onClick={() => updateSettings({ language: 'zh' })}
                >
                  {text.languageZh}
                </button>
                <button
                  className={`lang-option ${settings.language === 'en' ? 'active' : ''}`}
                  onClick={() => updateSettings({ language: 'en' })}
                >
                  {text.languageEn}
                </button>
              </div>
            </div>

            <div className="settings-group">
              <h3>{text.themeTitle}</h3>
              <p>{text.themeHint}</p>
              <div className="language-switch">
                <button
                  className={`lang-option ${settings.themeMode === 'system' ? 'active' : ''}`}
                  onClick={() => updateSettings({ themeMode: 'system' })}
                >
                  {text.themeSystem}
                </button>
                <button
                  className={`lang-option ${settings.themeMode === 'light' ? 'active' : ''}`}
                  onClick={() => updateSettings({ themeMode: 'light' })}
                >
                  {text.themeLight}
                </button>
                <button
                  className={`lang-option ${settings.themeMode === 'dark' ? 'active' : ''}`}
                  onClick={() => updateSettings({ themeMode: 'dark' })}
                >
                  {text.themeDark}
                </button>
              </div>
            </div>

            <div className="settings-group">
              <h3>{text.accountTitle}</h3>
              {account ? (
                <div className="account-user-card">
                  <div className="account-user-head">
                    {account.avatarUrl ? (
                      <img className="account-avatar" src={account.avatarUrl} alt={account.name} />
                    ) : (
                      <span className="account-avatar-fallback">{account.name.slice(0, 1).toUpperCase()}</span>
                    )}
                    <div className="account-user-meta">
                      <strong>{account.name}</strong>
                      <span>{account.email}</span>
                    </div>
                  </div>
                  <span>{`${text.providerPrefix}: ${accountProviderLabel}`}</span>
                  <span>{apiSessionLabel}</span>
                  <div className="panel-actions">
                    <button
                      className="mini-btn"
                      disabled={apiActionPending}
                      onClick={() => {
                        if (account) void bindAccountToApi(account)
                      }}
                    >
                      {settings.language === 'zh'
                        ? apiActionPending
                          ? '连接中...'
                          : '连接 API'
                        : apiActionPending
                          ? 'Connecting...'
                          : 'Connect API'}
                    </button>
                    <button className="mini-btn danger" onClick={logout}>
                      {text.logout}
                    </button>
                  </div>
                </div>
              ) : showLoginForm ? (
                <form className="login-form" onSubmit={submitDemoLogin}>
                  <input
                    type="text"
                    placeholder={text.loginDisplayNamePlaceholder}
                    value={loginName}
                    onChange={(event) => setLoginName(event.target.value)}
                  />
                  <input
                    type="email"
                    placeholder={text.loginEmailPlaceholder}
                    value={loginEmail}
                    onChange={(event) => setLoginEmail(event.target.value)}
                  />
                  <div className="panel-actions">
                    <button className="mini-btn" type="submit">
                      {text.signIn}
                    </button>
                    <button className="mini-btn" type="button" onClick={() => setShowLoginForm(false)}>
                      {text.cancel}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="account-empty">
                  <p>{text.loginHintInSettings}</p>
                  <div className="panel-actions">
                    <button
                      className="action-btn compact"
                      disabled={googleLoginPending}
                      onClick={() => {
                        void signInWithGoogle()
                      }}
                    >
                      {googleLoginPending ? text.googleSigningIn : text.googleQuickSignIn}
                    </button>
                    <button className="mini-btn" onClick={beginDemoLogin}>
                      {text.demoLoginLabel}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="settings-group">
              <h3>{text.openclawTitle}</h3>
              <p>{text.openclawHint}</p>

              <label className="input-row">
                <span>{text.openclawGatewayUrl}</span>
                <input
                  type="text"
                  className="settings-text-input"
                  value={openClawConfig.gatewayUrl}
                  onChange={(event) => updateOpenClawConfig({ gatewayUrl: event.target.value })}
                />
              </label>

              <label className="input-row">
                <span>{text.openclawGatewayPort}</span>
                <input
                  type="text"
                  className="settings-text-input"
                  value={openClawConfig.gatewayPort}
                  onChange={(event) => updateOpenClawConfig({ gatewayPort: event.target.value })}
                />
              </label>

              <label className="input-row">
                <span>{text.openclawGatewayToken}</span>
                <input
                  type="password"
                  className="settings-text-input"
                  value={openClawConfig.gatewayToken}
                  onChange={(event) => updateOpenClawConfig({ gatewayToken: event.target.value })}
                />
              </label>

              <label className="input-row">
                <span>{text.openclawSessionKey}</span>
                <input
                  type="text"
                  className="settings-text-input"
                  value={openClawConfig.sessionKey}
                  onChange={(event) => updateOpenClawConfig({ sessionKey: event.target.value })}
                />
              </label>

              <label className="input-row">
                <span>{text.openclawSessionKeys}</span>
                <input
                  type="text"
                  className="settings-text-input"
                  value={openClawConfig.sessionKeys}
                  onChange={(event) => updateOpenClawConfig({ sessionKeys: event.target.value })}
                />
              </label>

              <label className="input-row">
                <span>{text.openclawSource}</span>
                <input
                  type="text"
                  className="settings-text-input"
                  value={openClawConfig.source}
                  onChange={(event) => updateOpenClawConfig({ source: event.target.value })}
                />
              </label>

              <label className="input-row">
                <span>{text.googleClientIdLabel}</span>
                <input
                  type="text"
                  className="settings-text-input"
                  value={openClawConfig.googleClientId}
                  onChange={(event) => updateOpenClawConfig({ googleClientId: event.target.value })}
                />
              </label>
              <p>{text.googleClientIdHint}</p>

              <div className="panel-actions">
                <button className="mini-btn" onClick={saveOpenClawSettings}>
                  {text.openclawSave}
                </button>
                <button
                  className="mini-btn"
                  onClick={() => {
                    void copyOpenClawConfig()
                  }}
                >
                  {text.openclawCopyConfig}
                </button>
              </div>

              <label className="input-row">
                <span>{settings.language === 'zh' ? 'API Base URL' : 'API Base URL'}</span>
                <input type="text" className="settings-text-input" value={apiBaseLabel} readOnly />
              </label>

              <label className="input-row">
                <span>{settings.language === 'zh' ? 'API 服务状态' : 'API Service Status'}</span>
                <div className={`settings-api-status ${apiHealthState}`}>
                  <strong>{apiHealthLabel}</strong>
                  <button
                    type="button"
                    className="mini-btn"
                    disabled={apiHealthState === 'checking'}
                    onClick={() => {
                      void checkApiService()
                    }}
                  >
                    {settings.language === 'zh'
                      ? apiHealthState === 'checking'
                        ? '检测中...'
                        : '重新检测'
                      : apiHealthState === 'checking'
                        ? 'Checking...'
                        : 'Check again'}
                  </button>
                </div>
              </label>

              <label className="input-row">
                <span>{settings.language === 'zh' ? '最新 API Key' : 'Latest API Key'}</span>
                <input
                  type="text"
                  className="settings-text-input"
                  value={apiKeyMasked || (settings.language === 'zh' ? '尚未生成' : 'Not generated')}
                  readOnly
                />
              </label>

              <div className="panel-actions">
                <button
                  className="mini-btn"
                  disabled={apiActionPending}
                  onClick={() => {
                    void generateApiKeyForSkill()
                  }}
                >
                  {settings.language === 'zh'
                    ? apiActionPending
                      ? '处理中...'
                      : '生成 API Key'
                    : apiActionPending
                      ? 'Working...'
                      : 'Generate API key'}
                </button>
                <button
                  className="mini-btn"
                  disabled={apiActionPending}
                  onClick={() => {
                    void copyOpenClawSkillJson()
                  }}
                >
                  {settings.language === 'zh'
                    ? apiActionPending
                      ? '处理中...'
                      : '复制 Skill JSON'
                    : apiActionPending
                      ? 'Working...'
                      : 'Copy skill JSON'}
                </button>
              </div>

              {openClawNotice ? <p className="openclaw-inline-notice">{openClawNotice}</p> : null}

              <div className="openclaw-steps">
                <section className="openclaw-step">
                  <div className="openclaw-step-head">
                    <strong>{settings.language === 'zh' ? '步骤 2：SKILL.md' : 'Step 2: SKILL.md'}</strong>
                    <div className="panel-actions">
                      <button
                        className="mini-btn"
                        onClick={() => {
                          void copyTextWithNotice(
                            openClawSkillMarkdown,
                            '已复制 SKILL.md。',
                            'SKILL.md copied.',
                            '复制 SKILL.md 失败：',
                            'Failed to copy SKILL.md: ',
                          )
                        }}
                      >
                        {settings.language === 'zh' ? '复制' : 'Copy'}
                      </button>
                      <button
                        className="mini-btn"
                        onClick={() => {
                          downloadSkillMarkdown(openClawSkillMarkdown)
                        }}
                      >
                        {settings.language === 'zh' ? '下载' : 'Download'}
                      </button>
                    </div>
                  </div>
                  <pre className="openclaw-code"><code>{openClawSkillMarkdown}</code></pre>
                </section>

                <section className="openclaw-step">
                  <div className="openclaw-step-head">
                    <strong>{settings.language === 'zh' ? '步骤 3：openclaw.json' : 'Step 3: openclaw.json'}</strong>
                    <button
                      className="mini-btn"
                      onClick={() => {
                        void copyTextWithNotice(
                          openClawBotConfigSnippet,
                          '已复制 openclaw.json 配置。',
                          'openclaw.json snippet copied.',
                          '复制 openclaw.json 失败：',
                          'Failed to copy openclaw.json snippet: ',
                        )
                      }}
                    >
                      {settings.language === 'zh' ? '复制' : 'Copy'}
                    </button>
                  </div>
                  <p>
                    {settings.language === 'zh'
                      ? '把下面片段加入 openclaw.json / moltbot.json，并替换真实 API key。'
                      : 'Add this snippet to openclaw.json or moltbot.json, then replace with your real API key.'}
                  </p>
                  <pre className="openclaw-code"><code>{openClawBotConfigSnippet}</code></pre>
                </section>

                <section className="openclaw-step">
                  <div className="openclaw-step-head">
                    <strong>{settings.language === 'zh' ? '步骤 4：安装命令' : 'Step 4: Install command'}</strong>
                    <button
                      className="mini-btn"
                      onClick={() => {
                        void copyTextWithNotice(
                          openClawInstallCmd,
                          '已复制安装命令。',
                          'Install command copied.',
                          '复制安装命令失败：',
                          'Failed to copy install command: ',
                        )
                      }}
                    >
                      {settings.language === 'zh' ? '复制' : 'Copy'}
                    </button>
                  </div>
                  <pre className="openclaw-code"><code>{openClawInstallCmd}</code></pre>
                  <ol className="openclaw-quickstart">
                    <li>{settings.language === 'zh' ? '下载并安装 SKILL.md 到 ~/.openclaw/skills/open-canvas/SKILL.md。' : 'Download and install SKILL.md to ~/.openclaw/skills/open-canvas/SKILL.md.'}</li>
                    <li>{settings.language === 'zh' ? '把上面的配置片段加入 openclaw.json。' : 'Add the snippet above into openclaw.json.'}</li>
                    <li>{settings.language === 'zh' ? '替换为真实 API key，重启 OpenClaw。' : 'Replace with real API key and restart OpenClaw.'}</li>
                  </ol>
                </section>
              </div>

            </div>

            <div className="settings-group">
              <h3>{text.syncSettingsTitle}</h3>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={settings.autoSync}
                  onChange={(event) => updateSettings({ autoSync: event.target.checked })}
                />
                <span>{text.autoSyncLabel}</span>
              </label>

              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={settings.syncOnStartup}
                  onChange={(event) => updateSettings({ syncOnStartup: event.target.checked })}
                />
                <span>{text.syncOnStartupLabel}</span>
              </label>

              <label className="input-row">
                <span>{text.syncDebounceLabel}</span>
                <input
                  type="number"
                  min={500}
                  max={20000}
                  value={settings.syncDebounceMs}
                  onChange={(event) =>
                    updateSettings({
                      syncDebounceMs: clamp(Number(event.target.value) || 500, 500, 20000),
                    })
                  }
                />
              </label>
            </div>

            <div className="settings-group">
              <h3>{text.futureTitle}</h3>
              <p>{text.futureLine1}</p>
              <p>{text.futureLine2}</p>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}

export default App
