---
name: canvas-workbench-cli
description: Use this skill whenever the user wants to write notes, todos, calendar events, project ideas, meeting summaries, bugs, plans, or other structured work data into Canvas Workbench through the local CLI or Local API. This is especially relevant when the user mentions Canvas Workbench, canvas-workbench, Obsidian workbench, local canvas, CLI data entry, agent-to-workbench logging, creating cards, adding todos, adding calendar events, or choosing a grid. Prefer this skill over generic shell advice whenever the task is to put information into the user's Canvas Workbench.
---

# Canvas Workbench CLI Data Entry

Use this skill to help an agent write information into the user's Canvas Workbench local workspace through the `canvas-workbench` CLI. The goal is to turn natural-language work artifacts into the correct CLI calls without needing the agent to rediscover command syntax.

## Mental model

Canvas Workbench stores data as:

```text
Workspace → Grid → Card → Card content
```

The CLI talks to the Local API, which writes to the local SQLite database:

```text
.runtime/canvas-workbench.db
```

When the Web or Obsidian UI is open, the Local API broadcasts `workspace.updated` events. The UI should pull the latest state automatically, so agents usually do not need to tell the user to manually upload/download after a CLI write.

Default Local API:

```text
http://127.0.0.1:8799
```

## Important: Local API must be online

CLI data-writing commands require the Canvas Workbench Local API to be running and online. Before writing notes, todos, calendar events, or grids, make sure one of these is true:

- In Obsidian, Canvas Workbench is open and the top toolbar Local API status shows `本地 API 在线` / `Local API Online`.
- If it is offline, click the top toolbar button `连接本地 API` / `Connect Local API` first.
- Outside Obsidian, start the service with:

```bash
canvas-workbench start
```

If a CLI write fails because the Local API is unavailable, do not retry blindly. Tell the user to start/connect the Local API, then run the command again.

## Quick command reference

```bash
canvas-workbench grid list
canvas-workbench grid add "产品规划"
canvas-workbench note add "记录内容" --title "标题" --grid "产品规划"
canvas-workbench todo add "任务内容" --status doing --tag feature --grid "产品规划"
canvas-workbench calendar event add "会议标题" --date 2026-05-01 --time 10:00 --end 11:00 --grid "产品规划"
canvas-workbench flow add "事件流标题" --grid "产品规划"
canvas-workbench dashboard add "销售数据卡片" --option ./sales-option.json --prompt "根据虚拟销售数据生成趋势图" --generated-by claude-code --grid "AI区"
cat ./sales-option.json | canvas-workbench dashboard add "销售数据卡片" --stdin --grid "AI区"
```

All write commands can accept:

```bash
--grid <grid-name-or-id>
--api-url <url>
--api-key <key>
```

Normally omit `--api-url` and `--api-key` unless the user gives custom values.

## Before writing data

1. If the user names a target grid, use `--grid "name"`.
2. If the user does not name a grid but asks to organize data into a project area, create or use a reasonable grid name.
3. If uncertain which grids exist, run:

```bash
canvas-workbench grid list
```

4. If the user asks for a new grid, run:

```bash
canvas-workbench grid add "Grid Name"
```

5. Do not directly edit the SQLite database. Use the CLI or Local API.

## Notes

Use notes for freeform information: summaries, ideas, meeting notes, research snippets, decisions, logs, and context dumps.

```bash
canvas-workbench note add "内容"
canvas-workbench note add "内容" --title "标题"
canvas-workbench note add "内容" --title "标题" --grid "Grid Name"
```

Examples:

```bash
canvas-workbench note add "今天完成了 Local API SQLite 同步和 CLI 居中创建修复。" --title "开发日志" --grid "产品规划"
canvas-workbench note add "用户反馈：CLI 创建卡片不能落在左上角，应该默认居中。" --title "用户反馈" --grid "Canvas Workbench"
```

Behavior:

- Creates a `note` card.
- Default card size is `340 x 280`.
- CLI-created note cards default to the canvas center.

## Todos

Use todos for actionable work items. A todo command appends one item to a Todo card in the target grid. If that grid has no Todo card, the CLI creates one automatically.

```bash
canvas-workbench todo add "任务内容"
canvas-workbench todo add "任务内容" --status todo
canvas-workbench todo add "任务内容" --status doing
canvas-workbench todo add "任务内容" --status done
canvas-workbench todo add "任务内容" --tag important
canvas-workbench todo add "任务内容" --status doing --tag feature --grid "Grid Name"
```

Allowed statuses:

```text
todo | doing | done
```

Allowed tags:

```text
event | feature | important | plan | bug | idea
```

Important: use `--status`, not `--lane`.

Examples:

```bash
canvas-workbench todo add "补充 Canvas Workbench CLI 文档" --status doing --tag plan --grid "Canvas Workbench"
canvas-workbench todo add "修复 CLI 创建卡片仍落到左上角的问题" --status done --tag bug --grid "Canvas Workbench"
```

Behavior:

- Finds the target grid's existing Todo card.
- Creates a Todo card if none exists.
- New Todo card size defaults to `760 x 430`.
- CLI-created Todo cards default to the canvas center.
- Appends the new item into `todoItems` and patches the card.

## Calendar events

Use calendar events for meetings, milestones, reminders, scheduled tasks, deadlines, or dates.

```bash
canvas-workbench calendar event add "事件标题"
canvas-workbench calendar event add "事件标题" --date 2026-05-01
canvas-workbench calendar event add "事件标题" --date 2026-05-01 --time 10:00 --end 11:00
canvas-workbench calendar event add "全天事项" --date 2026-05-01 --all-day
canvas-workbench calendar event add "事件标题" --grid "Grid Name"
```

Date and time rules:

- `--date` format: `YYYY-MM-DD`
- `--time` format: `HH:MM`
- `--end` format: `HH:MM`
- Timed events need both `--time` and `--end`.
- Use `--time`, not `--start`.
- If no date is supplied, the CLI uses today's local date.

Examples:

```bash
canvas-workbench calendar event add "产品评审" --date 2026-05-01 --time 10:00 --end 11:00 --grid "产品规划"
canvas-workbench calendar event add "提交 Obsidian 官方插件材料" --date 2026-05-03 --all-day --grid "Canvas Workbench"
```

Behavior:

- Finds the target grid's existing Calendar card.
- Creates a Calendar card if none exists.
- New Calendar card size defaults to `480 x 560`.
- CLI-created Calendar cards default to the canvas center.
- Appends the event into `calendar.events` and patches the card.

## Event flows

Use event flows for process design, workflow mapping, decision trees, or step-by-step diagrams.

```bash
canvas-workbench flow add "事件流标题"
canvas-workbench flow add "事件流标题" --grid "Grid Name"
```

Examples:

```bash
canvas-workbench flow add "用户注册流程" --grid "产品规划"
canvas-workbench flow add "订单处理状态机" --grid "Canvas Workbench"
```

Behavior:

- Creates an `eventFlow` card with a default start node.
- New Event Flow card size defaults to `760 x 480`.
- CLI-created Event Flow cards default to the canvas center.
- The user can then expand nodes and connect edges in the UI.

## Dashboards / ECharts data cards

Use data cards for AI-generated data visualizations. The intended workflow is natural language → external AI/agent → JSON-only ECharts option → `canvas-workbench dashboard add` → Canvas Workbench data card.

Canvas Workbench does not need an AI API key for this. The external agent is responsible for understanding the natural-language request, inventing or transforming data, choosing chart types, and producing valid ECharts option JSON. Canvas Workbench only stores and renders the option.

```bash
canvas-workbench dashboard add "看板标题" --option ./option.json --grid "AI区"
canvas-workbench dashboard add "看板标题" --option ./option.json --data ./source-data.json --prompt "自然语言需求" --generated-by claude-code --grid "AI区"
cat ./option.json | canvas-workbench dashboard add "看板标题" --stdin --prompt "自然语言需求" --generated-by claude-code --grid "AI区"
```

Option requirements:

- The option must be a plain JSON-compatible ECharts option object.
- Do not use JavaScript functions, formatter callbacks, event handlers, or runtime code.
- If `series` exists, it must be an array.
- Keep the serialized option under 512 KiB.
- Prefer `backgroundColor: "transparent"` and dark-background-friendly colors.
- For multiple dashboards, vary chart types when useful: line/bar combo, donut/pie, radar, heatmap, funnel, scatter, gauge, etc.
- Use `--prompt` to preserve the user's natural-language requirement.
- Use `--generated-by` to record the producing agent or CLI.

Example natural-language request an agent should be able to satisfy:

```text
帮我在 AI区 生成 5 个虚拟电商数据卡片：销售趋势组合图、渠道占比环形图、门店能力雷达图、时段活跃热力图、转化路径漏斗图。输出合法 ECharts option JSON，不要使用 JS 函数，适配深色背景，并用 canvas-workbench dashboard add 写入。
```

Behavior:

- Creates a `dashboard` card.
- Default data card size is `760 x 480`.
- CLI-created data cards default to the canvas center.
- The dashboard is persisted in SQLite and live UIs should refresh through Local API events.
- If Local API is offline and the command fails with `fetch failed`, ask the user to connect/start Local API first.

## Grid selection patterns

When the user says things like:

- “写到 Canvas Workbench 项目里”
- “放到产品规划画布”
- “记录到 Bug 区”
- “把这个任务加入 Obsidian 插件项目”

Prefer adding `--grid "..."`. If a grid might not exist, run `canvas-workbench grid add "..."` first; it is safe because existing grids are reused by name.

Examples:

```bash
canvas-workbench grid add "Canvas Workbench"
canvas-workbench todo add "整理 CLI Skill" --status doing --tag feature --grid "Canvas Workbench"
```

## Safety and etiquette

- Do not delete or mutate existing cards unless the user explicitly asks.
- Do not directly open or modify `.runtime/canvas-workbench.db` for normal writes.
- Do not expose API keys in responses. If the user supplied one, use it in the command but redact it in summaries.
- Quote user-provided text and grid names in shell commands.
- Prefer one CLI call per note/todo/event so failures are easy to understand.
- For large batches, group commands by grid and summarize what was written.

## Reporting back to the user

After running commands, summarize briefly:

```text
已写入 Canvas Workbench：
- Grid: Canvas Workbench
- Note: 开发日志
- Todo: 修复 CLI 创建卡片位置，status=done, tag=bug
- Calendar: 产品评审，2026-05-01 10:00-11:00
- Event Flow: 用户注册流程
```

If the Local API is not running, suggest starting it:

```bash
canvas-workbench start
```

or, if the user is using Obsidian, ask them to ensure the Canvas Workbench plugin / Local API is running.

## Common mistakes to avoid

- Do not use `--lane`; use `--status`.
- Do not use `--start`; use `--time`.
- Do not assume `state`, `note list`, `todo list`, or `calendar event list` exist yet.
- Do not tell the user to manually sync unless live Local API sync appears unavailable.
