# Study 工作台

个人考研与学习资料仓库 **`d:\Study`** 上的**多应用联动**方案：以 **Markdown 文件**为数据总线，多个本地 Web / Electron 应用分工协作。

## 应用一览

| 应用 | 目录 | 端口 | 职责 |
|------|------|------|------|
| **Study Markdown Reader** | `md-reader-app/` | **5210** | 主入口：读 `学习资料/`、**进度中心**（学习进度 / **个人状态** / **进度规划** 可勾选写回 md）、错题刷题等 |
| **video-dash** | `video-dash/` | **5211** | B 站合集分 P 勾选；写回 `学习资料/学习视频进度/*.md` |
| **Drillly 做题本** | `drillly/api` + `drillly/web` | Web **5212** · API **5213** | PDF→LLM 出题、练习、代码运行、导出 MD |
| **kb-server**（可选） | `md-reader-app/kb-server/` | **5214** | 笔记向量知识库（需 `-WithKb`） |

端口定义见 [`study-suite.ports.json`](study-suite.ports.json)。

## 一键启动（根目录统一入口）

**双击** [`Start-Study.bat`](Start-Study.bat)（推荐，避免中文文件名编码问题）或 [`启动Study.bat`](启动Study.bat)，或在 PowerShell：

```powershell
cd D:\Study
.\启动Study.ps1
```

会启动全部子应用、检测端口占用（冲突时自动用备用端口），并**打开浏览器标签页**。实际端口写入 `study-suite.resolved.json`。

| 参数 | 说明 |
|------|------|
| `-NoOpenBrowser` | 不自动开浏览器 |
| `-ReaderOnly` | 只开 Markdown Reader |
| `-NoVideoDash` | 不启 video-dash |
| `-NoDrillly` | 不启 Drillly |
| `-WithKb` | 额外启动 kb-server |

旧名 `启动Study工作台.ps1` 会转调本脚本。

旧脚本 [`启动Markdown阅读器.bat`](启动Markdown阅读器.bat) 已改为调用本工作台（仅 Reader）。

## 联动方式（不写死数据库）

```
学习资料/
├── 学习视频进度/     ← video-dash 写 - [x] 分 P
├── 408/ 数学/ 英语/  ← Reader 扫描错题、二刷计划
├── 做题/             ← Drillly 导出题目 MD（规划路径）
周期记录/             ← 日报、学习进度、个人状态看板、进度规划看板
```

- **video-dash → Reader**：勾选同步到 `BV*.md`，Reader「视频进度」看板读取同一文件。
- **Drillly → Reader**：导出含 LaTeX 的 Markdown；可与「错题 / 二刷」目录并列或后续对接 `smr-quiz-log`。
- **Reader**：打开文件夹默认 `d:\Study`，各看板读 `周期记录/`、`学习资料/` 下约定 JSON 块（`smr-*`）。

## 规格文档

- **Drillly 功能与 API（完整）**：[`需求与规格汇总.md`](需求与规格汇总.md)
- **Reader 使用说明**：[`md-reader-app/README.md`](md-reader-app/README.md)
- **video-dash**：[`video-dash/README.md`](video-dash/README.md)
