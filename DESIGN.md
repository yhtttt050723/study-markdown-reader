# Design System: Study Markdown Reader (E-Ink / Paper)

> 依据 [ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)：**阅读 / 文档 / 学习工具** → **E-Ink / Paper** + **Minimal & Direct**。

## 1. Visual Theme

暖色纸感背景、墨石色正文、青绿强调（避免 AI 紫粉渐变）。界面以留白与细边框分层，阴影轻、过渡约 200ms。

## 2. Color Palette

| 角色 | 值 | 用途 |
|------|-----|------|
| Ink | `#1c1917` | 主文字 |
| Stone | `#57534e` / `#a8a29e` | 次级 / 占位 |
| Paper | `#f5f2eb` | 页面底 |
| Sheet | `#fffffe` | 卡片、顶栏 |
| Accent | `#0d9488` | 主 CTA、链接、选中 |
| Accent hover | `#0f766e` | 悬停 / 按下 |
| Badge | `#f0fdfa` / `#0f766e` | 标签、选中底 |

CSS 变量见 `src/App.css` 的 `:root`。

## 3. Typography

- **UI**：Plus Jakarta Sans（顶栏、按钮、看板）
- **阅读**：Literata（Markdown 预览、首页背诵区）

## 4. Layout

- **首页**：12 列 Bento 网格（浏览器 6 列、笔记/进度各 3 列、每日要背 6 列；窄屏单列）
- **顶栏**：分组胶囊 + 粘性顶栏；视图切换为 segmented control
- **侧栏**：激活项左侧 3px 强调条
- **预览**：`--read-max-width: 42rem`，衬线排版、行高 1.65

## 5. Accessibility Checklist (ui-ux-pro-max)

- [x] SVG 图标（`src/uiIcons.jsx`），不用 emoji 当图标
- [x] 可点击元素 `cursor: pointer` + `:focus-visible` 环
- [x] 悬停过渡 ~200ms
- [x] `prefers-reduced-motion` 缩短动画
- [x] 正文对比度 ≥ 4.5:1（墨石 on 纸白）

## 6. Anti-patterns (避免)

- 霓虹色、重阴影、深色模式默认（本应用为日间阅读）
- 紫色 AI 渐变主色
- 过密顶栏无分组
