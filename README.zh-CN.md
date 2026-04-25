# Open Canvas

Open Canvas 是一个画布工作区，支持浏览器运行、本地 API、`open-canvas` CLI 启动器，以及 Obsidian 原生插件构建。

## 这是什么

你可以把它理解成一套“能画、能写、能被本地工具调用”的工作区：

- 浏览器里直接操作画布
- 本地 Node API 负责账号、API Key、卡片和工作区数据
- CLI 可以一条命令启动整个产品
- Obsidian 插件可以在 vault 内打开原生画布视图

## 主要能力

- 便利贴、待办卡片、日历卡片、媒体卡片
- 待办卡和日历卡按 grid 固定为一张
- 卡片拖拽、缩放、编辑、删除后可持久化
- 本地状态持久化
- git 安装场景下支持原地在线更新
- Obsidian 原生插件构建产物

## 快速启动

先安装依赖：

```bash
npm install
```

推荐直接用 CLI 启动：

```bash
open-canvas start
```

如果你不想自动打开浏览器：

```bash
open-canvas start --no-open
```

如果你想手动分别启动前端和 API：

```bash
npm run api:dev
npm run dev
```

## Obsidian 插件

构建插件产物：

```bash
npm run build:obsidian
```

产物在 `dist-obsidian/`，复制到 vault 的 `.obsidian/plugins/open-canvas/` 后启用插件。

## CLI 命令

- `open-canvas start` 启动 Web + API
- `open-canvas start --no-open` 启动但不自动打开浏览器
- `open-canvas status` 查看运行状态
- `open-canvas update` 在线更新
- `open-canvas stop` 停止服务

## 开发命令

- `npm run build`
- `npm run build:obsidian`
- `npm run lint`
- `npm run preview`

## 文档

- [API 参考](./API_REFERENCE.md)
