import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent as ReactDragEvent, FormEvent, PointerEvent as ReactPointerEvent, WheelEvent } from 'react'
import './App.css'

type LanguageCode = 'zh' | 'en'
type SyncStatus = 'idle' | 'syncing' | 'ok' | 'error'
type CardKind = 'note' | 'hint' | 'image' | 'video' | 'pdf' | 'todo' | 'calendar'
type CalendarViewMode = 'month' | 'week'

type TodoItem = {
  id: string
  text: string
  done: boolean
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
  autoSync: boolean
  syncOnStartup: boolean
  syncDebounceMs: number
}

type FakeUser = {
  id: string
  name: string
  email: string
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
  fakeLogin: string
  fakeLoginSuccess: string
  signedOut: string
  logout: string
  loginHintInSettings: string
  languageTitle: string
  languageHint: string
  languageZh: string
  languageEn: string
  unnamedGrid: string
  unnamedCard: string
  demoUser: string
  gridPrefix: string
  syncSettingsTitle: string
  autoSyncLabel: string
  syncOnStartupLabel: string
  syncDebounceLabel: string
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

const DB_NAME = 'open-canvas-db'
const DB_VERSION = 1
const STORE_APP = 'app_state'
const STORE_ASSETS = 'assets'
const APP_STATE_KEY = 'main'
const AUTH_STORAGE_KEY = 'open-canvas-fake-auth'
const SETTINGS_STORAGE_KEY = 'open-canvas-settings'
const SYNC_META_KEY = 'open-canvas-sync-meta'
const CLOUD_KEY_PREFIX = 'open-canvas-cloud-'

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
  autoSync: true,
  syncOnStartup: true,
  syncDebounceMs: 2400,
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
    accountTitle: '账号（模拟登录）',
    loginDisplayNamePlaceholder: '显示名称',
    loginEmailPlaceholder: '邮箱（可选）',
    signIn: '登录',
    cancel: '取消',
    fakeLogin: '模拟登录',
    fakeLoginSuccess: '模拟登录成功。',
    signedOut: '已退出登录。',
    logout: '退出登录',
    loginHintInSettings: '登录入口在设置中，后续会替换为真实登录。',
    languageTitle: '语言',
    languageHint: '当前支持中英文切换',
    languageZh: '中文',
    languageEn: 'English',
    unnamedGrid: '未命名画布',
    unnamedCard: '未命名卡片',
    demoUser: '演示用户',
    gridPrefix: '画布',
    syncSettingsTitle: '同步策略',
    autoSyncLabel: '自动同步（本地改动后自动执行）',
    syncOnStartupLabel: '启动后自动检查云端版本',
    syncDebounceLabel: '自动同步延迟（毫秒）',
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
    accountTitle: 'Account (Fake Login)',
    loginDisplayNamePlaceholder: 'Display name',
    loginEmailPlaceholder: 'Email (optional)',
    signIn: 'Sign in',
    cancel: 'Cancel',
    fakeLogin: 'Fake login',
    fakeLoginSuccess: 'Fake login successful.',
    signedOut: 'Signed out.',
    logout: 'Log out',
    loginHintInSettings: 'Login entry is in Settings. Real auth will replace this later.',
    languageTitle: 'Language',
    languageHint: 'Currently supports Chinese and English',
    languageZh: '中文',
    languageEn: 'English',
    unnamedGrid: 'Untitled Grid',
    unnamedCard: 'Untitled Card',
    demoUser: 'Demo User',
    gridPrefix: 'Grid',
    syncSettingsTitle: 'Sync Strategy',
    autoSyncLabel: 'Auto sync (after local changes)',
    syncOnStartupLabel: 'Check cloud snapshot on startup',
    syncDebounceLabel: 'Auto sync debounce (ms)',
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
    defaultItems: ['整理想法', '安排下一步'],
  },
  en: {
    newCardButton: '+ New todo card',
    title: 'Todo',
    placeholder: 'Type a task and press Enter',
    addButton: 'Add',
    emptyHint: 'No tasks yet. Type above and press Enter.',
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

const createTodoItem = (text: string): TodoItem => ({
  id: uid('todo-item'),
  text,
  done: false,
})

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

    request.onsuccess = () => resolve((request.result as PersistedAppState | undefined) ?? null)
    request.onerror = () => reject(request.error ?? new Error('Failed to read app state'))
  })
}

const putPersistedState = async (state: PersistedAppState) => {
  const db = await openDatabase()

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_APP, 'readwrite')
    const store = tx.objectStore(STORE_APP)
    const request = store.put(state, APP_STATE_KEY)

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

  const [fakeUser, setFakeUser] = useState<FakeUser | null>(null)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [syncMessage, setSyncMessage] = useState('')
  const [syncMeta, setSyncMeta] = useState<SyncMeta>(DEFAULT_SYNC_META)

  const [editingGridId, setEditingGridId] = useState<string | null>(null)
  const [gridNameDraft, setGridNameDraft] = useState('')

  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [cardTitleDraft, setCardTitleDraft] = useState('')

  const [calendarDropTarget, setCalendarDropTarget] = useState<string | null>(null)

  const canvasRef = useRef<HTMLElement | null>(null)
  const viewportRef = useRef(viewport)
  const assetUrlsRef = useRef(assetUrls)
  const syncMetaRef = useRef(syncMeta)

  const dragStateRef = useRef<DragState>(null)
  const panStateRef = useRef<PanState>(null)
  const resizeStateRef = useRef<ResizeState>(null)
  const calendarDragStateRef = useRef<CalendarDragState>(null)

  const persistTimerRef = useRef<number | null>(null)
  const skipLocalSyncMetaUpdateRef = useRef(false)
  const startupSyncUserRef = useRef<string | null>(null)

  const activeGrid = useMemo(() => grids.find((grid) => grid.id === activeGridId) ?? grids[0], [activeGridId, grids])

  const text = I18N[settings.language]
  const todoText = TODO_I18N[settings.language]
  const calendarText = CALENDAR_I18N[settings.language]

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
      document.documentElement.dataset.theme = media.matches ? 'dark' : 'light'
    }

    applyTheme()

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', applyTheme)
      return () => media.removeEventListener('change', applyTheme)
    }

    media.addListener(applyTheme)
    return () => media.removeListener(applyTheme)
  }, [])

  useEffect(() => {
    const auth = readJson<FakeUser>(AUTH_STORAGE_KEY)
    const setting = readJson<AppSettings>(SETTINGS_STORAGE_KEY)
    const meta = readJson<SyncMeta>(SYNC_META_KEY)

    if (auth) setFakeUser(auth)
    if (setting) setSettings({ ...DEFAULT_SETTINGS, ...setting })
    if (meta) setSyncMeta(meta)
  }, [])

  useEffect(() => {
    if (syncStatus !== 'idle') return
    setSyncMessage(fakeUser ? text.ready : text.syncNeedLogin)
  }, [fakeUser, syncStatus, text.ready, text.syncNeedLogin])

  useEffect(() => {
    let cancelled = false

    const hydrate = async () => {
      try {
        const [stateFromDb, assetsFromDb] = await Promise.all([getPersistedState(), getAllAssets()])
        if (cancelled) return

        if (stateFromDb && stateFromDb.grids.length > 0) {
          setGrids(stateFromDb.grids)
          setActiveGridId(stateFromDb.activeGridId || stateFromDb.grids[0].id)
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
      const next = { ...current, ...partial }
      writeJson(SETTINGS_STORAGE_KEY, next)
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
        setGrids(snapshot.state.grids)
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
      if (!fakeUser) {
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

        const remote = readJson<CloudSnapshot>(cloudKey(fakeUser.id))

        if (!remote) {
          const assets = await serializeAssetsForCloud()
          const payload: CloudSnapshot = {
            version: 1,
            userId: fakeUser.id,
            savedAt: Date.now(),
            state: localState,
            assets,
          }

          writeJson(cloudKey(fakeUser.id), payload)
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
          userId: fakeUser.id,
          savedAt: Date.now(),
          state: localState,
          assets,
        }

        writeJson(cloudKey(fakeUser.id), payload)
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
      fakeUser,
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
    if (!hydrated || !fakeUser || !settings.syncOnStartup) return
    if (startupSyncUserRef.current === fakeUser.id) return
    startupSyncUserRef.current = fakeUser.id
    void performSync(true)
  }, [fakeUser, hydrated, performSync, settings.syncOnStartup])

  useEffect(() => {
    if (!hydrated || !fakeUser || !settings.autoSync) return

    const timer = window.setTimeout(() => {
      if (!skipLocalSyncMetaUpdateRef.current) {
        void performSync(true)
      }
    }, Math.max(500, settings.syncDebounceMs))

    return () => {
      window.clearTimeout(timer)
    }
  }, [activeGridId, fakeUser, grids, hydrated, performSync, settings.autoSync, settings.syncDebounceMs, viewport])

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
  }, [toWorldPoint])

  const closeSettings = () => {
    setSettingsOpen(false)
    setShowLoginForm(false)
  }

  const beginFakeLogin = () => {
    setShowLoginForm(true)
    setLoginName(fakeUser?.name ?? '')
    setLoginEmail(fakeUser?.email ?? '')
  }

  const submitFakeLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const name = loginName.trim() || text.demoUser
    const email = (loginEmail.trim() || `${name.toLowerCase().replace(/\s+/g, '.')}@open-canvas.local`).toLowerCase()

    const user: FakeUser = {
      id: `fake-${email}`,
      name,
      email,
    }

    writeJson(AUTH_STORAGE_KEY, user)
    setFakeUser(user)
    setShowLoginForm(false)
    setSyncStatus('idle')
    setSyncMessage(text.fakeLoginSuccess)
  }

  const logout = () => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    setFakeUser(null)
    startupSyncUserRef.current = null
    setShowLoginForm(false)
    setSyncStatus('idle')
    setSyncMessage(text.signedOut)
  }

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

  const addGrid = () => {
    const count = grids.length + 1
    const newGrid: GridData = {
      id: uid('grid'),
      name: `${text.gridPrefix} ${count}`,
      cards: [],
    }

    setGrids((current) => [...current, newGrid])
    setActiveGridId(newGrid.id)
  }

  const addNoteCard = () => {
    const newCard: CardData = {
      id: uid('note'),
      kind: 'note',
      title: text.newNoteCard.replace('+ ', ''),
      content: text.notePlaceholder,
      x: 92,
      y: 92,
      width: 340,
      height: 280,
    }

    setGrids((current) =>
      current.map((grid) => (grid.id === activeGridId ? { ...grid, cards: [...grid.cards, newCard] } : grid)),
    )
  }

  const addTodoCard = () => {
    const newCard: CardData = {
      id: uid('todo'),
      kind: 'todo',
      title: todoText.title,
      content: '',
      todoItems: todoText.defaultItems.map((item) => createTodoItem(item)),
      x: 132,
      y: 132,
      width: 360,
      height: 320,
    }

    setGrids((current) =>
      current.map((grid) => (grid.id === activeGridId ? { ...grid, cards: [...grid.cards, newCard] } : grid)),
    )
  }

  const addCalendarCard = () => {
    const newCard: CardData = {
      id: uid('calendar'),
      kind: 'calendar',
      title: calendarText.title,
      content: '',
      calendar: createDefaultCalendarState(),
      x: 180,
      y: 180,
      width: 440,
      height: 460,
    }

    setGrids((current) =>
      current.map((grid) => (grid.id === activeGridId ? { ...grid, cards: [...grid.cards, newCard] } : grid)),
    )
  }

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

  const addTodoItem = (cardId: string) => {
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
              todoItems: [...(card.todoItems ?? []), createTodoItem(textValue)],
            }
          }),
        }
      }),
    )
  }

  const toggleTodo = (cardId: string, todoId: string) => {
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
                item.id === todoId ? { ...item, done: !item.done } : item,
              ),
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
  }

  const zoomPercent = `${Math.round(viewport.zoom * 100)}%`

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
            {fakeUser ? `${text.accountPrefix}: ${fakeUser.email}` : text.accountSignedOutHint}
          </p>
          <div className="panel-actions">
            <button
              className="action-btn compact"
              disabled={!fakeUser || syncStatus === 'syncing'}
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
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
          setIsFileOver(true)
        }}
        onDragLeave={(event) => {
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
            const fileUrl = card.fileId ? assetUrls[card.fileId] : undefined

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
                        addTodoItem(card.id)
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

                    <div className="todo-list">
                      {(card.todoItems ?? []).length ? (
                        (card.todoItems ?? []).map((item) => (
                          <div key={item.id} className={`todo-item ${item.done ? 'done' : ''}`}>
                            <input
                              type="checkbox"
                              checked={item.done}
                              onChange={() => toggleTodo(card.id, item.id)}
                            />
                            <input
                              className="todo-item-input"
                              value={item.text}
                              onChange={(event) => updateTodoText(card.id, item.id, event.target.value)}
                              placeholder={todoText.placeholder}
                            />
                          </div>
                        ))
                      ) : (
                        <p className="todo-empty">{todoText.emptyHint}</p>
                      )}
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
              <h3>{text.accountTitle}</h3>
              {fakeUser ? (
                <div className="account-user-card">
                  <strong>{fakeUser.name}</strong>
                  <span>{fakeUser.email}</span>
                  <div className="panel-actions">
                    <button className="mini-btn danger" onClick={logout}>
                      {text.logout}
                    </button>
                  </div>
                </div>
              ) : showLoginForm ? (
                <form className="login-form" onSubmit={submitFakeLogin}>
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
                  <button className="action-btn compact" onClick={beginFakeLogin}>
                    {text.fakeLogin}
                  </button>
                </div>
              )}
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
