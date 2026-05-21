# Drillly · 做题本

Study 工作台子应用：**PDF → LLM → 练习 → 导出 Markdown**。

## 快速开始

```powershell
cd D:\Study
.\启动Study.ps1
# 或双击 启动Study.bat
```

或分别启动：

```powershell
# API（首次自动 venv + pip + 示例题）
cd drillly\api
.\run.bat

# Web
cd drillly\web
npm install
npm run dev
```

| 服务 | 地址 |
|------|------|
| 练习页 | http://localhost:5212 |
| PDF 导入 | http://localhost:5212/import |
| API 文档 | http://127.0.0.1:5213/docs |

## 目录

```
drillly/
├── api/          FastAPI + SQLite
└── web/          Vite + React
```

## 环境变量

复制 `api/.env.example` → `api/.env`，填入 `TONGYI_API_KEY` / `DEEPSEEK_API_KEY`（不填则用 **mock** 解析）。

Windows 代码题 C/C++：设置 `MINGW_BIN=C:\msys64\ucrt64\bin`。

## 与 Study 联动

- 导出：`GET /api/practice/export/markdown/` → 可保存到 `学习资料/做题/export/`
- 规格：[`需求与规格汇总.md`](../需求与规格汇总.md)

## PDF 收件箱（批量）

把 PDF 放入 **`学习资料/做题/PDF待导入/`**，打开 Drillly → **PDF 导入** → **一键处理全部**。  
通义 Key 在 **设置** 页配置（写入 `api/data/settings.json` + `api/.env`，重启仍有效）。

## 与 md-reader-app 同步

- 练习页 **「同步到 Reader」** → 导出 `学习资料/做题/同步错题/Drillly导入-日期.md`（`### 题目：` 错题本格式）
- 视频进度仍由 **video-dash** 写 `学习资料/学习视频进度/`，Reader 看板读取

## 已实现（M0+）

- 单选 / 多选 / 代码题（代码区默认 textarea，可点「加载完整编辑器」）
- 本机运行 Python / Java / C / C++
- 提交记录、草稿画板（localStorage）
- PDF 拆分、mock/通义/DeepSeek 解析、入库
- 分类 / 标签筛选、Markdown/ZIP 导出
