import type { CardKind } from './shared/workspaceTypes'

export type CardChrome = {
  showHeader: boolean
  showFileMeta: boolean
  showResizeHandle: boolean
  frameless: boolean
  chromeMode: 'standard' | 'hover'
  dragSurface: 'header' | 'body' | 'handle' | 'none'
}

export function getCardChrome(kind: CardKind): CardChrome {
  if (kind === 'image') {
    return {
      showHeader: false,
      showFileMeta: false,
      showResizeHandle: true,
      frameless: true,
      chromeMode: 'hover',
      dragSurface: 'body',
    }
  }

  if (kind === 'dashboard') {
    return {
      showHeader: false,
      showFileMeta: false,
      showResizeHandle: true,
      frameless: true,
      chromeMode: 'hover',
      dragSurface: 'none',
    }
  }

  return {
    showHeader: true,
    showFileMeta: kind === 'video' || kind === 'pdf',
    showResizeHandle: true,
    frameless: false,
    chromeMode: 'standard',
    dragSurface: 'header',
  }
}
