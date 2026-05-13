import { summarizePlanBoardProgress } from "./planBoard.js";

export function PlanBoardDashboard({ data, embedded = false }) {
  const sections = data?.sections || [];
  if (!sections.length) return null;

  const stats = summarizePlanBoardProgress(data);

  return (
    <div className={`plan-board-dash ${embedded ? "plan-board-dash--embedded" : ""}`}>
      <div className="plan-board-dash-header">
        {!embedded ? (
          <h3 className="plan-board-dash-title">进度规划看板</h3>
        ) : null}
        <div className="plan-board-dash-meta">
          {data.meta?.weekRange ? (
            <span className="plan-board-dash-pill">本周：{data.meta.weekRange}</span>
          ) : null}
          {data.meta?.phaseName ? (
            <span className="plan-board-dash-pill">阶段：{data.meta.phaseName}</span>
          ) : null}
          {stats.total > 0 ? (
            <span className="plan-board-dash-stat">
              勾选进度 <strong>{stats.done}</strong> / {stats.total}
              {stats.pct != null ? `（${stats.pct}%）` : ""}
            </span>
          ) : null}
        </div>
      </div>

      {(data.meta?.phaseDoc || data.meta?.weekDoc) && (
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

      {!embedded ? (
        <p className="plan-board-dash-footer">
          在左侧编辑本文件中的 <code>- [ ]</code> / <code>- [x]</code> 后保存，预览即可刷新；可选{" "}
          <code>smr-plan-board</code> JSON 填写周区间与关联文档路径。
        </p>
      ) : (
        <p className="plan-board-dash-footer plan-board-dash-footer--short">
          编辑请打开 <code>周期记录/进度规划看板.md</code> 保存后在此刷新。
        </p>
      )}
    </div>
  );
}
