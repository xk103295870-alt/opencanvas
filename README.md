# Open Canvas

Open Canvas is a browser-based canvas workspace with a local API, CLI launcher, and Obsidian plugin build.

## Documentation

- Chinese README: [README.zh-CN.md](./README.zh-CN.md)
- API reference: [API_REFERENCE.md](./API_REFERENCE.md)

## Quick Start

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
- Obsidian native plugin build
- In-place update flow for git installs

## Development

- `npm run build`
- `npm run lint`
- `npm run build:obsidian`
