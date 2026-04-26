# Canvas Workbench

Canvas Workbench 是一个本地优先的 Obsidian 画布工作台，内置代办、日程管理、便利贴、日历卡片和媒体卡片等功能。

它可以作为 Obsidian 原生插件直接运行。插件本身是自包含的，客户在 Obsidian 里使用时，**不需要启动后端服务**。

## 下载 Obsidian 插件

客户可以从 GitHub Releases 下载打包好的 Obsidian 插件：

- 最新版本：https://github.com/xk103295870-alt/Canvas-Workbench/releases/latest
- 插件压缩包：`open-canvas-obsidian-plugin.zip`

## 在 Obsidian 中安装

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
6. 进入 **设置 → 第三方插件**，找到 **Canvas Workbench** 并启用。
7. 通过左侧 W 图标或命令面板里的 **Canvas Workbench** 打开工作台。

## 主要功能

- 便利贴卡片
- 待办卡片，支持 To-do / Doing / Done 看板列
- 日历卡片，支持月视图和周视图
- 日程 / 事件管理
- 图片、视频、PDF 媒体卡片
- 卡片拖拽、缩放、编辑、最小化和删除确认
- 左侧边栏可收起 / 展开
- 默认本地持久化
- 默认免登录本地模式
- Obsidian 原生插件构建
- 保留本地 API 和 API Key 接口，方便未来扩展 CLI / AI 联动

## 是否需要启动后端服务？

不需要。

作为 Obsidian 插件使用时，Canvas Workbench 会直接在 Obsidian 内运行，不需要启动：

```bash
npm run dev
npm run api:dev
open-canvas start
```

这些命令只用于开发、浏览器版本、或者未来 CLI/API 联动场景。

## 浏览器 / CLI 快速启动

开发或浏览器版本使用：

```bash
npm install
open-canvas start
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

## 开发命令

```bash
npm install
npm run build
npm run build:obsidian
npm run lint
npm run icons:generate
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

## 文档

- [English README](./README.md)
- [API 参考](./API_REFERENCE.md)
