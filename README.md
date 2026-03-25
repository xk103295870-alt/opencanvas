# Open Canvas

Open Canvas is a browser-based canvas workspace with a local API, CLI launcher, and OpenClaw integration.

## Documentation

- Chinese README: [README.zh-CN.md](./README.zh-CN.md)
- API reference: [API_REFERENCE.md](./API_REFERENCE.md)
- OpenClaw setup: [OPENCLAW_INTEGRATION.md](./OPENCLAW_INTEGRATION.md)

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
- Local persistence with workspace sync
- API key-based OpenClaw integration
- In-place update flow for git installs

## Development

- `npm run build`
- `npm run lint`
- `npm run smoke:api`
