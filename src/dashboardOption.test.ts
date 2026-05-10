import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DASHBOARD_OPTION_MAX_BYTES, validateDashboardOption } from './dashboardOption.ts'

test('validateDashboardOption accepts JSON-compatible ECharts option objects', () => {
  const option = {
    title: { text: '销售趋势' },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: ['一月', '二月'] },
    yAxis: { type: 'value' },
    series: [{ type: 'line', data: [12, 18] }],
  }

  const result = validateDashboardOption(option)

  assert.equal(result.ok, true)
  if (result.ok) assert.deepEqual(result.option, option)
})

test('validateDashboardOption rejects missing option values', () => {
  const result = validateDashboardOption(undefined)

  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.message, '图表配置无效')
})

test('validateDashboardOption rejects non-object roots', () => {
  for (const value of [null, [], 'option', 42, true]) {
    const result = validateDashboardOption(value)
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.message, '图表配置无效')
  }
})

test('validateDashboardOption rejects series when it is not an array', () => {
  const result = validateDashboardOption({ series: { type: 'bar', data: [1, 2] } })

  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.detail, 'series must be an array when present')
})

test('validateDashboardOption rejects non JSON-compatible values', () => {
  const result = validateDashboardOption({ title: { text: 'Bad' }, formatter: () => 'unsafe' })

  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.detail, 'option must be JSON-compatible')
})

test('validateDashboardOption rejects oversized options', () => {
  const result = validateDashboardOption({ title: { text: 'x'.repeat(DASHBOARD_OPTION_MAX_BYTES) } })

  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.detail, `option JSON must be smaller than ${DASHBOARD_OPTION_MAX_BYTES} bytes`)
})
