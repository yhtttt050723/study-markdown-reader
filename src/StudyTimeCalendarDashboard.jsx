import { useMemo, useState } from "react";
import {
  buildMonthGrid,
  formatStudyDuration,
  formatStudyDurationShort,
  localYmd,
} from "./studyDailyTime.js";
import {
  formatPendingCopyForAgent,
  THREE_HOUR_BLOCK_MINUTES,
} from "./studyTimeQuickLog.js";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

/**
 * @param {Record<string, { totalMinutes?: number, displayTotalMinutes?: number, blocks?: unknown[], pendingBlocks?: unknown[] }>} byDate
 */
function maxMinutesInMap(byDate) {
  let max = 60;
  for (const v of Object.values(byDate || {})) {
    const m = v?.displayTotalMinutes ?? v?.totalMinutes ?? 0;
    if (m > max) max = m;
  }
  return max;
}

export function StudyTimeCalendarDashboard({
  year,
  month,
  byDate,
  loading,
  error,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onRefresh,
  folderHint,
  onClose,
  onAddQuickThreeHour,
  onRemovePendingBlock,
  onCopyPendingForAgent,
  pendingSyncHint,
}) {
  const { cells } = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const maxM = useMemo(() => maxMinutesInMap(byDate), [byDate]);
  const [quickLabel, setQuickLabel] = useState("");
  const [copyMsg, setCopyMsg] = useState("");

  const monthTotal = useMemo(() => {
    let t = 0;
    let days = 0;
    for (const ymd of cells) {
      if (!ymd) continue;
      const v = byDate?.[ymd];
      const mins = v?.displayTotalMinutes ?? v?.totalMinutes ?? 0;
      if (mins > 0) {
        t += mins;
        days += 1;
      }
    }
    return { t, days };
  }, [cells, byDate]);

  const selected = selectedDate ? byDate?.[selectedDate] : null;
  const pending = selected?.pendingBlocks ?? [];
  const reportBlocks = selected?.blocks ?? [];
  const displayTotal = selected?.displayTotalMinutes ?? selected?.totalMinutes ?? 0;

  const handleAddQuick = () => {
    if (!selectedDate || !onAddQuickThreeHour) return;
    onAddQuickThreeHour(selectedDate, quickLabel.trim());
    setQuickLabel("");
  };

  const handleCopy = async () => {
    if (!selectedDate || !onCopyPendingForAgent) return;
    const text = onCopyPendingForAgent(selectedDate);
    try {
      await navigator.clipboard.writeText(text);
      setCopyMsg("已复制到剪贴板");
      window.setTimeout(() => setCopyMsg(""), 2500);
    } catch {
      setCopyMsg("复制失败，请手动选择下方文本");
    }
  };

  return (
    <div
      className="study-time-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="study-time-title"
    >
      <div className="study-time-panel">
        <div className="study-time-toolbar">
          <h2 id="study-time-title" className="study-time-title">
            学习时长 · 日历
          </h2>
          <div className="study-time-toolbar-actions">
            <button type="button" className="ghost-btn" onClick={onRefresh} disabled={loading}>
              刷新
            </button>
            <button type="button" className="ghost-btn" onClick={onClose}>
              关闭（Esc）
            </button>
          </div>
        </div>

        <p className="study-time-lead">
          从已打开文件夹的 <strong>周期记录/YYYY-MM-DD.md</strong> 解析
          <strong>「当日执行摘要」</strong>；可选 <code>smr-study-time</code> JSON。
          <strong>快捷三小时段</strong> 写入 <code>周期记录/学习时长待同步.md</code>，晚间一并合并进日报。
          {folderHint ? ` ${folderHint}` : ""}
        </p>

        {error && <p className="study-time-error">{error}</p>}

        <div className="study-time-month-bar">
          <button type="button" className="ghost-btn" onClick={onPrevMonth} aria-label="上一月">
            ‹
          </button>
          <strong className="study-time-month-label">
            {year} 年 {month} 月
          </strong>
          <button type="button" className="ghost-btn" onClick={onNextMonth} aria-label="下一月">
            ›
          </button>
          <span className="study-time-month-total">
            本月合计 <strong>{formatStudyDuration(monthTotal.t)}</strong>
            {monthTotal.days > 0 && (
              <span className="study-time-month-sub">
                （{monthTotal.days} 天有记录）
              </span>
            )}
          </span>
        </div>

        {loading ? (
          <p className="study-time-loading">正在读取日报…</p>
        ) : (
          <>
            <div className="study-time-weekhead" aria-hidden>
              {WEEKDAYS.map((w) => (
                <span key={w} className="study-time-weekhead-cell">
                  {w}
                </span>
              ))}
            </div>
            <div className="study-time-grid">
              {cells.map((ymd, idx) => {
                if (!ymd) {
                  return <div key={`pad-${idx}`} className="study-time-cell study-time-cell--empty" />;
                }
                const data = byDate?.[ymd];
                const mins = data?.displayTotalMinutes ?? data?.totalMinutes ?? 0;
                const has = mins > 0;
                const hasPending = (data?.pendingMinutes ?? 0) > 0;
                const pct = has ? Math.max(12, Math.round((mins / maxM) * 100)) : 0;
                const isSelected = selectedDate === ymd;
                const [, , d] = ymd.split("-");
                const isToday = ymd === localYmd();
                return (
                  <button
                    key={ymd}
                    type="button"
                    className={`study-time-cell${has ? " study-time-cell--has" : ""}${
                      hasPending ? " study-time-cell--pending" : ""
                    }${isSelected ? " study-time-cell--selected" : ""}${
                      isToday ? " study-time-cell--today" : ""
                    }`}
                    onClick={() => onSelectDate(ymd)}
                    title={has ? `${ymd}：${formatStudyDuration(mins)}` : ymd}
                  >
                    <span className="study-time-cell-day">{Number(d)}</span>
                    <span
                      className="study-time-cell-bar"
                      style={{ height: has ? `${pct}%` : "4px" }}
                      aria-hidden
                    />
                    <span className="study-time-cell-hours">
                      {formatStudyDurationShort(mins)}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div className="study-time-quick">
          <h3 className="study-time-h3">快捷三小时段 · {selectedDate || "请先选日期"}</h3>
          <p className="study-time-quick-hint">
            每点一次记 <strong>{THREE_HOUR_BLOCK_MINUTES} min（3 h）</strong>，可填科目/段号备注；数据同步至{" "}
            <code>学习时长待同步.md</code>，晚间发给助手写入当日日报。
            {pendingSyncHint ? ` ${pendingSyncHint}` : ""}
          </p>
          <div className="study-time-quick-row">
            <input
              type="text"
              className="study-time-quick-input"
              placeholder="备注（可选），如：段#1 高数极限"
              value={quickLabel}
              onChange={(e) => setQuickLabel(e.target.value)}
              disabled={!selectedDate || !onAddQuickThreeHour}
            />
            <button
              type="button"
              className="primary-btn study-time-quick-btn"
              disabled={!selectedDate || !onAddQuickThreeHour}
              onClick={handleAddQuick}
            >
              + 三小时段
            </button>
            <button
              type="button"
              className="ghost-btn"
              disabled={!selectedDate || pending.length === 0 || !onCopyPendingForAgent}
              onClick={handleCopy}
            >
              复制待同步摘要
            </button>
            {copyMsg ? <span className="study-time-copy-msg">{copyMsg}</span> : null}
          </div>
        </div>

        <div className="study-time-detail">
          <h3 className="study-time-h3">
            {selectedDate ? `${selectedDate} 学习明细` : "点击日期查看明细"}
          </h3>
          {!selectedDate && (
            <p className="study-time-empty">在日历中选择某一天，下方显示该日各学习块时长。</p>
          )}
          {selectedDate && displayTotal <= 0 && (
            <p className="study-time-empty">
              该日暂无记录；可用上方「+ 三小时段」快捷记账，晚间再写入日报。
            </p>
          )}
          {selectedDate && displayTotal > 0 && (
            <>
              <p className="study-time-detail-total">
                展示合计 <strong>{formatStudyDuration(displayTotal)}</strong>
                {(selected?.pendingMinutes ?? 0) > 0 && (
                  <span className="study-time-badge study-time-badge--pending">
                    含待同步 {formatStudyDuration(selected.pendingMinutes)}
                  </span>
                )}
                {selected?.source === "smr-study-time" && (
                  <span className="study-time-badge">日报 JSON</span>
                )}
              </p>
              {reportBlocks.length > 0 && (
                <>
                  <p className="study-time-subhead">已写入日报</p>
                  <ul className="study-time-block-list">
                    {reportBlocks.map((b, i) => (
                      <li key={`r-${i}-${b.minutes}`}>
                        <span className="study-time-block-mins">
                          {formatStudyDuration(b.minutes)}
                        </span>
                        <span className="study-time-block-label">{b.label}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {pending.length > 0 && (
                <>
                  <p className="study-time-subhead">待同步（快捷记录）</p>
                  <ul className="study-time-block-list study-time-block-list--pending">
                    {pending.map((b) => (
                      <li key={b.slotKey}>
                        <span className="study-time-block-mins">
                          {formatStudyDuration(b.minutes)}
                        </span>
                        <span className="study-time-block-label">{b.label}</span>
                        {onRemovePendingBlock ? (
                          <button
                            type="button"
                            className="study-time-remove-pending"
                            onClick={() => onRemovePendingBlock(selectedDate, b.slotKey)}
                            aria-label="删除本条快捷记录"
                          >
                            删除
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
