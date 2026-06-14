import { summarizePlanBoardProgress } from "./planBoard.js";

/**
 * @param {object} props
 * @param {{ meta?: Record<string, string>, sections?: Array<{ title: string, items: Array<{ label: string, done: boolean | null }> }> }} props.data
 * @param {boolean} [props.embedded]
 * @param {string} [props.title]
 * @param {boolean} [props.interactive]
 * @param {(sectionIndex: number, itemIndex: number, done: boolean) => void} [props.onToggleItem]
 * @param {() => void} [props.onOpenInEditor]
 * @param {boolean} [props.saving]
 */
export function PlanBoardDashboard({
  data,
  embedded = false,
  title = "进度规划看板",
  interactive = false,
  onToggleItem,
  onOpenInEditor,
  saving = false,
}) {
  const sections = data?.sections || [];
  if (!sections.length) return null;

  const stats = summarizePlanBoardProgress(data);
  const canToggle = interactive && typeof onToggleItem === "function";

  return (
    <div className={`plan-board-dash ${embedded ? "plan-board-dash--embedded" : ""}`}>
      <div className="plan-board-dash-header">
        {!embedded ? (
          <h3 className="plan-board-dash-title">{title}</h3>
        ) : (
          <h3 className="plan-board-dash-title plan-board-dash-title--compact">{title}</h3>
        )}
        <div className="plan-board-dash-meta">
          {data.meta?.weekRange ? (
            <span className="plan-board-dash-pill">本周：{data.meta.weekRange}</span>
          ) : null}
          {data.meta?.phaseName ? (
            <span className="plan-board-dash-pill">阶段：{data.meta.phaseName}</span>
          ) : null}
          {data.meta?.phaseLabel ? (
            <span className="plan-board-dash-pill">{data.meta.phaseLabel}</span>
          ) : null}
          {data.meta?.currentPhase ? (
            <span className="plan-board-dash-pill">阶段码：{data.meta.currentPhase}</span>
          ) : null}
          {stats.total > 0 ? (
            <span className="plan-board-dash-stat">
              勾选进度 <strong>{stats.done}</strong> / {stats.total}
              {stats.pct != null ? `（${stats.pct}%）` : ""}
            </span>
          ) : null}
          {saving ? <span className="plan-board-dash-pill plan-board-dash-pill--muted">保存中…</span> : null}
        </div>
      </div>

      {(data.meta?.phaseDoc || data.meta?.weekDoc || data.meta?.statusDoc) && (
        <p className="plan-board-dash-links">
          {data.meta.phaseDoc ? (
            <span>
              详细：<code>{data.meta.phaseDoc}</code>
            </span>
          ) : null}
          {data.meta.weekDoc ? (
            <span>
              {" "}
              · <code>{data.meta.weekDoc}</code>
            </span>
          ) : null}
          {data.meta.statusDoc ? (
            <span>
              {" "}
              · <code>{data.meta.statusDoc}</code>
            </span>
          ) : null}
        </p>
      )}

      {stats.total > 0 && (
        <div className="plan-board-dash-bar-track" aria-hidden>
          <div
            className="plan-board-dash-bar-fill"
            style={{ width: `${Math.min(100, stats.pct ?? 0)}%` }}
          />
        </div>
      )}

      <div className="plan-board-dash-sections">
        {sections.map((sec, si) => (
          <section key={`${sec.title}-${si}`} className="plan-board-dash-section">
            <h4 className="plan-board-dash-section-title">{sec.title}</h4>
            {sec.items.length === 0 ? (
              <p className="plan-board-dash-empty">（本节暂无条目）</p>
            ) : (
              <ul className="plan-board-dash-list">
                {sec.items.map((it, ii) => (
                  <li
                    key={`${si}-${ii}`}
                    className={
                      it.done === null
                        ? "plan-board-dash-item plan-board-dash-item--note"
                        : it.done
                          ? "plan-board-dash-item plan-board-dash-item--done"
                          : "plan-board-dash-item"
                    }
                  >
                    {it.done === null ? (
                      <span className="plan-board-dash-note">{it.label}</span>
                    ) : canToggle ? (
                      <label className="plan-board-dash-check-label">
                        <input
                          type="checkbox"
                          checked={Boolean(it.done)}
                          disabled={saving}
                          onChange={(e) => onToggleItem(si, ii, e.target.checked)}
                        />
                        <span>{it.label}</span>
                      </label>
                    ) : (
                      <>
                        <span className="plan-board-dash-check" aria-hidden>
                          {it.done ? "☑" : "☐"}
                        </span>
                        <span>{it.label}</span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <div className="plan-board-dash-footer-row">
        {onOpenInEditor ? (
          <button type="button" className="ghost-btn plan-board-dash-open-btn" onClick={onOpenInEditor}>
            在 Markdown 浏览器中编辑全文
          </button>
        ) : null}
        <p className="plan-board-dash-footer plan-board-dash-footer--short">
          {canToggle
            ? "直接点击勾选会写入对应 .md 文件（需已用桌面版打开 Study 文件夹）。"
            : "请用桌面版打开 Study 文件夹后，在进度中心勾选。"}
        </p>
      </div>
    </div>
  );
}
