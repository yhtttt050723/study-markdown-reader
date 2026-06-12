# 个人知识库 API（PostgreSQL + pgvector）

供「学习笔记」同步：一级/二级标签、重点程度、关键词、向量近邻二次划分。

## 1. 启动数据库

在仓库根目录（`md-reader-app/`），**须先保证 Docker 引擎在运行**（Windows：打开 **Docker Desktop**，等到托盘图标就绪）：

```bash
npm run kb:pg
```

或：

```bash
docker compose -f docker-compose.kb.yml up -d
```

默认端口 **5433**（避免与本机已有 Postgres 冲突）。

### 故障排除（Windows）

| 现象 | 原因 |
|------|------|
| `unable to get image ... failed to connect to the docker API` / `dockerDesktopLinuxEngine` | **Docker Desktop 未启动或未安装**。请先启动 Docker Desktop，再执行 `npm run kb:pg`。 |
| `ECONNREFUSED 127.0.0.1:5433`（运行 `kb-server` 时） | 上面 Compose **没成功**，本机 **5433 上没有 Postgres**。先修好 Docker 并拉起容器，再 `npm run kb:serve`。 |

若不使用 Docker：在本机安装 **PostgreSQL** 并安装 **pgvector** 扩展，创建库与用户后设置 `DATABASE_URL`，再启动 `kb-server`。

## 2. 安装并启动 API

本机默认库地址已写在 `db.mjs`（与 compose 用户 **`studykb`**、端口 **5433** 一致），一般 **无需设置 `DATABASE_URL`**：

```bash
cd kb-server
npm install
npm start
```

可选：`set KB_PORT=3847`（默认即 3847）。  
可选：`set OPENAI_API_KEY=...` — 同步时勾选「重建向量」会写入 `embedding`，`/api/notes/:id/refine` 才能做近邻建议。

### 本机 Ollama（通义 Qwen，无需 Key）

先在本机运行 **`ollama serve`**（通常开机自启），并已 **`ollama pull`** 模型（如 **`qwen2.5:3b`**）。

| 环境变量 | 默认 | 说明 |
|----------|------|------|
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama API 根地址 |
| `OLLAMA_MODEL` | `qwen2.5:3b` | 用于 **`POST /api/llm/suggest-tags`** 的对话模型 |

健康检查 **`GET /api/health`** 会包含 `ollama: true/false`（探测 `/api/tags`）。  
学习笔记内 **「本地模型生成标签」** 即调用上述接口，把 JSON 建议写入表单后再由用户同步到 PostgreSQL。

或在应用仓库根目录：`npm run kb:serve`（同上）。

## 3. 前端联调（仅本机）

- **`npm run dev`**：`vite.config.js` 把 `/api` 代理到 **`http://127.0.0.1:3847`**，前端 **不用配环境变量**。
- **打包版 Electron**：从 `file://` 加载时，前端默认请求 **`http://127.0.0.1:3847`**（与本服务一致）。
- 若需改端口或远程 API：构建前设置 **`VITE_KB_API_URL`**（极少数场景）。

## 4. 流程说明

1. **Skill（Cursor）**：先根据正文给出 `tagL1` / `tagL2` / `importance` / `keywords`（见 `.cursor/skills/note-knowledge-tagging/SKILL.md`）。
2. **本机 Ollama**：同上字段可由 **`POST /api/llm/suggest-tags`** 自动生成（见 `.cursor/skills/ollama-qwen-local-notes/SKILL.md`）。
3. **PGVector**：同步到库并（可选）用 OpenAI 生成 embedding 后，调用 **向量二次划分** 接口，用同 `tag_l1` 下近邻 refine `tag_l2`、`vector_cluster`。
