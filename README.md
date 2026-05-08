# Study Markdown Reader

A local Markdown reader and editor designed for study workflows, with support for `.md` / `.mdc` browsing, editing, saving, and template-based quick input.

## Features

- Open a local folder and auto-scan `.md` / `.mdc` files
- Grouped file tree in the sidebar (filters common noisy folders)
- Three modes: Edit / Preview / Split view
- Keyboard shortcuts:
  - `Ctrl + S` Save
  - `Ctrl + Z` Undo
  - `Ctrl + Y` / `Ctrl + Shift + Z` Redo
- Quick-entry panel (Wrongbook / Daily Report / Day Clear / Weekly Report)
- Wrongbook entries support image-path linking and inline preview in Preview/Split mode
- **Random drill（错题本 + 二刷计划）**：合并扫描「文件名含 **错题** 的 `.md`」与「路径含 **`二刷计划`** 的 `.md`」（`## 题目 n：`）。两种模式：**① 勾选「文件内刷题」** → 仅从下拉选的 **某一个二刷 `.md`** 抽题（不含错题本），路径记在 **`smr-quiz-second-plan-focus`**；**② 不勾选** → **来源**（错题本/二刷）+ **文件夹**（第一层目录）+ **科目**（固定 **概率论 / 高数 / 线性代数**，并与题库「`- 科目：`」合并去重；多选 **命中其一**，并与文件夹条件 **同时满足**）。勾选状态 **`smr-quiz-file-only`**。底部计时 + 做对/做错 → **`smr-quiz-log`**。**答案区仍隐藏**
- In Preview/Split mode, files whose names contain `错题` automatically **hide answer blocks** in the preview pane
- Supports both Electron desktop mode and browser-compatible mode

## Tech Stack

- Electron
- React
- Vite
- Marked

## Run Locally

```bash
npm install
npm run dev
```

## Build (Windows)

```bash
npm run pack:win
```

Build outputs:

- `release/Study Markdown Reader 0.0.0.exe`
- `release/win-unpacked/`

## Project Structure

```text
md-reader-app/
├─ .cursor/rules/       # Cursor：本仓库代码规范 .mdc（改前端/Electron 前必读）
├─ electron/            # Electron main process and preload
├─ src/                 # React app（`markdownQuiz.js` 题库解析、`storageKeys.js` 本地键、`markedConfig.js`）
├─ public/              # Static assets (including app icon)
├─ dist/                # Frontend build output
└─ package.json
```

## Use Cases

- Exam prep / study material management (plans, daily logs, wrongbooks)
- Local knowledge base reading and quick editing
- Template-based records (daily review, weekly report, wrongbook entry)

## Roadmap

- Search by filename/content
- Customizable templates
- Auto-backup and file snapshots
- Dark mode and theme switching

## License

MIT
