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
- Local persistence by default
- No-login local mode
- Native Obsidian plugin build
- Local API and API-key interfaces retained for future CLI/AI integration

## Does it require a backend service?

No. When used as an Obsidian plugin, Canvas Workbench runs directly inside Obsidian and does **not** require:

```bash
npm run dev
npm run api:dev
canvas-workbench start
```

Those commands are only for development, browser usage, or future CLI/API integration.

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

- `canvas-workbench start`
- `canvas-workbench start --no-open`
- `canvas-workbench status`
- `canvas-workbench update`
- `canvas-workbench stop`

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
