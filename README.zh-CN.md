# Open Canvas

Open Canvas 是一个基于浏览器的画布工作区，支持本地 API、`open-canvas` CLI 启动器，以及和 OpenClaw 的 Skill / API 对接。

## 这是什么

你可以把它理解成一套“能画、能写、能同步、能被 Agent 调用”的工作区：

- 浏览器里直接操作画布
- 本地 Node API 负责账号、API Key、卡片和工作区数据
- CLI 可以一条命令启动整个产品
- OpenClaw 可以通过 Skill 调用 API，自动创建和更新卡片

## 主要能力

- 便利贴、待办卡片、日历卡片、媒体卡片
- 卡片拖拽、缩放、编辑、删除后可持久化
- 本地状态 + 远端状态同步
- API Key 方式对接 OpenClaw
- git 安装场景下支持原地在线更新

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

## CLI 命令

- `open-canvas start` 启动 Web + API
- `open-canvas start --no-open` 启动但不自动打开浏览器
- `open-canvas status` 查看运行状态
- `open-canvas update` 在线更新
- `open-canvas stop` 停止服务

## OpenClaw 对接

如果你要让 OpenClaw / Agent 自动联动，推荐按下面流程：

1. 在设置里登录账号
2. 生成 API Key
3. 复制 `Skill JSON`
4. 在 OpenClaw 中导入 Skill
5. 之后就可以通过 API 自动创建、更新、删除卡片

相关说明见：

- [OpenClaw 对接说明](./OPENCLAW_INTEGRATION.md)
- [API 参考](./API_REFERENCE.md)

## 开发命令

- `npm run build`
- `npm run lint`
- `npm run smoke:api`
- `npm run preview`

## 文档

- 英文入口：[`README.md`](./README.md)
- API 说明：[`API_REFERENCE.md`](./API_REFERENCE.md)
- OpenClaw 对接：[`OPENCLAW_INTEGRATION.md`](./OPENCLAW_INTEGRATION.md)

