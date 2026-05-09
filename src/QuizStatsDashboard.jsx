import { formatElapsed } from "./markdownQuiz.js";

function fmtTime(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(
      d.getMinutes()
    ).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}

export function QuizStatsDashboard({ stats, onClose }) {
  const empty = !stats || stats.total === 0;

  return (
    <div className="quiz-stats-overlay" role="dialog" aria-modal="true" aria-labelledby="quiz-stats-title">
      <div className="quiz-stats-panel">
        <div className="quiz-stats-toolbar">
          <h2 id="quiz-stats-title" className="quiz-stats-title">
            刷题数据看板
          </h2>
          <div className="quiz-stats-toolbar-btns">
            <button type="button" className="ghost-btn" onClick={onClose}>
              关闭（Esc）
            </button>
          </div>
        </div>

        {empty ? (
          <p className="quiz-stats-empty">
            暂无记录。打开「随机刷题」做题并点击「做对 / 做错」后，数据会写入本机{" "}
            <code>smr-quiz-log</code>。
          </p>
        ) : (
          <>
            <div className="quiz-stats-summary">
              <div className="quiz-stats-card quiz-stats-card--total">
                <span className="quiz-stats-card-label">总题次</span>
                <strong className="quiz-stats-card-value">{stats.total}</strong>
              </div>
              <div className="quiz-stats-card quiz-stats-card--acc">
                <span className="quiz-stats-card-label">正确率</span>
                <strong className="quiz-stats-card-value">{stats.accuracyPct}%</strong>
                <span className="quiz-stats-card-sub">
                  对 {stats.correct} · 错 {stats.wrong}
                </span>
              </div>
              <div className="quiz-stats-card">
                <span className="quiz-stats-card-label">平均用时</span>
                <strong className="quiz-stats-card-value">{formatElapsed(stats.avgSeconds)}</strong>
                <span className="quiz-stats-card-sub">
                  做对均{" "}
                  {stats.avgSecondsCorrect != null
                    ? formatElapsed(stats.avgSecondsCorrect)
                    : "—"}{" "}
                  · 做错均{" "}
                  {stats.avgSecondsWrong != null
                    ? formatElapsed(stats.avgSecondsWrong)
                    : "—"}
                </span>
              </div>
            </div>

            <section className="quiz-stats-section">
              <h3 className="quiz-stats-h3">来源</h3>
              <div className="quiz-stats-bars">
                {["wrongbook", "secondpass"].map((key) => {
                  const b = stats.byKind[key];
                  const label = key === "wrongbook" ? "错题本" : "二刷计划";
                  const acc = b.n ? Math.round((b.c / b.n) * 1000) / 10 : 0;
                  return (
                    <div key={key} className="quiz-stats-bar-row">
                      <span className="quiz-stats-bar-label">
                        {label} · {b.n} 次 · {acc}%
                      </span>
                      <div className="quiz-stats-bar-track">
                        <div
                          className="quiz-stats-bar-fill quiz-stats-bar-fill--ok"
                          style={{ width: `${acc}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {stats.folders.length > 0 && (
              <section className="quiz-stats-section">
                <h3 className="quiz-stats-h3">文件夹（Top）</h3>
                <ul className="quiz-stats-list">
                  {stats.folders.slice(0, 12).map((row) => (
                    <li key={row.key}>
                      <span className="quiz-stats-list-key">{row.key}</span>
                      <span className="quiz-stats-list-num">
                        {row.n} 次 · {row.acc}%
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {stats.subjects.length > 0 && (
              <section className="quiz-stats-section">
                <h3 className="quiz-stats-h3">科目</h3>
                <ul className="quiz-stats-list">
                  {stats.subjects.slice(0, 12).map((row) => (
                    <li key={row.key}>
                      <span className="quiz-stats-list-key">{row.key}</span>
                      <span className="quiz-stats-list-num">
                        {row.n} 次 · {row.acc}%
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="quiz-stats-section">
              <h3 className="quiz-stats-h3">最近记录</h3>
              <div className="quiz-stats-table-wrap">
                <table className="quiz-stats-table">
                  <thead>
                    <tr>
                      <th>时间</th>
                      <th>结果</th>
                      <th>用时</th>
                      <th>来源</th>
                      <th>科目</th>
                      <th>标题</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recent.map((e, i) => (
                      <tr key={`${e.at}-${i}`}>
                        <td>{fmtTime(e.at)}</td>
                        <td className={e.correct ? "quiz-stats-ok" : "quiz-stats-bad"}>
                          {e.correct ? "对" : "错"}
                        </td>
                        <td>{formatElapsed(Number(e.seconds) || 0)}</td>
                        <td>{e.kind === "secondpass" ? "二刷" : "错题"}</td>
                        <td>{(e.subject || "").trim() || "—"}</td>
                        <td className="quiz-stats-title-cell">{(e.title || "").slice(0, 36)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
