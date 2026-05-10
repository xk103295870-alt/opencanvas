import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const readmeZh = readFileSync(new URL('../README.zh-CN.md', import.meta.url), 'utf8')
const apiReference = readFileSync(new URL('../API_REFERENCE.md', import.meta.url), 'utf8')
const cliSkill = readFileSync(new URL('../skills/canvas-workbench-cli/SKILL.md', import.meta.url), 'utf8')

test('Chinese README documents natural-language AI to ECharts dashboard workflow', () => {
  assert.match(readmeZh, /自然语言需求 → 外部 AI \/ 智能体 → ECharts option JSON → canvas-workbench dashboard add → 数据看板卡片/)
  assert.match(readmeZh, /Canvas Workbench 本身不内置 AI 调用，也不要求配置 AI API Key/)
  assert.match(readmeZh, /不要使用 JS 函数、formatter callback、事件 handler 或运行时代码/)
  assert.match(readmeZh, /用 `--prompt` 记录自然语言需求，用 `--generated-by` 记录生成来源/)
})

test('API reference documents dashboard card payload requirements', () => {
  assert.match(apiReference, /- `dashboard`/)
  assert.match(apiReference, /dashboard\.option` is required for rendering and must be a JSON-compatible ECharts option object/)
  assert.match(apiReference, /Do not include JavaScript functions, formatter callbacks, event handlers, or runtime code/)
  assert.match(apiReference, /natural-language request -> external AI\/agent creates ECharts option JSON/)
})

test('CLI skill documents dashboard natural-language generation requirements', () => {
  assert.match(cliSkill, /Use dashboard cards for AI-generated data visualizations/)
  assert.match(cliSkill, /natural language → external AI\/agent → JSON-only ECharts option → `canvas-workbench dashboard add`/)
  assert.match(cliSkill, /Canvas Workbench does not need an AI API key for this/)
  assert.match(cliSkill, /Do not use JavaScript functions, formatter callbacks, event handlers, or runtime code/)
})
