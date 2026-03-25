# OpenClaw 对接参数说明（API 优先）

## 1. 推荐方式：Open Canvas API + Skill

当前推荐用 API 方式对接 OpenClaw。Open Canvas 会为账号生成固定 API Key，再由 OpenClaw Skill 调用。

### 启动方式

1. 推荐一键启动（同时启动 Web + API）：
```bash
open-canvas start
```

2. 如果你只想后台启动但不自动打开浏览器：
```bash
open-canvas start --no-open
```

3. 仍可手动启动 API：
```bash
npm run api:dev
```

4. 手动启动 Web：
```bash
npm run dev
```

5. 在线更新（原地升级）：
```bash
open-canvas update
```

### 另一台电脑安装 CLI

如果你想在另一台电脑上直接装出同样的 `open-canvas` 命令：

```bash
npm install -g git+https://github.com/xk103295870-alt/opencanvas.git
```

或者使用仓库里的安装脚本：

```bash
bash scripts/install-open-canvas.sh
```

Windows PowerShell：

```powershell
./scripts/install-open-canvas.ps1
```

### 账号绑定与 Skill 配置

1. 进入设置页，完成登录（演示或 Google）。
2. 点击 “连接 API” 绑定账号到 API 服务器。
3. 点击 “生成 API Key”，再点击 “复制 Skill JSON”。
4. 在 OpenClaw 中创建 Skill，粘贴 JSON 配置即可。

### API 能力

当前 Skill 已开放以下 API（标准前缀）：
- `POST /api/v1/grids` 创建画布
- `POST /api/v1/cards` 创建卡片（note / hint / image / video / pdf / todo / calendar，可选传入 `id`；todo / calendar 在每个 grid 内仅保留一张）
- `PATCH /api/v1/cards/:cardId` 更新卡片
- `DELETE /api/v1/cards/:cardId` 删除卡片
- `POST /api/v1/cards/:cardId/append-note` 追加文本
- `GET /api/v1/state?full=1` 获取全量画布状态
- `GET /api/v1/config` 获取 API 配置

固定卡规则：

- `note` 可以无限创建。
- `todo` 和 `calendar` 是每个 grid 的固定卡片。
- 如果目标 grid 已经有同类卡片，`POST /api/v1/cards` 会复用现有卡片。
- 更新固定卡请用 `PATCH /api/v1/cards/:cardId`。

卡片写法建议：

- `note`：标题短一点，正文写完整内容。
- `todo`：把任务条目写进 `todoItems`，不要把清单直接塞进 `content`。
- `calendar`：把事件写进 `calendar.events`，不要把事件列表直接塞进 `content`。
- 如果要做增量补充，优先用 `append-note`。

示例（创建卡片）：
```bash
curl -X POST http://127.0.0.1:8787/api/v1/cards \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"kind":"note","title":"From OpenClaw","content":"Auto created by API"}'
```

响应格式（标准路由）：
- 成功：`{ "data": ... , "meta"?: {...} }`
- 失败：`{ "error": { "code": "...", "message": "...", "details"?: ... } }`

兼容说明：
- 仅保留标准路径 `/api/v1/*`
- 旧路径 `/v1/*` 已移除

## 2. OpenClaw 网关参数（旧版兼容）

如果你仍需要对接旧版 OpenClaw 网关（例如现有 OpenClaw Assistant），连接参数优先级如下：

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

Open Canvas 的 Settings 里现在只保留真正需要的配置：

1. 账号区
- `Google Client ID`（用于 Google 快捷登录）

2. API 账号与 Skill（OpenClaw Skill 侧）
- `API Base URL`
- `API 服务状态（在线/离线）`
- `API Key`
- “生成 API Key”
- “复制 Skill JSON”

3. 高级项
- `openclaw.json` 配置片段
- 如果你需要手动维护 OpenClaw / moltbot 配置，再展开这块

4. 维护 / 更新
- 当前版本
- 在线更新按钮
- 仅适用于 git 仓库安装
- 有本地改动时先提交或暂存，再执行更新

旧网关字段已从主设置页收起，仅保留兼容说明。

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
