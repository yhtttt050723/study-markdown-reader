---
name: nightly-study-update
description: >-
  Processes queued evening software update requests for Study/Drillly overnight:
  implements tasks, runs builds, restarts local services, and logs results. Use
  when the user says 晚上自更新、夜间更新软件、nightly update、加入夜间队列、睡前更新
  Drillly, or when reading `.cursor/nightly-update-queue.md`.
---

# Nightly Study Software Update

晚间把需求写进队列，夜间（或次日清晨）由 Agent 自运行本 skill，完成 **Drillly / video-dash / Study 脚本** 等本地更新。

## Queue file

**`D:/Study/.cursor/nightly-update-queue.md`**

- 未完成任务：`- [ ]`
- 已完成：`- [x]` + 完成时间 + 简述

用户晚间只改队列；**不要**在对话里重复长需求。

## When to run

| 触发 | 动作 |
|:---|:---|
| 用户说「今晚自更新 / 加入夜间队列」 | 帮用户整理队列条目，可选执行 `scripts/arm-nightly-loop.ps1` |
| `/loop` 或 Automation 唤醒 | 读本 skill + 队列，逐项实现 |
| 用户说「执行夜间更新」 | 立即跑完整工作流 |

## Workflow（按顺序）

```
Task Progress:
- [ ] 1. 读本机时间 Get-Date -Format "yyyy-MM-dd HH:mm:ss K"
- [ ] 2. 读 nightly-update-queue.md 中未勾选项
- [ ] 3. 若无待办 → 在队列写「无待办」并结束
- [ ] 4. 逐项实现（Drillly 优先：api → web npm run build）
- [ ] 5. 运行 scripts/verify-study-apps.ps1（或等效冒烟）
- [ ] 6. 勾选队列、追加 ## 运行日志
- [ ] 7. 仅用户明确要求时才 git commit
```

### 实现范围（默认）

- **`drillly/api`**：Python 依赖、迁移、新路由
- **`drillly/web`**：`npm install` + `npm run build`（有前端改动时）
- **`video-dash`**：同上
- **`.cursor/rules` / `学习资料/MDC归档`**：文档与模板

### 服务重启（Windows）

```powershell
# API 若在跑，先停再启（用户常用 bat）
D:\Study\Start-Drillly-API.bat
```

不强制杀进程；build 失败则**不勾选**该项并在日志写原因。

## Arm overnight loop（可选）

```powershell
powershell -File D:\Study\.cursor\skills\nightly-study-update\scripts\arm-nightly-loop.ps1
```

- 默认 **02:30** 唤醒一次（可改脚本内 `$WakeAt`）。
- 唤醒 payload：`按 nightly-study-update skill 执行夜间更新队列`
- 用户说「停止夜间更新」→ 结束对应 loop / Automation。

## 与 Cursor Automations 配合

1. Cursor Settings → Automations → 新建
2. **Schedule**：`30 2 * * *`（每天 02:30）
3. **Prompt**：`读取 D:\Study\.cursor\nightly-study-update\SKILL.md 与 .cursor/nightly-update-queue.md，执行夜间更新工作流。`
4. **Tools**：Agent + Shell

## 日志格式

在队列文件末尾维护：

```markdown
## 运行日志

| 时间 | 结果 | 说明 |
|:---|:---|:---|
| 2026-06-10 02:35 | 完成 2/2 | session-stats API + 日报 MDC |
```

## 禁止

- 未读队列就改大段无关代码
- `git push --force`、改 git config
- 未验证就勾选队列项

## 脚本

| 脚本 | 用途 |
|:---|:---|
| [scripts/arm-nightly-loop.ps1](scripts/arm-nightly-loop.ps1) | 注册一次夜间唤醒 |
| [scripts/verify-study-apps.ps1](scripts/verify-study-apps.ps1) | API health + 关键脚本 `--help` |
