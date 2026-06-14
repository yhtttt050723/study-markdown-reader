---
name: nightly-git-sync
description: >-
  Nightly auto git commit and push for Study, drillly, and video-dash repos.
  Use when the user says 夜间提交、每晚推送、nightly git sync、自动提交远程,
  or when running the 02:30 scheduled git backup automation.
---

# Nightly Git Sync

每天固定时间把 **三个独立仓库** 的本地改动 `commit` + `push` 到 GitHub。

## 仓库列表（顺序执行）

| 路径 | 远程 |
|:---|:---|
| `D:\Study\drillly` | `git@github.com:yhtttt050723/Drillly-for-11408.git` |
| `D:\Study\video-dash` | `git@github.com:yhtttt050723/video-dash.git` |
| `D:\Study` | `git@github.com:yhtttt050723/study-markdown-reader.git` |

`Study` 的 `.gitignore` 已排除 `drillly/`、`video-dash/` 子目录（各自独立推送）。

## 触发

| 方式 | 说明 |
|:---|:---|
| 用户说「夜间提交 / 每晚推送 / nightly git sync」 | 立即执行 |
| **Automation / loop 02:30** | 读本文 + 跑脚本 |
| `powershell -File .cursor/skills/nightly-git-sync/scripts/nightly-git-push.ps1` | 仅推送，不实现功能 |

## Workflow

```
- [ ] 1. Get-Date -Format "yyyy-MM-dd HH:mm:ss K"
- [ ] 2. 对每个仓库执行 nightly-git-push.ps1（或等价步骤）
- [ ] 3. 追加日志到 .cursor/nightly-git-log.md
- [ ] 4. 向用户汇报：各仓 commit 哈希 / 无改动 / 失败原因
```

### 提交规则

- **有改动才提交**；`git status --porcelain` 为空则跳过
- 提交信息：`chore: nightly sync YYYY-MM-DD`（可加一行简述主要目录）
- **禁止**：`git push --force`、改 `git config`、提交 `.env` / `api/data/` / `node_modules`
- `drillly` / `video-dash` 各自仓库内已有 `.gitignore`

### 身份未配置时

在单次命令环境变量中设置（不要写全局 git config）：

```powershell
$env:GIT_AUTHOR_NAME='yhtttt050723'
$env:GIT_AUTHOR_EMAIL='yhtttt050723@users.noreply.github.com'
$env:GIT_COMMITTER_NAME='yhtttt050723'
$env:GIT_COMMITTER_EMAIL='yhtttt050723@users.noreply.github.com'
```

## 定时（与夜间更新同一时段）

默认 **每天 02:30**（可在 `arm-nightly-git-loop.ps1` 改 `$WakeAt`）。

```powershell
powershell -File D:\Study\.cursor\skills\nightly-git-sync\scripts\arm-nightly-git-loop.ps1
```

### Cursor Automation

1. Schedule：`30 2 * * *`
2. Prompt：`读取 D:\Study\.cursor\skills\nightly-git-sync\SKILL.md，执行 nightly-git-push.ps1 并写日志。`
3. Tools：Agent + Shell

## 日志

**`D:\Study\.cursor\nightly-git-log.md`**（gitignore 外若需备份可手抄；默认在 `.cursor` 下仅本机）

```markdown
| 时间 | 仓库 | 结果 | 说明 |
|:---|:---|:---|:---|
| 2026-06-14 02:31 | drillly | pushed abc1234 | calendar + intensive plan |
```

## 脚本

| 文件 | 用途 |
|:---|:---|
| [scripts/nightly-git-push.ps1](scripts/nightly-git-push.ps1) | 三仓顺序 add/commit/push |
| [scripts/arm-nightly-git-loop.ps1](scripts/arm-nightly-git-loop.ps1) | 等到 02:30 唤醒 Agent |

## 与 nightly-study-update 分工

| Skill | 职责 |
|:---|:---|
| `nightly-study-update` | 实现功能、build、队列任务 |
| `nightly-git-sync` | **仅** git 提交推送 |

可先跑 study-update 再跑 git-sync，或 Automation 链两条任务（02:30 git，03:00 功能队列）。
