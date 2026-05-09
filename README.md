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
- **择校目标看板**：文件名或路径包含 **`择校目标`**（例如 `考研择校/择校目标.md`）时，在 **预览 / 分栏** 右侧根据正文中的 **`## 11408` / `## 22408`** 章节及下方 Markdown **表格**（列含院校、专业方向、目标分数等）自动生成卡片与条形对比；编辑模式下顶部提示切换预览查看看板
- **Random drill（错题本 + 二刷计划）**：合并扫描「文件名含 **错题** 的 `.md`」与「路径含 **`二刷计划`** 的 `.md`」（`## 题目 n：`）。两种模式：**① 勾选「文件内刷题」** → 仅从下拉选的 **某一个二刷 `.md`** 抽题（不含错题本），路径记在 **`smr-quiz-second-plan-focus`**；**② 不勾选** → **来源**（错题本/二刷）+ **文件夹**（第一层目录）+ **科目**（固定 **概率论 / 高数 / 线性代数**，并与题库「`- 科目：`」合并去重；多选 **命中其一**，并与文件夹条件 **同时满足**）。勾选状态 **`smr-quiz-file-only`**。底部计时 + 做对/做错 → **`smr-quiz-log`**。**答案区仍隐藏**
- **刷题数据看板**：顶栏「刷题数据」读取浏览器 **`localStorage`** 中的 **`smr-quiz-log`**，汇总总题次、正确率、平均用时、来源（错题本 / 二刷）、文件夹与科目 Top、最近约 30 条记录；与随机刷题遮罩可同时打开时，看板在上层；**Esc** 优先关闭看板
- **学习路径看板**：顶栏「学习路径」展示蜿蜒路径至终点；节点可点击标记完成（**`smr-plan-path-done`**）。可选在 **`学习计划路径.md`**（文件名含「学习计划路径」）中用 **`smr-plan-path`** JSON 自定义节点
- **周进度与奖励**：顶栏「周进度」根据「学习进度」数据计算 **0–100% 综合分**，在本地 **`smr-progress-snapshots`** 中按日记录快照；**最近 7 天**内「窗口内首次与末次快照」之差为本周推进；若 **≥ 10 个百分点** 则提示 **吃饭奖励**。另统计 **`周期记录/YYYY-MM-DD.md`** 周报覆盖天数（与日报文件对应，非从正文解析）
- **学习进度看板**：顶栏「学习进度」。**数学**：在打开的文件夹中读取 **`Math.mdc`**（常见路径 `学习资料/MDC归档/科目目录/Math.mdc`），解析 **高等数学 / 线性代数 / 概率论** 目录下的章节；每科两条进度：**红书基础篇**、**严选题**，值为「已过章节数」。**408**：读取 **`408.mdc`**，单科 **基础进度** 对应「第 n 章」。**英语** / **政治** 同前述。**数据**：`周期记录/学习进度.md` 内 **`smr-progress`** 与 **`smr-study-progress`**；无目录文件时按内置章数估算。多遮罩时后开的在上层，**Esc** 先关最上层
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
├─ electron/                 # Main + preload（侧栏扫描会忽略 `软件/`、`md-reader-app` 等目录）
├─ src/
│   ├─ App.jsx               # 顶栏、侧栏、随机刷题与各看板入口
│   ├─ markdownQuiz.js     # 错题 / 二刷题库与随机刷题
│   ├─ schoolTargets.js    # 择校目标 Markdown 解析
│   ├─ SchoolTargetsDashboard.jsx
│   ├─ quizLogAnalytics.js # 刷题日志聚合
│   ├─ QuizStatsDashboard.jsx
│   ├─ studyCatalog.js     # Math.mdc / 408.mdc 章节目录解析
│   ├─ studyProgress.js    # 学习进度 JSON ↔ Markdown（`smr-progress`）
│   ├─ StudyProgressDashboard.jsx
│   ├─ studyPlanPath.js    # 学习路径节点（`smr-plan-path`）
│   ├─ StudyPathDashboard.jsx
│   ├─ progressScore.js    # 综合进度分（与看板同一数据源）
│   ├─ progressSnapshots.js # 日快照 + 周报区间统计
│   ├─ WeeklyProgressDashboard.jsx
│   └─ storageKeys.js      # `smr-*` localStorage 键名
├─ public/
├─ dist/
└─ package.json
```

### Companion files in your Study folder (outside this repo)

When you open the **Study** root as the app folder, typical paths are:

- `周期记录/学习进度.md` — progress data in a **`smr-progress`** fenced block
- `周期记录/学习计划路径.md` — optional **`smr-plan-path`** nodes for the path dashboard
- `学习资料/MDC归档/科目目录/Math.mdc` and `408.mdc` — chapter lists for the progress dashboard

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
