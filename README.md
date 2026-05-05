# Canvas Workbench

[中文文档 / Chinese README](./README.zh-CN.md)

Canvas Workbench is a local-first canvas workspace for Obsidian. It includes built-in todos, schedule management, sticky notes, calendar cards, and media cards.

It can be used directly as a native Obsidian plugin. The plugin is self-contained: users do **not** need to start a backend service to open it inside Obsidian.

## Download for Obsidian

Download the packaged Obsidian plugin from GitHub Releases:

- Latest release: https://github.com/xk103295870-alt/Canvas-Workbench/releases/latest
- Plugin zip: `canvas-workbench-obsidian-plugin.zip`

## Install in Obsidian

1. Download `canvas-workbench-obsidian-plugin.zip` from the latest release.
2. Open your Obsidian vault folder.
3. Create this folder if it does not exist:

```text
<Your Vault>/.obsidian/plugins/canvas-workbench/
```

4. Extract the zip contents directly into that folder. The final structure should look like:

```text
<Your Vault>/.obsidian/plugins/canvas-workbench/
  manifest.json
  main.js
  styles.css
  ai-sticky-notes-logo.svg
  favicon.ico
  icon-192.png
  icon-256.png
  icon-512.png
```

Do not put the whole `dist-obsidian` folder inside the plugin folder. Put the files inside `dist-obsidian` directly into `.obsidian/plugins/canvas-workbench/`.

5. Restart Obsidian, or disable and re-enable community plugins.
6. Go to **Settings → Community plugins**, find **Canvas Workbench**, and enable it.
7. Use the left ribbon W icon or the command palette command **Canvas Workbench** to open the workspace.

## Features

- Sticky note cards
- Todo cards with To-do / Doing / Done lanes
- Calendar cards with month and week views
- Schedule/event management
- Media cards for images, videos, and PDFs
- Card dragging, resizing, editing, minimizing, and delete confirmation
- Collapsible sidebar
- Local SQLite database shared by Web, Obsidian, and CLI
- Local API status button in the top toolbar
- Data Management tools inside Settings for local database reload/import
- CLI commands for writing notes, todos, calendar events, and grids
- API-key interfaces retained for future CLI/AI integration

## Does it require a backend service?

No for normal Obsidian-only usage. Canvas Workbench opens directly inside Obsidian without requiring the user to manually start:

```bash
npm run dev
npm run api:dev
canvas-workbench start
```

For CLI / AI-agent workflows, the Local API is used as the shared local database gateway. The Obsidian plugin can start/check the Local API from the UI, and the top toolbar shows the current Local API status.

## Local API, SQLite, and Data Management

Canvas Workbench uses a local SQLite database for Web / Obsidian / CLI synchronization:

```text
.runtime/canvas-workbench.db
```

Default Local API URL:

```text
http://127.0.0.1:8799
```

When the Local API is online, CLI writes go through the API into SQLite. Open Web / Obsidian windows receive `workspace.updated` events and pull the latest workspace automatically.

The top toolbar shows a Local API status action:

- `Connect Local API` / `连接本地 API`: offline or not checked; click to start/connect.
- `Checking Local API` / `检测本地 API`: startup or health check in progress.
- `Local API Online` / `本地 API 在线`: connected.

Manual database fallback tools are inside **Settings → Data Management**:

- Reload from local database
- Import current canvas into local database

## Browser / CLI Quick Start

For development or browser/API usage:

```bash
npm install
canvas-workbench start
```

If you want to run the web app and API separately:

```bash
npm run api:dev
npm run dev
```

## CLI

Service management:

- `canvas-workbench start`
- `canvas-workbench start --no-open`
- `canvas-workbench status`
- `canvas-workbench update`
- `canvas-workbench stop`

Canvas data commands:

```bash
canvas-workbench grid list
canvas-workbench grid add "Product Planning"
canvas-workbench note add "Meeting summary" --title "Meeting" --grid "Product Planning"
canvas-workbench todo add "Prepare homepage copy" --status doing --tag plan --grid "Product Planning"
canvas-workbench calendar event add "Design review" --date 2026-05-01 --time 11:00 --end 12:00 --grid "Product Planning"
```

Notes:

- CLI data commands require the Local API to be running/online. In Obsidian, click the top toolbar Local API status button (`Connect Local API` / `连接本地 API`) before using CLI or agent writes.
- Todo status values: `todo`, `doing`, `done`.
- Todo tag values: `event`, `feature`, `important`, `plan`, `bug`, `idea`.
- Calendar timed events use `--time` and `--end`.
- CLI-created note/todo/calendar cards default to the canvas center.
- Commands also accept `--api-url <url>` and `--api-key <key>` when needed.

## Claude Skill for CLI / agent writing

A packaged Claude Skill is provided for other agents to quickly write data into Canvas Workbench through the CLI:

- Skill package: [`release/canvas-workbench-cli.skill`](./release/canvas-workbench-cli.skill)
- Recommended location in Obsidian docs: `工作室产品文档/Canvas Workbench/canvas-workbench-cli.skill`
- Markdown copy: `工作室产品文档/Canvas Workbench/Canvas Workbench CLI Skill.md`

Use this Skill when an agent needs to add notes, todos, calendar events, or project records into Canvas Workbench. The Local API must be online before the Skill/CLI can write data.

## Development

```bash
npm install
npm run build
npm run build:obsidian
npm run lint
npm run icons:generate
```

## Build the Obsidian plugin

```bash
npm run build:obsidian
cp manifest.json dist-obsidian/manifest.json
```

The output is generated in `dist-obsidian/`.

## Package the Obsidian plugin zip

```bash
npm run build:obsidian
cp manifest.json dist-obsidian/manifest.json
mkdir -p release
cd dist-obsidian
zip -r ../release/canvas-workbench-obsidian-plugin.zip .
```

## Documentation

- 中文说明: [README.zh-CN.md](./README.zh-CN.md)
- API reference: [API_REFERENCE.md](./API_REFERENCE.md)
