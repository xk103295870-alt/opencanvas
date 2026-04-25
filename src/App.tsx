import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLayoutEffect } from 'react'
import type { DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent, WheelEvent } from 'react'
import './App.css'
import {
  apiCreateAsset,
  apiCreateCard,
  apiCreateGrid,
  apiDeleteAsset,
  apiDeleteCard,
  apiDeleteGrid,
  apiGetWorkspaceState,
  apiUpdateCard,
  apiUpdateGrid,
  getApiBaseUrl,
} from './apiClient'

type LanguageCode = 'zh' | 'en'
type ThemeMode = 'system' | 'light' | 'dark' | 'glass'
type SyncStatus = 'idle' | 'syncing' | 'ok' | 'error'
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

const LOCAL_ACCOUNT: AccountUser = {
  id: 'local-open-canvas',
  name: 'Local Workspace',
  email: 'local@open-canvas.local',
  provider: 'demo',
}

type CliBridgeConfig = {
  googleClientId: string
}

type DisabledRemoteAuth = {
  apiBaseUrl?: string
  lastApiKey?: string
}

type SyncMeta = {
  lastLocalUpdateAt: number
  lastSyncAt: number | null
}

type PersistedAppStateSnapshot = {
  version: number
  grids: GridData[]
  activeGridId: string
  viewport: ViewportState
  savedAt: number
}

type CliBridgeCardPatch = Partial<
  Pick<CardData, 'title' | 'content' | 'x' | 'y' | 'width' | 'height' | 'fileName' | 'externalUrl' | 'todoItems' | 'calendar'>
>

type CliBridgeLayoutSyncMeta = {
  lastLayoutMutationAt: number
  lastLayoutSyncAt: number
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
  removeGridAria: string
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
  googleClientIdLabel: string
  googleClientIdHint: string
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
  themeGlass: string
  unnamedGrid: string
  unnamedCard: string
  demoUser: string
  gridPrefix: string
  syncSettingsTitle: string
  autoSyncLabel: string
  syncOnStartupLabel: string
  syncDebounceLabel: string
  cliBridgeTitle: string
  cliBridgeHint: string
  updateTitle: string
  updateHint: string
  currentVersionLabel: string
  currentVersionUnknown: string
  currentRevisionLabel: string
  remoteRevisionLabel: string
  updateStatusLabel: string
  updateUpToDate: string
  updateHasUpdate: string
  updateTrackingLabel: string
  updateRemoteRevisionUnavailable: string
  updateButton: string
  updateWorking: string
  updateSuccess: string
  updateFailedPrefix: string
  updateLoginRequired: string
  updateUnavailable: string
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
  id?: string
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

type OpenCanvasSetConfigPayload = Partial<CliBridgeConfig>

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
        fileName?: string
        externalUrl?: string
        todoItems?: TodoItem[]
        calendar?: CalendarState
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
    fileName?: string
    externalUrl?: string
    todoItems?: TodoItem[]
    calendar?: CalendarState
    requestId?: string
  }) => Promise<OpenCanvasCommandResult>
  getState: (requestId?: string) => Promise<OpenCanvasCommandResult>
  getConfig: (requestId?: string) => Promise<OpenCanvasCommandResult>
  setConfig: (payload?: OpenCanvasSetConfigPayload & { requestId?: string }) => Promise<OpenCanvasCommandResult>
}

declare global {
  interface Window {
    openCanvas?: OpenCanvasGlobalApi
  }
}

const DB_NAME = 'open-canvas-db'
const DB_VERSION = 1
const STORE_APP = 'app_state'
const STORE_ASSETS = 'assets'
const APP_STATE_KEY = 'main'
const PERSISTED_APP_STATE_SHADOW_KEY = 'open-canvas-app-state-shadow'
const AUTH_STORAGE_KEY = 'open-canvas-fake-auth'
const SETTINGS_STORAGE_KEY = 'open-canvas-settings'
const CLI_BRIDGE_SETTINGS_KEY = 'open-canvas-cliBridge-settings'
const SYNC_META_KEY = 'open-canvas-sync-meta'
const CLI_BRIDGE_LAYOUT_SYNC_KEY = 'open-canvas-cliBridge-layout-sync'
const CLOUD_KEY_PREFIX = 'open-canvas-cloud-'
const BRAND_LOGO_DATA_URL = `data:image/svg+xml,${encodeURIComponent(
  '<svg width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="13" y="13" width="230" height="230" rx="43" fill="#22F15A"/><path d="M62 77H86.5L100.5 163H102.5L116.5 103H140L154 163H156L170 77H194.5L171.5 179H139.5L128.5 128.5H127.5L116.5 179H84.5L62 77Z" fill="#050505"/></svg>',
)}`

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

const DEFAULT_CLI_BRIDGE_CONFIG: CliBridgeConfig = {
  googleClientId: '',
}

const DEFAULT_SYNC_META: SyncMeta = {
  lastLocalUpdateAt: Date.now(),
  lastSyncAt: null,
}

const DEFAULT_CLI_BRIDGE_LAYOUT_SYNC_META: CliBridgeLayoutSyncMeta = {
  lastLayoutMutationAt: 0,
  lastLayoutSyncAt: 0,
}

const I18N: Record<LanguageCode, I18nText> = {
  zh: {
    settings: '设置',
    syncTitle: '同步',
    ready: '就绪',
    syncing: '同步中...',
    synced: '已同步',
    syncError: '同步失败',
    syncNeedLogin: '本地模式已启用，后续可接入登录同步。',
    syncPleaseSignIn: '当前使用本地模式，无需登录。',
    syncingWorkspace: '正在同步当前画布...',
    syncCloudCreated: '已创建云端副本。',
    syncPulledPrefix: '已拉取云端版本（',
    syncPushedPrefix: '已推送本地更新（',
    syncFailedPrefix: '同步失败：',
    syncNow: '立即同步',
    lastSyncPrefix: '上次同步：',
    lastSyncNever: '上次同步：从未',
    accountPrefix: '账号',
    accountSignedOutHint: '账号：本地模式',
    newNoteCard: '+ 新建便利贴',
    newTodoCard: '+ 待办卡片',
    newCalendarCard: '+ 日历卡片',
    newGridAria: '新建画布',
    removeGridAria: '删除画布',
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
    googleClientIdLabel: 'Google Client ID',
    googleClientIdHint: '用于 Google 快捷登录（OAuth）。',
    loginHintInSettings: '当前默认使用本地模式，登录接口保留用于后续扩展。',
    providerPrefix: '模式',
    providerDemo: '本地模式',
    providerGoogle: 'Google',
    languageTitle: '语言',
    languageHint: '当前支持中英文切换',
    languageZh: '中文',
    languageEn: 'English',
    themeTitle: '主题',
    themeHint: '可跟随系统，也可切换浅色、深色或 Apple 风格液体玻璃',
    themeSystem: '跟随系统',
    themeLight: '浅色',
    themeDark: '深色',
    themeGlass: '液体玻璃',
    unnamedGrid: '未命名画布',
    unnamedCard: '未命名卡片',
    demoUser: '演示用户',
    gridPrefix: '画布',
    syncSettingsTitle: '同步策略',
    autoSyncLabel: '自动同步（本地改动后自动执行）',
    syncOnStartupLabel: '启动后自动检查云端版本',
    syncDebounceLabel: '自动同步延迟（毫秒）',
    cliBridgeTitle: 'CLI Bridge 集成',
    cliBridgeHint: '这里保留 API、Skill 和本地联动需要的配置，旧网关字段已收起。',
    updateTitle: '在线更新',
    updateHint: '点击后会先拉取最新代码、安装依赖，再重启本地服务。仅适用于 git 仓库安装，若有本地改动请先提交或暂存。',
    currentVersionLabel: '当前版本',
    currentVersionUnknown: '未知',
    currentRevisionLabel: '当前修订',
    remoteRevisionLabel: '远端修订',
    updateStatusLabel: '更新状态',
    updateUpToDate: '已是最新',
    updateHasUpdate: '发现新版本',
    updateTrackingLabel: '追踪分支',
    updateRemoteRevisionUnavailable: '远端修订暂不可用',
    updateButton: '在线更新',
    updateWorking: '更新中...',
    updateSuccess: '更新已启动，服务重启后请刷新页面。',
    updateFailedPrefix: '更新失败：',
    updateLoginRequired: '请先登录后再执行在线更新。',
    updateUnavailable: '当前安装不是 git 仓库，无法在线更新。',
    futureTitle: '未来扩展',
    futureLine1: '当前默认免登录使用，本地 API 和鉴权接口保留给后续扩展。',
    futureLine2: '当前结构已支持 Web + 桌面 + 多平台扩展。',
  },
  en: {
    settings: 'Settings',
    syncTitle: 'SYNC',
    ready: 'Ready',
    syncing: 'Syncing...',
    synced: 'Synced',
    syncError: 'Sync failed',
    syncNeedLogin: 'Local mode is enabled. Auth sync can be connected later.',
    syncPleaseSignIn: 'Local mode is active. Sign-in is not required.',
    syncingWorkspace: 'Syncing workspace...',
    syncCloudCreated: 'Cloud snapshot created.',
    syncPulledPrefix: 'Pulled cloud snapshot (',
    syncPushedPrefix: 'Pushed local snapshot (',
    syncFailedPrefix: 'Sync failed: ',
    syncNow: 'Sync now',
    lastSyncPrefix: 'Last sync: ',
    lastSyncNever: 'Last sync: never',
    accountPrefix: 'Account',
    accountSignedOutHint: 'Account: local mode',
    newNoteCard: '+ New note card',
    newTodoCard: '+ New todo card',
    newCalendarCard: '+ New calendar card',
    newGridAria: 'New grid',
    removeGridAria: 'Remove grid',
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
    googleClientIdLabel: 'Google Client ID',
    googleClientIdHint: 'Used for Google OAuth quick sign-in.',
    loginHintInSettings: 'Local mode is enabled by default. Auth interfaces are reserved for later extension.',
    providerPrefix: 'Mode',
    providerDemo: 'Local mode',
    providerGoogle: 'Google',
    languageTitle: 'Language',
    languageHint: 'Currently supports Chinese and English',
    languageZh: '中文',
    languageEn: 'English',
    themeTitle: 'Theme',
    themeHint: 'Follow system or switch manually between light, dark, or an Apple-style liquid glass look',
    themeSystem: 'System',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeGlass: 'Liquid Glass',
    unnamedGrid: 'Untitled Grid',
    unnamedCard: 'Untitled Card',
    demoUser: 'Demo User',
    gridPrefix: 'Grid',
    syncSettingsTitle: 'Sync Strategy',
    autoSyncLabel: 'Auto sync (after local changes)',
    syncOnStartupLabel: 'Check cloud snapshot on startup',
    syncDebounceLabel: 'Auto sync debounce (ms)',
    cliBridgeTitle: 'CLI Bridge Integration',
    cliBridgeHint: 'Keep only the API, skill and local integration settings. Legacy gateway fields are hidden.',
    updateTitle: 'Online Update',
    updateHint: 'Pull the latest code, install dependencies, and restart local services. Git checkout installs only. Commit or stash local changes first.',
    currentVersionLabel: 'Current version',
    currentVersionUnknown: 'Unknown',
    currentRevisionLabel: 'Current revision',
    remoteRevisionLabel: 'Remote revision',
    updateStatusLabel: 'Update status',
    updateUpToDate: 'Up to date',
    updateHasUpdate: 'Update available',
    updateTrackingLabel: 'Tracking branch',
    updateRemoteRevisionUnavailable: 'Remote revision unavailable',
    updateButton: 'Update now',
    updateWorking: 'Updating...',
    updateSuccess: 'Update started. Refresh the page after services restart.',
    updateFailedPrefix: 'Update failed: ',
    updateLoginRequired: 'Please sign in before triggering an online update.',
    updateUnavailable: 'This install is not a git checkout, so online updates are unavailable.',
    futureTitle: 'Future Extension',
    futureLine1: 'No-login local mode is the default; API and auth interfaces remain available for future extension.',
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

const getMsUntilNextLocalDay = () => {
  const now = new Date()
  const nextDay = new Date(now)
  nextDay.setDate(now.getDate() + 1)
  nextDay.setHours(0, 0, 0, 0)
  return Math.max(1000, nextDay.getTime() - now.getTime())
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

const isMediaCardKind = (kind: CardKind): kind is Extract<CardKind, 'image' | 'video' | 'pdf'> =>
  kind === 'image' || kind === 'video' || kind === 'pdf'

const mergeRemoteGridsWithLocalMediaCards = (remoteGrids: GridData[], localGrids: GridData[]): GridData[] => {
  if (!Array.isArray(remoteGrids) || !Array.isArray(localGrids)) return remoteGrids

  const localById = new Map(localGrids.map((grid) => [grid.id, grid]))

  return remoteGrids.map((remoteGrid) => {
    const localGrid = localById.get(remoteGrid.id)
    if (!localGrid) return remoteGrid

    const remoteCardIds = new Set(remoteGrid.cards.map((card) => card.id))
    const preservedMediaCards = localGrid.cards
      .filter((card) => isMediaCardKind(card.kind) && !remoteCardIds.has(card.id))
      .map((card) => ({ ...card }))

    if (preservedMediaCards.length === 0) return remoteGrid

    return {
      ...remoteGrid,
      cards: [...remoteGrid.cards, ...preservedMediaCards],
    }
  })
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

const trimConfigValue = (value: unknown, maxLength = 260) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : ''

const normalizeThemeMode = (value: unknown): ThemeMode => {
  const mode = String(value || '')
    .trim()
    .toLowerCase()
  if (mode === 'light') return 'light'
  if (mode === 'dark') return 'dark'
  if (mode === 'glass') return 'glass'
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

const normalizeCliBridgeConfig = (input: Partial<CliBridgeConfig> | null | undefined): CliBridgeConfig => {
  const googleClientId = trimConfigValue(input?.googleClientId, 240)

  return {
    googleClientId,
  }
}

const normalizeCliBridgeLayoutSyncMeta = (
  input: Partial<CliBridgeLayoutSyncMeta> | null | undefined,
): CliBridgeLayoutSyncMeta => ({
  lastLayoutMutationAt: Math.max(0, Number.isFinite(Number(input?.lastLayoutMutationAt)) ? Number(input?.lastLayoutMutationAt) : 0),
  lastLayoutSyncAt: Math.max(0, Number.isFinite(Number(input?.lastLayoutSyncAt)) ? Number(input?.lastLayoutSyncAt) : 0),
})

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

const isSingletonCardKind = (kind: CardKind) => kind === 'todo' || kind === 'calendar'

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

const normalizePersistedStateSnapshot = (input: unknown): PersistedAppStateSnapshot | null => {
  if (!input || typeof input !== 'object') return null

  const raw = input as Record<string, unknown>
  const version = Number(raw.version)
  const grids = Array.isArray(raw.grids) ? (raw.grids as GridData[]) : null
  const activeGridId = typeof raw.activeGridId === 'string' ? raw.activeGridId.trim() : ''
  const viewport = raw.viewport && typeof raw.viewport === 'object' ? (raw.viewport as ViewportState) : null
  const savedAt = Number(raw.savedAt)

  if (!Number.isFinite(version) || version < 1 || !grids || !activeGridId || !viewport) {
    return null
  }

  return {
    version,
    grids,
    activeGridId,
    viewport,
    savedAt: Number.isFinite(savedAt) ? savedAt : Date.now(),
  }
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

type AppRuntime = 'web' | 'obsidian'

type AppProps = {
  runtime?: AppRuntime
}

function App({ runtime = 'web' }: AppProps) {
  const isObsidianRuntime = runtime === 'obsidian'
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
  const [todayKey, setTodayKey] = useState(() => toDateKey(new Date()))

  const [account, setAccount] = useState<AccountUser>(LOCAL_ACCOUNT)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [cliBridgeConfig, setCliBridgeConfig] = useState<CliBridgeConfig>(DEFAULT_CLI_BRIDGE_CONFIG)

  const [, setSyncStatus] = useState<SyncStatus>('idle')
  const [, setSyncMessage] = useState('')
  const [syncMeta, setSyncMeta] = useState<SyncMeta>(DEFAULT_SYNC_META)

  const [editingGridId, setEditingGridId] = useState<string | null>(null)
  const [gridNameDraft, setGridNameDraft] = useState('')

  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [cardTitleDraft, setCardTitleDraft] = useState('')

  const [calendarDropTarget, setCalendarDropTarget] = useState<string | null>(null)
  const [todoDropTarget, setTodoDropTarget] = useState<{ cardId: string; lane: TodoLane; itemId: string | null } | null>(null)

  const canvasRef = useRef<HTMLElement | null>(null)
  const gridsRef = useRef(grids)
  const viewportRef = useRef(viewport)
  const assetUrlsRef = useRef(assetUrls)
  const syncMetaRef = useRef(syncMeta)
  const cliBridgeLayoutSyncRef = useRef<CliBridgeLayoutSyncMeta>(DEFAULT_CLI_BRIDGE_LAYOUT_SYNC_META)
  const cliBridgePatchTimerRef = useRef<Record<string, number>>({})
  const cliBridgePendingPatchRef = useRef<Record<string, CliBridgeCardPatch>>({})

  const dragStateRef = useRef<DragState>(null)
  const panStateRef = useRef<PanState>(null)
  const resizeStateRef = useRef<ResizeState>(null)
  const calendarDragStateRef = useRef<CalendarDragState>(null)
  const todoDragStateRef = useRef<TodoDragState>(null)

  const persistTimerRef = useRef<number | null>(null)
  const skipLocalSyncMetaUpdateRef = useRef(false)
  const startupSyncUserRef = useRef<string | null>(null)
  const serverAuth = useRef<DisabledRemoteAuth | null>(null).current
  const lastCliBridgeWorkspaceUpdatedAtRef = useRef<string | null>(null)
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
    gridsRef.current = grids
  }, [grids])

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
    let timer: number | null = null

    const scheduleNextLocalDay = () => {
      setTodayKey(toDateKey(new Date()))
      timer = window.setTimeout(scheduleNextLocalDay, getMsUntilNextLocalDay() + 1000)
    }

    timer = window.setTimeout(scheduleNextLocalDay, getMsUntilNextLocalDay() + 1000)

    return () => {
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [])

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
    const openClaw = readJson<Partial<CliBridgeConfig>>(CLI_BRIDGE_SETTINGS_KEY)
    const meta = readJson<SyncMeta>(SYNC_META_KEY)
    const layoutMeta = readJson<Partial<CliBridgeLayoutSyncMeta>>(CLI_BRIDGE_LAYOUT_SYNC_KEY)
    const normalizedAccount = normalizeAccount(auth)

    if (normalizedAccount) {
      setAccount(normalizedAccount)
      writeJson(AUTH_STORAGE_KEY, normalizedAccount)
    } else {
      setAccount(LOCAL_ACCOUNT)
    }
    if (setting) setSettings(normalizeSettings(setting))
    if (openClaw) setCliBridgeConfig(normalizeCliBridgeConfig({ ...DEFAULT_CLI_BRIDGE_CONFIG, ...openClaw }))
    if (meta) setSyncMeta(meta)
    if (layoutMeta) cliBridgeLayoutSyncRef.current = normalizeCliBridgeLayoutSyncMeta(layoutMeta)
  }, [])

  useEffect(() => {
    let cancelled = false

    const hydrate = async () => {
      try {
        const persistedShadow = normalizePersistedStateSnapshot(readJson<unknown>(PERSISTED_APP_STATE_SHADOW_KEY))
        const [stateFromDb, assetsFromDb] = await Promise.all([getPersistedState(), getAllAssets()])
        if (cancelled) return

        const persistedState = persistedShadow ?? stateFromDb
        if (persistedState && persistedState.grids.length > 0) {
          const normalizedGrids = normalizeGridsForTodoBoard(persistedState.grids)
          setGrids(normalizedGrids)
          setActiveGridId(persistedState.activeGridId || normalizedGrids[0].id)
          setViewport(persistedState.viewport ?? initialViewport)
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

  const saveCliBridgeConfig = useCallback((nextConfig: CliBridgeConfig) => {
    setCliBridgeConfig(nextConfig)
    writeJson(CLI_BRIDGE_SETTINGS_KEY, nextConfig)
  }, [])

  const updateCliBridgeConfig = useCallback((partial: Partial<CliBridgeConfig>) => {
    setCliBridgeConfig((current) => {
      const next = normalizeCliBridgeConfig({ ...current, ...partial })
      writeJson(CLI_BRIDGE_SETTINGS_KEY, next)
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

  const persistLocalStateSnapshot = useCallback((state: PersistedAppState) => {
    const snapshot: PersistedAppStateSnapshot = {
      ...state,
      savedAt: Date.now(),
    }
    writeJson(PERSISTED_APP_STATE_SHADOW_KEY, snapshot)

    const nextMeta: SyncMeta = {
      ...syncMetaRef.current,
      lastLocalUpdateAt: snapshot.savedAt,
    }
    syncMetaRef.current = nextMeta
    writeJson(SYNC_META_KEY, nextMeta)
  }, [])

  useLayoutEffect(() => {
    if (!hydrated) return

    persistLocalStateSnapshot({
      version: 1,
      grids,
      activeGridId,
      viewport,
    })
  }, [activeGridId, grids, hydrated, persistLocalStateSnapshot, viewport])

  const resolveApiBaseUrl = useCallback(() => (serverAuth?.apiBaseUrl || getApiBaseUrl()).trim(), [serverAuth?.apiBaseUrl])

  const updateCliBridgeLayoutSyncMeta = useCallback((partial: Partial<CliBridgeLayoutSyncMeta>) => {
    const next = normalizeCliBridgeLayoutSyncMeta({ ...cliBridgeLayoutSyncRef.current, ...partial })
    cliBridgeLayoutSyncRef.current = next
    writeJson(CLI_BRIDGE_LAYOUT_SYNC_KEY, next)
    return next
  }, [])

  const persistCliBridgeGridCreate = useCallback(
    async (grid: GridData, activateGrid = false) => {
      if (!account || !serverAuth?.lastApiKey) return false

      try {
        await apiCreateGrid(
          serverAuth.lastApiKey,
          {
            id: grid.id,
            name: grid.name,
            activate: activateGrid,
          },
          resolveApiBaseUrl(),
        )
        updateCliBridgeLayoutSyncMeta({ lastLayoutSyncAt: Date.now() })
        return true
      } catch (error) {
        console.error('Failed to persist CLI Bridge grid creation:', error)
        return false
      }
    },
    [account, resolveApiBaseUrl, serverAuth?.lastApiKey, updateCliBridgeLayoutSyncMeta],
  )

  const persistCliBridgeGridUpdate = useCallback(
    async (gridId: string, updates: { name?: string; activate?: boolean }) => {
      if (!account || !serverAuth?.lastApiKey) return false

      try {
        await apiUpdateGrid(serverAuth.lastApiKey, gridId, updates, resolveApiBaseUrl())
        updateCliBridgeLayoutSyncMeta({ lastLayoutSyncAt: Date.now() })
        return true
      } catch (error) {
        console.error('Failed to persist CLI Bridge grid update:', error)
        return false
      }
    },
    [account, resolveApiBaseUrl, serverAuth?.lastApiKey, updateCliBridgeLayoutSyncMeta],
  )

  const persistCliBridgeGridDelete = useCallback(
    async (gridId: string) => {
      if (!account || !serverAuth?.lastApiKey) return false

      try {
        await apiDeleteGrid(serverAuth.lastApiKey, gridId, resolveApiBaseUrl())
        updateCliBridgeLayoutSyncMeta({ lastLayoutSyncAt: Date.now() })
        return true
      } catch (error) {
        console.error('Failed to persist CLI Bridge grid deletion:', error)
        return false
      }
    },
    [account, resolveApiBaseUrl, serverAuth?.lastApiKey, updateCliBridgeLayoutSyncMeta],
  )

  const persistCliBridgeAssetUpload = useCallback(
    async (assetId: string, name: string, type: string, blob: Blob) => {
      if (!account || !serverAuth?.lastApiKey) return null

      try {
        const dataUrl = await blobToDataUrl(blob)
        const uploaded = await apiCreateAsset(
          serverAuth.lastApiKey,
          {
            id: assetId,
            name,
            type,
            dataUrl,
          },
          resolveApiBaseUrl(),
        )
        updateCliBridgeLayoutSyncMeta({ lastLayoutSyncAt: Date.now() })
        return uploaded.assetUrl
      } catch (error) {
        console.error('Failed to persist CLI Bridge asset upload:', error)
        return null
      }
    },
    [account, resolveApiBaseUrl, serverAuth?.lastApiKey, updateCliBridgeLayoutSyncMeta],
  )

  const persistCliBridgeAssetDelete = useCallback(
    async (assetId: string) => {
      if (!account || !serverAuth?.lastApiKey) return false

      try {
        await apiDeleteAsset(serverAuth.lastApiKey, assetId, resolveApiBaseUrl())
        updateCliBridgeLayoutSyncMeta({ lastLayoutSyncAt: Date.now() })
        return true
      } catch (error) {
        console.error('Failed to persist CLI Bridge asset deletion:', error)
        return false
      }
    },
    [account, resolveApiBaseUrl, serverAuth?.lastApiKey, updateCliBridgeLayoutSyncMeta],
  )

  const clearCliBridgePatchTimer = useCallback((cardId: string) => {
    const timer = cliBridgePatchTimerRef.current[cardId]
    if (timer !== undefined) {
      window.clearTimeout(timer)
      delete cliBridgePatchTimerRef.current[cardId]
    }
    delete cliBridgePendingPatchRef.current[cardId]
  }, [])

  const persistCliBridgeCardPatch = useCallback(
    async (cardId: string, updates: CliBridgeCardPatch) => {
      if (!account || !serverAuth?.lastApiKey) return false

      try {
        await apiUpdateCard(serverAuth.lastApiKey, cardId, updates, resolveApiBaseUrl())
        updateCliBridgeLayoutSyncMeta({ lastLayoutSyncAt: Date.now() })
        return true
      } catch (error) {
        console.error('Failed to persist CLI Bridge card patch:', error)
        return false
      }
    },
    [account, resolveApiBaseUrl, serverAuth?.lastApiKey, updateCliBridgeLayoutSyncMeta],
  )

  const scheduleCliBridgeCardPatch = useCallback(
    (cardId: string, updates: CliBridgeCardPatch, delayMs = 500) => {
      const next = { ...(cliBridgePendingPatchRef.current[cardId] ?? {}), ...updates }
      cliBridgePendingPatchRef.current[cardId] = next

      const existingTimer = cliBridgePatchTimerRef.current[cardId]
      if (existingTimer !== undefined) {
        window.clearTimeout(existingTimer)
      }

      cliBridgePatchTimerRef.current[cardId] = window.setTimeout(() => {
        const patch = cliBridgePendingPatchRef.current[cardId]
        delete cliBridgePendingPatchRef.current[cardId]
        delete cliBridgePatchTimerRef.current[cardId]
        if (!patch) return
        void persistCliBridgeCardPatch(cardId, patch)
      }, delayMs)
    },
    [persistCliBridgeCardPatch],
  )

  const persistCliBridgeCardCreate = useCallback(
    async (gridId: string, card: CardData, activateGrid = false) => {
      if (!account || !serverAuth?.lastApiKey) return false

      try {
        await apiCreateCard(
          serverAuth.lastApiKey,
          {
            id: card.id,
            kind: card.kind,
            gridId,
            title: card.title,
            content: card.content,
            x: card.x,
            y: card.y,
            width: card.width,
            height: card.height,
            activateGrid,
            fileName: card.fileName,
            mediaUrl: card.externalUrl,
            todoItems: card.todoItems,
            calendar: card.calendar,
          },
          resolveApiBaseUrl(),
        )
        updateCliBridgeLayoutSyncMeta({ lastLayoutSyncAt: Date.now() })
        return true
      } catch (error) {
        console.error('Failed to persist CLI Bridge card creation:', error)
        return false
      }
    },
    [account, resolveApiBaseUrl, serverAuth?.lastApiKey, updateCliBridgeLayoutSyncMeta],
  )

  const persistCliBridgeCardDelete = useCallback(
    async (cardId: string) => {
      if (!account || !serverAuth?.lastApiKey) return false

      try {
        await apiDeleteCard(serverAuth.lastApiKey, cardId, resolveApiBaseUrl())
        updateCliBridgeLayoutSyncMeta({ lastLayoutSyncAt: Date.now() })
        return true
      } catch (error) {
        console.error('Failed to persist CLI Bridge card deletion:', error)
        return false
      }
    },
    [account, resolveApiBaseUrl, serverAuth?.lastApiKey, updateCliBridgeLayoutSyncMeta],
  )

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('open-canvas:config', {
        detail: {
          cliBridge: cliBridgeConfig,
        },
      }),
    )
  }, [cliBridgeConfig])

  useEffect(
    () => () => {
      Object.values(cliBridgePatchTimerRef.current).forEach((timer) => window.clearTimeout(timer))
      cliBridgePatchTimerRef.current = {}
      cliBridgePendingPatchRef.current = {}
    },
    [],
  )

  const pullCliBridgeWorkspace = useCallback(async () => {
    if (!account || !serverAuth?.lastApiKey) return false

    try {
      const { lastLayoutMutationAt, lastLayoutSyncAt } = cliBridgeLayoutSyncRef.current
      if (lastLayoutMutationAt > lastLayoutSyncAt + 1000) {
        return false
      }

      if (Object.keys(cliBridgePendingPatchRef.current).length > 0) {
        return false
      }

      const remote = await apiGetWorkspaceState(serverAuth.lastApiKey, resolveApiBaseUrl())
      const remoteUpdatedAt = remote.workspace.updatedAt || null
      if (remoteUpdatedAt && remoteUpdatedAt === lastCliBridgeWorkspaceUpdatedAtRef.current) {
        return false
      }

      const remoteGrids = Array.isArray(remote.workspace.grids)
        ? remote.workspace.grids.map((grid) => ({
            id: String(grid.id || ''),
            name: String(grid.name || ''),
            cards: Array.isArray(grid.cards) ? grid.cards.map((card) => ({ ...card })) : [],
          }))
        : []

      const hasRemoteCards = remoteGrids.some((grid) => grid.cards.length > 0)
      if (!hasRemoteCards && lastCliBridgeWorkspaceUpdatedAtRef.current === null) {
        lastCliBridgeWorkspaceUpdatedAtRef.current = remoteUpdatedAt
        return false
      }

      const nextGrids = mergeRemoteGridsWithLocalMediaCards(
        normalizeGridsForTodoBoard(remoteGrids as GridData[]),
        gridsRef.current,
      )
      if (!nextGrids.length) {
        lastCliBridgeWorkspaceUpdatedAtRef.current = remoteUpdatedAt
        return false
      }

      skipLocalSyncMetaUpdateRef.current = true
      setGrids(nextGrids)
      setActiveGridId(
        nextGrids.some((grid) => grid.id === remote.workspace.activeGridId)
          ? remote.workspace.activeGridId
          : nextGrids[0].id,
      )
      updateSyncMeta({
        lastLocalUpdateAt: Date.now(),
        lastSyncAt: Date.now(),
      })
      updateCliBridgeLayoutSyncMeta({ lastLayoutSyncAt: Date.now() })
      lastCliBridgeWorkspaceUpdatedAtRef.current = remoteUpdatedAt
      return true
    } catch {
      return false
    } finally {
      window.setTimeout(() => {
        skipLocalSyncMetaUpdateRef.current = false
      }, 0)
    }
  }, [account, resolveApiBaseUrl, serverAuth?.lastApiKey, setActiveGridId, setGrids, updateCliBridgeLayoutSyncMeta, updateSyncMeta])

  const persistCliBridgeCardLayout = useCallback(
    async (
      cardId: string,
      updates: { x?: number; y?: number; width?: number; height?: number },
    ) => {
      if (!account || !serverAuth?.lastApiKey) return false

      try {
        await apiUpdateCard(serverAuth.lastApiKey, cardId, updates, resolveApiBaseUrl())
        updateCliBridgeLayoutSyncMeta({ lastLayoutSyncAt: Date.now() })
        return true
      } catch (error) {
        console.error('Failed to persist CLI Bridge card layout:', error)
        return false
      }
    },
    [account, resolveApiBaseUrl, serverAuth?.lastApiKey, updateCliBridgeLayoutSyncMeta],
  )

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
    if (isObsidianRuntime) return
    if (!hydrated || !account || !settings.syncOnStartup) return
    if (startupSyncUserRef.current === account.id) return
    startupSyncUserRef.current = account.id
    void performSync(true)
  }, [account, hydrated, isObsidianRuntime, performSync, settings.syncOnStartup])

  useEffect(() => {
    if (isObsidianRuntime) return
    if (!hydrated || !account || !settings.autoSync) return

    const timer = window.setTimeout(() => {
      if (!skipLocalSyncMetaUpdateRef.current) {
        void performSync(true)
      }
    }, Math.max(500, settings.syncDebounceMs))

    return () => {
      window.clearTimeout(timer)
    }
  }, [activeGridId, account, grids, hydrated, isObsidianRuntime, performSync, settings.autoSync, settings.syncDebounceMs, viewport])

  useEffect(() => {
    if (isObsidianRuntime) return
    if (!hydrated || !account || !serverAuth?.lastApiKey) return

    let cancelled = false
    const run = async () => {
      if (cancelled) return
      await pullCliBridgeWorkspace()
    }

    void run()
    const timer = window.setInterval(() => {
      void run()
    }, 6000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [account, hydrated, isObsidianRuntime, pullCliBridgeWorkspace, serverAuth?.lastApiKey])

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

    const handlePointerUp = (event: PointerEvent) => {
      const resizeState = resizeStateRef.current
      if (resizeState) {
        const world = toWorldPoint(event.clientX, event.clientY)
        const deltaX = world.x - resizeState.startPointerWorldX
        const deltaY = world.y - resizeState.startPointerWorldY
        const nextWidth = clamp(resizeState.startWidth + deltaX, CARD_MIN_WIDTH, CARD_MAX_WIDTH)
        const nextHeight = clamp(resizeState.startHeight + deltaY, CARD_MIN_HEIGHT, CARD_MAX_HEIGHT)
        void persistCliBridgeCardLayout(resizeState.cardId, {
          width: nextWidth,
          height: nextHeight,
        })
      }

      const dragState = dragStateRef.current
      if (dragState) {
        const world = toWorldPoint(event.clientX, event.clientY)
        const nextX = clamp(world.x - dragState.pointerOffsetX, -200, SCENE_WIDTH - 60)
        const nextY = clamp(world.y - dragState.pointerOffsetY, -200, SCENE_HEIGHT - 60)
        void persistCliBridgeCardLayout(dragState.cardId, {
          x: nextX,
          y: nextY,
        })
      }

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
  }, [persistCliBridgeCardLayout, pushParticleImpulse, toWorldPoint])

  const closeSettings = () => {
    setSettingsOpen(false)
  }

  const beginEditGrid = (grid: GridData) => {
    setEditingGridId(grid.id)
    setGridNameDraft(grid.name)
  }

  const commitGridName = () => {
    if (!editingGridId) return
    const targetGrid = grids.find((grid) => grid.id === editingGridId)
    if (!targetGrid) {
      setEditingGridId(null)
      setGridNameDraft('')
      return
    }

    const nextName = gridNameDraft.trim() || text.unnamedGrid
    updateCliBridgeLayoutSyncMeta({ lastLayoutMutationAt: Date.now() })
    setGrids((current) =>
      current.map((grid) => (grid.id === editingGridId ? { ...grid, name: nextName } : grid)),
    )
    void persistCliBridgeGridUpdate(editingGridId, { name: nextName })
    setEditingGridId(null)
    setGridNameDraft('')
  }

  const cancelGridName = () => {
    setEditingGridId(null)
    setGridNameDraft('')
  }

  const activateGrid = useCallback(
    (gridId: string) => {
      if (gridId === activeGridId) return

      const targetGrid = grids.find((grid) => grid.id === gridId)
      if (!targetGrid) return

      updateCliBridgeLayoutSyncMeta({ lastLayoutMutationAt: Date.now() })
      setActiveGridId(gridId)
      void persistCliBridgeGridUpdate(gridId, { activate: true })
    },
    [activeGridId, grids, persistCliBridgeGridUpdate, updateCliBridgeLayoutSyncMeta],
  )

  const beginEditCardTitle = (card: CardData) => {
    setEditingCardId(card.id)
    setCardTitleDraft(card.title)
  }

  const commitCardTitle = () => {
    if (!editingCardId) return

    const nextTitle = cardTitleDraft.trim() || text.unnamedCard
    updateCliBridgeLayoutSyncMeta({ lastLayoutMutationAt: Date.now() })
    setGrids((current) =>
      current.map((grid) => {
        if (grid.id !== activeGridId) return grid
        return {
          ...grid,
          cards: grid.cards.map((card) => (card.id === editingCardId ? { ...card, title: nextTitle } : card)),
        }
      }),
    )
    void persistCliBridgeCardPatch(editingCardId, { title: nextTitle })
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

      const shouldActivateGrid = payload?.activate !== false
      updateCliBridgeLayoutSyncMeta({ lastLayoutMutationAt: Date.now() })
      setGrids((current) => [...current, newGrid])
      if (shouldActivateGrid) {
        setActiveGridId(newGrid.id)
      }
      void persistCliBridgeGridCreate(newGrid, shouldActivateGrid)

      return newGrid
    },
    [grids.length, persistCliBridgeGridCreate, text.gridPrefix, updateCliBridgeLayoutSyncMeta],
  )

  const createCardInternal = useCallback(
    (payload?: OpenCanvasCreateCardPayload) => {
      const targetGridId =
        payload?.gridId && grids.some((grid) => grid.id === payload.gridId) ? payload.gridId : activeGridId
      const targetGrid = grids.find((grid) => grid.id === targetGridId)
      if (!targetGrid) return null

      const kind = normalizeCardKind(payload?.kind)
      const existingSingletonCard = isSingletonCardKind(kind)
        ? targetGrid.cards.find((card) => card.kind === kind) ?? null
        : null
      if (existingSingletonCard) {
        if (payload?.activateGrid) {
          setActiveGridId(targetGridId)
        }
        return { cardId: existingSingletonCard.id, gridId: targetGridId, reused: true }
      }

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
      const cardId = String(payload?.id || '').trim() || uid(kind)
      const externalTodoItems = toTodoItems(payload?.todoItems)
      const canvasBounds = canvasRef.current?.getBoundingClientRect()
      const currentViewport = viewportRef.current
      const centeredWorldPoint = canvasBounds
        ? {
            x: (canvasBounds.width / 2 - currentViewport.x) / currentViewport.zoom,
            y: (canvasBounds.height / 2 - currentViewport.y) / currentViewport.zoom,
          }
        : { x: 140, y: 140 }

      const cardBase: CardData = {
        id: cardId,
        kind,
        title,
        content: kind === 'note' ? content || text.notePlaceholder : content,
        x: clamp(toFiniteNumber(payload?.x, centeredWorldPoint.x - width / 2), -200, SCENE_WIDTH - 60),
        y: clamp(toFiniteNumber(payload?.y, centeredWorldPoint.y - height / 2), -200, SCENE_HEIGHT - 60),
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
      updateCliBridgeLayoutSyncMeta({ lastLayoutMutationAt: Date.now() })
      if (payload?.activateGrid) {
        setActiveGridId(targetGridId)
      }
      pushParticleImpulse(cardBase.x + cardBase.width / 2, cardBase.y + cardBase.height / 2, 0.22)
      void persistCliBridgeCardCreate(targetGridId, cardWithTypeData, Boolean(payload?.activateGrid))

      return { cardId, gridId: targetGridId, reused: false }
    },
    [
      activeGridId,
      calendarText.title,
      grids,
      pushParticleImpulse,
      persistCliBridgeCardCreate,
      updateCliBridgeLayoutSyncMeta,
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

  const removeGrid = (gridId: string) => {
    if (grids.length <= 1) return

    const targetIndex = grids.findIndex((grid) => grid.id === gridId)
    if (targetIndex < 0) return

    const next = grids.filter((grid) => grid.id !== gridId)
    const fallbackGrid = activeGridId === gridId ? next[Math.max(0, targetIndex - 1)] ?? next[0] : null

    if (editingGridId === gridId) {
      setEditingGridId(null)
      setGridNameDraft('')
    }

    updateCliBridgeLayoutSyncMeta({ lastLayoutMutationAt: Date.now() })
    setGrids(next)
    if (fallbackGrid) {
      setActiveGridId(fallbackGrid.id)
    }
    void persistCliBridgeGridDelete(gridId)
  }

  const addNoteCard = () => {
    createCardInternal({
      kind: 'note',
      width: 340,
      height: 280,
    })
  }

  const addTodoCard = () => {
    createCardInternal({
      kind: 'todo',
      width: 360,
      height: 320,
    })
  }

  const addCalendarCard = () => {
    createCardInternal({
      kind: 'calendar',
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

    const patch: CliBridgeCardPatch = {}
    if (typeof payload.title === 'string') patch.title = payload.title.trim() || undefined
    if (typeof payload.content === 'string') patch.content = payload.content
    if (typeof payload.x === 'number') patch.x = clamp(payload.x, -200, SCENE_WIDTH - 60)
    if (typeof payload.y === 'number') patch.y = clamp(payload.y, -200, SCENE_HEIGHT - 60)
    if (typeof payload.width === 'number') patch.width = clamp(payload.width, CARD_MIN_WIDTH, CARD_MAX_WIDTH)
    if (typeof payload.height === 'number') patch.height = clamp(payload.height, CARD_MIN_HEIGHT, CARD_MAX_HEIGHT)
    if (typeof payload.fileName === 'string') patch.fileName = payload.fileName.trim() || undefined
    if (typeof payload.externalUrl === 'string') patch.externalUrl = payload.externalUrl.trim() || undefined
    if (payload.todoItems !== undefined) patch.todoItems = payload.todoItems
    if (payload.calendar !== undefined) patch.calendar = payload.calendar

    updateCliBridgeLayoutSyncMeta({ lastLayoutMutationAt: Date.now() })
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

    void persistCliBridgeCardPatch(cardId, patch)

    return { ok: true, message: 'Card updated', data: { cardId } } satisfies OpenCanvasCommandResult
  }, [grids, persistCliBridgeCardPatch, updateCliBridgeLayoutSyncMeta])

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
        return {
          ok: true,
          requestId,
          message: created.reused ? 'Card reused' : 'Card created',
          data: {
            cardId: created.cardId,
            gridId: created.gridId,
            reused: created.reused,
          },
        }
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

        const targetCard = grids.flatMap((grid) => grid.cards).find((card) => card.id === cardId)
        const exists = Boolean(targetCard)
        if (!exists) {
          return { ok: false, requestId, message: `Card not found: ${cardId}` }
        }

        const nextContent = targetCard?.content ? `${targetCard.content}\n${appendText}` : appendText

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
        void persistCliBridgeCardPatch(cardId, { content: nextContent })
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
            cliBridge: cliBridgeConfig,
          },
        }
      }

      if (command.type === 'get-config') {
        return {
          ok: true,
          requestId,
          data: {
            cliBridge: cliBridgeConfig,
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
        const next = normalizeCliBridgeConfig({ ...cliBridgeConfig, ...partial })
        saveCliBridgeConfig(next)

        return {
          ok: true,
          requestId,
          message: 'Config updated',
          data: {
            cliBridge: next,
          },
        }
      }

      return { ok: false, requestId, message: 'Unsupported command' }
    },
    [
      account,
      activeGridId,
      createCardInternal,
      createGridInternal,
      grids,
      cliBridgeConfig,
      persistCliBridgeCardPatch,
      saveCliBridgeConfig,
      updateCardInternal,
    ],
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
          payload: payload ? { googleClientId: payload.googleClientId } : undefined,
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
        !['cli', 'cli-bridge', 'open-canvas-bridge'].includes(String(data.source).toLowerCase())
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

    clearCliBridgePatchTimer(cardId)
    updateCliBridgeLayoutSyncMeta({ lastLayoutMutationAt: Date.now() })
    setGrids((current) =>
      current.map((grid) => {
        if (grid.id !== activeGridId) return grid
        return { ...grid, cards: grid.cards.filter((card) => card.id !== cardId) }
      }),
    )

    if (targetCard) {
      void persistCliBridgeCardDelete(cardId)
    }

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
    void persistCliBridgeAssetDelete(fileId)
  }

  const onCardDragStart = (event: ReactPointerEvent<HTMLElement>, card: CardData) => {
    event.preventDefault()
    event.stopPropagation()

    resizeStateRef.current = null
    setResizingCardId(null)
    updateCliBridgeLayoutSyncMeta({ lastLayoutMutationAt: Date.now() })

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
    updateCliBridgeLayoutSyncMeta({ lastLayoutMutationAt: Date.now() })

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
    updateCliBridgeLayoutSyncMeta({ lastLayoutMutationAt: Date.now() })
    setGrids((current) =>
      current.map((grid) => {
        if (grid.id !== activeGridId) return grid
        return {
          ...grid,
          cards: grid.cards.map((card) => (card.id === cardId ? { ...card, content } : card)),
        }
      }),
    )
    scheduleCliBridgeCardPatch(cardId, { content })
  }

  const addTodoItem = (cardId: string, lane: TodoLane = 'todo') => {
    const targetCard = activeGrid.cards.find((card) => card.id === cardId)
    if (!targetCard || targetCard.kind !== 'todo') return

    const textValue = targetCard.content.trim()
    if (!textValue) return

    const nextTodoItems = [...(targetCard.todoItems ?? []), createTodoItem(textValue, lane)]
    clearCliBridgePatchTimer(cardId)
    updateCliBridgeLayoutSyncMeta({ lastLayoutMutationAt: Date.now() })
    setGrids((current) =>
      current.map((grid) =>
        grid.id !== activeGridId
          ? grid
          : {
              ...grid,
              cards: grid.cards.map((card) =>
                card.id === cardId ? { ...card, content: '', todoItems: nextTodoItems } : card,
              ),
            },
      ),
    )
    void persistCliBridgeCardPatch(cardId, { content: '', todoItems: nextTodoItems })
  }

  const moveTodoItem = (cardId: string, itemId: string, nextLane: TodoLane, targetItemId: string | null = null) => {
    const targetCard = activeGrid.cards.find((card) => card.id === cardId)
    if (!targetCard || targetCard.kind !== 'todo' || targetItemId === itemId) return

    const lanes: Record<TodoLane, TodoItem[]> = { todo: [], doing: [], done: [] }
    let movingItem: TodoItem | null = null

    for (const todoItem of targetCard.todoItems ?? []) {
      const normalizedLane = normalizeTodoLane(todoItem.status)
      if (todoItem.id === itemId) {
        movingItem = { ...todoItem, status: nextLane }
        continue
      }
      lanes[normalizedLane].push({ ...todoItem, status: normalizedLane })
    }

    if (!movingItem) return

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

    const nextTodoItems = [...lanes.todo, ...lanes.doing, ...lanes.done]
    updateCliBridgeLayoutSyncMeta({ lastLayoutMutationAt: Date.now() })
    setGrids((current) =>
      current.map((grid) =>
        grid.id !== activeGridId
          ? grid
          : {
              ...grid,
              cards: grid.cards.map((card) => (card.id === cardId ? { ...card, todoItems: nextTodoItems } : card)),
            },
      ),
    )
    void persistCliBridgeCardPatch(cardId, { todoItems: nextTodoItems })
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

    const targetCard = activeGrid.cards.find((card) => card.id === cardId)
    if (!targetCard || targetCard.kind !== 'todo') return

    const nextTodoItems = (targetCard.todoItems ?? []).filter((item) => item.id !== todoId)
    updateCliBridgeLayoutSyncMeta({ lastLayoutMutationAt: Date.now() })
    setGrids((current) =>
      current.map((grid) =>
        grid.id !== activeGridId
          ? grid
          : {
              ...grid,
              cards: grid.cards.map((card) => (card.id === cardId ? { ...card, todoItems: nextTodoItems } : card)),
            },
      ),
    )
    void persistCliBridgeCardPatch(cardId, { todoItems: nextTodoItems })
  }

  const updateTodoText = (cardId: string, todoId: string, value: string) => {
    const targetCard = activeGrid.cards.find((card) => card.id === cardId)
    if (!targetCard || targetCard.kind !== 'todo') return

    const nextTodoItems = (targetCard.todoItems ?? []).map((item) => (item.id === todoId ? { ...item, text: value } : item))
    updateCliBridgeLayoutSyncMeta({ lastLayoutMutationAt: Date.now() })
    setGrids((current) =>
      current.map((grid) =>
        grid.id !== activeGridId
          ? grid
          : {
              ...grid,
              cards: grid.cards.map((card) => (card.id === cardId ? { ...card, todoItems: nextTodoItems } : card)),
            },
      ),
    )
    void persistCliBridgeCardPatch(cardId, { todoItems: nextTodoItems })
  }

  const updateCalendarCard = (cardId: string, updater: (state: CalendarState) => CalendarState) => {
    const targetCard = activeGrid.cards.find((card) => card.id === cardId)
    if (!targetCard || targetCard.kind !== 'calendar') return

    const nextCalendar = withCalendarDefaults(updater(withCalendarDefaults(targetCard.calendar)))
    updateCliBridgeLayoutSyncMeta({ lastLayoutMutationAt: Date.now() })
    setGrids((current) =>
      current.map((grid) =>
        grid.id !== activeGridId
          ? grid
          : {
              ...grid,
              cards: grid.cards.map((card) => (card.id === cardId ? { ...card, calendar: nextCalendar } : card)),
            },
      ),
    )
    void persistCliBridgeCardPatch(cardId, { calendar: nextCalendar })
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
    const remoteMediaCards: CardData[] = []

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

      const uploadedAssetUrl =
        account && serverAuth?.lastApiKey
          ? await persistCliBridgeAssetUpload(assetId, file.name, file.type || 'application/octet-stream', file)
          : null

      const nextCard: CardData = {
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
        ...(uploadedAssetUrl ? { externalUrl: uploadedAssetUrl } : {}),
      }

      newCards.push(nextCard)
      if (uploadedAssetUrl) {
        remoteMediaCards.push(nextCard)
      }
    }

    if (!newCards.length) return

    setAssetUrls((current) => ({ ...current, ...nextUrls }))
    setGrids((current) =>
      current.map((grid) => (grid.id === activeGridId ? { ...grid, cards: [...grid.cards, ...newCards] } : grid)),
    )
    if (remoteMediaCards.length > 0) {
      void Promise.all(remoteMediaCards.map((card) => persistCliBridgeCardCreate(activeGridId, card, false)))
    }
    pushParticleImpulse(world.x, world.y, 0.24)
  }

  const zoomPercent = `${Math.round(viewport.zoom * 100)}%`
  const accountProviderLabel = account?.provider === 'google' ? text.providerGoogle : text.providerDemo

  return (
    <main className="app-shell">
        <aside className="sidebar">
          <div className="brand-block">
            <div className="brand-meta">
              <div className="brand-logo" aria-hidden>
                <img className="brand-logo-image" src={BRAND_LOGO_DATA_URL} alt="" />
              </div>
              <div className="brand-copy">
                <span className="brand-name">AI Sticky Notes</span>
                <span className="brand-subtitle">(open-canvas)</span>
              </div>
            </div>
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
                  activateGrid(grid.id)
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
                <span className="grid-item-actions">
                  <span className="grid-badge">{index + 1}</span>
                  {grids.length > 1 ? (
                    <button
                      type="button"
                      className="grid-remove-btn"
                      aria-label={text.removeGridAria}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation()
                        removeGrid(grid.id)
                      }}
                    >
                      x
                    </button>
                  ) : null}
                </span>
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
                <button
                  className={`lang-option ${settings.themeMode === 'glass' ? 'active' : ''}`}
                  onClick={() => updateSettings({ themeMode: 'glass' })}
                >
                  {text.themeGlass}
                </button>
              </div>
            </div>

            <div className="settings-group">
              <h3>{text.accountTitle}</h3>
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
                <p>{text.loginHintInSettings}</p>
              </div>

              <label className="input-row">
                <span>{text.googleClientIdLabel}</span>
                <input
                  type="text"
                  className="settings-text-input"
                  value={cliBridgeConfig.googleClientId}
                  onChange={(event) => updateCliBridgeConfig({ googleClientId: event.target.value })}
                />
              </label>
              <p>{text.googleClientIdHint}</p>
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
