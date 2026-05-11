import { useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import * as echarts from 'echarts'
import type { DashboardState } from './shared/workspaceTypes'
import { validateDashboardOption } from './dashboardOption'

type DashboardCardProps = {
  dashboard?: DashboardState
  title: string
  onOpenInspect?: () => void
  onStartDrag?: (event: ReactPointerEvent<HTMLElement>) => void
}

function shortErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message.slice(0, 120)
  return '请检查 option JSON'
}

function DashboardShell({
  title,
  meta,
  onOpenInspect,
  onStartDrag,
  children,
}: {
  title: string
  meta: string
  onOpenInspect?: () => void
  onStartDrag?: (event: ReactPointerEvent<HTMLElement>) => void
  children: ReactNode
}) {
  return (
    <section className="dashboard-card-frame is-previewing" aria-label={title || '数据卡片'}>
      <div className="dashboard-card-topbar" onPointerDown={(event) => onStartDrag?.(event)}>
        <span className="dashboard-card-name">{title || '数据卡片'}</span>
      </div>
      <div className="dashboard-card-preview" onPointerDown={(event) => onStartDrag?.(event)}>{children}</div>
      <div className="dashboard-card-menu">
        <span className="dashboard-card-menu-meta">{meta}</span>
        <button type="button" className="dashboard-open-inspector" onClick={onOpenInspect}>
          查看 / 交互
        </button>
      </div>
    </section>
  )
}

export function DashboardCard({ dashboard, title, onOpenInspect, onStartDrag }: DashboardCardProps) {
  const chartRef = useRef<HTMLDivElement | null>(null)
  const instanceRef = useRef<echarts.ECharts | null>(null)

  const validation = useMemo(() => validateDashboardOption(dashboard?.option), [dashboard?.option])
  const generatedBy = dashboard?.generatedBy?.trim()
  const updatedAt = dashboard?.updatedAt?.trim()
  const meta = generatedBy && updatedAt ? `${generatedBy} · ${updatedAt}` : generatedBy || updatedAt || ''

  useEffect(() => {
    const container = chartRef.current
    if (!container || !validation.ok) return undefined

    const chart = echarts.init(container, undefined, { renderer: 'canvas' })
    instanceRef.current = chart

    const existingOverlay = container.parentElement?.querySelector('.dashboard-render-error')
    existingOverlay?.remove()

    try {
      chart.setOption(validation.option, true)
    } catch (error) {
      const overlay = document.createElement('div')
      overlay.className = 'dashboard-card-message dashboard-card-message-error dashboard-render-error'
      const heading = document.createElement('strong')
      heading.textContent = '图表渲染失败'
      const detail = document.createElement('span')
      detail.textContent = shortErrorMessage(error)
      overlay.append(heading, detail)
      container.parentElement?.append(overlay)
    }

    const resizeObserver = new ResizeObserver(() => {
      chart.resize()
    })
    resizeObserver.observe(container)
    chart.resize()

    return () => {
      resizeObserver.disconnect()
      container.parentElement?.querySelector('.dashboard-render-error')?.remove()
      chart.dispose()
      if (instanceRef.current === chart) instanceRef.current = null
    }
  }, [validation])

  let preview: ReactNode

  if (!dashboard?.option) {
    preview = (
      <div className="dashboard-card-message">
        <strong>等待图表配置</strong>
        <span>请通过 CLI 写入 ECharts option</span>
      </div>
    )
  } else if (!validation.ok) {
    preview = (
      <div className="dashboard-card-message dashboard-card-message-error">
        <strong>{validation.message}</strong>
        <span>{validation.detail || '请检查 option JSON'}</span>
      </div>
    )
  } else {
    preview = <div ref={chartRef} className="dashboard-chart" aria-hidden="true" />
  }

  return (
    <DashboardShell title={title} meta={meta} onOpenInspect={onOpenInspect} onStartDrag={onStartDrag}>
      {preview}
    </DashboardShell>
  )
}
