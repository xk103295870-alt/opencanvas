import { ItemView, Plugin, type WorkspaceLeaf } from 'obsidian'
import { createRoot, type Root } from 'react-dom/client'
import App from './App'
import './index.css'
import './obsidian.css'

const VIEW_TYPE_OPEN_CANVAS = 'open-canvas-view'

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
    return 'layout-dashboard'
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
    this.registerView(VIEW_TYPE_OPEN_CANVAS, (leaf) => new OpenCanvasView(leaf))

    this.addRibbonIcon('layout-dashboard', 'Open Canvas', () => {
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
