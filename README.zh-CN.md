# Canvas Workbench

Canvas Workbench 是一个本地优先的 Obsidian 画布工作台，内置代办、日程管理、便利贴、日历卡片和媒体卡片等功能。

它可以作为 Obsidian 原生插件直接运行。插件本身是自包含的，客户在 Obsidian 里使用时，**不需要启动后端服务**。

## 下载 Obsidian 插件

客户可以从 GitHub Releases 下载打包好的 Obsidian 插件：

- 最新版本：https://github.com/xk103295870-alt/Canvas-Workbench/releases/latest
- 插件压缩包：`canvas-workbench-obsidian-plugin.zip`

## 在 Obsidian 中安装

1. 从最新 Release 下载 `canvas-workbench-obsidian-plugin.zip`。
2. 打开你的 Obsidian vault 文件夹。
3. 如果没有插件目录，创建：

```text
<你的 Vault>/.obsidian/plugins/canvas-workbench/
```

4. 把 zip 内容直接解压到这个目录里。最终结构应该是：

```text
<你的 Vault>/.obsidian/plugins/canvas-workbench/
  manifest.json
  main.js
  styles.css
  ai-sticky-notes-logo.svg
  favicon.ico
  icon-192.png
  icon-256.png
  icon-512.png
```

注意：不是把 `dist-obsidian` 文件夹整个放进去，而是把里面的文件放到 `canvas-workbench/` 目录下。

5. 重启 Obsidian，或者关闭再开启第三方插件。
6. 进入 **设置 → 第三方插件**，找到 **Canvas Workbench** 并启用。
7. 通过左侧 W 图标或命令面板里的 **Canvas Workbench** 打开工作台。

## 主要功能

- 便利贴卡片
- 待办卡片，支持 To-do / Doing / Done 看板列
- 日历卡片，支持月视图和周视图
- 日程 / 事件管理
- 图片、视频、PDF 媒体卡片
- 卡片拖拽、缩放、编辑、最小化和删除确认
- 左侧边栏可收起 / 展开
- Web / Obsidian / CLI 共用的本地 SQLite 数据库
- 顶部工具栏显示本地 API 连接状态
- 设置里的数据管理工具，支持本地数据库重新加载 / 导入
- CLI 支持写入便利贴、待办、日历事件、事件流、图片和数据卡片
- 数据卡片支持由外部 AI / CLI 根据自然语言需求生成 ECharts option JSON 后写入，无需在 Canvas Workbench 内配置 AI API Key
- 保留 API Key 接口，方便后续扩展 CLI / AI 联动

## 是否需要启动后端服务？

普通 Obsidian 插件使用不需要手动启动后端服务。Canvas Workbench 可以直接在 Obsidian 内打开，不需要用户手动运行：

```bash
npm run dev
npm run api:dev
canvas-workbench start
```

如果要使用 CLI / AI 智能体写入能力，则会使用 Local API 作为共享本地数据库入口。Obsidian 插件可以从界面里启动 / 检测 Local API，顶部工具栏会显示当前 Local API 状态。

## Local API、SQLite 与数据管理

Canvas Workbench 使用本地 SQLite 数据库同步 Web / Obsidian / CLI 数据：

```text
.runtime/canvas-workbench.db
```

默认 Local API 地址：

```text
http://127.0.0.1:8799
```

Local API 在线时，CLI 会通过 API 写入 SQLite。打开中的 Web / Obsidian UI 会收到 `workspace.updated` 事件，并自动拉取最新工作区。

顶部工具栏显示本地 API 状态按钮：

- `连接本地 API`：离线或未检测，点击后启动 / 连接本地 API。
- `检测本地 API`：正在启动或检测。
- `本地 API 在线`：已连接。

手动兜底工具放在 **设置 → 数据管理**：

- 从本地数据库重新加载
- 导入当前画布到本地数据库

## 浏览器 / CLI 快速启动

开发或浏览器版本使用：

```bash
npm install
canvas-workbench start
```

如果你想手动分别启动前端和 API：

```bash
npm run api:dev
npm run dev
```

## CLI 命令

服务管理：

- `canvas-workbench start` 启动 Web + API
- `canvas-workbench start --no-open` 启动但不自动打开浏览器
- `canvas-workbench status` 查看运行状态
- `canvas-workbench update` 在线更新
- `canvas-workbench stop` 停止服务

画布数据写入：

```bash
canvas-workbench grid list
canvas-workbench grid add "产品规划"
canvas-workbench note add "会议总结" --title "会议" --grid "产品规划"
canvas-workbench todo add "准备首页文案" --status doing --tag plan --grid "产品规划"
canvas-workbench calendar event add "设计评审" --date 2026-05-01 --time 11:00 --end 12:00 --grid "产品规划"
canvas-workbench dashboard add "销售数据卡片" --option ./sales-option.json --prompt "根据虚拟销售数据生成趋势图和渠道占比" --generated-by claude-code --grid "AI区"
cat ./sales-option.json | canvas-workbench dashboard add "销售数据卡片" --stdin --grid "AI区"
canvas-workbench image add "./generated.png" --title "Generated concept" --grid "AI区"
```

### 数据卡片与自然语言生成

数据卡片的推荐工作流是“自然语言给外部 AI，AI 生成 ECharts option JSON，CLI 写入 Canvas Workbench”：

```text
自然语言需求 → 外部 AI / 智能体 → ECharts option JSON → canvas-workbench dashboard add → 数据卡片
```

Canvas Workbench 本身不内置 AI 调用，也不要求配置 AI API Key。自然语言理解、虚拟数据构造、图表类型选择和 option JSON 生成由 Claude Code、ChatGPT、Gemini、Cursor、Codex 等外部 AI / CLI 智能体完成；Canvas Workbench 负责接收 JSON、保存到本地数据库并渲染 ECharts 看板。

给 AI 的数据卡片生成要求：

- 输出合法的 ECharts `option` JSON 对象。
- JSON 必须可序列化，不要使用 JS 函数、formatter callback、事件 handler 或运行时代码。
- `series` 存在时必须是数组。
- option 文件建议小于 512 KiB。
- 图表应适配深色背景，建议使用 `backgroundColor: "transparent"`。
- 多个看板应该选择不同展示类型，例如折线 / 柱状组合图、环形图、雷达图、热力图、漏斗图。
- 用 `--prompt` 记录自然语言需求，用 `--generated-by` 记录生成来源。

示例自然语言需求：

```text
帮我在 AI区 生成 5 个虚拟电商数据卡片：
1. 销售额和订单数趋势，折线 + 柱状组合图
2. 渠道来源占比，环形图
3. 门店能力评分，雷达图
4. 一周各时段活跃度，热力图
5. 用户转化路径，漏斗图
要求输出合法 ECharts option JSON，不要使用 JS 函数，适配深色背景，然后通过 canvas-workbench dashboard add 写入。
```

对应 CLI：

```bash
canvas-workbench dashboard add "销售趋势组合看板" \
  --option ./sales-trend-option.json \
  --prompt "根据虚拟一周销售额和订单数生成组合趋势图" \
  --generated-by claude-code \
  --grid "AI区"
```

说明：

- CLI 数据写入需要先让 Local API 处于运行 / 在线状态。在 Obsidian 中使用前，先点击顶部工具栏的本地 API 状态按钮（`连接本地 API` / `Connect Local API`）。
- Todo 状态可用：`todo`、`doing`、`done`。
- Todo 标签可用：`event`、`feature`、`important`、`plan`、`bug`、`idea`。
- 日历定时事件使用 `--time` 和 `--end`。
- CLI 创建的便利贴、待办、日历、图片、数据卡片默认出现在画布中心。
- 如有需要，命令也支持 `--api-url <url>` 和 `--api-key <key>`。

## Claude Skill：CLI / 智能体写入

项目提供了一个打包好的 Claude Skill，方便其他智能体快速通过 CLI 把数据写入 Canvas Workbench：

- Skill 包：[`release/canvas-workbench-cli.skill`](./release/canvas-workbench-cli.skill)
- 推荐存放位置：`工作室产品文档/Canvas Workbench/canvas-workbench-cli.skill`
- Markdown 说明文档：`工作室产品文档/Canvas Workbench/Canvas Workbench CLI Skill.md`

当智能体需要写入便利贴、待办、日历事件、事件流、图片或 AI 生成的 ECharts 数据卡片时，可以使用这个 Skill。打包 Skill 已包含“自然语言 → 外部 AI / 智能体 → JSON-only ECharts option → `canvas-workbench dashboard add`”工作流说明。使用 Skill / CLI 写入前，需要先确保 Local API 在线。

## 开发命令

```bash
npm install
npm run build
npm run build:obsidian
npm run lint
npm run icons:generate
```

## 构建 Obsidian 插件

```bash
npm run build:obsidian
cp manifest.json dist-obsidian/manifest.json
```

产物在 `dist-obsidian/`。

## 打包 Obsidian 插件 zip

```bash
npm run build:obsidian
cp manifest.json dist-obsidian/manifest.json
mkdir -p release
cd dist-obsidian
zip -r ../release/canvas-workbench-obsidian-plugin.zip .
```

## 文档

- [English README](./README.md)
- [API 参考](./API_REFERENCE.md)
