# Study Markdown Reader

一个面向学习场景的本地 Markdown 阅读与编辑工具，支持 `.md` / `.mdc` 文件快速浏览、编辑、保存，以及模板化快速录入。

## 功能特性

- 打开本地文件夹，自动扫描 `.md` / `.mdc`
- 左侧按目录分组展示文件树（过滤常见无关目录）
- 编辑 / 预览 / 分栏三种视图切换
- 快捷键支持：
  - `Ctrl + S` 保存
  - `Ctrl + Z` 撤销
  - `Ctrl + Y` / `Ctrl + Shift + Z` 重做
- 快速录入面板（错题 / 日报 / 日清 / 周报）
- Electron 桌面模式 + 浏览器兼容模式双支持

## 技术栈

- Electron
- React
- Vite
- Marked

## 本地运行

```bash
npm install
npm run dev
```

## 打包（Windows）

```bash
npm run pack:win
```

打包输出目录：

- `release/Study Markdown Reader 0.0.0.exe`
- `release/win-unpacked/`

## 项目结构

```text
md-reader-app/
├─ electron/            # Electron 主进程与 preload
├─ src/                 # React 页面
├─ public/              # 静态资源（含应用图标）
├─ dist/                # 前端构建产物
└─ package.json
```

## 适用场景

- 考研/学习资料管理（计划、日报、错题）
- 本地知识库查看与快速编辑
- 模板化记录（日常复盘、周报、错题录入）

## 后续规划

- 搜索（按文件名/内容）
- 模板可自定义
- 自动备份与版本快照
- 深色模式与主题切换

## License

MIT
