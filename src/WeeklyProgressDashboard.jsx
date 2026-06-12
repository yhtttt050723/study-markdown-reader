import {
  WEEKLY_REWARD_DELTA_PCT,
} from "./progressSnapshots.js";

export function WeeklyProgressDashboard({
  currentScore,
  weekStart,
  weekEnd,
  weekDelta,
  weekReason,
  snapshotsInWindow,
  dayRows,
  dailyReportDays,
  onClose,
}) {
  const unlocked =
    weekDelta != null && weekDelta >= WEEKLY_REWARD_DELTA_PCT;

  return (
    <div
      className="weekly-prog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="weekly-prog-title"
    >
      <div className="weekly-prog-panel">
        <div className="weekly-prog-toolbar">
          <h2 id="weekly-prog-title" className="weekly-prog-title">
            周进度与奖励
          </h2>
          <button type="button" className="ghost-btn" onClick={onClose}>
            关闭（Esc）
          </button>
        </div>

        <p className="weekly-prog-lead">
          综合进度分由当前「学习进度」看板数据算出（数一 / 数二 / 408 / 英语）。每次你<strong>调整并保存</strong>学习进度时会记录<strong>当日快照</strong>（保存在{" "}
          <code>smr-progress-snapshots</code>
          ）。最近 <strong>7 天</strong>内第一次与最后一次快照的差值即「本周推进」。
        </p>

        <div className="weekly-prog-cards">
          <div className="weekly-prog-card">
            <span className="weekly-prog-card-label">当前综合进度</span>
            <strong className="weekly-prog-card-value">{currentScore}%</strong>
          </div>
          <div className="weekly-prog-card weekly-prog-card--accent">
            <span className="weekly-prog-card-label">
              本周推进（{weekStart}～{weekEnd}）
            </span>
            <strong className="weekly-prog-card-value">
              {weekDelta == null ? "—" : `${weekDelta >= 0 ? "+" : ""}${weekDelta}%`}
            </strong>
            {weekReason === "need_two_days" && (
              <span className="weekly-prog-card-sub">
                本周窗口内需至少 2 天有快照：请隔日再打开本面板，或在「学习进度」里微调后保存。
              </span>
            )}
          </div>
          <div className="weekly-prog-card">
            <span className="weekly-prog-card-label">本周已写日报（周期记录）</span>
            <strong className="weekly-prog-card-value">{dailyReportDays}</strong>
            <span className="weekly-prog-card-sub">天（文件名 YYYY-MM-DD.md）</span>
          </div>
        </div>

        {unlocked && (
          <div className="weekly-prog-reward" role="status">
            <span className="weekly-prog-reward-emoji" aria-hidden>
              🍜
            </span>
            <div>
              <strong>吃饭奖励已解锁</strong>
              <p className="weekly-prog-reward-text">
                本周综合进度推进 <strong>{weekDelta}%</strong>，已达到{" "}
                <strong>{WEEKLY_REWARD_DELTA_PCT}%</strong>{" "}
                阈值——给自己安排一顿奖励餐吧。
              </p>
            </div>
          </div>
        )}

        {!unlocked && weekDelta != null && (
          <p className="weekly-prog-hint">
            距离吃饭奖励还差{" "}
            <strong>
              {Math.max(0, Math.round((WEEKLY_REWARD_DELTA_PCT - weekDelta) * 10) / 10)}%
            </strong>{" "}
            综合进度推进（阈值 {WEEKLY_REWARD_DELTA_PCT}%）。
          </p>
        )}

        <section className="weekly-prog-section">
          <h3 className="weekly-prog-h3">本周窗口内快照</h3>
          {snapshotsInWindow.length === 0 ? (
            <p className="weekly-prog-empty">尚无快照。去「学习进度」拖动保存一次即可开始累计。</p>
          ) : (
            <ul className="weekly-prog-snap-list">
              {snapshotsInWindow.map((x) => (
                <li key={x.d}>
                  <span>{x.d}</span>
                  <span>{x.s}%</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="weekly-prog-section">
          <h3 className="weekly-prog-h3">最近 7 天逐日（有快照才显示分数）</h3>
          <div className="weekly-prog-table-wrap">
            <table className="weekly-prog-table">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>综合分</th>
                  <th>较上一有记录日</th>
                </tr>
              </thead>
              <tbody>
                {dayRows.map((row) => (
                  <tr key={row.d}>
                    <td>{row.d}</td>
                    <td>{row.s == null ? "—" : `${row.s}%`}</td>
                    <td>
                      {row.deltaFromPrev == null
                        ? "—"
                        : `${row.deltaFromPrev >= 0 ? "+" : ""}${row.deltaFromPrev}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
