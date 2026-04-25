# Open Canvas

Open Canvas is a local-first canvas workspace for notes, todos, calendar items, and media. It can run as a browser app with a local API/CLI, and it also ships as a native Obsidian plugin.

## Download for Obsidian

Customers can download the packaged Obsidian plugin from GitHub Releases:

- Latest release: https://github.com/xk103295870-alt/opencanvas/releases/latest
- Plugin zip: `open-canvas-obsidian-plugin.zip`

The Obsidian plugin is self-contained. Customers do **not** need to start a backend server, `npm run dev`, or `npm run api:dev` to use it inside Obsidian.

## Install in Obsidian

1. Download `open-canvas-obsidian-plugin.zip` from the latest release.
2. Open your Obsidian vault folder.
3. Create this folder if it does not exist:

```text
<Your Vault>/.obsidian/plugins/open-canvas/
```

4. Extract the zip contents directly into that folder. The final structure should look like:

```text
<Your Vault>/.obsidian/plugins/open-canvas/
  manifest.json
  main.js
  styles.css
  ai-sticky-notes-logo.svg
  favicon.ico
  icon-192.png
  icon-256.png
  icon-512.png
```

5. Restart Obsidian, or disable and re-enable community plugins.
6. Go to **Settings → Community plugins**, find **Open Canvas**, and enable it.
7. Use the ribbon icon or command palette command **Open Canvas** to open the workspace.

## Documentation

- Chinese README: [README.zh-CN.md](./README.zh-CN.md)
- API reference: [API_REFERENCE.md](./API_REFERENCE.md)

## Browser / CLI Quick Start

For development or browser/API usage:

```bash
npm install
open-canvas start
```

If you want to run the pieces separately:

```bash
npm run api:dev
npm run dev
```

## CLI

- `open-canvas start`
- `open-canvas start --no-open`
- `open-canvas status`
- `open-canvas update`
- `open-canvas stop`

## Features

- Multi-card canvas for notes, todos, calendar items, and media
- Todo and calendar cards are singleton per grid
- Local persistence with workspace sync
- Native Obsidian plugin build
- No-login local mode by default
- Local API and API-key interfaces retained for future CLI/AI integration
- In-place update flow for git installs

## Development

- `npm run build`
- `npm run lint`
- `npm run build:obsidian`
- `npm run icons:generate`

## Package the Obsidian plugin

```bash
npm run build:obsidian
cp manifest.json dist-obsidian/manifest.json
mkdir -p release
cd dist-obsidian
zip -r ../release/open-canvas-obsidian-plugin.zip .
```
