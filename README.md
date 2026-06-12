# Study 学习工作台

考研复习资料、周期日报、408/英语错题与 Study 套件配置。本仓库根目录同时包含 **Study Markdown Reader** 桌面/浏览器应用源码。

| 目录 | 说明 |
|------|------|
| `学习资料/` | 笔记、错题本、截图、二刷计划 |
| `周期记录/` | 每日复习日报 |
| `src/` · `electron/` | Markdown Reader（本仓库） |
| `video-dash/` | 视频进度看板（独立 Git：[video-dash](https://github.com/yhtttt050723/video-dash)） |
| `drillly/` | 刷题应用（独立 Git：[Drillly-for-11408](https://github.com/yhtttt050723/Drillly-for-11408)） |
| `Start-Study.ps1` | 一键启动套件 |

端口见 `study-suite.ports.json`。

---

# Study Markdown Reader

A local Markdown reader and editor designed for study workflows, with support for `.md` / `.mdc` browsing, editing, saving, and template-based quick input.

## Features

- **启动首页**：首次进入为工作区选择页（**Markdown 浏览器** / **学习笔记** / **进度中心**），上次选择记在 **`smr-app-section`**
- **学习笔记**：独立速记本（多页、Markdown 编辑/预览），数据在 **`smr-quick-notes`**；可选连接 **PostgreSQL + pgvector** 个人知识库
- **进度中心**：学习进度、**视频进度**、本周进度、路径、练习统计、记账等看板
- Open a local folder and auto-scan `.md` / `.mdc` files
- Three modes: Edit / Preview / Split view
- **Random drill**（错题本 + 二刷计划）、**练习统计**、**学习路径**、**周进度与奖励**
- **视频进度看板**：读取 `学习资料/学习视频进度/视频进度看板数据.md` 内 **`smr-video-progress`**
- Supports both Electron desktop mode and browser-compatible mode

## Tech Stack

- Electron · React · Vite · Marked

## Run Locally

```bash
npm install
npm run dev
```

`npm run dev` 会同时启动 Vite 并打开 Electron 桌面窗口。仅调试前端时用 `npm run dev:web`（默认 http://localhost:5210）。

知识库：`npm run kb:pg` → `npm run kb:serve`，详见 `kb-server/README.md`。

## Build (Windows)

```bash
npm run pack:win
```

输出：`release/Study Markdown Reader 0.0.0.exe`

## Design system

根目录 **`DESIGN.md`** 为 Notion 风格界面规范。

## Companion files in your Study folder

- `周期记录/学习进度.md` — **`smr-progress`**
- `周期记录/学习计划路径.md` — optional **`smr-plan-path`**
- `学习资料/MDC归档/科目目录/Math.mdc` and `408.mdc`

## License

MIT
