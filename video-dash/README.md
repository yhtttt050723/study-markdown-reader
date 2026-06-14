# video-dash · B 站视频学习看板

本地 **B 站分 P 进度看板**：粘贴 BV 链接 → 拉取分 P 与时长 → 勾选已看 → 顶部 KPI 汇总。可与 [Study](https://github.com/yhtttt050723) 工作台联动，将进度写回 `学习资料/学习视频进度/`，供 Markdown Reader 读取。

```
BV 链接 ──► 分 P 列表 + 时长 ──► 勾选已看 ──► KPI / 科目分类
                    │
                    └── 同步到 Study 文件夹 → BV*.md + 视频进度看板数据.md
```

## 功能概览

| 模块 | 能力 |
|:---|:---|
| **进度管理** | 多 BV 系列；分 P 表格勾选；全稿 / 已看时长与占比 KPI |
| **分类** | 按 **科目**（408 四科 / 数学 / 英语等）与 **类型**（教学 / 题目讲解）筛选 |
| **持久化** | 浏览器 `localStorage`（键名 `video-dash-series-v1`） |
| **Study 同步** | 绑定本地文件夹，写回 `BV*-video-dash.md` 与 `视频进度看板数据.md` |
| **B 站 API** | 开发环境 Vite 代理 `/bili` → `api.bilibili.com`，规避 CORS |

## 环境要求

- **Node.js** 18+
- 现代浏览器（Chrome / Edge 等，Study 同步需 File System Access API）

## 快速开始

### 1. 克隆

```bash
git clone git@github.com:yhtttt050723/video-dash.git
cd video-dash
```

### 2. 安装并启动

```bash
npm install
npm run dev
```

| 服务 | 地址 |
|:---|:---|
| 看板页 | http://localhost:5211 |

默认端口 **5211**（Study 套件端口段 `5210–5214`）。可通过环境变量 `STUDY_VIDEO_PORT` 覆盖。

### 3. 使用

1. 在输入框粘贴含 BV 的链接，例如：  
   `https://www.bilibili.com/video/BV1Q4iJBAEsr`
2. 点击 **拉取分 P**，在表格中勾选已看完的分 P
3. 顶部 KPI 卡片会更新汇总时长与占比

## 与 Study 工作台联动

1. 页面 **Study 文件夹同步** 面板 → 选择目录 `学习资料/学习视频进度`
2. 勾选进度后点 **同步到文件夹**，会更新或创建：
   - `BVxxxx-video-dash.md`（分 P checklist）
   - `视频进度看板数据.md`（含 `smr-video-progress` JSON，Reader 看板读取）

若 `video-dash` 位于 Study 仓库内，也可从 Study 根目录一键启动：

```powershell
.\启动Study.ps1
# 或 启动Study.bat
```

## 离线脚本（Study 仓库内）

从 Study 根目录重建看板数据（扫描已有 `BV*.md`）：

```bash
node video-dash/scripts/rebuild-video-progress-board.mjs
```

## 生产构建

```bash
npm run build
npm run preview
```

`preview` 仅静态预览。**生产环境**若仍从浏览器直连 B 站 API，需配置与开发相同的同源代理（见 `vite.config.ts` 中 `server.proxy`），或改为自有后端转发 `pagelist`。

## 常见问题

| 现象 | 处理 |
|:---|:---|
| 拉取失败 / 403 | 重启 `npm run dev`；代理已设置浏览器 UA / Referer |
| BV 拉不到 | 核对 BV 号是否与地址栏一致（易混淆 `I` / `l` / `1`） |
| 同步无写入 | 确认已授权文件夹写入；路径选对 `学习视频进度` |

## 目录结构

```
video-dash/
├── src/
│   ├── api/           B 站 pagelist 请求
│   ├── components/    KPI、系列看板、Study 同步面板
│   ├── lib/           Markdown 同步、看板 JSON、科目分类
│   └── stores/        Zustand 持久化状态
├── scripts/           看板重建、分类标签工具
└── vite.config.ts     开发代理与端口
```

## 技术栈

- Vite 8 + React 19 + TypeScript
- Tailwind CSS v4
- TanStack Query / Table
- Zustand + persist

## 许可证

个人学习项目，按需自用与二次开发。

## 仓库

https://github.com/yhtttt050723/video-dash
