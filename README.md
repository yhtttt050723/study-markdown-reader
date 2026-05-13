# Study Markdown Reader

A local Markdown reader and editor designed for study workflows, with support for `.md` / `.mdc` browsing, editing, saving, and template-based quick input.

## Features

- **启动首页**：首次进入为工作区选择页（**Markdown 浏览器** / **学习笔记** / **进度中心**），上次选择记在 **`smr-app-section`**；在 Markdown 浏览器顶栏点 **「返回首页」** 可回到工作区选择（有未保存修改时会确认）；**进度中心**、**学习笔记** 等分区顶栏同样有 **「← 返回首页」**
- **学习笔记**：独立速记本（多页、Markdown 编辑/预览），数据在 **`smr-quick-notes`**，不依赖当前打开的文件夹；**方案 A 分块**：工具栏插入 **`## 📌` 科目块** 与 **fenced 代码块**，右侧 **块大纲**（当前页内 `##` 标题）点击跳转；**编辑区与大纲之间可拖动调比例**（**`smr-notes-editor-ratio`**）；**Electron** 下可在编辑区 **粘贴截图**（落盘 `userData/quick-notes-assets`，正文 **`smr-img://`**）；可选连接 **PostgreSQL + pgvector** 个人知识库（同步笔记、**知识树** 视图、向量二次划分建议）。详见下文 **个人知识库**
- **进度中心**：集中入口打开学习进度、本周进度、路径、练习统计、记账等看板（与顶栏功能一致）
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
- **Random drill（错题本 + 二刷计划）**：合并扫描「文件名含 **错题** 的 `.md`」与「路径含 **`二刷计划`** 的 `.md`」（`## 题目 n：`）。两种模式：**① 勾选「文件内刷题」** → 仅从下拉选的 **某一个二刷 `.md`** 抽题（不含错题本），路径记在 **`smr-quiz-second-plan-focus`**；**② 不勾选** → **来源**（错题本/二刷）+ **文件夹**（第一层目录）+ **科目**（固定 **概率论 / 高数 / 线性代数**，并与题库「`- 科目：`」合并去重；多选 **命中其一**，并与文件夹条件 **同时满足**）。勾选状态 **`smr-quiz-file-only`**。底部计时 + 做对/做错 → 写入 **`smr-quiz-log`**（浏览器仅用 localStorage；**Electron 桌面版**同步写入用户目录 **`userData/smr-quiz-log.json`**，关闭再打开仍保留）。**答案区仍隐藏**
- **练习统计看板**：顶栏「练习统计」读取 **`smr-quiz-log`**（与磁盘 JSON 同步）；汇总总题次、正确率、平均用时、来源（错题本 / 二刷）、文件夹与科目 Top、最近约 30 条记录；与随机练习遮罩可同时打开时，看板在上层；**Esc** 优先关闭看板
- **学习路径看板**：顶栏「学习路径」展示蜿蜒路径至终点；节点可点击标记完成（**`smr-plan-path-done`**）。可选在 **`学习计划路径.md`**（文件名含「学习计划路径」）中用 **`smr-plan-path`** JSON 自定义节点
- **周进度与奖励**：顶栏「本周进度」根据「学习进度」数据计算 **0–100% 综合分**，在本地 **`smr-progress-snapshots`** 中按日记录快照；**最近 7 天**内「窗口内首次与末次快照」之差为本周推进；若 **≥ 10 个百分点** 则提示 **吃饭奖励**。另统计 **`周期记录/YYYY-MM-DD.md`** 周报覆盖天数（与日报文件对应，非从正文解析）
- **学习进度看板**：顶栏「学习进度」。**数学**：在打开的文件夹中读取 **`Math.mdc`**（常见路径 `学习资料/MDC归档/科目目录/Math.mdc`），解析 **高等数学 / 线性代数 / 概率论** 目录下的章节；每科两条进度：**红书基础篇**、**严选题**，值为「已过章节数」；**高数**下另有第三条 **《660》**（`book660Through` / `book660Total`，高数默认总题数 **360**；线代/概率将 `book660Total` 设为 **0** 则隐藏该条）。**408**：读取 **`408.mdc`**，单科 **基础进度** 对应「第 n 章」。**英语** / **政治** 同前述。**数据**：`周期记录/学习进度.md` 内 **`smr-progress`** 与 **`smr-study-progress`**；无目录文件时按内置章数估算。多遮罩时后开的在上层，**Esc** 先关最上层
- **记账与经济状况**：顶栏「记账」打开看板；维护 **当前余额**、可选 **月预算**，记录 **支出流水**（日期、金额、分类、备注）；汇总 **今日 / 近 7 日 / 本月** 支出；可选 **记一笔时从余额扣减**。数据保存在 **`smr-finance-state`**（localStorage）。与其他遮罩并存时 **Esc** 优先关闭最上层（记账为 `z-index: 1002`）
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

知识库 **仅按本机** 使用即可：`Docker`（Postgres **5433**）+ **`kb-server`**（默认 **3847**）。开发时 **`VITE_KB_API_URL` 不必设置**，由 Vite 把 **`/api`** 代理到 `http://127.0.0.1:3847`。打包后的 exe 从本机打开时，会默认请求同一地址（需你已在本机启动 `kb-server`）。

## 个人知识库（PostgreSQL + pgvector，本机）

**一键顺序（在项目根 `md-reader-app/`）**：

```bash
npm run kb:pg
npm run kb:serve
```

另开终端：`npm run dev`（或 `npm run pack:win` 后的 exe）。详细说明见 `kb-server/README.md`。

1. **数据库**（若不用上面的 `kb:pg`，可手动执行）：

   ```bash
   docker compose -f docker-compose.kb.yml up -d
   ```

   账号/库与 compose 一致：**`studykb` / `studykb`**，端口 **5433**。`kb-server` 若不设置 `DATABASE_URL`，会默认连 `postgresql://studykb:studykb@127.0.0.1:5433/studykb`。

2. **API 服务**（若不用 `npm run kb:serve`）：

   ```bash
   cd kb-server
   npm install
   rem DATABASE_URL 可省略（使用上述默认）
   rem 可选：set OPENAI_API_KEY=...  （embedding；无 key 时仅标签树，不做向量 refine）
   npm start
   ```

   端口由 **`KB_PORT`** 控制（默认 **3847**）。

3. **学习笔记内**：先 **同步到知识库**；需要近邻建议时再勾选 **同步时重建向量**。**「向量二次划分」** 在一级标签不变的前提下，按 embedding 建议二级标签、关键词、`vector_cluster`。

4. **本机 Ollama（通义 Qwen）**：保持 **`ollama serve`** 与已拉取的模型（如 `qwen2.5:3b`）后，学习笔记可点 **「本地模型生成标签」**；环境变量见 `kb-server/README.md`（`OLLAMA_BASE_URL` / `OLLAMA_MODEL`，无需 API Key）。

5. **Cursor Skill（第一次打标）**：`.cursor/skills/note-knowledge-tagging/SKILL.md`；若走 Ollama，另见 `.cursor/skills/ollama-qwen-local-notes/SKILL.md`。流程可为 **本地模型或 Skill → 同步 →（可选）向量 refine**。

## Build (Windows)

```bash
npm run pack:win
```

Build outputs:

- `release/Study Markdown Reader 0.0.0.exe`
- `release/win-unpacked/`

## Design system

根目录 **`DESIGN.md`** 为 **Notion 风格** 界面规范（暖中性色、极轻边框、多层弱阴影、单一强调色 **Notion Blue `#0075de`**、Inter 字阶与字重约定等）。实现上将同名语义映射到 **`src/App.css`** 顶部 **`:root`**（如 `--text-primary`、`--surface-muted`、`--accent`、`--shadow-deep`、`--border-whisper`），全应用样式与之对齐。页面通过 **`index.html`** 引入 **Inter** 字体。

若你日后改回带 YAML front matter 的 [design.md](https://github.com/google-labs/code/blob/main/design.md) 格式，可自行跑 `npx @google/design.md lint DESIGN.md` 校验；当前仓库内 `DESIGN.md` 为叙事型规范，以正文为准。

## Project Structure

```text
md-reader-app/
├─ DESIGN.md                 # Notion 风格设计规范（颜色、字阶、组件、阴影）
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
│   ├─ finance.js          # 记账状态读写与区间汇总
│   ├─ FinanceDashboard.jsx
│   ├─ HomeHub.jsx         # 启动首页 · 工作区选择
│   ├─ NotesWorkspace.jsx  # 学习笔记（smr-quick-notes + 可选 KB）
│   ├─ NoteKnowledgeMap.jsx
│   ├─ kbApi.js
│   ├─ ProgressHub.jsx     # 进度中心入口
│   ├─ WorkspaceChrome.jsx # 分区顶栏「返回首页」
│   ├─ quickNotes.js       # 速记持久化
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
