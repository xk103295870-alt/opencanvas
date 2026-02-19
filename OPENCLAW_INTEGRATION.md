# OpenClaw 对接参数说明

## 1. 网关参数（OpenClaw 侧）

根据现有 OpenClaw Assistant 实现，连接参数优先级如下：

1. 环境变量
- `OPENCLAW_GATEWAY_URL`（如 `ws://localhost:18789`）
- `OPENCLAW_GATEWAY_PORT`
- `OPENCLAW_GATEWAY_TOKEN`
- `OPENCLAW_SESSION_KEY`（单会话）
- `OPENCLAW_SESSION_KEYS`（多会话轮转，逗号分隔）

2. 本地配置文件
- `~/.openclaw/openclaw.json`
- 读取字段：`gateway.port`、`gateway.auth.token`

## 2. 调 Open Canvas 的方式

Open Canvas Web 已提供两个入口供 OpenClaw 调用：

1. 全局 API（同页面 JS 环境）
- `window.openCanvas.invoke(command)`
- `window.openCanvas.createCard(payload)`
- `window.openCanvas.createGrid(payload)`
- `window.openCanvas.updateCard(payload)`
- `window.openCanvas.getState()`

2. `postMessage` 桥接（跨窗口/WebView）
- 发送：
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

- 回执（消息源窗口会收到）：
```js
{
  source: 'open-canvas',
  type: 'open-canvas.result',
  result: {
    ok: true,
    requestId: 'req-001',
    message: 'Card created',
    data: { cardId: '...', gridId: '...' }
  }
}
```

## 3. 命令参数（当前支持）

1. `create-grid`
```ts
{
  type: 'create-grid',
  requestId?: string,
  payload?: { name?: string; activate?: boolean }
}
```

2. `create-card`
```ts
{
  type: 'create-card',
  requestId?: string,
  payload?: {
    kind?: 'note'|'hint'|'image'|'video'|'pdf'|'todo'|'calendar',
    gridId?: string,
    title?: string,
    content?: string,
    x?: number,
    y?: number,
    width?: number,
    height?: number,
    activateGrid?: boolean,
    fileName?: string,
    mediaUrl?: string,
    todoItems?: Array<string|{text:string,done?:boolean}>,
    calendar?: {
      monthCursor?: string,
      selectedDate?: string,
      viewMode?: 'month'|'week',
      draftTitle?: string,
      draftAllDay?: boolean,
      draftStartTime?: string,
      draftEndTime?: string,
      events?: Array<{
        title: string,
        date?: string,
        allDay?: boolean,
        startTime?: string,
        endTime?: string
      }>
    }
  }
}
```

3. `update-card`
```ts
{
  type: 'update-card',
  requestId?: string,
  payload: {
    cardId: string,
    title?: string,
    content?: string,
    x?: number,
    y?: number,
    width?: number,
    height?: number
  }
}
```

4. `append-note`
```ts
{
  type: 'append-note',
  requestId?: string,
  payload: { cardId: string, text: string }
}
```

5. `get-state`
```ts
{ type: 'get-state', requestId?: string }
```

## 4. OpenClaw 工作流建议

1. 先通过 OpenClaw 的 `canvas.navigate` 打开 Open Canvas 页面。
2. 用 `canvas.eval` 或同等 JS 注入方式执行 `window.openCanvas.createCard(...)`。
3. 若需可靠交付，使用 `requestId`，并监听 `open-canvas.result` 回执确认是否创建成功。
