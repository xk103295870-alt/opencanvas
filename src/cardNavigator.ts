import type { CardData, CardKind, ViewportState } from './shared/workspaceTypes'

const READABLE_CARD_ZOOM = 0.85

const CARD_KIND_LABELS: Record<CardKind, string> = {
  note: '笔记',
  hint: '提示',
  image: '图片',
  video: '视频',
  pdf: 'PDF',
  todo: '待办事项',
  calendar: '日历',
  eventFlow: 'Event Flow',
  dashboard: '数据看板',
}

export function getNavigatorCardTypeLabel(kind: CardKind) {
  return CARD_KIND_LABELS[kind]
}

export function getNavigatorCardLabel(card: CardData) {
  const title = card.title.trim()
  if (title) return title
  const fileName = card.fileName?.trim()
  if (fileName) return fileName
  return getNavigatorCardTypeLabel(card.kind)
}

export function getNavigatorCardMeta(card: CardData) {
  if (card.fileName?.trim()) return card.fileName.trim()
  if (card.kind === 'todo') {
    const count = card.todoItems?.length ?? 0
    return `${count} ${count === 1 ? 'item' : 'items'}`
  }
  if (card.kind === 'calendar') {
    const count = card.calendar?.events.length ?? 0
    return `${count} ${count === 1 ? 'event' : 'events'}`
  }
  if (card.kind === 'dashboard') {
    const generatedBy = card.dashboard?.generatedBy?.trim()
    if (generatedBy) return generatedBy
    const updatedAt = card.dashboard?.updatedAt?.trim()
    if (updatedAt) return updatedAt
    return ''
  }
  const content = card.content.trim().replace(/\s+/g, ' ')
  return content ? content.slice(0, 80) : ''
}

export function filterNavigatorCards(cards: CardData[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return cards

  return cards.filter((card) => {
    const haystack = [
      getNavigatorCardLabel(card),
      getNavigatorCardTypeLabel(card.kind),
      card.fileName ?? '',
      card.content,
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(normalizedQuery)
  })
}

export function centerViewportOnCard(
  bounds: { width: number; height: number } | null | undefined,
  card: Pick<CardData, 'x' | 'y' | 'width' | 'height'>,
  currentZoom: number,
): ViewportState {
  const width = bounds?.width && bounds.width > 0 ? bounds.width : 1440
  const height = bounds?.height && bounds.height > 0 ? bounds.height : 900
  const zoom = currentZoom < READABLE_CARD_ZOOM ? READABLE_CARD_ZOOM : currentZoom
  const targetX = card.x + card.width / 2
  const targetY = card.y + card.height / 2

  return {
    zoom,
    x: width / 2 - targetX * zoom,
    y: height / 2 - targetY * zoom,
  }
}
