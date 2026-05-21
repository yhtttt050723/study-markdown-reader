# video-dash

本地 **B 站视频学习看板**：粘贴含 BV 的链接 → 拉取分 P 与时长 → 表格勾选「已看」→ 顶部 KPI 汇总全稿 / 已看时长（分钟与占比）。数据在浏览器 **localStorage** 持久化。

## 技术栈

- Vite + React 19 + TypeScript  
- Tailwind CSS v4（`@tailwindcss/vite`）  
- TanStack Query（拉取）、TanStack Table（分 P 表）  
- Zustand + `persist`（多 BV 状态）  
- 开发环境 **Vite 代理** `/bili` → `https://api.bilibili.com`（避免浏览器 CORS）

## 使用

```bash
cd video-dash
npm install
npm run dev
```

默认端口 **5211**（Study 套件 `5210–5214`，见根目录 **`启动Study.bat`**）。

浏览器打开 `http://localhost:5211`（若端口被占用，查看 `study-suite.resolved.json`），在输入框粘贴例如：

`https://www.bilibili.com/video/BV1Q4iJBAEsr`

点击 **拉取分 P**，在表格中勾选已看完的分 P；顶部卡片会更新汇总。

若修改 `vite.config.ts` 代理后仍提示网络错误，请 **停掉并重新执行** `npm run dev`。拉取失败且为 **403** 时，多为代理出站缺少浏览器头（本仓库已在代理上设置 `User-Agent` / `Referer`）。请核对 BV 号是否与浏览器地址栏一致（易混淆 `I` / `l` / `1`）。

## 生产构建

```bash
npm run build
```

`npm run preview` 仅预览静态包；**生产环境若仍从浏览器直连 B 站 API**，需自行加同源代理（与 `vite.config.ts` 中 `server.proxy` 等效），否则应改为自有后端转发 `pagelist`。

## 与 Study 工作台

- 页面内可绑定 **`学习资料\学习视频进度`**，勾选写回 `BV*.md`，供 **Markdown Reader**「视频进度」看板读取。
- 总览见仓库根 [`Study工作台.md`](../Study工作台.md)。
