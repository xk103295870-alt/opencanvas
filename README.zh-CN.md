# Open Canvas

Open Canvas 是一个本地优先的画布工作区，支持便利贴、待办、日历和媒体卡片。它可以作为浏览器应用配合本地 API/CLI 使用，也可以作为 Obsidian 原生插件直接运行。

## 给客户下载 Obsidian 插件

客户可以从 GitHub Releases 下载打包好的 Obsidian 插件：

- 最新版本：https://github.com/xk103295870-alt/opencanvas/releases/latest
- 插件压缩包：`open-canvas-obsidian-plugin.zip`

Obsidian 插件版本是自包含的。客户在 Obsidian 里使用时，**不需要启动后端服务**，也不需要运行：

```bash
npm run dev
npm run api:dev
open-canvas start
```

这些命令只用于开发、浏览器版本、或者未来 CLI/API 联动场景。

## Obsidian 安装方式

1. 从最新 Release 下载 `open-canvas-obsidian-plugin.zip`。
2. 打开你的 Obsidian vault 文件夹。
3. 如果没有插件目录，创建：

```text
<你的 Vault>/.obsidian/plugins/open-canvas/
```

4. 把 zip 内容直接解压到这个目录里。最终结构应该是：

```text
<你的 Vault>/.obsidian/plugins/open-canvas/
  manifest.json
  main.js
  styles.css
  ai-sticky-notes-logo.svg
  favicon.ico
  icon-192.png
  icon-256.png
  icon-512.png
```

注意：不是把 `dist-obsidian` 文件夹整个放进去，而是把里面的文件放到 `open-canvas/` 目录下。

5. 重启 Obsidian，或者关闭再开启第三方插件。
6. 进入 **设置 → 第三方插件**，找到 **Open Canvas** 并启用。
7. 通过左侧图标或命令面板里的 **Open Canvas** 打开画布。

## 这是什么

你可以把它理解成一套“能画、能写、能被本地工具调用”的工作区：

- 浏览器里直接操作画布
- Obsidian 内直接打开原生画布视图
- 本地 Node API 保留账号、API Key、卡片和工作区接口，方便未来 CLI/AI 联动
- CLI 可以一条命令启动 Web + API 开发/浏览器版本

## 主要能力

- 便利贴、待办卡片、日历卡片、媒体卡片
- 待办卡和日历卡按 grid 固定为一张
- 卡片拖拽、缩放、编辑、删除后可持久化
- 默认免登录本地模式
- 日历“今天”高亮跟随本地日期自动刷新
- Obsidian 原生插件构建产物
- 本地 API 与 API Key 接口保留，便于未来扩展 CLI 模式 AI 交互

## 浏览器 / CLI 快速启动

开发或浏览器版本使用：

```bash
npm install
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

## 构建 Obsidian 插件

```bash
npm run build:obsidian
cp manifest.json dist-obsidian/manifest.json
```

产物在 `dist-obsidian/`。

## 打包 Obsidian 插件 zip

```bash
npm run build:obsidian
cp manifest.json dist-obsidian/manifest.json
mkdir -p release
cd dist-obsidian
zip -r ../release/open-canvas-obsidian-plugin.zip .
```

## CLI 命令

- `open-canvas start` 启动 Web + API
- `open-canvas start --no-open` 启动但不自动打开浏览器
- `open-canvas status` 查看运行状态
- `open-canvas update` 在线更新
- `open-canvas stop` 停止服务

## 开发命令

- `npm run build`
- `npm run build:obsidian`
- `npm run icons:generate`
- `npm run lint`
- `npm run preview`

## 文档

- [API 参考](./API_REFERENCE.md)
