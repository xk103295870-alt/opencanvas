import type { CardKind } from './shared/workspaceTypes'

export type CardChrome = {
  showHeader: boolean
  showFileMeta: boolean
  showResizeHandle: boolean
  frameless: boolean
}

export function getCardChrome(kind: CardKind): CardChrome {
  if (kind === 'image') {
    return {
      showHeader: false,
      showFileMeta: false,
      showResizeHandle: false,
      frameless: true,
    }
  }

  return {
    showHeader: true,
    showFileMeta: kind === 'video' || kind === 'pdf',
    showResizeHandle: true,
    frameless: false,
  }
}
