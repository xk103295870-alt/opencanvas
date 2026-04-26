import { ItemView, Plugin, addIcon, type WorkspaceLeaf } from 'obsidian'
import { createRoot, type Root } from 'react-dom/client'
import App from './App'
import './index.css'
import './obsidian.css'

const VIEW_TYPE_CANVAS_WORKBENCH = 'canvas-workbench-view'
const CANVAS_WORKBENCH_ICON = 'canvas-workbench-logo'
const CANVAS_WORKBENCH_ICON_SVG = '<svg viewBox="0 0 256 256" width="100" height="100" preserveAspectRatio="xMidYMid meet"><rect x="18" y="18" width="220" height="220" rx="42" fill="currentColor"/><path d="M62 77H86.5L100.5 163H102.5L116.5 103H140L154 163H156L170 77H194.5L171.5 179H139.5L128.5 128.5H127.5L116.5 179H84.5L62 77Z" fill="var(--background-primary, #050505)"/></svg>'

class CanvasWorkbenchView extends ItemView {
  private root: Root | null = null

  constructor(leaf: WorkspaceLeaf) {
    super(leaf)
  }

  getViewType() {
    return VIEW_TYPE_CANVAS_WORKBENCH
  }

  getDisplayText() {
    return 'Canvas Workbench'
  }

  getIcon() {
    return CANVAS_WORKBENCH_ICON
  }

  async onOpen() {
    const container = this.containerEl.children[1]
    container.empty()
    container.addClass('canvas-workbench-obsidian-view')

    const mountEl = container.createDiv({ cls: 'canvas-workbench-obsidian-root' })
    this.root = createRoot(mountEl)
    this.root.render(<App runtime="obsidian" />)
  }

  async onClose() {
    this.root?.unmount()
    this.root = null
  }
}

export default class CanvasWorkbenchPlugin extends Plugin {
  async onload() {
    addIcon(CANVAS_WORKBENCH_ICON, CANVAS_WORKBENCH_ICON_SVG)
    this.registerView(VIEW_TYPE_CANVAS_WORKBENCH, (leaf) => new CanvasWorkbenchView(leaf))

    this.addRibbonIcon(CANVAS_WORKBENCH_ICON, 'Canvas Workbench', () => {
      void this.activateView()
    })

    this.addCommand({
      id: 'canvas-workbench',
      name: 'Canvas Workbench',
      callback: () => {
        void this.activateView()
      },
    })
  }

  async onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_CANVAS_WORKBENCH)
  }

  private async activateView() {
    const existingLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CANVAS_WORKBENCH)
    if (existingLeaves.length > 0) {
      this.app.workspace.revealLeaf(existingLeaves[0])
      return
    }

    const leaf = this.app.workspace.getLeaf(true)
    await leaf.setViewState({ type: VIEW_TYPE_CANVAS_WORKBENCH, active: true })
    this.app.workspace.revealLeaf(leaf)
  }
}
