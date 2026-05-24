import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLayoutEffect } from 'react'
import type { DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react'
import './App.css'
import {
  apiCreateAsset,
  apiCreateCard,
  apiCreateGrid,
  apiCheckHealth,
  apiDeleteAsset,
  apiDeleteCard,
  apiDeleteGrid,
  apiDownloadAsset,
  apiGetWorkspaceState,
  apiUpdateCard,
  apiUpdateGrid,
  apiUploadWorkspaceState,
  createWorkspaceEventSource,
  getApiBaseUrl,
  type ServerWorkspaceEvent,
} from './apiClient'
import {
  CARD_DEFAULT_SIZES,
  INITIAL_VIEWPORT,
  TODO_FILTERS,
  TODO_LANES,
  TODO_TAGS,
  createTodoItem,
  createDefaultEventFlowState,
  isSingletonCardKind,
  normalizeCalendarEvents,
  normalizeCalendarState,
  normalizeCardKind,
  normalizeEventFlowState,
  normalizeGridsForTodoBoard,
  normalizeTodoLane,
  normalizeTodoTag,
  normalizeTodoItems,
  type CalendarEvent,
  type CalendarState,
  type CalendarViewMode,
  type CardData,
  type CardKind,
  type DashboardState,
  type EventFlowNode,
  type EventFlowState,
  type ExternalCalendarInput,
  type ExternalTodoInput,
  type GridData,
  type PersistedAppState,
  type TodoFilter,
  type TodoItem,
  type TodoLane,
  type TodoTag,
  type ViewportState,
} from './shared/workspaceTypes'
import {
  centerViewportOnCard,
  filterNavigatorCards,
  getNavigatorCardLabel,
  getNavigatorCardMeta,
  getNavigatorCardTypeLabel,
} from './cardNavigator'
import { getCardChrome } from './cardChrome'
import { DashboardCard } from './DashboardCard'
import { DashboardInspectModal } from './DashboardInspectModal'
import { shouldPollLocalApiInRuntime } from './localApiLiveSync'
import { getHolidays, type HolidayInfo } from './shared/holidays'

type LanguageCode = 'zh' | 'en'
type ThemeMode = 'system' | 'light' | 'dark'
type PointerMode = 'card' | 'canvas'
type SyncStatus = 'idle' | 'syncing' | 'ok' | 'error'
type LocalApiStatus = 'idle' | 'checking' | 'online' | 'offline'

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

type EventFlowNodeDragState = {
  cardId: string
  nodeId: string
  pointerOffsetX: number
  pointerOffsetY: number
  boundsWidth: number
  boundsHeight: number
  canvasLeft: number
  canvasTop: number
  zoom: number
} | null

type EventFlowEdgeDragState = {
  cardId: string
  sourceNodeId: string
  sourceNodeTitle: string
  pointerX: number
  pointerY: number
  canvasLeft: number
  canvasTop: number
  zoom: number
} | null

type StoredAsset = {
  id: string
  blob: Blob
  name: string
  type: string
  createdAt: number
}

type DownloadedAssetRestore = {
  asset: StoredAsset
  url: string
}

type AppSettings = {
  language: LanguageCode
  themeMode: ThemeMode
  autoSync: boolean
  syncOnStartup: boolean
  syncDebounceMs: number
  localApiAutoSaveEnabled: boolean
  localApiAutoSaveMinutes: number
  calendarHolidayMode: 'none' | 'china' | 'us' | 'both'
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
  id: 'local-canvas-workbench',
  name: 'Local Workspace',
  email: 'local@canvas-workbench.local',
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

const TRASH_CARD_RETENTION_MS = 10 * 24 * 60 * 60 * 1000

type TrashedCard = {
  id: string
  card: CardData
  gridId: string
  gridName: string
  deletedAt: number
  expiresAt: number
}

type TrashedTodoItem = {
  id: string
  item: TodoItem
  cardId: string
  cardTitle: string
  gridId: string
  gridName: string
  deletedAt: number
  expiresAt: number
}

type PersistedAppStateWithTrash = PersistedAppState & {
  trashCards?: TrashedCard[]
  trashTodoItems?: TrashedTodoItem[]
}

type PersistedAppStateSnapshot = {
  version: number
  grids: GridData[]
  activeGridId: string
  viewport: ViewportState
  trashCards: TrashedCard[]
  trashTodoItems: TrashedTodoItem[]
  savedAt: number
}

type CliBridgeCardPatch = Partial<
  Pick<CardData, 'title' | 'content' | 'x' | 'y' | 'width' | 'height' | 'fileName' | 'externalUrl' | 'todoItems' | 'calendar' | 'eventFlow' | 'dashboard'>
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
  holidays?: HolidayInfo[]
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
  newEventFlowCard: string
  newDashboardCard: string
  eventFlowTitle: string
  eventFlowAddNode: string
  eventFlowNext: string
  eventFlowStart: string
  eventFlowNewNode: string
  eventFlowDragHint: string
  eventFlowDeleteNode: string
  eventFlowNodePlaceholder: string
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
  localApiTitle: string
  localApiHint: string
  localApiStatusOnline: string
  localApiStatusOffline: string
  localApiStatusChecking: string
  localApiStatusIdle: string
  localApiRefresh: string
  localApiOpenHealth: string
  localApiCopyStartCommand: string
  localApiStartButton: string
  localApiStarting: string
  localApiStartSuccess: string
  localApiStartFailedPrefix: string
  localApiStartCommandCopied: string
  localApiBrowserCannotStart: string
  localApiAutoSaveTitle: string
  localApiAutoSaveHint: string
  localApiAutoSaveIntervalLabel: string
  localApiAutoSaveEnable: string
  localApiAutoSaveDisable: string
  localApiAutoSaveEnabledStatus: string
  localApiAutoSaveDisabledStatus: string
  calendarHolidayTitle: string
  calendarHolidayHint: string
  calendarHolidayNone: string
  calendarHolidayChina: string
  calendarHolidayUS: string
  calendarHolidayBoth: string
  localApiUrlLabel: string
  localApiVersionLabel: string
  localApiStartCommandLabel: string
  localApiToolbarOnline: string
  localApiToolbarOffline: string
  localApiToolbarChecking: string
  localApiToolbarIdle: string
  dataManagementTitle: string
  dataManagementHint: string
  dataManagementReload: string
  dataManagementImport: string
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
  filterLabel: string
  removeItemAria: string
  laneTodo: string
  laneDoing: string
  laneDone: string
  laneAddCard: string
  tagEvent: string
  tagFeature: string
  tagImportant: string
  tagPlan: string
  tagBug: string
  tagIdea: string
  filterAll: string
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

type CanvasWorkbenchCreateCardPayload = {
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
  eventFlow?: EventFlowState
  dashboard?: DashboardState
}

type CanvasWorkbenchSetConfigPayload = Partial<CliBridgeConfig>

type CanvasWorkbenchCommand =
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
      payload?: CanvasWorkbenchCreateCardPayload
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
        eventFlow?: EventFlowState
        dashboard?: DashboardState
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
      payload?: CanvasWorkbenchSetConfigPayload
    }

type CanvasWorkbenchCommandResult = {
  ok: boolean
  requestId?: string
  message?: string
  data?: unknown
}

type CanvasWorkbenchPostMessageEnvelope = {
  source?: string
  type: 'canvas-workbench.command'
  command: CanvasWorkbenchCommand
}

type CanvasWorkbenchPostMessageResult = {
  source: 'canvas-workbench'
  type: 'canvas-workbench.result'
  result: CanvasWorkbenchCommandResult
}

type CanvasWorkbenchGlobalApi = {
  invoke: (command: CanvasWorkbenchCommand) => Promise<CanvasWorkbenchCommandResult>
  createGrid: (payload?: { name?: string; activate?: boolean; requestId?: string }) => Promise<CanvasWorkbenchCommandResult>
  createCard: (payload?: CanvasWorkbenchCreateCardPayload & { requestId?: string }) => Promise<CanvasWorkbenchCommandResult>
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
  }) => Promise<CanvasWorkbenchCommandResult>
  getState: (requestId?: string) => Promise<CanvasWorkbenchCommandResult>
  getConfig: (requestId?: string) => Promise<CanvasWorkbenchCommandResult>
  setConfig: (payload?: CanvasWorkbenchSetConfigPayload & { requestId?: string }) => Promise<CanvasWorkbenchCommandResult>
}

declare global {
  interface Window {
    canvasWorkbench?: CanvasWorkbenchGlobalApi
  }
}

const DB_NAME = 'canvas-workbench-db'
const DB_VERSION = 1
const STORE_APP = 'app_state'
const STORE_ASSETS = 'assets'
const APP_STATE_KEY = 'main'
const PERSISTED_APP_STATE_SHADOW_KEY = 'canvas-workbench-app-state-shadow'
const AUTH_STORAGE_KEY = 'canvas-workbench-fake-auth'
const SETTINGS_STORAGE_KEY = 'canvas-workbench-settings'
const CLI_BRIDGE_SETTINGS_KEY = 'canvas-workbench-cliBridge-settings'
const SYNC_META_KEY = 'canvas-workbench-sync-meta'
const CLI_BRIDGE_LAYOUT_SYNC_KEY = 'canvas-workbench-cliBridge-layout-sync'
const CLOUD_KEY_PREFIX = 'canvas-workbench-cloud-'
const BRAND_LOGO_DATA_URL = `data:image/svg+xml,${encodeURIComponent(
  '<svg width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="13" y="13" width="230" height="230" rx="43" fill="#22F15A"/><path d="M62 77H86.5L100.5 163H102.5L116.5 103H140L154 163H156L170 77H194.5L171.5 179H139.5L128.5 128.5H127.5L116.5 179H84.5L62 77Z" fill="#050505"/></svg>',
)}`

const SCENE_WIDTH = 20_000_000
const SCENE_HEIGHT = 20_000_000
const ZOOM_MIN = 0.45
const ZOOM_MAX = 2.4
const CARD_MIN_WIDTH = 220
const CARD_MIN_HEIGHT = 160
const CARD_MAX_WIDTH = 1400
const CARD_MAX_HEIGHT = 1200

const DEFAULT_SETTINGS: AppSettings = {
  language: 'en',
  themeMode: 'system',
  autoSync: true,
  syncOnStartup: true,
  syncDebounceMs: 2400,
  localApiAutoSaveEnabled: false,
  localApiAutoSaveMinutes: 5,
  calendarHolidayMode: 'none',
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
    newEventFlowCard: '+ 事件流卡片',
    newDashboardCard: '+ 数据卡片',
    eventFlowTitle: '事件流',
    eventFlowAddNode: '+ 节点',
    eventFlowNext: '+ 下一步',
    eventFlowStart: '起点',
    eventFlowNewNode: '新节点',
    eventFlowDragHint: '拖动圆点连接节点',
    eventFlowDeleteNode: '删除节点',
    eventFlowNodePlaceholder: '输入节点内容…',
    newGridAria: '新建画布',
    removeGridAria: '删除画布',
    grids: '画布',
    reset: '重置',
    resizeCardAria: '缩放卡片',
    removeCardAria: '删除卡片',
    notePlaceholder: '可用 Markdown 书写...',
    mediaImageUnavailable: '此类型暂不支持跨端显示。',
    mediaVideoUnavailable: '此类型暂不支持跨端显示。',
    mediaPdfUnavailable: '此类型暂不支持跨端显示。',
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
    cliBridgeTitle: 'CLI Bridge 集成',
    cliBridgeHint: '这里保留 API、Skill 和本地联动需要的配置，旧网关字段已收起。',
    localApiTitle: '本地 API',
    localApiHint: '本地 API / SQLite 是 CLI、Web 和 Obsidian 共用的本地数据库。在线时会自动同步，下面仅保留状态和兜底操作。',
    localApiStatusOnline: '在线',
    localApiStatusOffline: '离线',
    localApiStatusChecking: '检测中',
    localApiStatusIdle: '未检测',
    localApiRefresh: '刷新状态',
    localApiOpenHealth: '打开 health',
    localApiCopyStartCommand: '复制启动命令',
    localApiStartButton: '启动本地 API',
    localApiStarting: '正在启动...',
    localApiStartSuccess: '本地 API 启动命令已发送。',
    localApiStartFailedPrefix: '启动失败：',
    localApiStartCommandCopied: '启动命令已复制。',
    localApiBrowserCannotStart: '浏览器页面不能直接拉起本地 Node 进程；Obsidian 插件可直接启动。',
    localApiAutoSaveTitle: '浏览器缓存备份到本地数据库',
    localApiAutoSaveHint: '在线模式会实时写入本地数据库；此开关仅作为浏览器缓存定时导入的兜底备份。',
    localApiAutoSaveIntervalLabel: '备份间隔（分钟）',
    localApiAutoSaveEnable: '开启兜底备份',
    localApiAutoSaveDisable: '关闭兜底备份',
    localApiAutoSaveEnabledStatus: '兜底备份已开启',
    localApiAutoSaveDisabledStatus: '兜底备份未开启',
    calendarHolidayTitle: '日历节假日',
    calendarHolidayHint: '在日历卡片中显示节假日标注。',
    calendarHolidayNone: '不显示',
    calendarHolidayChina: '中国节日',
    calendarHolidayUS: '美国节日',
    calendarHolidayBoth: '全部显示',
    localApiUrlLabel: 'API 地址',
    localApiVersionLabel: 'API 版本',
    localApiStartCommandLabel: '启动命令',
    localApiToolbarOnline: '本地 API 在线',
    localApiToolbarOffline: '连接本地 API',
    localApiToolbarChecking: '检测本地 API',
    localApiToolbarIdle: '连接本地 API',
    dataManagementTitle: '数据管理',
    dataManagementHint: '本地数据库重载和导入工具保留在这里，作为离线恢复、备份和调试入口。',
    dataManagementReload: '从本地数据库重新加载',
    dataManagementImport: '导入当前画布到本地数据库',
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
    newEventFlowCard: '+ Event flow card',
    newDashboardCard: '+ Data card',
    eventFlowTitle: 'Event Flow',
    eventFlowAddNode: '+ Node',
    eventFlowNext: '+ Next',
    eventFlowStart: 'Start',
    eventFlowNewNode: 'New node',
    eventFlowDragHint: 'Drag the dot to connect nodes',
    eventFlowDeleteNode: 'Delete node',
    eventFlowNodePlaceholder: 'Enter node content…',
    newGridAria: 'New grid',
    removeGridAria: 'Remove grid',
    grids: 'GRIDS',
    reset: 'Reset',
    resizeCardAria: 'Resize card',
    removeCardAria: 'Remove card',
    notePlaceholder: 'Write with markdown...',
    mediaImageUnavailable: 'This media type is not supported for cross-device display yet.',
    mediaVideoUnavailable: 'This media type is not supported for cross-device display yet.',
    mediaPdfUnavailable: 'This media type is not supported for cross-device display yet.',
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
    cliBridgeTitle: 'CLI Bridge Integration',
    cliBridgeHint: 'Keep only the API, skill and local integration settings. Legacy gateway fields are hidden.',
    localApiTitle: 'Local API',
    localApiHint: 'The Local API / SQLite database is shared by CLI, Web, and Obsidian. Online mode syncs automatically; this panel keeps status and fallback actions.',
    localApiStatusOnline: 'Online',
    localApiStatusOffline: 'Offline',
    localApiStatusChecking: 'Checking',
    localApiStatusIdle: 'Not checked',
    localApiRefresh: 'Refresh status',
    localApiOpenHealth: 'Open health',
    localApiCopyStartCommand: 'Copy start command',
    localApiStartButton: 'Start Local API',
    localApiStarting: 'Starting...',
    localApiStartSuccess: 'Local API start command sent.',
    localApiStartFailedPrefix: 'Start failed: ',
    localApiStartCommandCopied: 'Start command copied.',
    localApiBrowserCannotStart: 'Browser pages cannot directly start the local Node process. The Obsidian plugin can start it directly.',
    localApiAutoSaveTitle: 'Fallback browser-cache backup to local database',
    localApiAutoSaveHint: 'Online mode writes to the local database in real time. This switch is only a fallback scheduled import from the browser cache.',
    localApiAutoSaveIntervalLabel: 'Backup interval (minutes)',
    localApiAutoSaveEnable: 'Turn on fallback backup',
    localApiAutoSaveDisable: 'Turn off fallback backup',
    localApiAutoSaveEnabledStatus: 'Fallback backup is on',
    localApiAutoSaveDisabledStatus: 'Fallback backup is off',
    calendarHolidayTitle: 'Calendar Holidays',
    calendarHolidayHint: 'Show holiday labels in calendar cards.',
    calendarHolidayNone: 'None',
    calendarHolidayChina: 'China',
    calendarHolidayUS: 'US',
    calendarHolidayBoth: 'All',
    localApiUrlLabel: 'API URL',
    localApiVersionLabel: 'API version',
    localApiStartCommandLabel: 'Start command',
    localApiToolbarOnline: 'Local API Online',
    localApiToolbarOffline: 'Connect Local API',
    localApiToolbarChecking: 'Checking Local API',
    localApiToolbarIdle: 'Connect Local API',
    dataManagementTitle: 'Data Management',
    dataManagementHint: 'Local database reload and import tools live here as fallback recovery, backup, and debugging actions.',
    dataManagementReload: 'Reload from local database',
    dataManagementImport: 'Import current canvas into local database',
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
    filterLabel: '筛选',
    removeItemAria: '删除事项',
    laneTodo: '待办',
    laneDoing: '进行中',
    laneDone: '已完成',
    laneAddCard: '新增卡片',
    tagEvent: '事件',
    tagFeature: '功能',
    tagImportant: '重要',
    tagPlan: '计划',
    tagBug: '问题',
    tagIdea: '想法',
    filterAll: '全部',
    defaultItems: ['整理想法', '安排下一步'],
  },
  en: {
    newCardButton: '+ New todo card',
    title: 'Todo',
    placeholder: 'Type a task and press Enter',
    addButton: 'Add',
    emptyHint: 'No tasks yet. Type above and press Enter.',
    filterLabel: 'Filter',
    removeItemAria: 'Remove item',
    laneTodo: 'To-do',
    laneDoing: 'Doing',
    laneDone: 'Done',
    laneAddCard: 'Add card',
    tagEvent: 'Event',
    tagFeature: 'Feature',
    tagImportant: 'Important',
    tagPlan: 'Plan',
    tagBug: 'Bug',
    tagIdea: 'Idea',
    filterAll: 'All',
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
const toMonthKey = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`

const parseDateKey = (value: string): Date => {
  const [yearRaw, monthRaw, dayRaw] = value.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return new Date()
  return new Date(year, month - 1, day)
}

const toDateKeyOrFallback = (value: string | undefined, fallback: string) =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : fallback

const shiftDateKey = (dateKey: string, deltaDays: number) => {
  const date = parseDateKey(dateKey)
  date.setDate(date.getDate() + deltaDays)
  return toDateKey(date)
}

const shiftMonthKey = (monthKey: string, delta: number) => {
  const rawMonth = typeof monthKey === 'string' ? monthKey.trim() : ''
  const match = /^(\d{4})-(\d{2})/.exec(rawMonth)
  const fallback = new Date()
  const year = match ? Number(match[1]) : fallback.getFullYear()
  const monthIndex = match ? Number(match[2]) - 1 : fallback.getMonth()
  const date = new Date(year, monthIndex + delta, 1)
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

const isEditableKeyboardTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

const getWeekStart = (date: Date) => {
  const output = new Date(date)
  output.setDate(date.getDate() - date.getDay())
  output.setHours(0, 0, 0, 0)
  return output
}

const buildMonthCells = (monthCursor: string): CalendarDayCell[] => {
  const cursor = parseDateKey(/^\d{4}-\d{2}$/.test(monthCursor.trim()) ? `${monthCursor.trim()}-01` : monthCursor)
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
  const date = parseDateKey(/^\d{4}-\d{2}$/.test(monthCursor.trim()) ? `${monthCursor.trim()}-01` : monthCursor)
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

const isMediaCardKind = (kind: CardKind): kind is Extract<CardKind, 'image' | 'video' | 'pdf'> =>
  kind === 'image' || kind === 'video' || kind === 'pdf'

const mergeRemoteGridsWithLocalMediaCards = (remoteGrids: GridData[], localGrids: GridData[]): GridData[] => {
  if (!Array.isArray(remoteGrids) || !Array.isArray(localGrids)) return remoteGrids

  const localById = new Map(localGrids.map((grid) => [grid.id, grid]))

  return remoteGrids.map((remoteGrid) => {
    const localGrid = localById.get(remoteGrid.id)
    if (!localGrid) return remoteGrid

    const localCardsById = new Map(localGrid.cards.map((card) => [card.id, card]))
    const remoteCardIds = new Set(remoteGrid.cards.map((card) => card.id))
    const mergedRemoteCards = remoteGrid.cards.map((remoteCard) => {
      const localCard = localCardsById.get(remoteCard.id)
      if (!localCard || !isMediaCardKind(remoteCard.kind) || !isMediaCardKind(localCard.kind)) return remoteCard

      const preservedFileId = localCard.fileId && !remoteCard.fileId ? localCard.fileId : remoteCard.fileId
      return {
        ...remoteCard,
        ...(preservedFileId ? { fileId: preservedFileId } : {}),
        fileName: remoteCard.fileName || localCard.fileName,
        externalUrl: remoteCard.externalUrl || localCard.externalUrl,
      }
    })
    const preservedMediaCards = localGrid.cards
      .filter((card) => isMediaCardKind(card.kind) && !remoteCardIds.has(card.id))
      .map((card) => ({ ...card }))

    if (preservedMediaCards.length === 0 && mergedRemoteCards === remoteGrid.cards) return remoteGrid

    return {
      ...remoteGrid,
      cards: [...mergedRemoteCards, ...preservedMediaCards],
    }
  })
}

const withCalendarDefaults = normalizeCalendarState

const DEFAULT_CANVAS_ZOOM = 0.45

const initialViewport: ViewportState = { ...INITIAL_VIEWPORT, zoom: DEFAULT_CANVAS_ZOOM }

const createCenteredViewport = (
  bounds?: { width: number; height: number } | null,
  target?: { x: number; y: number } | null,
): ViewportState => {
  const width = bounds?.width && bounds.width > 0 ? bounds.width : typeof window !== 'undefined' ? window.innerWidth : 1440
  const height = bounds?.height && bounds.height > 0 ? bounds.height : typeof window !== 'undefined' ? window.innerHeight : 900
  const tx = target?.x ?? SCENE_WIDTH / 2
  const ty = target?.y ?? SCENE_HEIGHT / 2

  return {
    zoom: DEFAULT_CANVAS_ZOOM,
    x: width / 2 - tx * DEFAULT_CANVAS_ZOOM,
    y: height / 2 - ty * DEFAULT_CANVAS_ZOOM,
  }
}

const getCardsCenter = (grid: GridData | undefined): { x: number; y: number } | null => {
  if (!grid || grid.cards.length === 0) return null
  let sx = 0
  let sy = 0
  for (const c of grid.cards) {
    sx += c.x + c.width / 2
    sy += c.y + c.height / 2
  }
  return { x: sx / grid.cards.length, y: sy / grid.cards.length }
}

const getViewportCenterWorldPoint = (bounds: { width: number; height: number } | null | undefined, viewport: ViewportState) => {
  if (!bounds) return { x: SCENE_WIDTH / 2, y: SCENE_HEIGHT / 2 }
  return {
    x: (bounds.width / 2 - viewport.x) / viewport.zoom,
    y: (bounds.height / 2 - viewport.y) / viewport.zoom,
  }
}

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
  return 'system'
}

const normalizeSettings = (input: Partial<AppSettings> | null | undefined): AppSettings => {
  const language = input?.language === 'zh' ? 'zh' : DEFAULT_SETTINGS.language
  const themeMode = normalizeThemeMode(input?.themeMode)
  const autoSync = typeof input?.autoSync === 'boolean' ? input.autoSync : DEFAULT_SETTINGS.autoSync
  const syncOnStartup = typeof input?.syncOnStartup === 'boolean' ? input.syncOnStartup : DEFAULT_SETTINGS.syncOnStartup
  const syncDebounceMsRaw = Number(input?.syncDebounceMs)
  const syncDebounceMs = Number.isFinite(syncDebounceMsRaw)
    ? Math.max(500, Math.min(12_000, Math.round(syncDebounceMsRaw)))
    : DEFAULT_SETTINGS.syncDebounceMs
  const localApiAutoSaveEnabled = typeof input?.localApiAutoSaveEnabled === 'boolean'
    ? input.localApiAutoSaveEnabled
    : DEFAULT_SETTINGS.localApiAutoSaveEnabled
  const localApiAutoSaveMinutesRaw = Number(input?.localApiAutoSaveMinutes)
  const localApiAutoSaveMinutes = Number.isFinite(localApiAutoSaveMinutesRaw)
    ? Math.max(1, Math.min(240, Math.round(localApiAutoSaveMinutesRaw)))
    : DEFAULT_SETTINGS.localApiAutoSaveMinutes
  const calendarHolidayMode = ['none', 'china', 'us', 'both'].includes(String(input?.calendarHolidayMode))
    ? (String(input?.calendarHolidayMode) as 'none' | 'china' | 'us' | 'both')
    : DEFAULT_SETTINGS.calendarHolidayMode

  return {
    language,
    themeMode,
    autoSync,
    syncOnStartup,
    syncDebounceMs,
    localApiAutoSaveEnabled,
    localApiAutoSaveMinutes,
    calendarHolidayMode,
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

const toFiniteNumber = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const toTodoItems = (input: ExternalTodoInput[] | undefined) => normalizeTodoItems(input)

const toCalendarEvents = (input: ExternalCalendarInput['events'] | undefined, fallbackDate: string) =>
  normalizeCalendarEvents(input, fallbackDate)

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

const putPersistedState = async (state: PersistedAppStateWithTrash) => {
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

const normalizeTrashCards = (input: unknown[]): TrashedCard[] =>
  input
    .filter((item): item is TrashedCard => {
      if (!item || typeof item !== 'object') return false
      const raw = item as Partial<TrashedCard>
      return (
        typeof raw.id === 'string' &&
        raw.card !== undefined &&
        typeof raw.gridId === 'string' &&
        typeof raw.gridName === 'string' &&
        Number.isFinite(Number(raw.deletedAt)) &&
        Number.isFinite(Number(raw.expiresAt))
      )
    })
    .map((item) => ({
      ...item,
      deletedAt: Number(item.deletedAt),
      expiresAt: Number(item.expiresAt),
    }))

const normalizeTrashTodoItems = (input: unknown[]): TrashedTodoItem[] =>
  input
    .filter((item): item is TrashedTodoItem => {
      if (!item || typeof item !== 'object') return false
      const raw = item as Partial<TrashedTodoItem>
      return (
        typeof raw.id === 'string' &&
        raw.item !== undefined &&
        typeof raw.cardId === 'string' &&
        typeof raw.cardTitle === 'string' &&
        typeof raw.gridId === 'string' &&
        typeof raw.gridName === 'string' &&
        Number.isFinite(Number(raw.deletedAt)) &&
        Number.isFinite(Number(raw.expiresAt))
      )
    })
    .map((item) => ({
      ...item,
      deletedAt: Number(item.deletedAt),
      expiresAt: Number(item.expiresAt),
    }))

const normalizePersistedStateSnapshot = (input: unknown): PersistedAppStateSnapshot | null => {
  if (!input || typeof input !== 'object') return null

  const raw = input as Record<string, unknown>
  const version = Number(raw.version)
  const grids = Array.isArray(raw.grids) ? (raw.grids as GridData[]) : null
  const activeGridId = typeof raw.activeGridId === 'string' ? raw.activeGridId.trim() : ''
  const viewport = raw.viewport && typeof raw.viewport === 'object' ? (raw.viewport as ViewportState) : null
  const savedAt = Number(raw.savedAt)
  const normalizedTrashCards = Array.isArray(raw.trashCards) ? normalizeTrashCards(raw.trashCards) : []
  const normalizedTrashTodoItems = Array.isArray(raw.trashTodoItems) ? normalizeTrashTodoItems(raw.trashTodoItems) : []

  if (!Number.isFinite(version) || version < 1 || !grids || !activeGridId || !viewport) {
    return null
  }

  return {
    version,
    grids,
    activeGridId,
    viewport,
    trashCards: normalizedTrashCards,
    trashTodoItems: normalizedTrashTodoItems,
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

type StartLocalApiResult = {
  ok: boolean
  message?: string
  pid?: number
}

type LocalApiHealthResult = {
  ok: boolean
  version?: string
  apiBaseUrl?: string
  message?: string
}

type AppProps = {
  runtime?: AppRuntime
  onStartLocalApi?: (input: { apiBaseUrl: string }) => Promise<StartLocalApiResult>
  onCheckLocalApiHealth?: (input: { apiBaseUrl: string }) => Promise<LocalApiHealthResult>
}

function App({ runtime = 'web', onStartLocalApi, onCheckLocalApiHealth }: AppProps) {
  const isObsidianRuntime = runtime === 'obsidian'
  const [grids, setGrids] = useState<GridData[]>(initialGrids)
  const [activeGridId, setActiveGridId] = useState(initialGrids[0].id)
  const [viewport, setViewport] = useState<ViewportState>(initialViewport)
  const [cardNavigatorOpen, setCardNavigatorOpen] = useState(false)
  const [trashOpen, setTrashOpen] = useState(false)
  const [cardNavigatorQuery, setCardNavigatorQuery] = useState('')
  const [highlightedNavigatorCardId, setHighlightedNavigatorCardId] = useState<string | null>(null)
  const [pointerMode, setPointerMode] = useState<PointerMode>('card')
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null)
  const [resizingCardId, setResizingCardId] = useState<string | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [inspectedDashboardCardId, setInspectedDashboardCardId] = useState<string | null>(null)
  const [isFileOver, setIsFileOver] = useState(false)
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({})
  const [hydrated, setHydrated] = useState(false)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [localApiStatus, setLocalApiStatus] = useState<LocalApiStatus>('idle')
  const [localApiStarting, setLocalApiStarting] = useState(false)
  const [localApiHealth, setLocalApiHealth] = useState<{ version?: string; apiBaseUrl?: string } | null>(null)
  const [localApiStatusMessage, setLocalApiStatusMessage] = useState('')
  const [todoDraftTarget, setTodoDraftTarget] = useState<{ cardId: string; lane: TodoLane } | null>(null)
  const [todoDraftText, setTodoDraftText] = useState('')
  const [todoDraftTag, setTodoDraftTag] = useState<TodoTag>('event')
  const [todoFilters, setTodoFilters] = useState<Record<string, TodoFilter>>({})
  const [calendarNavigationLocks, setCalendarNavigationLocks] = useState<Record<string, number>>({})
  const [calendarDraftOpen, setCalendarDraftOpen] = useState(false)
  const [calendarDraftCardId, setCalendarDraftCardId] = useState<string | null>(null)
  const [minimizedCardIds, setMinimizedCardIds] = useState<string[]>([])
  const [pendingDeleteCardId, setPendingDeleteCardId] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
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
  const [trashCards, setTrashCards] = useState<TrashedCard[]>([])
  const [trashTodoItems, setTrashTodoItems] = useState<TrashedTodoItem[]>([])
  const [renamingImageCardId, setRenamingImageCardId] = useState<string | null>(null)
  const [imageCardTitleDraft, setImageCardTitleDraft] = useState('')

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
  const eventFlowNodeDragRef = useRef<EventFlowNodeDragState>(null)
  const eventFlowEdgeDragRef = useRef<EventFlowEdgeDragState>(null)
  const eventFlowConnectHandlerRef = useRef<((sourceNodeId: string, targetNodeId: string) => void) | null>(null)
  const [eventFlowEdgeDrag, setEventFlowEdgeDrag] = useState<EventFlowEdgeDragState>(null)

  const persistTimerRef = useRef<number | null>(null)
  const skipLocalSyncMetaUpdateRef = useRef(false)
  const localApiAutoSaveRunningRef = useRef(false)
  const startupSyncUserRef = useRef<string | null>(null)
  const serverAuth = useRef<DisabledRemoteAuth | null>(null).current
  const lastCliBridgeWorkspaceUpdatedAtRef = useRef<string | null>(null)
  const lastCliBridgeWorkspaceRevisionRef = useRef<number | null>(null)
  const localApiLiveInitialPullRef = useRef<string | null>(null)
  const localApiLivePullTimerRef = useRef<number | null>(null)
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
  const inspectedDashboardCard = activeGrid?.cards.find((card) => card.id === inspectedDashboardCardId && card.kind === 'dashboard')
  const renamingImageCard = activeGrid?.cards.find((card) => card.id === renamingImageCardId && card.kind === 'image')

  const text = I18N[settings.language]
  const todoText = TODO_I18N[settings.language]
  const calendarText = CALENDAR_I18N[settings.language]
  const todoLaneLabels: Record<TodoLane, string> = {
    todo: todoText.laneTodo,
    doing: todoText.laneDoing,
    done: todoText.laneDone,
  }
  const todoTagLabels: Record<TodoTag, string> = {
    event: todoText.tagEvent,
    feature: todoText.tagFeature,
    important: todoText.tagImportant,
    plan: todoText.tagPlan,
    bug: todoText.tagBug,
    idea: todoText.tagIdea,
  }
  const todoFilterLabels: Record<TodoFilter, string> = {
    all: todoText.filterAll,
    ...todoTagLabels,
  }

  useEffect(() => {
    gridsRef.current = grids
  }, [grids])

  const commitGrids = useCallback((updater: (current: GridData[]) => GridData[]) => {
    setGrids((current) => {
      const next = updater(current)
      gridsRef.current = next
      return next
    })
  }, [])

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
          const targetGridId = persistedState.activeGridId || normalizedGrids[0].id
          const targetGrid = normalizedGrids.find((g) => g.id === targetGridId) ?? normalizedGrids[0]
          setGrids(normalizedGrids)
          setActiveGridId(targetGridId)
          const persistedTrashCards =
            'trashCards' in persistedState && Array.isArray(persistedState.trashCards)
              ? normalizeTrashCards(persistedState.trashCards)
              : []
          const persistedTrashTodoItems =
            'trashTodoItems' in persistedState && Array.isArray(persistedState.trashTodoItems)
              ? normalizeTrashTodoItems(persistedState.trashTodoItems)
              : []
          setViewport(persistedState.viewport ?? createCenteredViewport(canvasRef.current?.getBoundingClientRect(), getCardsCenter(targetGrid)))
          setTrashCards(persistedTrashCards)
          setTrashTodoItems(persistedTrashTodoItems)
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
      const state: PersistedAppStateWithTrash = {
        version: 1,
        grids,
        activeGridId,
        viewport,
        trashCards,
        trashTodoItems,
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
  }, [activeGridId, grids, hydrated, trashCards, trashTodoItems, viewport])

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

  const persistLocalStateSnapshot = useCallback((state: PersistedAppStateWithTrash) => {
    const snapshot: PersistedAppStateSnapshot = {
      ...state,
      trashCards: state.trashCards ?? [],
      trashTodoItems: state.trashTodoItems ?? [],
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
      trashCards,
      trashTodoItems,
    })
  }, [activeGridId, grids, hydrated, persistLocalStateSnapshot, trashCards, trashTodoItems, viewport])

  const resolveApiBaseUrl = useCallback(() => {
    const configured = (serverAuth?.apiBaseUrl || getApiBaseUrl()).trim()
    return configured
  }, [serverAuth?.apiBaseUrl])
  const resolveOptionalApiKey = useCallback(() => serverAuth?.lastApiKey ?? '', [serverAuth?.lastApiKey])
  const localApiBaseUrl = resolveApiBaseUrl()
  const localApiStartCommand = useMemo(() => {
    try {
      const url = new URL(localApiBaseUrl)
      return `canvas-workbench start --api-port ${url.port || '8799'}`
    } catch {
      return 'canvas-workbench start'
    }
  }, [localApiBaseUrl])

  const refreshLocalApiStatus = useCallback(async () => {
    setLocalApiStatus('checking')
    setLocalApiStatusMessage('')
    try {
      const baseUrl = resolveApiBaseUrl()
      const health = onCheckLocalApiHealth
        ? await onCheckLocalApiHealth({ apiBaseUrl: baseUrl })
        : await apiCheckHealth(baseUrl, 1500)
      const healthMessage = 'message' in health && typeof health.message === 'string' ? health.message : ''
      setLocalApiHealth({ version: health.version, apiBaseUrl: health.apiBaseUrl || baseUrl })
      setLocalApiStatus(health.ok === false ? 'offline' : 'online')
      setLocalApiStatusMessage(health.ok === false ? healthMessage : '')
    } catch (error) {
      setLocalApiHealth(null)
      setLocalApiStatus('offline')
      setLocalApiStatusMessage(error instanceof Error ? error.message : String(error))
    }
  }, [onCheckLocalApiHealth, resolveApiBaseUrl])

  const copyLocalApiStartCommand = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(localApiStartCommand)
      setLocalApiStatusMessage(text.localApiStartCommandCopied)
    } catch (error) {
      setLocalApiStatusMessage(error instanceof Error ? error.message : String(error))
    }
  }, [localApiStartCommand, text.localApiStartCommandCopied])

  const openLocalApiHealth = useCallback(() => {
    window.open(`${localApiBaseUrl.replace(/\/$/, '')}/health`, '_blank', 'noopener,noreferrer')
  }, [localApiBaseUrl])

  const handleStartLocalApi = useCallback(async () => {
    setLocalApiStarting(true)
    setLocalApiStatus('checking')
    if (!onStartLocalApi) {
      await copyLocalApiStartCommand()
      setLocalApiStarting(false)
      return
    }

    setLocalApiStatusMessage(text.localApiStarting)
    try {
      const result = await onStartLocalApi({ apiBaseUrl: localApiBaseUrl })
      if (!result.ok) {
        throw new Error(result.message || text.localApiStartFailedPrefix)
      }
      setLocalApiStatusMessage(result.message || `${text.localApiStartSuccess}${result.pid ? ` PID ${result.pid}` : ''}`)
      const delays = [800, 1800, 3200, 5200]
      delays.forEach((delay) => {
        window.setTimeout(() => {
          void refreshLocalApiStatus()
        }, delay)
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setLocalApiStatusMessage(`${text.localApiStartFailedPrefix}${message}`)
      setLocalApiStatus('offline')
    } finally {
      window.setTimeout(() => setLocalApiStarting(false), 1400)
    }
  }, [copyLocalApiStartCommand, localApiBaseUrl, onStartLocalApi, refreshLocalApiStatus, text.localApiStartFailedPrefix, text.localApiStartSuccess, text.localApiStarting])

  const handleLocalApiToolbarAction = useCallback(async () => {
    if (localApiStatus === 'online') {
      void refreshLocalApiStatus()
      return
    }
    await handleStartLocalApi()
  }, [handleStartLocalApi, localApiStatus, refreshLocalApiStatus])

  useEffect(() => {
    if (!settingsOpen) return
    void refreshLocalApiStatus()
  }, [refreshLocalApiStatus, settingsOpen])

  const updateCliBridgeLayoutSyncMeta = useCallback((partial: Partial<CliBridgeLayoutSyncMeta>) => {
    const next = normalizeCliBridgeLayoutSyncMeta({ ...cliBridgeLayoutSyncRef.current, ...partial })
    cliBridgeLayoutSyncRef.current = next
    writeJson(CLI_BRIDGE_LAYOUT_SYNC_KEY, next)
    return next
  }, [])

  const persistCliBridgeGridCreate = useCallback(
    async (grid: GridData, activateGrid = false) => {
      if (!account) return false

      try {
        await apiCreateGrid(
          resolveOptionalApiKey(),
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
    [account, resolveApiBaseUrl, resolveOptionalApiKey, updateCliBridgeLayoutSyncMeta],
  )

  const persistCliBridgeGridUpdate = useCallback(
    async (gridId: string, updates: { name?: string; activate?: boolean }) => {
      if (!account) return false

      try {
        await apiUpdateGrid(resolveOptionalApiKey(), gridId, updates, resolveApiBaseUrl())
        updateCliBridgeLayoutSyncMeta({ lastLayoutSyncAt: Date.now() })
        return true
      } catch (error) {
        console.error('Failed to persist CLI Bridge grid update:', error)
        return false
      }
    },
    [account, resolveApiBaseUrl, resolveOptionalApiKey, updateCliBridgeLayoutSyncMeta],
  )

  const persistCliBridgeGridDelete = useCallback(
    async (gridId: string) => {
      if (!account) return false

      try {
        await apiDeleteGrid(resolveOptionalApiKey(), gridId, resolveApiBaseUrl())
        updateCliBridgeLayoutSyncMeta({ lastLayoutSyncAt: Date.now() })
        return true
      } catch (error) {
        console.error('Failed to persist CLI Bridge grid deletion:', error)
        return false
      }
    },
    [account, resolveApiBaseUrl, resolveOptionalApiKey, updateCliBridgeLayoutSyncMeta],
  )

  const persistCliBridgeAssetUpload = useCallback(
    async (assetId: string, name: string, type: string, blob: Blob) => {
      if (!account) return null

      try {
        const dataUrl = await blobToDataUrl(blob)
        const uploaded = await apiCreateAsset(
          resolveOptionalApiKey(),
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
    [account, resolveApiBaseUrl, resolveOptionalApiKey, updateCliBridgeLayoutSyncMeta],
  )

  const persistCliBridgeAssetDelete = useCallback(
    async (assetId: string) => {
      if (!account) return false

      try {
        await apiDeleteAsset(resolveOptionalApiKey(), assetId, resolveApiBaseUrl())
        updateCliBridgeLayoutSyncMeta({ lastLayoutSyncAt: Date.now() })
        return true
      } catch (error) {
        console.error('Failed to persist CLI Bridge asset deletion:', error)
        return false
      }
    },
    [account, resolveApiBaseUrl, resolveOptionalApiKey, updateCliBridgeLayoutSyncMeta],
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
      if (!account) return false

      try {
        await apiUpdateCard(resolveOptionalApiKey(), cardId, updates, resolveApiBaseUrl())
        updateCliBridgeLayoutSyncMeta({ lastLayoutSyncAt: Date.now() })
        return true
      } catch (error) {
        console.error('Failed to persist CLI Bridge card patch:', error)
        return false
      }
    },
    [account, resolveApiBaseUrl, resolveOptionalApiKey, updateCliBridgeLayoutSyncMeta],
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
      if (!account) return false

      try {
        await apiCreateCard(
          resolveOptionalApiKey(),
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
            eventFlow: card.eventFlow,
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
    [account, resolveApiBaseUrl, resolveOptionalApiKey, updateCliBridgeLayoutSyncMeta],
  )

  const persistCliBridgeCardDelete = useCallback(
    async (cardId: string) => {
      if (!account) return false

      try {
        await apiDeleteCard(resolveOptionalApiKey(), cardId, resolveApiBaseUrl())
        updateCliBridgeLayoutSyncMeta({ lastLayoutSyncAt: Date.now() })
        return true
      } catch (error) {
        console.error('Failed to persist CLI Bridge card deletion:', error)
        return false
      }
    },
    [account, resolveApiBaseUrl, resolveOptionalApiKey, updateCliBridgeLayoutSyncMeta],
  )

  const uploadWorkspaceToLocalApi = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      const currentGrids = gridsRef.current
      const currentActiveGrid = currentGrids.find((grid) => grid.id === activeGridId) ?? currentGrids[0]
      if (!currentActiveGrid) return false

      try {
        const assets = await getAllAssets()
        const uploadedAssetUrls: Record<string, string> = {}
        for (const grid of currentGrids) {
          for (const card of grid.cards) {
            if (!isMediaCardKind(card.kind) || !card.fileId || card.externalUrl) continue
            const asset = assets.find((item) => item.id === card.fileId)
            if (!asset) continue
            const uploadedUrl = await persistCliBridgeAssetUpload(asset.id, asset.name, asset.type || 'application/octet-stream', asset.blob)
            if (uploadedUrl) uploadedAssetUrls[card.id] = uploadedUrl
          }
        }
        const gridsForUpload = currentGrids.map((grid) => ({
          id: grid.id,
          name: grid.name,
          cards: grid.cards.map((card) =>
            uploadedAssetUrls[card.id]
              ? {
                  ...card,
                  externalUrl: uploadedAssetUrls[card.id],
                }
              : card,
          ),
        }))
        const payload = {
          name: 'My Canvas',
          activeGridId,
          grids: gridsForUpload,
        }
        await apiUploadWorkspaceState(resolveOptionalApiKey(), payload, resolveApiBaseUrl())
        if (Object.keys(uploadedAssetUrls).length > 0) {
          setGrids((current) =>
            current.map((grid) => ({
              ...grid,
              cards: grid.cards.map((card) =>
                uploadedAssetUrls[card.id]
                  ? {
                      ...card,
                      externalUrl: uploadedAssetUrls[card.id],
                    }
                  : card,
              ),
            })),
          )
        }
        updateCliBridgeLayoutSyncMeta({ lastLayoutSyncAt: Date.now() })
        setSyncStatus('ok')
        if (!silent) {
          setSyncMessage(settings.language === 'zh' ? '已导入到本地数据库。' : 'Imported workspace into local database.')
        }
        return true
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setSyncStatus('error')
        setSyncMessage(
          settings.language === 'zh'
            ? `导入到本地数据库失败：${message}`
            : `Failed to import into local database: ${message}`,
        )
        console.error('Failed to upload workspace to Local API:', error)
        return false
      }
    },
    [activeGridId, persistCliBridgeAssetUpload, resolveApiBaseUrl, resolveOptionalApiKey, settings.language, updateCliBridgeLayoutSyncMeta],
  )

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('canvas-workbench:config', {
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

  const restoreRemoteMediaAssets = useCallback(async (nextGrids: GridData[]) => {
    const restored: Record<string, DownloadedAssetRestore> = {}
    const seenAssetIds = new Set<string>()

    for (const grid of nextGrids) {
      for (const card of grid.cards) {
        if (!isMediaCardKind(card.kind) || !card.fileId || !card.externalUrl) continue
        if (assetUrlsRef.current[card.fileId] || seenAssetIds.has(card.fileId)) continue
        seenAssetIds.add(card.fileId)

        try {
          const downloaded = await apiDownloadAsset(card.externalUrl)
          const blob = downloaded.blob
          const asset: StoredAsset = {
            id: card.fileId,
            blob,
            name: card.fileName || card.title || card.fileId,
            type: downloaded.type || blob.type || 'application/octet-stream',
            createdAt: Date.now(),
          }
          await putAsset(asset)
          restored[card.fileId] = {
            asset,
            url: URL.createObjectURL(blob),
          }
        } catch (error) {
          console.error('Failed to restore Local API media asset:', error)
        }
      }
    }

    return restored
  }, [])

  const pullCliBridgeWorkspace = useCallback(async (force = false, apiBaseUrlOverride?: string) => {
    if (!account) return false

    try {
      const { lastLayoutMutationAt, lastLayoutSyncAt } = cliBridgeLayoutSyncRef.current
      if (!force && lastLayoutMutationAt > lastLayoutSyncAt + 1000) {
        return false
      }

      if (!force && Object.keys(cliBridgePendingPatchRef.current).length > 0) {
        return false
      }

      const remote = await apiGetWorkspaceState(resolveOptionalApiKey(), apiBaseUrlOverride || resolveApiBaseUrl())
      const remoteUpdatedAt = remote.workspace.updatedAt || null
      const remoteRevision = typeof remote.workspace.revision === 'number' ? remote.workspace.revision : null
      if (!force && remoteRevision !== null && remoteRevision === lastCliBridgeWorkspaceRevisionRef.current) {
        return false
      }
      if (!force && remoteRevision === null && remoteUpdatedAt && remoteUpdatedAt === lastCliBridgeWorkspaceUpdatedAtRef.current) {
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
      const hasLocalCards = gridsRef.current.some((grid) => grid.cards.length > 0)
      if (!hasRemoteCards && hasLocalCards && !force) {
        lastCliBridgeWorkspaceUpdatedAtRef.current = remoteUpdatedAt
        lastCliBridgeWorkspaceRevisionRef.current = remoteRevision
        return false
      }

      const nextGrids = mergeRemoteGridsWithLocalMediaCards(
        normalizeGridsForTodoBoard(remoteGrids as GridData[]),
        gridsRef.current,
      )
      if (!nextGrids.length) {
        lastCliBridgeWorkspaceUpdatedAtRef.current = remoteUpdatedAt
        lastCliBridgeWorkspaceRevisionRef.current = remoteRevision
        return false
      }

      const restoredMediaAssets = await restoreRemoteMediaAssets(nextGrids)
      const restoredAssetUrls = Object.fromEntries(
        Object.entries(restoredMediaAssets).map(([assetId, restored]) => [assetId, restored.url]),
      )

      if (Object.keys(restoredAssetUrls).length > 0) {
        setAssetUrls((current) => {
          Object.keys(restoredAssetUrls).forEach((assetId) => {
            if (current[assetId]) URL.revokeObjectURL(restoredAssetUrls[assetId])
          })
          return { ...current, ...restoredAssetUrls }
        })
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
      lastCliBridgeWorkspaceRevisionRef.current = remoteRevision
      return true
    } catch {
      return false
    } finally {
      window.setTimeout(() => {
        skipLocalSyncMetaUpdateRef.current = false
      }, 0)
    }
  }, [account, resolveApiBaseUrl, resolveOptionalApiKey, restoreRemoteMediaAssets, setActiveGridId, setGrids, updateCliBridgeLayoutSyncMeta, updateSyncMeta])

  const persistCliBridgeCardLayout = useCallback(
    async (
      cardId: string,
      updates: { x?: number; y?: number; width?: number; height?: number },
    ) => {
      if (!account) return false

      try {
        await apiUpdateCard(resolveOptionalApiKey(), cardId, updates, resolveApiBaseUrl())
        updateCliBridgeLayoutSyncMeta({ lastLayoutSyncAt: Date.now() })
        return true
      } catch (error) {
        console.error('Failed to persist CLI Bridge card layout:', error)
        return false
      }
    },
    [account, resolveApiBaseUrl, resolveOptionalApiKey, updateCliBridgeLayoutSyncMeta],
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

        const normalizedGrids = normalizeGridsForTodoBoard(snapshot.state.grids)
        const targetGridId = snapshot.state.activeGridId
        const targetGrid = normalizedGrids.find((g) => g.id === targetGridId) ?? normalizedGrids[0]
        setAssetUrls(restoredUrls)
        setGrids(normalizedGrids)
        setActiveGridId(targetGridId)
        setViewport(snapshot.state.viewport ?? createCenteredViewport(canvasRef.current?.getBoundingClientRect(), getCardsCenter(targetGrid)))
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
    if (!hydrated || !account || !settings.localApiAutoSaveEnabled) return

    const intervalMs = Math.max(1, settings.localApiAutoSaveMinutes) * 60_000
    const runAutoSave = () => {
      if (skipLocalSyncMetaUpdateRef.current || localApiAutoSaveRunningRef.current) return
      localApiAutoSaveRunningRef.current = true
      void uploadWorkspaceToLocalApi({ silent: true }).finally(() => {
        localApiAutoSaveRunningRef.current = false
      })
    }
    const timer = window.setInterval(runAutoSave, intervalMs)
    runAutoSave()

    return () => {
      window.clearInterval(timer)
    }
  }, [account, hydrated, settings.localApiAutoSaveEnabled, settings.localApiAutoSaveMinutes, uploadWorkspaceToLocalApi])

  useEffect(() => {
    if (!hydrated || !account) return

    const apiBaseUrl = resolveApiBaseUrl()
    const stream = createWorkspaceEventSource(resolveOptionalApiKey(), apiBaseUrl)
    let closed = false

    const schedulePull = (force = false) => {
      if (closed) return
      if (localApiLivePullTimerRef.current !== null) {
        window.clearTimeout(localApiLivePullTimerRef.current)
      }
      localApiLivePullTimerRef.current = window.setTimeout(() => {
        localApiLivePullTimerRef.current = null
        void pullCliBridgeWorkspace(force, apiBaseUrl)
      }, force ? 0 : 250)
    }

    stream.addEventListener('hello', (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data || '{}') as ServerWorkspaceEvent
      if (typeof payload.revision === 'number') {
        lastCliBridgeWorkspaceRevisionRef.current = payload.revision
      }
      if (payload.updatedAt) {
        lastCliBridgeWorkspaceUpdatedAtRef.current = payload.updatedAt
      }
      if (localApiLiveInitialPullRef.current !== apiBaseUrl) {
        localApiLiveInitialPullRef.current = apiBaseUrl
        schedulePull(true)
      }
    })

    stream.addEventListener('workspace.updated', (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data || '{}') as ServerWorkspaceEvent
      if (payload.workspaceId && typeof payload.revision === 'number' && payload.revision === lastCliBridgeWorkspaceRevisionRef.current) {
        return
      }
      schedulePull(false)
    })

    stream.onerror = () => {
      stream.close()
    }

    return () => {
      closed = true
      stream.close()
      if (localApiLivePullTimerRef.current !== null) {
        window.clearTimeout(localApiLivePullTimerRef.current)
        localApiLivePullTimerRef.current = null
      }
    }
  }, [account, hydrated, pullCliBridgeWorkspace, resolveApiBaseUrl, resolveOptionalApiKey])

  useEffect(() => {
    if (!hydrated || !account) return

    let cancelled = false
    const run = async () => {
      if (cancelled) return
      await pullCliBridgeWorkspace()
    }

    void run()
    if (!shouldPollLocalApiInRuntime(isObsidianRuntime)) return () => {
      cancelled = true
    }

    const timer = window.setInterval(() => {
      void run()
    }, 6000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [account, hydrated, isObsidianRuntime, pullCliBridgeWorkspace])

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
    const clearPointerInteractionState = () => {
      eventFlowNodeDragRef.current = null
      eventFlowEdgeDragRef.current = null
      setEventFlowEdgeDrag(null)
      dragStateRef.current = null
      panStateRef.current = null
      resizeStateRef.current = null
      setDraggingCardId(null)
      setResizingCardId(null)
      setIsPanning(false)
    }

    const handlePointerMove = (event: PointerEvent) => {
      const flowDragState = eventFlowNodeDragRef.current
      if (flowDragState) {
        const nextX = clamp((event.clientX - flowDragState.canvasLeft) / flowDragState.zoom - flowDragState.pointerOffsetX, 18, flowDragState.boundsWidth - 232)
        const nextY = clamp((event.clientY - flowDragState.canvasTop) / flowDragState.zoom - flowDragState.pointerOffsetY, 18, flowDragState.boundsHeight - 132)
        setGrids((current) =>
          current.map((grid) => ({
            ...grid,
            cards: grid.cards.map((card) => {
              if (card.id !== flowDragState.cardId || card.kind !== 'eventFlow') return card
              const eventFlow = normalizeEventFlowState(card.eventFlow)
              return {
                ...card,
                eventFlow: {
                  ...eventFlow,
                  nodes: eventFlow.nodes.map((node) =>
                    node.id === flowDragState.nodeId ? { ...node, x: nextX, y: nextY } : node,
                  ),
                },
              }
            }),
          })),
        )
        return
      }

      const edgeDragState = eventFlowEdgeDragRef.current
      if (edgeDragState) {
        const nextEdgeDrag: EventFlowEdgeDragState = {
          ...edgeDragState,
          pointerX: (event.clientX - edgeDragState.canvasLeft) / edgeDragState.zoom,
          pointerY: (event.clientY - edgeDragState.canvasTop) / edgeDragState.zoom,
        }
        eventFlowEdgeDragRef.current = nextEdgeDrag
        setEventFlowEdgeDrag(nextEdgeDrag)
        return
      }

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
        pushParticleImpulse(world.x, world.y, 0.08 + movement / 1200)
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
      finishEventFlowEdgeDragByPointer(event)

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
        pushParticleImpulse(world.x, world.y, 0.26)
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

      const flowDragState = eventFlowNodeDragRef.current
      if (flowDragState) {
        const targetCard = gridsRef.current.flatMap((grid) => grid.cards).find((card) => card.id === flowDragState.cardId)
        const targetNode = targetCard?.kind === 'eventFlow' ? normalizeEventFlowState(targetCard.eventFlow).nodes.find((node) => node.id === flowDragState.nodeId) : null
        if (targetNode) {
          void persistCliBridgeCardPatch(flowDragState.cardId, {
            eventFlow: normalizeEventFlowState({
              ...(targetCard?.kind === 'eventFlow' ? targetCard.eventFlow : undefined),
              nodes: normalizeEventFlowState(targetCard?.kind === 'eventFlow' ? targetCard.eventFlow : undefined).nodes.map((node) =>
                node.id === flowDragState.nodeId ? targetNode : node,
              ),
            }),
          })
        }
      }

      clearPointerInteractionState()
    }

    const handlePointerCancel = () => {
      clearPointerInteractionState()
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)
    window.addEventListener('blur', clearPointerInteractionState)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
      window.removeEventListener('blur', clearPointerInteractionState)
    }
  }, [persistCliBridgeCardLayout, pushParticleImpulse, toWorldPoint])

  useEffect(() => {
    const handleDashboardInspectKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setInspectedDashboardCardId(null)
    }

    window.addEventListener('keydown', handleDashboardInspectKeyDown)
    return () => {
      window.removeEventListener('keydown', handleDashboardInspectKeyDown)
    }
  }, [])

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

  const updateCardTitle = (cardId: string, title: string) => {
    updateCliBridgeLayoutSyncMeta({ lastLayoutMutationAt: Date.now() })
    setGrids((current) =>
      current.map((grid) => {
        if (grid.id !== activeGridId) return grid
        return {
          ...grid,
          cards: grid.cards.map((card) => (card.id === cardId ? { ...card, title } : card)),
        }
      }),
    )
    void persistCliBridgeCardPatch(cardId, { title })
  }

  const beginEditCardTitle = (card: CardData) => {
    setEditingCardId(card.id)
    setCardTitleDraft(card.title)
  }

  const commitCardTitle = () => {
    if (!editingCardId) return

    const nextTitle = cardTitleDraft.trim()
    if (!nextTitle) {
      cancelCardTitle()
      return
    }
    updateCardTitle(editingCardId, nextTitle)
    setEditingCardId(null)
    setCardTitleDraft('')
  }

  const cancelCardTitle = () => {
    setEditingCardId(null)
    setCardTitleDraft('')
  }

  const openImageCardRenameDialog = (card: CardData) => {
    if (card.kind !== 'image') return
    setRenamingImageCardId(card.id)
    setImageCardTitleDraft(card.title)
  }

  const closeImageCardRenameDialog = () => {
    setRenamingImageCardId(null)
    setImageCardTitleDraft('')
  }

  const submitImageCardRename = () => {
    const nextTitle = imageCardTitleDraft.trim()
    if (!renamingImageCardId || !nextTitle) return
    updateCardTitle(renamingImageCardId, nextTitle)
    closeImageCardRenameDialog()
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
    (payload?: CanvasWorkbenchCreateCardPayload) => {
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
            : kind === 'eventFlow'
              ? text.eventFlowTitle
              : kind === 'hint'
                ? 'Hints'
                : kind === 'note'
                  ? text.newNoteCard.replace('+ ', '')
                  : text.unnamedCard

      const defaultSize = CARD_DEFAULT_SIZES[kind]

      const width = clamp(toFiniteNumber(payload?.width, defaultSize.width), CARD_MIN_WIDTH, CARD_MAX_WIDTH)
      const height = clamp(toFiniteNumber(payload?.height, defaultSize.height), CARD_MIN_HEIGHT, CARD_MAX_HEIGHT)
      const title = String(payload?.title ?? '').trim() || defaultTitle
      const content = String(payload?.content ?? '').trim()
      const cardId = String(payload?.id || '').trim() || uid(kind)
      const externalTodoItems = toTodoItems(payload?.todoItems)
      const centeredWorldPoint = getViewportCenterWorldPoint(canvasRef.current?.getBoundingClientRect(), viewportRef.current)

      const cardBase: CardData = {
        id: cardId,
        kind,
        title,
        content: kind === 'note' ? content || text.notePlaceholder : content,
        x: clamp(toFiniteNumber(payload?.x, centeredWorldPoint.x - width / 2), -200, SCENE_WIDTH),
        y: clamp(toFiniteNumber(payload?.y, centeredWorldPoint.y - height / 2), -200, SCENE_HEIGHT),
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
                const calendarState = normalizeCalendarState({
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
              : kind === 'eventFlow'
                ? {
                    ...cardBase,
                    content: '',
                    eventFlow: normalizeEventFlowState(payload?.eventFlow ?? createDefaultEventFlowState()),
                  }
                : kind === 'dashboard'
                  ? {
                      ...cardBase,
                      content: '',
                      dashboard: payload?.dashboard,
                    }
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
      text.eventFlowTitle,
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
    const center = getViewportCenterWorldPoint(canvasRef.current?.getBoundingClientRect(), viewportRef.current)
    createCardInternal({
      kind: 'note',
      width: 340,
      height: 280,
      x: center.x - 340 / 2,
      y: center.y - 280 / 2,
    })
  }

  const addTodoCard = () => {
    const center = getViewportCenterWorldPoint(canvasRef.current?.getBoundingClientRect(), viewportRef.current)
    createCardInternal({
      kind: 'todo',
      width: 760,
      height: 430,
      x: center.x - 760 / 2,
      y: center.y - 430 / 2,
    })
  }

  const addCalendarCard = () => {
    const center = getViewportCenterWorldPoint(canvasRef.current?.getBoundingClientRect(), viewportRef.current)
    createCardInternal({
      kind: 'calendar',
      width: 480,
      height: 560,
      x: center.x - 480 / 2,
      y: center.y - 560 / 2,
    })
  }

  const addEventFlowCard = () => {
    const center = getViewportCenterWorldPoint(canvasRef.current?.getBoundingClientRect(), viewportRef.current)
    createCardInternal({
      kind: 'eventFlow',
      width: CARD_DEFAULT_SIZES.eventFlow.width,
      height: CARD_DEFAULT_SIZES.eventFlow.height,
      x: center.x - CARD_DEFAULT_SIZES.eventFlow.width / 2,
      y: center.y - CARD_DEFAULT_SIZES.eventFlow.height / 2,
    })
  }

  const addDashboardCard = () => {
    const center = getViewportCenterWorldPoint(canvasRef.current?.getBoundingClientRect(), viewportRef.current)
    createCardInternal({
      kind: 'dashboard',
      title: settings.language === 'zh' ? '数据卡片' : 'Data Card',
      width: CARD_DEFAULT_SIZES.dashboard.width,
      height: CARD_DEFAULT_SIZES.dashboard.height,
      x: center.x - CARD_DEFAULT_SIZES.dashboard.width / 2,
      y: center.y - CARD_DEFAULT_SIZES.dashboard.height / 2,
    })
  }

  const updateCardInternal = useCallback((payload: NonNullable<Extract<CanvasWorkbenchCommand, { type: 'update-card' }>['payload']>) => {
    const cardId = String(payload.cardId || '').trim()
    if (!cardId) {
      return { ok: false, message: 'cardId is required' } satisfies CanvasWorkbenchCommandResult
    }

    const exists = grids.some((grid) => grid.cards.some((card) => card.id === cardId))
    if (!exists) {
      return { ok: false, message: `Card not found: ${cardId}` } satisfies CanvasWorkbenchCommandResult
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
    if (payload.eventFlow !== undefined) patch.eventFlow = payload.eventFlow
    if (payload.dashboard !== undefined) patch.dashboard = payload.dashboard

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
            ...(payload.todoItems !== undefined ? { todoItems: toTodoItems(payload.todoItems) } : {}),
            ...(payload.calendar !== undefined ? { calendar: normalizeCalendarState(payload.calendar) } : {}),
            ...(payload.eventFlow !== undefined ? { eventFlow: normalizeEventFlowState(payload.eventFlow) } : {}),
            ...(payload.dashboard !== undefined ? { dashboard: payload.dashboard } : {}),
          }
        }),
      })),
    )

    void persistCliBridgeCardPatch(cardId, patch)

    return { ok: true, message: 'Card updated', data: { cardId } } satisfies CanvasWorkbenchCommandResult
  }, [grids, persistCliBridgeCardPatch, updateCliBridgeLayoutSyncMeta])

  const handleCanvasWorkbenchCommand = useCallback(
    (command: CanvasWorkbenchCommand): CanvasWorkbenchCommandResult => {
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
    const api: CanvasWorkbenchGlobalApi = {
      invoke: async (command) => handleCanvasWorkbenchCommand(command),
      createGrid: async (payload) =>
        handleCanvasWorkbenchCommand({
          type: 'create-grid',
          requestId: payload?.requestId,
          payload: { name: payload?.name, activate: payload?.activate },
        }),
      createCard: async (payload) =>
        handleCanvasWorkbenchCommand({
          type: 'create-card',
          requestId: payload?.requestId,
          payload,
        }),
      updateCard: async (payload) =>
        handleCanvasWorkbenchCommand({
          type: 'update-card',
          requestId: payload?.requestId,
          payload,
        }),
      getState: async (requestId) =>
        handleCanvasWorkbenchCommand({
          type: 'get-state',
          requestId,
        }),
      getConfig: async (requestId) =>
        handleCanvasWorkbenchCommand({
          type: 'get-config',
          requestId,
        }),
      setConfig: async (payload) =>
        handleCanvasWorkbenchCommand({
          type: 'set-config',
          requestId: payload?.requestId,
          payload: payload ? { googleClientId: payload.googleClientId } : undefined,
        }),
    }

    window.canvasWorkbench = api
    return () => {
      if (window.canvasWorkbench === api) {
        delete window.canvasWorkbench
      }
    }
  }, [handleCanvasWorkbenchCommand])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as CanvasWorkbenchPostMessageEnvelope | null
      if (!data || typeof data !== 'object' || data.type !== 'canvas-workbench.command') return

      if (
        data.source &&
        !['cli', 'cli-bridge', 'canvas-workbench-bridge'].includes(String(data.source).toLowerCase())
      ) {
        return
      }

      const result = handleCanvasWorkbenchCommand(data.command)
      const response: CanvasWorkbenchPostMessageResult = {
        source: 'canvas-workbench',
        type: 'canvas-workbench.result',
        result,
      }

      const source = event.source as WindowProxy | null
      if (source?.postMessage) {
        source.postMessage(response, '*')
      }

      window.dispatchEvent(new CustomEvent('canvas-workbench:result', { detail: response }))
    }

    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('message', onMessage)
    }
  }, [handleCanvasWorkbenchCommand])

  const shouldDeleteTrashedAsset = (fileId: string, trashId: string) => {
    const activeUses = gridsRef.current.some((grid) =>
      grid.cards.some((card) => card.fileId === fileId),
    )
    const trashUses = trashCards.some((item) => item.id !== trashId && item.card.fileId === fileId)
    return !activeUses && !trashUses
  }

  const permanentlyDeleteTrashedCard = (trashId: string) => {
    const target = trashCards.find((item) => item.id === trashId)
    if (!target) return

    setTrashCards((current) => current.filter((item) => item.id !== trashId))
    updateCliBridgeLayoutSyncMeta({ lastLayoutMutationAt: Date.now() })
    void persistCliBridgeCardDelete(trashId)

    const fileId = target.card.fileId
    if (!fileId || !shouldDeleteTrashedAsset(fileId, trashId)) return

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

  const requestPermanentlyDeleteTrashedCard = (item: TrashedCard) => {
    const label = getTrashCardLabel(item)
    const confirmed = window.confirm(
      settings.language === 'zh'
        ? `永久删除「${label}」？此操作无法恢复。`
        : `Permanently delete "${label}"? This cannot be undone.`,
    )
    if (!confirmed) return
    permanentlyDeleteTrashedCard(item.id)
  }

  const permanentlyDeleteTrashedTodoItem = (trashId: string) => {
    setTrashTodoItems((current) => current.filter((item) => item.id !== trashId))
  }

  const requestPermanentlyDeleteTrashedTodoItem = (item: TrashedTodoItem) => {
    const confirmed = window.confirm(
      settings.language === 'zh'
        ? `永久删除这条代办「${item.item.text}」？此操作无法恢复。`
        : `Permanently delete this todo item "${item.item.text}"? This cannot be undone.`,
    )
    if (!confirmed) return
    permanentlyDeleteTrashedTodoItem(item.id)
  }

  const resolveTodoRestoreDestination = (target: TrashedTodoItem) => {
    const originalGrid = gridsRef.current.find((grid) =>
      grid.cards.some((card) => card.id === target.cardId && card.kind === 'todo'),
    )
    const originalCard = gridsRef.current
      .find((grid) => grid.id === originalGrid?.id)
      ?.cards.find((card) => card.id === target.cardId && card.kind === 'todo')
    if (originalGrid && originalCard && originalCard.kind === 'todo') {
      return { gridId: originalGrid.id, cardId: originalCard.id, todoItems: originalCard.todoItems ?? [] }
    }

    const fallbackGrid = gridsRef.current.find((grid) => grid.id === target.gridId) ?? activeGrid
    const fallbackTodoCard = fallbackGrid.cards.find((card) => card.kind === 'todo')
    if (fallbackTodoCard && fallbackTodoCard.kind === 'todo') {
      return { gridId: fallbackGrid.id, cardId: fallbackTodoCard.id, todoItems: fallbackTodoCard.todoItems ?? [] }
    }

    const fallbackCard: CardData = {
      id: uid('card'),
      kind: 'todo',
      title: settings.language === 'zh' ? '恢复的代办' : 'Restored Todos',
      content: '',
      x: 120,
      y: 120,
      width: CARD_DEFAULT_SIZES.todo.width,
      height: CARD_DEFAULT_SIZES.todo.height,
      todoItems: [],
    }

    updateCliBridgeLayoutSyncMeta({ lastLayoutMutationAt: Date.now() })
    void persistCliBridgeCardCreate(fallbackGrid.id, fallbackCard, false)

    return { gridId: fallbackGrid.id, cardId: fallbackCard.id, todoItems: [], fallbackCard }
  }

  const restoreTrashedTodoItem = (trashId: string) => {
    const target = trashTodoItems.find((item) => item.id === trashId)
    if (!target) return

    const destination = resolveTodoRestoreDestination(target) as {
      gridId: string
      cardId: string
      todoItems: TodoItem[]
      fallbackCard?: CardData
    }
    const hasItemConflict = destination.todoItems.some((item) => item.id === target.item.id)
    const restoredTodoItem: TodoItem = hasItemConflict ? { ...target.item, id: uid('todo') } : target.item
    const nextTodoItems = [...destination.todoItems, restoredTodoItem]

    updateCliBridgeLayoutSyncMeta({ lastLayoutMutationAt: Date.now() })
    setGrids((current) =>
      current.map((grid) =>
        grid.id !== destination.gridId
          ? grid
          : {
              ...grid,
              cards: grid.cards.some((card) => card.id === destination.cardId)
                ? grid.cards.map((card) =>
                    card.id === destination.cardId ? { ...card, todoItems: nextTodoItems } : card,
                  )
                : destination.fallbackCard
                  ? [...grid.cards, { ...destination.fallbackCard, todoItems: nextTodoItems }]
                  : grid.cards,
            },
      ),
    )
    void persistCliBridgeCardPatch(destination.cardId, { todoItems: nextTodoItems })
    setTrashTodoItems((current) => current.filter((item) => item.id !== trashId))
  }

  const restoreTrashedCard = (trashId: string) => {
    const target = trashCards.find((item) => item.id === trashId)
    if (!target) return

    const restoreGridId = grids.some((grid) => grid.id === target.gridId) ? target.gridId : activeGridId
    const hasIdConflict = grids.some((grid) => grid.cards.some((card) => card.id === target.card.id))
    const restoredCard: CardData = hasIdConflict
      ? { ...target.card, id: uid('card'), x: target.card.x + 24, y: target.card.y + 24 }
      : target.card

    updateCliBridgeLayoutSyncMeta({ lastLayoutMutationAt: Date.now() })
    setGrids((current) =>
      current.map((grid) => {
        if (grid.id !== restoreGridId) return grid
        return { ...grid, cards: [...grid.cards, restoredCard] }
      }),
    )
    setTrashCards((current) => current.filter((item) => item.id !== trashId))
    void persistCliBridgeCardCreate(restoreGridId, restoredCard, false)
  }

  const purgeExpiredTrashCards = () => {
    const now = Date.now()
    trashCards.filter((item) => item.expiresAt <= now).forEach((item) => permanentlyDeleteTrashedCard(item.id))
  }

  const purgeExpiredTrashTodoItems = () => {
    const now = Date.now()
    trashTodoItems.filter((item) => item.expiresAt <= now).forEach((item) => permanentlyDeleteTrashedTodoItem(item.id))
  }

  useEffect(() => {
    if (!trashCards.length) return
    purgeExpiredTrashCards()
  }, [trashCards])

  useEffect(() => {
    if (!trashTodoItems.length) return
    purgeExpiredTrashTodoItems()
  }, [trashTodoItems])

  const moveCardToTrash = (cardId: string) => {
    const sourceGrid = activeGrid
    const targetCard = sourceGrid.cards.find((card) => card.id === cardId)
    if (!targetCard) return

    if (editingCardId === cardId) {
      setEditingCardId(null)
      setCardTitleDraft('')
    }

    const now = Date.now()
    const trashedCard: TrashedCard = {
      id: cardId,
      card: targetCard,
      gridId: sourceGrid.id,
      gridName: sourceGrid.name,
      deletedAt: now,
      expiresAt: now + TRASH_CARD_RETENTION_MS,
    }

    setMinimizedCardIds((current) => current.filter((id) => id !== cardId))
    setPendingDeleteCardId((current) => (current === cardId ? null : current))
    clearCliBridgePatchTimer(cardId)
    updateCliBridgeLayoutSyncMeta({ lastLayoutMutationAt: Date.now() })
    setTrashCards((current) => [trashedCard, ...current.filter((item) => item.id !== cardId)])
    setGrids((current) =>
      current.map((grid) => {
        if (grid.id !== sourceGrid.id) return grid
        return { ...grid, cards: grid.cards.filter((card) => card.id !== cardId) }
      }),
    )
  }

  const requestRemoveCard = (cardId: string) => {
    setPendingDeleteCardId(cardId)
  }

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

  const minimizeCard = (cardId: string) => {
    if (editingCardId === cardId) {
      setEditingCardId(null)
      setCardTitleDraft('')
    }
    setMinimizedCardIds((current) => (current.includes(cardId) ? current : [...current, cardId]))
  }

  const restoreCard = (cardId: string) => {
    setMinimizedCardIds((current) => current.filter((id) => id !== cardId))
  }

  const confirmDeleteCard = () => {
    if (!pendingDeleteCardId) return
    moveCardToTrash(pendingDeleteCardId)
  }

  const cancelDeleteCard = () => {
    setPendingDeleteCardId(null)
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
    if (pointerMode !== 'canvas') return
    if (event.button !== 0) return
    if ((event.target as HTMLElement).closest('.canvas-pointer-mode-switch, .canvas-toolbar')) return

    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setInspectedDashboardCardId(null)

    const currentViewport = viewportRef.current
    panStateRef.current = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: currentViewport.x,
      startY: currentViewport.y,
    }

    setIsPanning(true)
  }

  const onAppShellPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (pointerMode !== 'canvas') return
    if (event.button !== 0) return
    if ((event.target as HTMLElement).closest('.sidebar, .sidebar-toggle, .canvas-pointer-mode-switch, .canvas-toolbar, .image-rename-overlay, .image-rename-dialog, .trash-overlay, .trash-dialog, .confirm-overlay, .confirm-dialog, .todo-draft-overlay, .todo-draft-dialog, .calendar-draft-overlay, .calendar-draft-dialog, .settings-overlay, .settings-dialog')) return

    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setInspectedDashboardCardId(null)

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

  const addTodoItem = (cardId: string, lane: TodoLane = 'todo', explicitText?: string, tag: TodoTag = 'event') => {
    const targetCard = activeGrid.cards.find((card) => card.id === cardId)
    if (!targetCard || targetCard.kind !== 'todo') return

    const textValue = (explicitText ?? targetCard.content).trim()
    if (!textValue) return

    const nextTodoItems = [...(targetCard.todoItems ?? []), createTodoItem(textValue, lane, tag)]
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

  const openTodoDraft = (cardId: string, lane: TodoLane) => {
    const targetCard = activeGrid.cards.find((card) => card.id === cardId)
    setTodoDraftTarget({ cardId, lane })
    setTodoDraftText(targetCard?.content ?? '')
    setTodoDraftTag('event')
  }

  const closeTodoDraft = () => {
    setTodoDraftTarget(null)
    setTodoDraftText('')
    setTodoDraftTag('event')
  }

  const submitTodoDraft = () => {
    if (!todoDraftTarget || !todoDraftText.trim()) return
    addTodoItem(todoDraftTarget.cardId, todoDraftTarget.lane, todoDraftText, todoDraftTag)
    closeTodoDraft()
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

  const moveTodoItemToTrash = (cardId: string, todoId: string) => {
    if (todoDragStateRef.current?.cardId === cardId && todoDragStateRef.current?.itemId === todoId) {
      todoDragStateRef.current = null
    }
    setTodoDropTarget((current) =>
      current && current.cardId === cardId && current.itemId === todoId ? null : current,
    )

    const targetCard = activeGrid.cards.find((card) => card.id === cardId)
    if (!targetCard || targetCard.kind !== 'todo') return

    const targetItem = (targetCard.todoItems ?? []).find((item) => item.id === todoId)
    if (!targetItem) return

    const now = Date.now()
    const trashedTodoItem: TrashedTodoItem = {
      id: todoId,
      item: targetItem,
      cardId: targetCard.id,
      cardTitle: targetCard.title,
      gridId: activeGrid.id,
      gridName: activeGrid.name,
      deletedAt: now,
      expiresAt: now + TRASH_CARD_RETENTION_MS,
    }

    const nextTodoItems = (targetCard.todoItems ?? []).filter((item) => item.id !== todoId)
    updateCliBridgeLayoutSyncMeta({ lastLayoutMutationAt: Date.now() })
    setTrashTodoItems((current) => [trashedTodoItem, ...current.filter((item) => item.id !== todoId)])
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

  const removeTodoItem = (cardId: string, todoId: string) => {
    moveTodoItemToTrash(cardId, todoId)
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

  const updateTodoTag = (cardId: string, todoId: string, tag: TodoTag) => {
    const targetCard = activeGrid.cards.find((card) => card.id === cardId)
    if (!targetCard || targetCard.kind !== 'todo') return

    const nextTodoItems = (targetCard.todoItems ?? []).map((item) =>
      item.id === todoId ? { ...item, tag: normalizeTodoTag(tag) } : item,
    )
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

  const commitCalendarCard = (cardId: string, nextCalendar: CalendarState) => {
    const now = Date.now()
    const patch = { calendar: nextCalendar }
    let changedForPersist = false

    const nextGrids = gridsRef.current.map((grid) => {
      let changed = false
      const cards = grid.cards.map((card) => {
        if (card.id !== cardId || card.kind !== 'calendar') return card
        changed = true
        changedForPersist = true
        return { ...card, calendar: nextCalendar }
      })
      return changed ? { ...grid, cards } : grid
    })

    if (!changedForPersist) return

    gridsRef.current = nextGrids
    cliBridgePendingPatchRef.current[cardId] = { ...(cliBridgePendingPatchRef.current[cardId] ?? {}), ...patch }
    updateCliBridgeLayoutSyncMeta({ lastLayoutMutationAt: now })
    setCalendarNavigationLocks((currentLocks) => ({ ...currentLocks, [cardId]: now }))
    setGrids(nextGrids)

    void persistCliBridgeCardPatch(cardId, patch).finally(() => {
      const pendingPatch = cliBridgePendingPatchRef.current[cardId]
      if (pendingPatch?.calendar === nextCalendar) {
        delete cliBridgePendingPatchRef.current[cardId]
      }
      window.setTimeout(() => {
        setCalendarNavigationLocks((currentLocks) => {
          if (currentLocks[cardId] !== now) return currentLocks
          const nextLocks = { ...currentLocks }
          delete nextLocks[cardId]
          return nextLocks
        })
      }, 1200)
    })
  }

  const updateCalendarCard = (cardId: string, updater: (state: CalendarState) => CalendarState) => {
    const targetCard = gridsRef.current.flatMap((grid) => grid.cards).find((card) => card.id === cardId && card.kind === 'calendar')
    if (!targetCard || targetCard.kind !== 'calendar') return
    commitCalendarCard(cardId, withCalendarDefaults(updater(withCalendarDefaults(targetCard.calendar))))
  }

  const updateEventFlowCard = (cardId: string, updater: (state: EventFlowState) => EventFlowState) => {
    const targetCard = activeGrid.cards.find((card) => card.id === cardId)
    if (!targetCard || targetCard.kind !== 'eventFlow') return

    const nextEventFlow = normalizeEventFlowState(updater(normalizeEventFlowState(targetCard.eventFlow)))
    updateCliBridgeLayoutSyncMeta({ lastLayoutMutationAt: Date.now() })
    setGrids((current) =>
      current.map((grid) =>
        grid.id !== activeGridId
          ? grid
          : {
              ...grid,
              cards: grid.cards.map((card) => (card.id === cardId ? { ...card, eventFlow: nextEventFlow } : card)),
            },
      ),
    )
    void persistCliBridgeCardPatch(cardId, { eventFlow: nextEventFlow })
  }

  const addEventFlowNode = (cardId: string) => {
    updateEventFlowCard(cardId, (state) => ({
      ...state,
      nodes: [
        ...state.nodes,
        {
          id: uid('flow-node'),
          title: '',
          kind: 'step',
          x: 120 + state.nodes.length * 42,
          y: 120 + state.nodes.length * 34,
        },
      ],
    }))
  }

  const addEventFlowNextNode = (cardId: string, sourceNode: EventFlowNode) => {
    const nextNode: EventFlowNode = {
      id: uid('flow-node'),
      title: '',
      kind: 'step',
      x: sourceNode.x + 285,
      y: sourceNode.y,
    }
    updateEventFlowCard(cardId, (state) => ({
      ...state,
      nodes: [...state.nodes, nextNode],
      edges: [
        ...state.edges,
        {
          id: uid('flow-edge'),
          sourceNodeId: sourceNode.id,
          targetNodeId: nextNode.id,
          label: text.eventFlowNext.replace(/^\+\s*/, ''),
        },
      ],
    }))
  }

  const updateEventFlowNodeTitle = (cardId: string, nodeId: string, title: string) => {
    updateEventFlowCard(cardId, (state) => ({
      ...state,
      nodes: state.nodes.map((node) => (node.id === nodeId ? { ...node, title } : node)),
    }))
  }

  const startEventFlowNodeDrag = (event: React.PointerEvent<HTMLElement>, cardId: string, node: EventFlowNode) => {
    if (eventFlowEdgeDragRef.current) return
    const target = event.target as HTMLElement
    if (target.closest('.event-flow-node-title') || target.closest('.event-flow-next-btn') || target.closest('.event-flow-node-handle')) return
    const canvasElement = event.currentTarget.closest('.event-flow-canvas') as HTMLElement | null
    if (!canvasElement) return
    const canvasBounds = canvasElement.getBoundingClientRect()
    const zoom = viewportRef.current.zoom || 1
    event.stopPropagation()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    eventFlowNodeDragRef.current = {
      cardId,
      nodeId: node.id,
      pointerOffsetX: (event.clientX - canvasBounds.left) / zoom - node.x,
      pointerOffsetY: (event.clientY - canvasBounds.top) / zoom - node.y,
      boundsWidth: canvasBounds.width / zoom,
      boundsHeight: canvasBounds.height / zoom,
      canvasLeft: canvasBounds.left,
      canvasTop: canvasBounds.top,
      zoom,
    }
  }

  const startEventFlowEdgeDrag = (event: React.PointerEvent<HTMLElement>, cardId: string, sourceNode: EventFlowNode) => {
    const canvasElement = event.currentTarget.closest('.event-flow-canvas') as HTMLElement | null
    if (!canvasElement) return
    const canvasBounds = canvasElement.getBoundingClientRect()
    const zoom = viewportRef.current.zoom || 1
    event.stopPropagation()
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId)
    } catch {
      // Some synthetic/browser edge cases do not have an active pointer yet.
    }
    const dragState: EventFlowEdgeDragState = {
      cardId,
      sourceNodeId: sourceNode.id,
      sourceNodeTitle: sourceNode.title,
      pointerX: (event.clientX - canvasBounds.left) / zoom,
      pointerY: (event.clientY - canvasBounds.top) / zoom,
      canvasLeft: canvasBounds.left,
      canvasTop: canvasBounds.top,
      zoom,
    }
    eventFlowEdgeDragRef.current = dragState
    setEventFlowEdgeDrag(dragState)
  }

  const finishEventFlowEdgeDrag = (event: React.PointerEvent<HTMLElement>, cardId: string, targetNode: EventFlowNode) => {
    const dragState = eventFlowEdgeDragRef.current
    if (!dragState || dragState.cardId !== cardId) return
    if (dragState.sourceNodeId === targetNode.id) return
    event.stopPropagation()
    connectEventFlowNodesDirect({
      cardId,
      sourceNodeId: dragState.sourceNodeId,
      sourceNodeTitle: dragState.sourceNodeTitle,
      targetNodeId: targetNode.id,
      targetNodeTitle: targetNode.title,
    })
    eventFlowEdgeDragRef.current = null
    setEventFlowEdgeDrag(null)
  }

  const finishEventFlowEdgeDragByPointer = (event: PointerEvent) => {
    const dragState = eventFlowEdgeDragRef.current
    if (!dragState) return

    const elements = document.elementsFromPoint(event.clientX, event.clientY)
    const targetNodeElement = elements.find((element) => element instanceof HTMLElement && element.dataset.eventFlowNodeId) as HTMLElement | undefined
    const targetCardId = targetNodeElement?.dataset.eventFlowCardId
    const targetNodeId = targetNodeElement?.dataset.eventFlowNodeId
    const targetTitle = targetNodeElement?.dataset.eventFlowNodeTitle
    if (targetCardId && targetNodeId && targetCardId === dragState.cardId) {
      connectEventFlowNodesDirect({
        cardId: dragState.cardId,
        sourceNodeId: dragState.sourceNodeId,
        sourceNodeTitle: dragState.sourceNodeTitle,
        targetNodeId,
        targetNodeTitle: targetTitle,
      })
    }
  }

  const connectEventFlowNodesDirect = ({
    cardId,
    sourceNodeId,
    sourceNodeTitle,
    targetNodeId,
    targetNodeTitle,
  }: {
    cardId: string
    sourceNodeId: string
    sourceNodeTitle?: string
    targetNodeId: string
    targetNodeTitle?: string
  }) => {
    if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId) return
    const label = text.eventFlowNext.replace(/^\+\s*/, '')
    const edgeId = uid('flow-edge')
    const sourceTitle = sourceNodeTitle ?? text.eventFlowStart
    const targetTitle = targetNodeTitle ?? text.eventFlowNewNode

    updateCliBridgeLayoutSyncMeta({ lastLayoutMutationAt: Date.now() })
    commitGrids((current) =>
      current.map((grid) => ({
        ...grid,
        cards: grid.cards.map((card) => {
          if (card.id !== cardId || card.kind !== 'eventFlow') return card
          const existingFlow = normalizeEventFlowState(card.eventFlow)
          const hasSourceNode = existingFlow.nodes.some((node) => node.id === sourceNodeId)
          const hasTargetNode = existingFlow.nodes.some((node) => node.id === targetNodeId)
          const nodes = [
            ...existingFlow.nodes,
            ...(hasSourceNode
              ? []
              : [{ id: sourceNodeId, title: sourceTitle, kind: 'step' as const, x: 72, y: 150 }]),
            ...(hasTargetNode
              ? []
              : [{ id: targetNodeId, title: targetTitle, kind: 'step' as const, x: 320, y: 150 }]),
          ]
          const edges = existingFlow.edges.some((edge) => edge.sourceNodeId === sourceNodeId && edge.targetNodeId === targetNodeId)
            ? existingFlow.edges
            : [
                ...existingFlow.edges,
                {
                  id: edgeId,
                  sourceNodeId,
                  targetNodeId,
                  label,
                },
              ]
          const nextEventFlow = normalizeEventFlowState({ ...existingFlow, nodes, edges })
          void persistCliBridgeCardPatch(cardId, { eventFlow: nextEventFlow })
          return { ...card, eventFlow: nextEventFlow }
        }),
      })),
    )
  }

  const connectEventFlowNodes = (cardId: string, sourceNodeId: string, targetNodeId: string) => {
    if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId) return
    const applyEdge = (state: EventFlowState) => ({
      ...state,
      edges: state.edges.some((edge) => edge.sourceNodeId === sourceNodeId && edge.targetNodeId === targetNodeId)
        ? state.edges
        : [
            ...state.edges,
            {
              id: uid('flow-edge'),
              sourceNodeId,
              targetNodeId,
              label: text.eventFlowNext.replace(/^\+\s*/, ''),
            },
          ],
    })

    const canUseActiveGrid = activeGrid.cards.some((card) => card.id === cardId && card.kind === 'eventFlow')
    if (canUseActiveGrid) {
      updateEventFlowCard(cardId, applyEdge)
      return
    }

    let nextEventFlow: EventFlowState | null = null
    let didUpdate = false
    updateCliBridgeLayoutSyncMeta({ lastLayoutMutationAt: Date.now() })
    commitGrids((current) =>
      current.map((grid) => {
        let gridChanged = false
        const nextCards = grid.cards.map((card) => {
          if (card.id !== cardId || card.kind !== 'eventFlow') return card
          nextEventFlow = normalizeEventFlowState(applyEdge(normalizeEventFlowState(card.eventFlow)))
          didUpdate = true
          gridChanged = true
          return { ...card, eventFlow: nextEventFlow }
        })
        return gridChanged ? { ...grid, cards: nextCards } : grid
      }),
    )
    if (!didUpdate) return
    window.setTimeout(() => {
      if (nextEventFlow) {
        void persistCliBridgeCardPatch(cardId, { eventFlow: nextEventFlow })
      }
    }, 0)
  }

  const deleteEventFlowNode = (cardId: string, nodeId: string) => {
    updateEventFlowCard(cardId, (state) => ({
      ...state,
      nodes: state.nodes.filter((node) => node.id !== nodeId),
      edges: state.edges.filter((edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId),
    }))
  }

  const deleteEventFlowEdge = (cardId: string, edgeId: string) => {
    updateEventFlowCard(cardId, (state) => ({
      ...state,
      edges: state.edges.filter((edge) => edge.id !== edgeId),
    }))
  }

  eventFlowConnectHandlerRef.current = (sourceNodeId: string, targetNodeId: string) => {
    const cardId = eventFlowEdgeDragRef.current?.cardId
    if (cardId) connectEventFlowNodes(cardId, sourceNodeId, targetNodeId)
  }

  const setCalendarViewMode = (cardId: string, mode: CalendarViewMode) => {
    updateCalendarCard(cardId, (calendarState) => ({
      ...calendarState,
      viewMode: mode,
      monthCursor: toMonthKey(parseDateKey(calendarState.selectedDate)),
    }))
  }

  const navigateCalendarFromCard = (card: CardData, delta: number) => {
    if (card.kind !== 'calendar') return
    const currentCard = gridsRef.current.flatMap((grid) => grid.cards).find((item) => item.id === card.id && item.kind === 'calendar')
    const calendarState = withCalendarDefaults(currentCard?.kind === 'calendar' ? currentCard.calendar : card.calendar)
    const nextCalendar = withCalendarDefaults(
      calendarState.viewMode === 'week'
        ? (() => {
            const nextSelected = shiftDateKey(calendarState.selectedDate, delta * 7)
            return {
              ...calendarState,
              selectedDate: nextSelected,
              monthCursor: toMonthKey(parseDateKey(nextSelected)),
            }
          })()
        : {
            ...calendarState,
            monthCursor: shiftMonthKey(calendarState.monthCursor, delta),
          },
    )
    commitCalendarCard(card.id, nextCalendar)
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

  const openCalendarDraft = (cardId: string, dateKey: string) => {
    selectCalendarDate(cardId, dateKey)
    setCalendarDraftCardId(cardId)
    setCalendarDraftOpen(true)
  }

  const closeCalendarDraft = () => {
    setCalendarDraftOpen(false)
    setCalendarDraftCardId(null)
  }

  const submitCalendarDraft = () => {
    if (!calendarDraftCardId) return
    addCalendarEvent(calendarDraftCardId)
    closeCalendarDraft()
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

  const setCenteredZoom = (nextZoomValue: number, clientX?: number, clientY?: number) => {
    const bounds = canvasRef.current?.getBoundingClientRect()
    if (!bounds) return

    const centerX = typeof clientX === 'number' ? clientX - bounds.left : bounds.width / 2
    const centerY = typeof clientY === 'number' ? clientY - bounds.top : bounds.height / 2
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

  const onCanvasWheel = (event: ReactWheelEvent<HTMLElement>) => {
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

  const onAppShellWheel = (event: ReactWheelEvent<HTMLElement>) => {
    if (pointerMode !== 'canvas') return
    if ((event.target as HTMLElement).closest('.sidebar, .sidebar-toggle, .canvas-pointer-mode-switch, .canvas-toolbar, .image-rename-overlay, .image-rename-dialog, .trash-overlay, .trash-dialog, .confirm-overlay, .confirm-dialog, .todo-draft-overlay, .todo-draft-dialog, .calendar-draft-overlay, .calendar-draft-dialog, .settings-overlay, .settings-dialog')) return

    event.preventDefault()
    event.stopPropagation()

    const currentViewport = viewportRef.current
    const scale = Math.exp(-event.deltaY * 0.0015)
    const nextZoom = clamp(currentViewport.zoom * scale, ZOOM_MIN, ZOOM_MAX)
    setCenteredZoom(nextZoom, event.clientX, event.clientY)
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

      const uploadedAssetUrl = account
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

  const handleDownloadFromLocalApi = async () => {
    const pulled = await pullCliBridgeWorkspace(true)
    setSyncStatus(pulled ? 'ok' : 'idle')
    setSyncMessage(
      pulled
        ? settings.language === 'zh'
          ? '已从本地数据库重新加载工作区。'
          : 'Reloaded workspace from local database.'
        : settings.language === 'zh'
          ? '本地数据库暂无更新。'
          : 'No newer local database workspace to reload.',
    )
  }

  const handleUploadToLocalApi = async () => {
    await uploadWorkspaceToLocalApi({ silent: false })
  }

  const zoomPercent = `${Math.round(viewport.zoom * 100)}%`
  const localApiToolbarLabel =
    localApiStarting || localApiStatus === 'checking'
      ? text.localApiToolbarChecking
      : localApiStatus === 'online'
        ? text.localApiToolbarOnline
        : localApiStatus === 'offline'
          ? text.localApiToolbarOffline
          : text.localApiToolbarIdle
  const accountProviderLabel = account?.provider === 'google' ? text.providerGoogle : text.providerDemo
  const activeCardCount = activeGrid.cards.length
  const trashCardCount = trashCards.length
  const trashTodoItemCount = trashTodoItems.length
  const trashTotalCount = trashCardCount + trashTodoItemCount
  const navigatorCards = useMemo(
    () => filterNavigatorCards(activeGrid.cards, cardNavigatorQuery),
    [activeGrid.cards, cardNavigatorQuery],
  )

  const closeCardNavigator = useCallback(() => {
    setCardNavigatorOpen(false)
    setCardNavigatorQuery('')
  }, [])

  const jumpToNavigatorCard = useCallback((card: CardData) => {
    setViewport(centerViewportOnCard(canvasRef.current?.getBoundingClientRect(), card, viewportRef.current.zoom))
    setHighlightedNavigatorCardId(card.id)
    closeCardNavigator()
    window.setTimeout(() => {
      setHighlightedNavigatorCardId((current) => (current === card.id ? null : current))
    }, 1400)
  }, [closeCardNavigator])

  const viewAllNavigatorCards = useCallback(() => {
    setViewport(createCenteredViewport(canvasRef.current?.getBoundingClientRect(), getCardsCenter(activeGrid)))
    closeCardNavigator()
  }, [activeGrid, closeCardNavigator])

  const getTrashCardLabel = (item: TrashedCard) =>
    item.card.title || item.card.fileName || getNavigatorCardTypeLabel(item.card.kind)

  const getTrashRemainingLabel = (item: TrashedCard) => {
    const remainingMs = Math.max(0, item.expiresAt - Date.now())
    const remainingDays = Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)))
    return settings.language === 'zh' ? `剩余 ${remainingDays} 天` : `${remainingDays} day${remainingDays === 1 ? '' : 's'} left`
  }

  const getTrashTodoRemainingLabel = (item: TrashedTodoItem) => {
    const remainingMs = Math.max(0, item.expiresAt - Date.now())
    const remainingDays = Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)))
    return settings.language === 'zh' ? `剩余 ${remainingDays} 天` : `${remainingDays} day${remainingDays === 1 ? '' : 's'} left`
  }

  const formatTrashTodoDeletedAt = (item: TrashedTodoItem) =>
    new Date(item.deletedAt).toLocaleString(settings.language === 'zh' ? 'zh-CN' : 'en-US')

  const formatTrashDeletedAt = (item: TrashedCard) =>
    new Date(item.deletedAt).toLocaleString(settings.language === 'zh' ? 'zh-CN' : 'en-US')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableKeyboardTarget(event.target)) return
      if (event.key.toLowerCase() === 'h') setPointerMode('canvas')
      if (event.key.toLowerCase() === 'v') setPointerMode('card')
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!cardNavigatorOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeCardNavigator()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [cardNavigatorOpen, closeCardNavigator])

  const canvasStatusLabel =
    settings.language === 'zh'
      ? `卡片导航 · ${activeGrid.name}（${activeCardCount} 张）`
      : `Card Navigator · ${activeGrid.name} (${activeCardCount} ${activeCardCount === 1 ? 'card' : 'cards'})`
  const canvasStatusMeta =
    settings.language === 'zh'
      ? `${activeGrid.name}（${activeCardCount} 张）`
      : `${activeGrid.name} (${activeCardCount} ${activeCardCount === 1 ? 'card' : 'cards'})`
  const productSubtitle = settings.language === 'zh' ? '本地优先画布工作区' : 'Local-first canvas workspace'
  const noteActionLabel = text.newNoteCard.replace(/^\+\s*/, '')
  const todoActionLabel = todoText.newCardButton.replace(/^\+\s*/, '')
  const calendarActionLabel = calendarText.newCardButton.replace(/^\+\s*/, '')
  const eventFlowActionLabel = text.newEventFlowCard.replace(/^\+\s*/, '')
  const dashboardActionLabel = text.newDashboardCard.replace(/^\+\s*/, '')
  const canvasModeTip = settings.language === 'zh'
    ? '画布模式：拖动画布、缩放画布，避免卡片内容接管鼠标。'
    : 'Canvas mode: drag and zoom the canvas without card content taking the pointer.'
  const cardModeTip = settings.language === 'zh'
    ? '卡片模式：操作卡片内部内容、按钮、编辑和查看。'
    : 'Card mode: edit card content, buttons, details, and viewers.'

  return (
    <main
      className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${isPanning ? 'is-panning' : ''}`}
      data-pointer-mode={pointerMode}
      onPointerDownCapture={onAppShellPointerDown}
      onWheel={onAppShellWheel}
    >
      <aside className="sidebar" aria-hidden={sidebarCollapsed}>
        <button
          type="button"
          className="sidebar-toggle sidebar-toggle-inside"
          onClick={() => setSidebarCollapsed(true)}
          aria-label={settings.language === 'zh' ? '隐藏侧边栏' : 'Hide sidebar'}
          title={settings.language === 'zh' ? '隐藏侧边栏' : 'Hide sidebar'}
        >
          ‹
        </button>
        <div className="brand-block">
          <div className="brand-meta">
            <div className="brand-logo" aria-hidden>
              <img className="brand-logo-image" src={BRAND_LOGO_DATA_URL} alt="" />
            </div>
            <div className="brand-copy">
              <span className="brand-name">Canvas Workbench</span>
              <span className="brand-subtitle">{productSubtitle}</span>
            </div>
          </div>
        </div>

        <div className="create-actions" aria-label={settings.language === 'zh' ? '创建卡片' : 'Create cards'}>
          <button className="action-btn" onClick={addNoteCard}>
            <span className="action-icon">＋</span>
            <span>{noteActionLabel}</span>
          </button>
          <button className="action-btn" onClick={addTodoCard}>
            <span className="action-icon">✓</span>
            <span>{todoActionLabel}</span>
          </button>
          <button className="action-btn" onClick={addCalendarCard}>
            <span className="action-icon">◷</span>
            <span>{calendarActionLabel}</span>
          </button>
          <button className="action-btn" onClick={addEventFlowCard}>
            <span className="action-icon">↬</span>
            <span>{eventFlowActionLabel}</span>
          </button>
          <button className="action-btn" onClick={addDashboardCard}>
            <span className="action-icon">▣</span>
            <span>{dashboardActionLabel}</span>
          </button>
        </div>

        <button type="button" className="trash-entry-btn" onClick={() => setTrashOpen(true)}>
          <span className="trash-entry-icon">♻</span>
          <span>{settings.language === 'zh' ? '回收站' : 'Recycle Bin'}</span>
          {trashTotalCount ? <span className="trash-count-badge">{trashTotalCount}</span> : null}
        </button>

        <section className="grid-panel">
          <header className="grid-panel-header">
            <span>{text.grids}</span>
            <button className="icon-btn" aria-label={text.newGridAria} onClick={addGrid}>
              ＋
            </button>
          </header>

          <div className="grid-list">
            {grids.map((grid, index) => (
              <div
                key={grid.id}
                role="button"
                tabIndex={0}
                className={`grid-item ${grid.id === activeGridId ? 'active' : ''}`}
                onClick={() => {
                  activateGrid(grid.id)
                  if (editingGridId && editingGridId !== grid.id) cancelGridName()
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    activateGrid(grid.id)
                    if (editingGridId && editingGridId !== grid.id) cancelGridName()
                  }
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
                      ×
                    </button>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </section>
      </aside>

      {sidebarCollapsed ? (
        <button
          type="button"
          className="sidebar-toggle sidebar-toggle-floating"
          onClick={() => setSidebarCollapsed(false)}
          aria-label={settings.language === 'zh' ? '显示侧边栏' : 'Show sidebar'}
          title={settings.language === 'zh' ? '显示侧边栏' : 'Show sidebar'}
        >
          ›
        </button>
      ) : null}

      <section
        ref={canvasRef}
        className={`canvas canvas-workbench-stage ${isPanning ? 'is-panning' : ''} ${isFileOver ? 'is-file-over' : ''}`}
        data-pointer-mode={pointerMode}
        data-drop-label={text.dropFilesLabel}
        onPointerDownCapture={onCanvasPointerDown}
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
          <div className="canvas-status-wrap">
            <button
              type="button"
              className={`canvas-status ${cardNavigatorOpen ? 'open' : ''}`}
              title={canvasStatusLabel}
              aria-expanded={cardNavigatorOpen}
              aria-controls="canvas-card-navigator"
              onClick={(event) => {
                event.stopPropagation()
                setCardNavigatorOpen((open) => !open)
              }}
            >
              <strong>{settings.language === 'zh' ? '卡片导航' : 'Card Navigator'}</strong>
              <span>{canvasStatusMeta}</span>
            </button>

            {cardNavigatorOpen ? (
              <div
                id="canvas-card-navigator"
                className="card-navigator-popover"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="card-navigator-head">
                  <div>
                    <strong>{activeGrid.name}</strong>
                    <span>{settings.language === 'zh' ? `${activeCardCount} 张卡片` : `${activeCardCount} ${activeCardCount === 1 ? 'card' : 'cards'}`}</span>
                  </div>
                </div>

                {activeCardCount > 1 ? (
                  <input
                    className="card-navigator-search"
                    value={cardNavigatorQuery}
                    onChange={(event) => setCardNavigatorQuery(event.target.value)}
                    placeholder={settings.language === 'zh' ? '搜索卡片...' : 'Search cards...'}
                    autoFocus
                  />
                ) : null}

                <div className="card-navigator-list">
                  {activeCardCount === 0 ? (
                    <p className="card-navigator-empty">{settings.language === 'zh' ? '当前画布暂无卡片' : 'No cards in this grid yet'}</p>
                  ) : navigatorCards.length === 0 ? (
                    <p className="card-navigator-empty">{settings.language === 'zh' ? '没有匹配的卡片' : 'No matching cards'}</p>
                  ) : (
                    navigatorCards.map((card) => {
                      const meta = getNavigatorCardMeta(card)
                      return (
                        <button
                          key={card.id}
                          type="button"
                          className="card-navigator-row"
                          onClick={() => jumpToNavigatorCard(card)}
                        >
                          <span className={`card-navigator-kind ${card.kind}`}>{getNavigatorCardTypeLabel(card.kind).slice(0, 1)}</span>
                          <span className="card-navigator-copy">
                            <strong>{getNavigatorCardLabel(card)}</strong>
                            {meta ? <small>{meta}</small> : null}
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>

                <button type="button" className="card-navigator-footer" onClick={viewAllNavigatorCards}>
                  {settings.language === 'zh' ? '⌖ 查看全部卡片' : '⌖ View all cards'}
                </button>
              </div>
            ) : null}
          </div>
          <div className="canvas-command-group" aria-label={settings.language === 'zh' ? '缩放控制' : 'Zoom controls'}>
            <button className="zoom-btn" onClick={() => setCenteredZoom(viewport.zoom - 0.1)} aria-label="Zoom out">
              −
            </button>
            <span className="zoom-label">{zoomPercent}</span>
            <button className="zoom-btn" onClick={() => setCenteredZoom(viewport.zoom + 0.1)} aria-label="Zoom in">
              ＋
            </button>
          </div>
          <button
            type="button"
            className={`zoom-btn reset local-api-trigger local-api-status-trigger ${localApiStatus}`}
            onClick={() => void handleLocalApiToolbarAction()}
            disabled={localApiStarting || localApiStatus === 'checking'}
            title={localApiStatusMessage || localApiBaseUrl}
          >
            <span className="local-api-status-dot" aria-hidden="true" />
            {localApiToolbarLabel}
          </button>
          <button className="zoom-btn reset" onClick={() => setViewport(createCenteredViewport(canvasRef.current?.getBoundingClientRect(), getCardsCenter(activeGrid)))}>
            {text.reset}
          </button>
          <button className={`zoom-btn reset settings-trigger ${settingsOpen ? 'open' : ''}`} onClick={() => setSettingsOpen(true)}>
            {text.settings}
          </button>
        </div>

        <div className="canvas-pointer-mode-switch" aria-label={settings.language === 'zh' ? '鼠标模式' : 'Pointer mode'}>
          <button
            type="button"
            className={`pointer-mode-btn ${pointerMode === 'canvas' ? 'active' : ''}`}
            onClick={() => setPointerMode('canvas')}
            aria-pressed={pointerMode === 'canvas'}
          >
            <span>H</span>
            <small>{settings.language === 'zh' ? '画布' : 'Canvas'}</small>
            <span className="pointer-mode-tip">{canvasModeTip}</span>
          </button>
          <button
            type="button"
            className={`pointer-mode-btn ${pointerMode === 'card' ? 'active' : ''}`}
            onClick={() => setPointerMode('card')}
            aria-pressed={pointerMode === 'card'}
          >
            <span>V</span>
            <small>{settings.language === 'zh' ? '卡片' : 'Card'}</small>
            <span className="pointer-mode-tip">{cardModeTip}</span>
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
            const fileUrl = card.fileId ? assetUrls[card.fileId] || card.externalUrl : card.externalUrl
            const isMinimizableCard = card.kind === 'todo' || card.kind === 'calendar' || card.kind === 'eventFlow'
            const isMinimizedCard = isMinimizableCard && minimizedCardIds.includes(card.id)
            const cardTypeLabel =
              card.kind === 'todo'
                ? todoText.title
                : card.kind === 'calendar'
                  ? calendarText.title
                  : card.kind === 'eventFlow'
                    ? text.eventFlowTitle
                    : card.kind === 'dashboard'
                      ? getNavigatorCardTypeLabel(card.kind)
                      : card.kind

            const cardChrome = getCardChrome(card.kind)

            return (
              <article
                key={card.id}
                className={`card ${draggingCardId === card.id ? 'dragging' : ''} ${resizingCardId === card.id ? 'resizing' : ''} ${isMinimizedCard ? 'minimized' : ''} ${cardChrome.frameless ? 'frameless' : ''} ${highlightedNavigatorCardId === card.id ? 'navigator-highlight' : ''} card-${card.kind}`}
                onDoubleClick={() => {
                  if (isMinimizedCard) restoreCard(card.id)
                }}
                style={{
                  transform: `translate(${card.x}px, ${card.y}px)`,
                  width: isMinimizedCard ? '220px' : `${card.width}px`,
                  height: isMinimizedCard ? '54px' : `${card.height}px`,
                  zIndex: draggingCardId === card.id || resizingCardId === card.id ? 20 : 1 + activeGrid.cards.length - activeGrid.cards.findIndex((item) => item.id === card.id),
                }}
              >
                {cardChrome.showHeader ? (
                  <header
                    className="card-header"
                  onPointerDown={(event) => {
                    const target = event.target as HTMLElement
                    if (
                      target.closest('.card-title-input') ||
                      target.closest('.card-title-text') ||
                      target.closest('.card-action')
                    ) {
                      return
                    }
                    onCardDragStart(event, card)
                  }}
                >
                  <div className={`card-title-wrap ${isMinimizedCard ? 'only-kind' : ''}`}>
                    <span className="card-kind-pill">{cardTypeLabel}</span>
                    {!isMinimizedCard ? (
                      editingCardId === card.id ? (
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
                      )
                    ) : null}
                  </div>

                  {isMinimizableCard ? (
                    <button
                      className="card-action card-minimize"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation()
                        minimizeCard(card.id)
                      }}
                      aria-label={settings.language === 'zh' ? '最小化卡片' : 'Minimize card'}
                      title={settings.language === 'zh' ? '最小化卡片' : 'Minimize card'}
                    >
                      −
                    </button>
                  ) : null}

                  <button
                    className="card-action card-close"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation()
                      requestRemoveCard(card.id)
                    }}
                    aria-label={text.removeCardAria}
                  >
                    ×
                  </button>
                  </header>
                ) : (
                  <>
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
                    {card.kind === 'image' ? (
                      <button
                        className="card-action image-card-rename"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation()
                          openImageCardRenameDialog(card)
                        }}
                        aria-label={settings.language === 'zh' ? '重命名图片卡片' : 'Rename image card'}
                        title={settings.language === 'zh' ? '重命名图片卡片' : 'Rename image card'}
                      >
                        ✎
                      </button>
                    ) : null}
                    <button
                      className="card-action card-close image-card-close"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation()
                        requestRemoveCard(card.id)
                      }}
                      aria-label={text.removeCardAria}
                    >
                      ×
                    </button>
                  </>
                )}

                {!isMinimizedCard && card.kind === 'note' ? (
                  <textarea
                    className="note-editor"
                    value={card.content}
                    onChange={(event) => updateCardContent(card.id, event.target.value)}
                    placeholder={text.notePlaceholder}
                  />
                ) : null}

                {!isMinimizedCard && card.kind === 'todo' ? (
                  <div className="todo-card-body">
                    <div className="todo-board-topbar">
                      <div>
                        <span className="todo-board-eyebrow">{settings.language === 'zh' ? '看板' : 'Board'}</span>
                        <strong>{card.title || todoText.title}</strong>
                      </div>
                      <span className="todo-board-total">
                        {(card.todoItems ?? []).length} {settings.language === 'zh' ? '项任务' : 'cards'}
                      </span>
                    </div>

                    <div className="todo-filter-bar" aria-label={todoText.filterLabel}>
                      <span>{todoText.filterLabel}</span>
                      {TODO_FILTERS.map((filter) => {
                        const activeFilter = todoFilters[card.id] ?? 'all'
                        const isFilterActive = activeFilter === filter
                        return (
                          <button
                            key={filter}
                            type="button"
                            className={`todo-filter-chip ${isFilterActive ? 'active' : ''} ${filter !== 'all' ? `todo-tag-${filter}` : ''}`}
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={() => setTodoFilters((current) => ({ ...current, [card.id]: filter }))}
                          >
                            {filter !== 'all' ? <span aria-hidden="true" /> : null}
                            {todoFilterLabels[filter]}
                          </button>
                        )
                      })}
                    </div>

                    <div className="todo-board">
                      {TODO_LANES.map((lane) => {
                        const activeFilter = todoFilters[card.id] ?? 'all'
                        const laneItems = (card.todoItems ?? []).filter((item) => {
                          const itemTag = normalizeTodoTag(item.tag)
                          return normalizeTodoLane(item.status) === lane && (activeFilter === 'all' || itemTag === activeFilter)
                        })
                        const isLaneDropTarget =
                          todoDropTarget?.cardId === card.id && todoDropTarget.lane === lane && todoDropTarget.itemId === null

                        return (
                          <section
                            key={lane}
                            className={`todo-lane todo-lane-${lane} ${isLaneDropTarget ? 'drop-target' : ''}`}
                            onDragOver={(event) => onTodoLaneDragOver(event, card.id, lane)}
                            onDrop={(event) => onTodoDrop(event, card.id, lane)}
                          >
                            <header className="todo-lane-header">
                              <div className="todo-lane-title-wrap">
                                <span>{todoLaneLabels[lane]}</span>
                                <span className="todo-lane-count">{laneItems.length}</span>
                              </div>
                              <button
                                type="button"
                                className="todo-lane-icon-btn"
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={() => openTodoDraft(card.id, lane)}
                                aria-label={todoText.laneAddCard}
                                title={todoText.laneAddCard}
                              >
                                +
                              </button>
                            </header>

                            <div className="todo-lane-list">
                              {laneItems.length ? (
                                laneItems.map((item) => {
                                  const itemTag = normalizeTodoTag(item.tag)
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
                                      <div className="todo-item-main">
                                        <textarea
                                          className="todo-item-input"
                                          value={item.text}
                                          onPointerDown={(event) => event.stopPropagation()}
                                          onChange={(event) => updateTodoText(card.id, item.id, event.target.value)}
                                          placeholder={todoText.placeholder}
                                          rows={2}
                                        />
                                        <div className="todo-item-meta">
                                          <label className="todo-item-tag-select-wrap">
                                            <span className={`todo-item-tag todo-tag-${itemTag}`} aria-hidden="true">
                                              <span />
                                              {todoTagLabels[itemTag]}
                                            </span>
                                            <select
                                              className="todo-item-tag-select"
                                              value={itemTag}
                                              onPointerDown={(event) => event.stopPropagation()}
                                              onClick={(event) => event.stopPropagation()}
                                              onChange={(event) => updateTodoTag(card.id, item.id, normalizeTodoTag(event.target.value))}
                                              aria-label={settings.language === 'zh' ? '修改任务标签' : 'Change todo tag'}
                                            >
                                              {TODO_TAGS.map((tag) => (
                                                <option key={tag} value={tag}>
                                                  {todoTagLabels[tag]}
                                                </option>
                                              ))}
                                            </select>
                                          </label>
                                          <span className="todo-board-grip" title={settings.language === 'zh' ? '拖拽排序' : 'Drag to reorder'}>
                                            ≡
                                          </span>
                                        </div>
                                      </div>
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
                                        ×
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
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={() => openTodoDraft(card.id, lane)}
                            >
                              + {todoText.laneAddCard}
                            </button>
                          </section>
                        )
                      })}
                    </div>
                  </div>
                ) : null}

                {!isMinimizedCard && card.kind === 'calendar'
                  ? (() => {
                      const calendar = withCalendarDefaults(card.calendar)
                      const displayedCalendar =
                        calendarNavigationLocks[card.id] && card.kind === 'calendar'
                          ? withCalendarDefaults(
                              gridsRef.current
                                .flatMap((grid) => grid.cards)
                                .find((item) => item.id === card.id && item.kind === 'calendar')?.calendar,
                            )
                          : calendar
                      const days =
                        displayedCalendar.viewMode === 'month'
                          ? buildMonthCells(displayedCalendar.monthCursor)
                          : buildWeekCells(displayedCalendar.selectedDate)

                      const eventsByDate = displayedCalendar.events.reduce<Record<string, CalendarEvent[]>>((acc, eventItem) => {
                        if (!acc[eventItem.date]) acc[eventItem.date] = []
                        acc[eventItem.date].push(eventItem)
                        return acc
                      }, {})

                      const selectedEvents = [...(eventsByDate[displayedCalendar.selectedDate] ?? [])].sort((a, b) => {
                        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
                        return (a.startTime ?? '').localeCompare(b.startTime ?? '')
                      })

                      const periodLabel =
                        displayedCalendar.viewMode === 'month'
                          ? formatMonthLabel(displayedCalendar.monthCursor, settings.language)
                          : formatWeekLabel(displayedCalendar.selectedDate, settings.language)

                      return (
                        <div className="calendar-card-body">
                          <div className="calendar-topbar">
                            <button
                              type="button"
                              className="calendar-nav-btn"
                              aria-label={calendarText.prevMonthAria}
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={() => navigateCalendarFromCard(card, -1)}
                            >
                              ‹
                            </button>

                            <div className="calendar-month-label">{periodLabel}</div>

                            <button
                              type="button"
                              className="calendar-nav-btn"
                              aria-label={calendarText.nextMonthAria}
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={() => navigateCalendarFromCard(card, 1)}
                            >
                              ›
                            </button>
                          </div>

                          <div className="calendar-view-switch">
                            <button
                              type="button"
                              className={`calendar-view-btn ${displayedCalendar.viewMode === 'month' ? 'active' : ''}`}
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={() => setCalendarViewMode(card.id, 'month')}
                            >
                              {calendarText.viewMonth}
                            </button>
                            <button
                              type="button"
                              className={`calendar-view-btn ${displayedCalendar.viewMode === 'week' ? 'active' : ''}`}
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

                          <div className={`calendar-grid ${displayedCalendar.viewMode === 'week' ? 'week-mode' : ''}`}>
                            {days.map((day, dayIndex) => {
                              const isSelected = day.dateKey === displayedCalendar.selectedDate
                              const isToday = day.dateKey === todayKey
                              const dayEvents = eventsByDate[day.dateKey] ?? []
                              const eventCount = dayEvents.length
                              const dropKey = `${card.id}:${day.dateKey}`
                              const holidays = getHolidays(day.dateKey, settings.calendarHolidayMode)
                              const holidayLabel = holidays[0]
                                ? settings.language === 'zh'
                                  ? holidays[0].name
                                  : holidays[0].nameEn
                                : null

                              return (
                                <button
                                  key={day.dateKey}
                                  type="button"
                                  className={`calendar-day ${day.inMonth ? '' : 'outside'} ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${calendarDropTarget === dropKey ? 'drop-target' : ''}`}
                                  onPointerDown={(event) => event.stopPropagation()}
                                  onClick={() => selectCalendarDate(card.id, day.dateKey)}
                                  onDoubleClick={() => openCalendarDraft(card.id, day.dateKey)}
                                  onDragOver={(event) => onCalendarDayDragOver(event, card.id, day.dateKey)}
                                  onDragLeave={() => onCalendarDayDragLeave(card.id, day.dateKey)}
                                  onDrop={(event) => onCalendarDayDrop(event, card.id, day.dateKey)}
                                >
                                  <span className="calendar-day-top">
                                    {displayedCalendar.viewMode === 'week' ? (
                                      <span className="calendar-day-week">{calendarText.weekdays[dayIndex]}</span>
                                    ) : null}
                                    <span className="calendar-day-number">{Number(day.dateKey.slice(8, 10))}</span>
                                    {holidayLabel ? <span className="calendar-day-holiday" title={holidays.map((h) => (settings.language === 'zh' ? h.name : h.nameEn)).join(', ')}>{holidayLabel}</span> : null}
                                  </span>

                                  {eventCount > 0 ? <span className="calendar-day-count">{eventCount}</span> : null}

                                  {displayedCalendar.viewMode === 'week' ? (
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

                          <div className="calendar-selected-header">
                            <span className="calendar-selected-date">{calendarText.selectedPrefix}{displayedCalendar.selectedDate}</span>
                            <button
                              type="button"
                              className="calendar-add-inline-btn"
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={() => openCalendarDraft(card.id, displayedCalendar.selectedDate)}
                            >
                              + {calendarText.addButton}
                            </button>
                          </div>

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
                                    ⋮⋮
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
                                    ×
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

                {!isMinimizedCard && card.kind === 'eventFlow'
                  ? (() => {
                      const flow = normalizeEventFlowState(card.eventFlow)
                      const nodeMap = new Map(flow.nodes.map((node) => [node.id, node]))
                      const dragSource = eventFlowEdgeDrag?.cardId === card.id ? nodeMap.get(eventFlowEdgeDrag.sourceNodeId) : null

                      return (
                        <div className="event-flow-card-body" onPointerDown={(event) => event.stopPropagation()}>
                          <div className="event-flow-toolbar">
                            <div>
                              <span className="event-flow-eyebrow">{text.eventFlowTitle}</span>
                              <strong>{flow.nodes.length} nodes</strong>
                              <p>{text.eventFlowDragHint}</p>
                            </div>
                            <button
                              type="button"
                              className="event-flow-add-btn"
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={() => addEventFlowNode(card.id)}
                            >
                              {text.eventFlowAddNode}
                            </button>
                          </div>

                          <div className="event-flow-canvas" onPointerDown={(event) => event.stopPropagation()}>
                            <svg className="event-flow-layer" viewBox={`0 0 ${Math.max(card.width - 24, 320)} ${Math.max(card.height - 124, 240)}`} preserveAspectRatio="none">
                              <defs>
                                <marker id={`event-flow-arrow-${card.id}`} markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="strokeWidth">
                                  <path d="M 0 0 L 10 5 L 0 10 z" />
                                </marker>
                              </defs>
                              {flow.edges.map((edge) => {
                                const sourceNode = nodeMap.get(edge.sourceNodeId)
                                const targetNode = nodeMap.get(edge.targetNodeId)
                                if (!sourceNode || !targetNode) return null
                                const startX = sourceNode.x + 220
                                const startY = sourceNode.y + 58
                                const endX = targetNode.x
                                const endY = targetNode.y + 58
                                const mid = Math.max(56, Math.abs(endX - startX) / 2)
                                const midX = (startX + endX) / 2
                                const midY = (startY + endY) / 2
                                return (
                                  <g key={edge.id}>
                                    <path
                                      className="event-flow-path"
                                      d={`M ${startX} ${startY} C ${startX + mid} ${startY}, ${endX - mid} ${endY}, ${endX} ${endY}`}
                                      markerEnd={`url(#event-flow-arrow-${card.id})`}
                                    />
                                    <circle
                                      className="event-flow-edge-delete"
                                      cx={midX}
                                      cy={midY}
                                      r={10}
                                      onPointerDown={(event) => event.stopPropagation()}
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        deleteEventFlowEdge(card.id, edge.id)
                                      }}
                                    />
                                    <text
                                      className="event-flow-edge-delete-icon"
                                      x={midX}
                                      y={midY}
                                      textAnchor="middle"
                                      dominantBaseline="central"
                                      onPointerDown={(event) => event.stopPropagation()}
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        deleteEventFlowEdge(card.id, edge.id)
                                      }}
                                    >
                                      ×
                                    </text>
                                  </g>
                                )
                              })}
                              {dragSource && eventFlowEdgeDrag ? (
                                <path
                                  className="event-flow-preview"
                                  d={`M ${dragSource.x + 220} ${dragSource.y + 58} C ${dragSource.x + 276} ${dragSource.y + 58}, ${eventFlowEdgeDrag.pointerX - 56} ${eventFlowEdgeDrag.pointerY}, ${eventFlowEdgeDrag.pointerX} ${eventFlowEdgeDrag.pointerY}`}
                                />
                              ) : null}
                            </svg>

                            {flow.nodes.map((node) => {
                              const isTarget = eventFlowEdgeDrag?.cardId === card.id && eventFlowEdgeDrag.sourceNodeId !== node.id
                              return (
                                <div
                                  key={node.id}
                                  className={`event-flow-node ${node.kind === 'start' ? 'start' : ''} ${isTarget ? 'target' : ''}`}
                                  style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
                                  data-event-flow-card-id={card.id}
                                  data-event-flow-node-id={node.id}
                                  data-event-flow-node-title={node.title}
                                  onPointerDown={(event) => startEventFlowNodeDrag(event, card.id, node)}
                                  onPointerUp={(event) => finishEventFlowEdgeDrag(event, card.id, node)}
                                >
                                  <button
                                    type="button"
                                    className="event-flow-node-delete"
                                    aria-label={text.eventFlowDeleteNode}
                                    title={text.eventFlowDeleteNode}
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      deleteEventFlowNode(card.id, node.id)
                                    }}
                                  >
                                    ×
                                  </button>
                                  <span className="event-flow-node-type">{node.kind === 'start' ? text.eventFlowStart : text.eventFlowNewNode}</span>
                                  <textarea
                                    className="event-flow-node-title"
                                    defaultValue={node.title}
                                    placeholder={text.eventFlowNodePlaceholder}
                                    onBlur={(event) => updateEventFlowNodeTitle(card.id, node.id, event.currentTarget.value)}
                                  />
                                  <button
                                    type="button"
                                    className="event-flow-next-btn"
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onClick={() => addEventFlowNextNode(card.id, node)}
                                  >
                                    {text.eventFlowNext}
                                  </button>
                                  <button
                                    type="button"
                                    className="event-flow-node-handle"
                                    aria-label={text.eventFlowDragHint}
                                    title={text.eventFlowDragHint}
                                    onPointerDown={(event) => startEventFlowEdgeDrag(event, card.id, node)}
                                    onDragStart={(event) => event.preventDefault()}
                                  />
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })()
                  : null}

                {!isMinimizedCard && card.kind === 'dashboard' ? (
                  <DashboardCard
                    dashboard={card.dashboard}
                    title={card.title}
                    onOpenInspect={() => setInspectedDashboardCardId(card.id)}
                    onStartDrag={(event) => onCardDragStart(event, card)}
                  />
                ) : null}

                {!isMinimizedCard && card.kind === 'hint' ? (
                  <div className="hint-list">
                    {text.hintItems.map((item) => (
                      <p key={item}>{item}</p>
                    ))}
                  </div>
                ) : null}

                {!isMinimizedCard && card.kind === 'image' ? (
                  <div
                    className="media-block image-media-block"
                    onPointerDown={(event) => {
                      if (cardChrome.dragSurface === 'body') onCardDragStart(event, card)
                    }}
                  >
                    {fileUrl ? (
                      <img src={fileUrl} alt={card.fileName ?? card.title} className="media-image" />
                    ) : (
                      <div className="media-missing">{text.mediaImageUnavailable}</div>
                    )}
                    {cardChrome.showFileMeta ? <div className="file-meta">{card.fileName}</div> : null}
                  </div>
                ) : null}

                {!isMinimizedCard && card.kind === 'video' ? (
                  <div className="media-block">
                    {fileUrl ? (
                      <video src={fileUrl} controls className="media-video" />
                    ) : (
                      <div className="media-missing">{text.mediaVideoUnavailable}</div>
                    )}
                    <div className="file-meta">{card.fileName}</div>
                  </div>
                ) : null}

                {!isMinimizedCard && card.kind === 'pdf' ? (
                  <div className="media-block">
                    {fileUrl ? (
                      <iframe src={fileUrl} title={card.fileName ?? card.title} className="pdf-viewer" />
                    ) : (
                      <div className="media-missing">{text.mediaPdfUnavailable}</div>
                    )}
                    <div className="file-meta">{card.fileName}</div>
                  </div>
                ) : null}

                {!isMinimizedCard && cardChrome.showResizeHandle ? (
                  <button
                    type="button"
                    className="card-resize-handle"
                    onPointerDown={(event) => onCardResizeStart(event, card)}
                    aria-label={text.resizeCardAria}
                    title={text.resizeCardAria}
                  />
                ) : null}
              </article>
            )
          })}
        </div>
      </section>

      {inspectedDashboardCard ? (
        <DashboardInspectModal card={inspectedDashboardCard} onClose={() => setInspectedDashboardCardId(null)} />
      ) : null}

      {renamingImageCard ? (
        <div className="image-rename-overlay" onClick={closeImageCardRenameDialog}>
          <form
            className="image-rename-dialog"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault()
              submitImageCardRename()
            }}
          >
            <header className="image-rename-header">
              <div>
                <span>{renamingImageCard.fileName || (settings.language === 'zh' ? '图片卡片' : 'Image card')}</span>
                <h3>{settings.language === 'zh' ? '重命名图片卡片' : 'Rename image card'}</h3>
              </div>
              <button type="button" className="settings-close" onClick={closeImageCardRenameDialog}>
                ×
              </button>
            </header>
            <input
              className="image-rename-input"
              value={imageCardTitleDraft}
              autoFocus
              placeholder={settings.language === 'zh' ? '输入新的图片卡片名称' : 'Enter a new image card name'}
              onChange={(event) => setImageCardTitleDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  submitImageCardRename()
                }
                if (event.key === 'Escape') {
                  event.preventDefault()
                  closeImageCardRenameDialog()
                }
              }}
            />
            <div className="image-rename-actions">
              <button type="button" className="image-rename-secondary" onClick={closeImageCardRenameDialog}>
                {settings.language === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button type="submit" className="image-rename-primary" disabled={!imageCardTitleDraft.trim()}>
                {settings.language === 'zh' ? '保存' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {trashOpen ? (
        <div className="trash-overlay" onClick={() => setTrashOpen(false)}>
          <section className="trash-dialog" onClick={(event) => event.stopPropagation()}>
            <header className="trash-dialog-header">
              <div>
                <span>{settings.language === 'zh' ? '保留 10 天' : 'Kept for 10 days'}</span>
                <h3>{settings.language === 'zh' ? '回收站' : 'Recycle Bin'}</h3>
              </div>
              <button type="button" className="settings-close" onClick={() => setTrashOpen(false)}>
                ×
              </button>
            </header>

            <div className="trash-sections">
              <section className="trash-section" aria-label={settings.language === 'zh' ? '已删除卡片' : 'Deleted cards'}>
                <header className="trash-section-title">
                  <span>{settings.language === 'zh' ? '已删除卡片' : 'Deleted cards'}</span>
                  <small>{trashCardCount}</small>
                </header>
                {trashCards.length === 0 ? (
                  <div className="trash-empty">
                    {settings.language === 'zh' ? '暂无已删除卡片。' : 'No deleted cards.'}
                  </div>
                ) : (
                  <div className="trash-list">
                    {trashCards.map((item) => (
                      <article key={item.id} className="trash-item" aria-label={getTrashCardLabel(item)}>
                        <div className="trash-item-main">
                          <span className={`trash-kind ${item.card.kind}`}>{getNavigatorCardTypeLabel(item.card.kind).slice(0, 1)}</span>
                          <div className="trash-item-copy">
                            <strong>{getTrashCardLabel(item)}</strong>
                            <small>{item.gridName} · {formatTrashDeletedAt(item)} · {getTrashRemainingLabel(item)}</small>
                          </div>
                        </div>
                        <div className="trash-item-actions">
                          <button type="button" className="trash-restore-btn" onClick={() => restoreTrashedCard(item.id)}>
                            {settings.language === 'zh' ? '恢复' : 'Restore'}
                          </button>
                          <button type="button" className="trash-delete-btn" onClick={() => requestPermanentlyDeleteTrashedCard(item)}>
                            {settings.language === 'zh' ? '永久删除' : 'Delete forever'}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="trash-section" aria-label={settings.language === 'zh' ? '已删除代办' : 'Deleted todos'}>
                <header className="trash-section-title">
                  <span>{settings.language === 'zh' ? '已删除代办' : 'Deleted todos'}</span>
                  <small>{trashTodoItemCount}</small>
                </header>
                {trashTodoItems.length === 0 ? (
                  <div className="trash-empty">
                    {settings.language === 'zh' ? '暂无已删除代办。' : 'No deleted todo items.'}
                  </div>
                ) : (
                  <div className="trash-list">
                    {trashTodoItems.map((item) => (
                      <article key={item.id} className="trash-todo-item" aria-label={item.item.text}>
                        <div className="trash-item-main">
                          <span className={`trash-kind ${normalizeTodoTag(item.item.tag)}`}>✓</span>
                          <div className="trash-item-copy">
                            <strong>{item.item.text}</strong>
                            <small>{item.cardTitle} · {item.gridName} · {formatTrashTodoDeletedAt(item)} · {getTrashTodoRemainingLabel(item)}</small>
                          </div>
                        </div>
                        <div className="trash-item-actions">
                          <button type="button" className="trash-restore-btn" onClick={() => restoreTrashedTodoItem(item.id)}>
                            {settings.language === 'zh' ? '恢复' : 'Restore'}
                          </button>
                          <button type="button" className="trash-delete-btn" onClick={() => requestPermanentlyDeleteTrashedTodoItem(item)}>
                            {settings.language === 'zh' ? '永久删除' : 'Delete forever'}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </section>
        </div>
      ) : null}

      {pendingDeleteCardId ? (
        <div className="confirm-overlay" onClick={cancelDeleteCard}>
          <section className="confirm-dialog" onClick={(event) => event.stopPropagation()}>
            <h3>{settings.language === 'zh' ? '删除卡片？' : 'Delete card?'}</h3>
            <p>
              {settings.language === 'zh'
                ? '删除后会进入回收站，10 天内可以恢复，也可以在回收站永久删除。'
                : 'Deleted cards move to the recycle bin for 10 days. You can restore them or permanently delete them there.'}
            </p>
            <div className="confirm-actions">
              <button type="button" className="confirm-secondary" onClick={cancelDeleteCard}>
                {settings.language === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button type="button" className="confirm-danger" onClick={confirmDeleteCard}>
                {settings.language === 'zh' ? '确认删除' : 'Delete'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {todoDraftTarget ? (
        <div className="todo-draft-overlay" onClick={closeTodoDraft}>
          <form
            className="todo-draft-dialog"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault()
              submitTodoDraft()
            }}
          >
            <header className="todo-draft-header">
              <div>
                <span>{todoLaneLabels[todoDraftTarget.lane]}</span>
                <h3>{settings.language === 'zh' ? '新增待办' : 'Add todo'}</h3>
              </div>
              <button type="button" className="settings-close" onClick={closeTodoDraft}>
                ×
              </button>
            </header>
            <textarea
              className="todo-draft-input"
              value={todoDraftText}
              autoFocus
              placeholder={todoText.placeholder}
              onChange={(event) => setTodoDraftText(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                  event.preventDefault()
                  submitTodoDraft()
                }
                if (event.key === 'Escape') {
                  event.preventDefault()
                  closeTodoDraft()
                }
              }}
            />
            <div className="todo-tag-picker" aria-label={settings.language === 'zh' ? '任务标签' : 'Todo tag'}>
              {TODO_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`todo-tag-option todo-tag-${tag} ${todoDraftTag === tag ? 'active' : ''}`}
                  onClick={() => setTodoDraftTag(tag)}
                >
                  <span aria-hidden="true" />
                  {todoTagLabels[tag]}
                </button>
              ))}
            </div>
            <div className="todo-draft-actions">
              <button type="button" className="todo-draft-secondary" onClick={closeTodoDraft}>
                {settings.language === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button type="submit" className="todo-draft-primary" disabled={!todoDraftText.trim()}>
                {todoText.addButton}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {calendarDraftOpen && calendarDraftCardId ? (() => {
        const draftCard = gridsRef.current.flatMap((g) => g.cards).find((c) => c.id === calendarDraftCardId && c.kind === 'calendar')
        const draftCalendar = draftCard ? withCalendarDefaults(draftCard.calendar) : null
        if (!draftCalendar) return null
        const draftDate = parseDateKey(draftCalendar.selectedDate)
        const weekdayName = CALENDAR_I18N[settings.language].weekdays[draftDate.getDay()]
        const canSubmit = draftCalendar.draftTitle.trim() && (draftCalendar.draftAllDay || normalizeTimeRange(draftCalendar.draftStartTime, draftCalendar.draftEndTime))
        return (
          <div className="calendar-draft-overlay" onClick={closeCalendarDraft}>
            <form
              className="calendar-draft-dialog"
              onClick={(event) => event.stopPropagation()}
              onSubmit={(event) => {
                event.preventDefault()
                submitCalendarDraft()
              }}
            >
              <header className="calendar-draft-header">
                <div>
                  <span>{draftCalendar.selectedDate} {weekdayName}</span>
                  <h3>{settings.language === 'zh' ? '添加日程' : 'Add Event'}</h3>
                </div>
                <button type="button" className="settings-close" onClick={closeCalendarDraft}>
                  ×
                </button>
              </header>
              <input
                className="calendar-draft-input"
                value={draftCalendar.draftTitle}
                autoFocus
                placeholder={CALENDAR_I18N[settings.language].placeholder}
                onChange={(event) =>
                  updateCalendarCard(calendarDraftCardId, (state) => ({ ...state, draftTitle: event.target.value }))
                }
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                    event.preventDefault()
                    submitCalendarDraft()
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    closeCalendarDraft()
                  }
                }}
              />
              <div className="calendar-draft-meta">
                <label className="calendar-all-day">
                  <input
                    type="checkbox"
                    checked={draftCalendar.draftAllDay}
                    onChange={(event) =>
                      updateCalendarCard(calendarDraftCardId, (state) => ({ ...state, draftAllDay: event.target.checked }))
                    }
                  />
                  <span>{CALENDAR_I18N[settings.language].allDay}</span>
                </label>
                {draftCalendar.draftAllDay ? null : (
                  <div className="calendar-time-range">
                    <label>
                      <span>{CALENDAR_I18N[settings.language].startTime}</span>
                      <input
                        type="time"
                        value={draftCalendar.draftStartTime}
                        onChange={(event) =>
                          updateCalendarCard(calendarDraftCardId, (state) => ({ ...state, draftStartTime: event.target.value }))
                        }
                      />
                    </label>
                    <label>
                      <span>{CALENDAR_I18N[settings.language].endTime}</span>
                      <input
                        type="time"
                        value={draftCalendar.draftEndTime}
                        onChange={(event) =>
                          updateCalendarCard(calendarDraftCardId, (state) => ({ ...state, draftEndTime: event.target.value }))
                        }
                      />
                    </label>
                  </div>
                )}
              </div>
              {canSubmit ? null : <p className="calendar-time-error">{CALENDAR_I18N[settings.language].invalidTimeHint}</p>}
              <div className="calendar-draft-actions">
                <button type="button" className="calendar-draft-secondary" onClick={closeCalendarDraft}>
                  {settings.language === 'zh' ? '取消' : 'Cancel'}
                </button>
                <button type="submit" className="calendar-draft-primary" disabled={!canSubmit}>
                  {CALENDAR_I18N[settings.language].addButton}
                </button>
              </div>
            </form>
          </div>
        )
      })() : null}

      {settingsOpen ? (
        <div className="settings-overlay" onClick={closeSettings}>
          <section className="settings-dialog" onClick={(event) => event.stopPropagation()}>
            <header className="settings-header">
              <div>
                <span className="settings-kicker">Canvas Workbench</span>
                <h2>{text.settings}</h2>
                <p>{settings.language === 'zh' ? '本地优先，无需后端服务即可在 Obsidian 使用。' : 'Local-first and self-contained inside Obsidian.'}</p>
              </div>
              <button className="settings-close" onClick={closeSettings} aria-label={text.settings}>
                ×
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
              <h3>{text.calendarHolidayTitle}</h3>
              <p>{text.calendarHolidayHint}</p>
              <div className="language-switch">
                <button
                  className={`lang-option ${settings.calendarHolidayMode === 'none' ? 'active' : ''}`}
                  onClick={() => updateSettings({ calendarHolidayMode: 'none' })}
                >
                  {text.calendarHolidayNone}
                </button>
                <button
                  className={`lang-option ${settings.calendarHolidayMode === 'china' ? 'active' : ''}`}
                  onClick={() => updateSettings({ calendarHolidayMode: 'china' })}
                >
                  {text.calendarHolidayChina}
                </button>
                <button
                  className={`lang-option ${settings.calendarHolidayMode === 'us' ? 'active' : ''}`}
                  onClick={() => updateSettings({ calendarHolidayMode: 'us' })}
                >
                  {text.calendarHolidayUS}
                </button>
                <button
                  className={`lang-option ${settings.calendarHolidayMode === 'both' ? 'active' : ''}`}
                  onClick={() => updateSettings({ calendarHolidayMode: 'both' })}
                >
                  {text.calendarHolidayBoth}
                </button>
              </div>
            </div>

            <div className="settings-group">
              <h3>{text.localApiTitle}</h3>
              <p>{text.localApiHint}</p>
              <div className="local-api-status-card">
                <div className="local-api-status-head">
                  <span className={`local-api-status-pill ${localApiStatus}`}>
                    {localApiStatus === 'online'
                      ? text.localApiStatusOnline
                      : localApiStatus === 'offline'
                        ? text.localApiStatusOffline
                        : localApiStatus === 'checking'
                          ? text.localApiStatusChecking
                          : text.localApiStatusIdle}
                  </span>
                  <span>{localApiHealth?.version ? `${text.localApiVersionLabel}: ${localApiHealth.version}` : localApiBaseUrl}</span>
                </div>
                <dl className="local-api-meta">
                  <div>
                    <dt>{text.localApiUrlLabel}</dt>
                    <dd>{localApiHealth?.apiBaseUrl || localApiBaseUrl}</dd>
                  </div>
                  <div>
                    <dt>{text.localApiStartCommandLabel}</dt>
                    <dd className="local-api-command">{localApiStartCommand}</dd>
                  </div>
                </dl>
                <p>{text.localApiBrowserCannotStart}</p>
                <div className="local-api-auto-save">
                  <div>
                    <strong>{text.localApiAutoSaveTitle}</strong>
                    <p>{text.localApiAutoSaveHint}</p>
                  </div>
                  <label className="input-row">
                    <span>{text.localApiAutoSaveIntervalLabel}</span>
                    <input
                      type="number"
                      min="1"
                      max="240"
                      step="1"
                      className="settings-text-input"
                      value={settings.localApiAutoSaveMinutes}
                      onChange={(event) => updateSettings({ localApiAutoSaveMinutes: Number(event.target.value) })}
                    />
                  </label>
                  <div className="local-api-actions">
                    <span className={`local-api-status-pill ${settings.localApiAutoSaveEnabled ? 'online' : 'idle'}`}>
                      {settings.localApiAutoSaveEnabled
                        ? text.localApiAutoSaveEnabledStatus
                        : text.localApiAutoSaveDisabledStatus}
                    </span>
                    <button
                      type="button"
                      className="settings-inline-btn"
                      onClick={() => updateSettings({ localApiAutoSaveEnabled: !settings.localApiAutoSaveEnabled })}
                    >
                      {settings.localApiAutoSaveEnabled ? text.localApiAutoSaveDisable : text.localApiAutoSaveEnable}
                    </button>
                  </div>
                </div>
                {localApiStatusMessage ? <p className="local-api-status-message">{localApiStatusMessage}</p> : null}
                <div className="local-api-actions">
                  <button type="button" className="settings-inline-btn" onClick={() => void refreshLocalApiStatus()}>
                    {text.localApiRefresh}
                  </button>
                  <button type="button" className="settings-inline-btn" onClick={openLocalApiHealth}>
                    {text.localApiOpenHealth}
                  </button>
                  <button type="button" className="settings-inline-btn" onClick={() => void handleStartLocalApi()} disabled={localApiStarting}>
                    {localApiStarting ? text.localApiStarting : onStartLocalApi ? text.localApiStartButton : text.localApiCopyStartCommand}
                  </button>
                </div>
              </div>
            </div>

            <div className="settings-group">
              <h3>{text.dataManagementTitle}</h3>
              <p>{text.dataManagementHint}</p>
              <div className="local-api-actions">
                <button type="button" className="settings-inline-btn" onClick={handleDownloadFromLocalApi}>
                  {text.dataManagementReload}
                </button>
                <button type="button" className="settings-inline-btn" onClick={handleUploadToLocalApi}>
                  {text.dataManagementImport}
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
