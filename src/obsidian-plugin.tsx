import { ItemView, Plugin, addIcon, type WorkspaceLeaf } from 'obsidian'
import { createRoot, type Root } from 'react-dom/client'
import App from './App'
import './index.css'
import './obsidian.css'

const VIEW_TYPE_OPEN_CANVAS = 'open-canvas-view'
const OPEN_CANVAS_ICON = 'open-canvas-logo'
const OPEN_CANVAS_ICON_SVG = '<svg viewBox="0 0 256 256" width="100" height="100" preserveAspectRatio="xMidYMid meet"><rect x="18" y="18" width="220" height="220" rx="42" fill="currentColor"/><path d="M62 77H86.5L100.5 163H102.5L116.5 103H140L154 163H156L170 77H194.5L171.5 179H139.5L128.5 128.5H127.5L116.5 179H84.5L62 77Z" fill="var(--background-primary, #050505)"/></svg>'

class OpenCanvasView extends ItemView {
  private root: Root | null = null

  constructor(leaf: WorkspaceLeaf) {
    super(leaf)
  }

  getViewType() {
    return VIEW_TYPE_OPEN_CANVAS
  }

  getDisplayText() {
    return 'Open Canvas'
  }

  getIcon() {
    return OPEN_CANVAS_ICON
  }

  async onOpen() {
    const container = this.containerEl.children[1]
    container.empty()
    container.addClass('open-canvas-obsidian-view')

    const mountEl = container.createDiv({ cls: 'open-canvas-obsidian-root' })
    this.root = createRoot(mountEl)
    this.root.render(<App runtime="obsidian" />)
  }

  async onClose() {
    this.root?.unmount()
    this.root = null
  }
}

export default class OpenCanvasPlugin extends Plugin {
  async onload() {
    addIcon(OPEN_CANVAS_ICON, OPEN_CANVAS_ICON_SVG)
    this.registerView(VIEW_TYPE_OPEN_CANVAS, (leaf) => new OpenCanvasView(leaf))

    this.addRibbonIcon(OPEN_CANVAS_ICON, 'Open Canvas', () => {
      void this.activateView()
    })

    this.addCommand({
      id: 'open-canvas',
      name: 'Open Canvas',
      callback: () => {
        void this.activateView()
      },
    })
  }

  async onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_OPEN_CANVAS)
  }

  private async activateView() {
    const existingLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_OPEN_CANVAS)
    if (existingLeaves.length > 0) {
      this.app.workspace.revealLeaf(existingLeaves[0])
      return
    }

    const leaf = this.app.workspace.getLeaf(true)
    await leaf.setViewState({ type: VIEW_TYPE_OPEN_CANVAS, active: true })
    this.app.workspace.revealLeaf(leaf)
  }
}
