# OpenClaw 对接参数说明（API 优先）

## 1. 推荐方式：Open Canvas API + Skill

当前推荐用 API 方式对接 OpenClaw。Open Canvas 会为账号生成固定 API Key，再由 OpenClaw Skill 调用。

### 启动方式

1. 启动 API：
```bash
npm run api:dev
```

2. 启动 Web：
```bash
npm run dev
```

### 账号绑定与 Skill 配置

1. 进入设置页，完成登录（演示或 Google）。
2. 点击 “连接 API” 绑定账号到 API 服务器。
3. 点击 “生成 API Key”，再点击 “复制 Skill JSON”。
4. 在 OpenClaw 中创建 Skill，粘贴 JSON 配置即可。

### API 能力

当前 Skill 已开放以下 API：
- `POST /v1/grids` 创建画布
- `POST /v1/cards` 创建卡片（note / hint / image / video / pdf / todo / calendar）
- `PATCH /v1/cards/:cardId` 更新卡片
- `POST /v1/cards/:cardId/append-note` 追加文本
- `GET /v1/state?full=1` 获取全量画布状态
- `GET /v1/config` 获取 API 配置

示例（创建卡片）：
```bash
curl -X POST http://127.0.0.1:8787/v1/cards \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"kind":"note","title":"From OpenClaw","content":"Auto created by API"}'
```

## 2. OpenClaw 网关参数（仍保留）

如果你仍需要对接 OpenClaw 网关（例如现有 OpenClaw Assistant），连接参数优先级如下：

1. 环境变量
- `OPENCLAW_GATEWAY_URL`（如 `ws://localhost:18789`）
- `OPENCLAW_GATEWAY_PORT`
- `OPENCLAW_GATEWAY_TOKEN`
- `OPENCLAW_SESSION_KEY`（单会话）
- `OPENCLAW_SESSION_KEYS`（多会话轮转，逗号分隔）

2. 本地配置文件
- `~/.openclaw/openclaw.json`
- 读取字段：`gateway.port`、`gateway.auth.token`

## 3. Legacy：Web 注入方式（保留但不推荐）

Open Canvas Web 仍保留本地 JS 注入模式，但该方式不适合账号/API-Key 控制。

1. 全局 API（同页面 JS 环境）
- `window.openCanvas.invoke(command)`
- `window.openCanvas.createCard(payload)`
- `window.openCanvas.createGrid(payload)`
- `window.openCanvas.updateCard(payload)`
- `window.openCanvas.getState()`

2. `postMessage` 桥接（跨窗口/WebView）
```js
window.postMessage({
  source: 'openclaw',
  type: 'open-canvas.command',
  command: {
    type: 'create-card',
    requestId: 'req-001',
    payload: {
      kind: 'note',
      title: '来自 OpenClaw',
      content: '自动写入内容',
      x: 220,
      y: 160,
      width: 420,
      height: 300,
      activateGrid: true
    }
  }
}, '*')
```

## 4. 设置面板配置

Open Canvas 的 Settings 中 `OpenClaw 集成` 分组包含两部分：

1. 网关参数（OpenClaw Assistant 侧）
- `gatewayUrl`
- `gatewayPort`
- `gatewayToken`
- `sessionKey`
- `sessionKeys`
- `source`

2. API 账号与 Skill（OpenClaw Skill 侧）
- `API Base URL`
- `API Key`
- “生成 API Key”
- “复制 Skill JSON”

配置会实时持久化，并广播事件：
```js
window.addEventListener('open-canvas:config', (event) => {
  console.log(event.detail.openclaw)
})
```

## 5. 配置命令（Web 注入模式）

`get-config`
```ts
{ type: 'get-config', requestId?: string }
```

`set-config`
```ts
{
  type: 'set-config',
  requestId?: string,
  payload?: Partial<OpenClawConfig>
}
```
