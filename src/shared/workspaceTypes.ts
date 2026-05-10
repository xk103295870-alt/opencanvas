export type CardKind = 'note' | 'hint' | 'image' | 'video' | 'pdf' | 'todo' | 'calendar' | 'eventFlow' | 'dashboard'
export type CalendarViewMode = 'month' | 'week'
export type EventFlowNodeKind = 'start' | 'step'
export type TodoLane = 'todo' | 'doing' | 'done'
export type TodoTag = 'event' | 'feature' | 'important' | 'plan' | 'bug' | 'idea'
export type TodoFilter = 'all' | TodoTag

export type TodoItem = {
  id: string
  text: string
  status: TodoLane
  tag?: TodoTag
}

export type CalendarEvent = {
  id: string
  date: string
  title: string
  allDay: boolean
  startTime?: string
  endTime?: string
}

export type CalendarState = {
  monthCursor: string
  selectedDate: string
  viewMode: CalendarViewMode
  draftTitle: string
  draftAllDay: boolean
  draftStartTime: string
  draftEndTime: string
  events: CalendarEvent[]
}

export type EventFlowNode = {
  id: string
  title: string
  x: number
  y: number
  kind: EventFlowNodeKind
}

export type EventFlowEdge = {
  id: string
  sourceNodeId: string
  targetNodeId: string
  label?: string
}

export type EventFlowState = {
  nodes: EventFlowNode[]
  edges: EventFlowEdge[]
  draftTitle: string
}

export type DashboardState = {
  option: unknown
  sourceData?: unknown
  prompt?: string
  generatedBy?: string
  updatedAt?: string
}

export type CardData = {
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
  eventFlow?: EventFlowState
  dashboard?: DashboardState
}

export type GridData = {
  id: string
  name: string
  cards: CardData[]
}

export type ViewportState = {
  x: number
  y: number
  zoom: number
}

export type PersistedAppState = {
  version: number
  grids: GridData[]
  activeGridId: string
  viewport: ViewportState
}

export type ExternalTodoInput = string | { text?: string; done?: boolean; status?: TodoLane | string; tag?: TodoTag | string }

export type ExternalCalendarEventInput = {
  title?: string
  date?: string
  allDay?: boolean
  startTime?: string
  endTime?: string
}

export type ExternalCalendarInput = Partial<Omit<CalendarState, 'events'>> & {
  events?: ExternalCalendarEventInput[]
}

export type ExternalEventFlowNodeInput = Partial<EventFlowNode>
export type ExternalEventFlowEdgeInput = Partial<EventFlowEdge>
export type ExternalEventFlowInput = Partial<Omit<EventFlowState, 'nodes' | 'edges'>> & {
  nodes?: ExternalEventFlowNodeInput[]
  edges?: ExternalEventFlowEdgeInput[]
}

export const TODO_LANES: TodoLane[] = ['todo', 'doing', 'done']
export const TODO_TAGS: TodoTag[] = ['event', 'feature', 'important', 'plan', 'bug', 'idea']
export const TODO_FILTERS: TodoFilter[] = ['all', ...TODO_TAGS]

export const CARD_KIND_SET = new Set<CardKind>(['note', 'hint', 'image', 'video', 'pdf', 'todo', 'calendar', 'eventFlow', 'dashboard'])

export const CARD_DEFAULT_SIZES: Record<CardKind, { width: number; height: number }> = {
  note: { width: 340, height: 280 },
  hint: { width: 300, height: 420 },
  image: { width: 360, height: 280 },
  video: { width: 420, height: 300 },
  pdf: { width: 460, height: 360 },
  todo: { width: 760, height: 430 },
  calendar: { width: 540, height: 640 },
  eventFlow: { width: 760, height: 480 },
  dashboard: { width: 760, height: 480 },
}

export const INITIAL_VIEWPORT: ViewportState = { x: 0, y: 0, zoom: 1 }

const pad2 = (value: number) => String(value).padStart(2, '0')

export const toDateKey = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`

export const toMonthKey = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`

export const parseDateKey = (dateKey: string) => {
  const [yearRaw, monthRaw, dayRaw] = dateKey.split('-').map(Number)
  const year = Number.isFinite(yearRaw) ? yearRaw : new Date().getFullYear()
  const month = Number.isFinite(monthRaw) ? monthRaw - 1 : new Date().getMonth()
  const day = Number.isFinite(dayRaw) ? dayRaw : 1
  return new Date(year, month, day)
}

export const toDateKeyOrFallback = (value: unknown, fallback: string) =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : fallback

export const toMonthKeyOrFallback = (value: unknown, fallback: string) =>
  typeof value === 'string' && /^\d{4}-\d{2}$/.test(value.trim()) ? value.trim() : fallback

export const normalizeCardKind = (value: unknown): CardKind => {
  const raw = typeof value === 'string' ? value.trim() : ''
  const normalized = raw.toLowerCase()
  if (normalized === 'eventflow' || normalized === 'event-flow' || normalized === 'event_flow') return 'eventFlow'
  return CARD_KIND_SET.has(raw as CardKind) ? (raw as CardKind) : CARD_KIND_SET.has(normalized as CardKind) ? (normalized as CardKind) : 'note'
}

export const isSingletonCardKind = (kind: CardKind) => kind === 'todo' || kind === 'calendar'

export const normalizeTodoLane = (value: unknown, doneFallback = false): TodoLane => {
  const lane = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (lane === 'todo' || lane === 'doing' || lane === 'done') return lane
  return doneFallback ? 'done' : 'todo'
}

export const normalizeTodoTag = (value: unknown): TodoTag => {
  const tag = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (tag === 'feature' || tag === 'important' || tag === 'plan' || tag === 'bug' || tag === 'idea') return tag
  return 'event'
}

export const createTodoItem = (
  text: string,
  status: TodoLane = 'todo',
  tag: TodoTag = 'event',
  id = `todo-item-${cryptoRandomId()}`,
): TodoItem => ({
  id,
  text,
  status,
  tag,
})

export const normalizeTodoItems = (items: ExternalTodoInput[] | TodoItem[] | undefined): TodoItem[] => {
  if (!Array.isArray(items)) return []
  const normalizedItems: TodoItem[] = []

  for (const item of items) {
    if (typeof item === 'string') {
      const text = item.trim()
      if (!text) continue
      normalizedItems.push(createTodoItem(text))
      continue
    }

    if (!item || typeof item !== 'object') continue
    const text = String(item.text ?? '').trim()
    if (!text) continue
    const rawDone = 'done' in item ? Boolean(item.done) : false
    normalizedItems.push({
      id: 'id' in item && item.id ? String(item.id) : `todo-item-${cryptoRandomId()}`,
      text,
      status: normalizeTodoLane(item.status, rawDone),
      tag: normalizeTodoTag(item.tag),
    })
  }

  return normalizedItems
}

export const createDefaultCalendarState = (now = new Date()): CalendarState => {
  const today = toDateKey(now)
  return {
    monthCursor: toMonthKey(now),
    selectedDate: today,
    viewMode: 'month',
    draftTitle: '',
    draftAllDay: true,
    draftStartTime: '09:00',
    draftEndTime: '10:00',
    events: [],
  }
}

export const normalizeTimeValue = (value: unknown, fallback: string) => {
  const raw = typeof value === 'string' ? value.trim() : ''
  return /^\d{2}:\d{2}$/.test(raw) ? raw : fallback
}

export const normalizeCalendarEvents = (
  input: ExternalCalendarEventInput[] | CalendarEvent[] | undefined,
  fallbackDate: string,
): CalendarEvent[] => {
  if (!Array.isArray(input)) return []

  return input
    .map((eventItem) => {
      const title = String(eventItem?.title ?? '').trim()
      if (!title) return null

      const date = toDateKeyOrFallback(eventItem?.date, fallbackDate)
      const allDay = eventItem?.allDay !== false
      const startTime = normalizeTimeValue(eventItem?.startTime, '') || undefined
      const endTime = normalizeTimeValue(eventItem?.endTime, '') || undefined

      return {
        id: 'id' in eventItem && eventItem.id ? String(eventItem.id) : `event-${cryptoRandomId()}`,
        date,
        title,
        allDay,
        ...(allDay ? {} : { startTime, endTime }),
      } satisfies CalendarEvent
    })
    .filter((eventItem): eventItem is CalendarEvent => Boolean(eventItem))
}

export const normalizeCalendarState = (calendar?: ExternalCalendarInput | CalendarState): CalendarState => {
  const fallback = createDefaultCalendarState()
  if (!calendar || typeof calendar !== 'object') return fallback

  const selectedDate = toDateKeyOrFallback(calendar.selectedDate, fallback.selectedDate)
  const monthCursor = toMonthKeyOrFallback(calendar.monthCursor, toMonthKey(parseDateKey(selectedDate)))

  return {
    monthCursor,
    selectedDate,
    viewMode: calendar.viewMode === 'week' ? 'week' : 'month',
    draftTitle: String(calendar.draftTitle ?? ''),
    draftAllDay: calendar.draftAllDay ?? true,
    draftStartTime: normalizeTimeValue(calendar.draftStartTime, fallback.draftStartTime),
    draftEndTime: normalizeTimeValue(calendar.draftEndTime, fallback.draftEndTime),
    events: normalizeCalendarEvents(calendar.events, selectedDate),
  }
}

export const createDefaultEventFlowState = (): EventFlowState => ({
  draftTitle: '',
  nodes: [
    {
      id: `flow-node-${cryptoRandomId()}`,
      title: '',
      kind: 'start',
      x: 72,
      y: 150,
    },
  ],
  edges: [],
})

const normalizeEventFlowNodeKind = (value: unknown): EventFlowNodeKind => (value === 'start' ? 'start' : 'step')

export const normalizeEventFlowState = (input?: ExternalEventFlowInput | EventFlowState): EventFlowState => {
  const fallback = createDefaultEventFlowState()
  if (!input || typeof input !== 'object') return fallback

  const nodesInput = Array.isArray(input.nodes) ? input.nodes : []
  const seenNodeIds = new Set<string>()
  const nodes = nodesInput
    .map((nodeInput, index) => {
      if (!nodeInput || typeof nodeInput !== 'object') return null
      const rawId = String(nodeInput.id ?? '').trim()
      const id = rawId && !seenNodeIds.has(rawId) ? rawId : `flow-node-${cryptoRandomId()}`
      seenNodeIds.add(id)
      const kind = index === 0 ? normalizeEventFlowNodeKind(nodeInput.kind ?? 'start') : normalizeEventFlowNodeKind(nodeInput.kind)
      return {
        id,
        title: String(nodeInput.title ?? '').trim(),
        x: Number.isFinite(nodeInput.x) ? Number(nodeInput.x) : 72 + index * 180,
        y: Number.isFinite(nodeInput.y) ? Number(nodeInput.y) : 150,
        kind,
      } satisfies EventFlowNode
    })
    .filter((node): node is EventFlowNode => Boolean(node))

  const normalizedNodes = nodes.length ? nodes : fallback.nodes
  const nodeIds = new Set(normalizedNodes.map((node) => node.id))
  const seenPairs = new Set<string>()
  const seenEdgeIds = new Set<string>()
  const edgesInput = Array.isArray(input.edges) ? input.edges : []
  const edges = edgesInput
    .map((edgeInput) => {
      if (!edgeInput || typeof edgeInput !== 'object') return null
      const sourceNodeId = String(edgeInput.sourceNodeId ?? '').trim()
      const targetNodeId = String(edgeInput.targetNodeId ?? '').trim()
      if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId) return null
      if (!nodeIds.has(sourceNodeId) || !nodeIds.has(targetNodeId)) return null
      const pairKey = `${sourceNodeId}->${targetNodeId}`
      if (seenPairs.has(pairKey)) return null
      seenPairs.add(pairKey)
      const rawId = String(edgeInput.id ?? '').trim()
      const id = rawId && !seenEdgeIds.has(rawId) ? rawId : `flow-edge-${cryptoRandomId()}`
      seenEdgeIds.add(id)
      const label = typeof edgeInput.label === 'string' && edgeInput.label.trim() ? edgeInput.label.trim() : undefined
      return {
        id,
        sourceNodeId,
        targetNodeId,
        ...(label ? { label } : {}),
      } satisfies EventFlowEdge
    })
    .filter((edge): edge is EventFlowEdge => Boolean(edge))

  return {
    draftTitle: String(input.draftTitle ?? ''),
    nodes: normalizedNodes,
    edges,
  }
}

export const normalizeDashboardState = (value: unknown): DashboardState | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  return {
    option: raw.option,
    sourceData: raw.sourceData,
    prompt: typeof raw.prompt === 'string' ? raw.prompt : undefined,
    generatedBy: typeof raw.generatedBy === 'string' ? raw.generatedBy : undefined,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
  }
}

export const normalizeGridsForTodoBoard = (input: GridData[]): GridData[] => {
  if (!Array.isArray(input)) return []
  return input.map((grid) => ({
    ...grid,
    cards: Array.isArray(grid.cards)
      ? grid.cards.map((card) =>
          card.kind === 'todo'
            ? {
                ...card,
                todoItems: normalizeTodoItems(card.todoItems),
              }
            : card.kind === 'calendar'
              ? {
                  ...card,
                  calendar: normalizeCalendarState(card.calendar),
                }
              : card.kind === 'eventFlow'
                ? {
                    ...card,
                    eventFlow: normalizeEventFlowState(card.eventFlow),
                  }
                : card.kind === 'dashboard'
                  ? {
                      ...card,
                      dashboard: normalizeDashboardState(card.dashboard),
                    }
                  : card,
        )
      : [],
  }))
}

function cryptoRandomId() {
  const cryptoLike = globalThis.crypto
  if (cryptoLike && typeof cryptoLike.randomUUID === 'function') {
    return cryptoLike.randomUUID().slice(0, 10)
  }
  return Math.random().toString(36).slice(2, 12)
}
