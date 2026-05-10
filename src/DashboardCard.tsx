import { useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts'
import type { DashboardState } from './shared/workspaceTypes'
import { validateDashboardOption } from './dashboardOption'

type DashboardCardProps = {
  dashboard?: DashboardState
  title: string
}

function shortErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message.slice(0, 120)
  return '请检查 option JSON'
}

export function DashboardCard({ dashboard, title }: DashboardCardProps) {
  const chartRef = useRef<HTMLDivElement | null>(null)
  const instanceRef = useRef<echarts.ECharts | null>(null)

  const validation = useMemo(() => validateDashboardOption(dashboard?.option), [dashboard?.option])
  const generatedBy = dashboard?.generatedBy?.trim()
  const updatedAt = dashboard?.updatedAt?.trim()
  const footer = generatedBy && updatedAt ? `${generatedBy} · ${updatedAt}` : generatedBy || updatedAt || ''

  useEffect(() => {
    const container = chartRef.current
    if (!container || !validation.ok) return undefined

    const chart = echarts.init(container, undefined, { renderer: 'canvas' })
    instanceRef.current = chart

    const existingOverlay = container.parentElement?.querySelector('.dashboard-card-overlay')
    existingOverlay?.remove()

    try {
      chart.setOption(validation.option, true)
    } catch (error) {
      const overlay = document.createElement('div')
      overlay.className = 'dashboard-card-state dashboard-card-state-error dashboard-card-overlay'
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
      container.parentElement?.querySelector('.dashboard-card-overlay')?.remove()
      chart.dispose()
      if (instanceRef.current === chart) instanceRef.current = null
    }
  }, [validation])

  if (!dashboard?.option) {
    return (
      <section className="dashboard-card-frame" aria-label={title || '数据看板'}>
        <div className="dashboard-card-header">
          <span>{title || '数据看板'}</span>
        </div>
        <div className="dashboard-card-state">
          <strong>等待图表配置</strong>
          <span>请通过 CLI 写入 ECharts option</span>
        </div>
      </section>
    )
  }

  if (!validation.ok) {
    return (
      <section className="dashboard-card-frame" aria-label={title || '数据看板'}>
        <div className="dashboard-card-header">
          <span>{title || '数据看板'}</span>
        </div>
        <div className="dashboard-card-state dashboard-card-state-error">
          <strong>{validation.message}</strong>
          <span>{validation.detail || '请检查 option JSON'}</span>
        </div>
      </section>
    )
  }

  return (
    <section className="dashboard-card-frame" aria-label={title || '数据看板'}>
      <div className="dashboard-card-header">
        <span>{title || '数据看板'}</span>
      </div>
      <div className="dashboard-card-viewport">
        <div ref={chartRef} className="dashboard-chart" />
      </div>
      {footer ? <div className="dashboard-card-footer">{footer}</div> : null}
    </section>
  )
}
