import { useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts'
import { validateDashboardOption } from './dashboardOption'
import type { CardData } from './shared/workspaceTypes'

type DashboardInspectModalProps = {
  card: CardData
  onClose: () => void
}

function shortErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message.slice(0, 120)
  return '请检查 option JSON'
}

export function DashboardInspectModal({ card, onClose }: DashboardInspectModalProps) {
  const chartRef = useRef<HTMLDivElement | null>(null)
  const instanceRef = useRef<echarts.ECharts | null>(null)
  const dashboard = card.dashboard

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

  return (
    <div className="dashboard-inspect-overlay" onClick={onClose}>
      <section className="dashboard-inspect-modal" onClick={(event) => event.stopPropagation()} aria-label={card.title || '数据卡片'}>
        <header className="dashboard-inspect-modal-header">
          <div>
            <span>数据卡片</span>
            <strong>{card.title || '数据卡片'}</strong>
          </div>
          <button type="button" className="dashboard-inspect-close" aria-label="关闭数据卡片查看" onClick={onClose}>
            关闭
          </button>
        </header>

        <div className="dashboard-inspect-modal-body">
          {!dashboard?.option ? (
            <div className="dashboard-card-state">
              <strong>等待图表配置</strong>
              <span>请通过 CLI 写入 ECharts option</span>
            </div>
          ) : !validation.ok ? (
            <div className="dashboard-card-state dashboard-card-state-error">
              <strong>{validation.message}</strong>
              <span>{validation.detail || '请检查 option JSON'}</span>
            </div>
          ) : (
            <div ref={chartRef} className="dashboard-inspect-chart" aria-hidden="true" />
          )}
        </div>

        {footer ? <footer className="dashboard-inspect-modal-footer">{footer}</footer> : null}
      </section>
    </div>
  )
}
