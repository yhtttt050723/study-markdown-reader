import { summarizeSchoolTargets } from "./schoolTargets.js";

/** 条形长度：约 340～400 总分刻度 */
function barPercent(scoreNum, globalMax) {
  if (scoreNum == null || !globalMax) return 8;
  const lo = 340;
  const hi = Math.max(400, globalMax + 5);
  const p = ((scoreNum - lo) / (hi - lo)) * 100;
  return Math.min(100, Math.max(6, p));
}

export function SchoolTargetsDashboard({ data }) {
  const groups = data?.groups || [];
  if (!groups.length) return null;

  const stats = summarizeSchoolTargets(groups);
  const globalMax = stats.maxScore || 400;

  return (
    <div className="school-dash">
      <div className="school-dash-header">
        <h3 className="school-dash-title">择校目标看板</h3>
        <div className="school-dash-stats">
          {stats.totalRows > 0 && (
            <span className="school-dash-stat">
              共 <strong>{stats.totalRows}</strong> 条目标
            </span>
          )}
          {stats.minScore != null && stats.maxScore != null && (
            <span className="school-dash-stat">
              分数区间 <strong>{stats.minScore}</strong> —{" "}
              <strong>{stats.maxScore}</strong>
            </span>
          )}
        </div>
      </div>

      {groups.map((g) => (
        <section key={g.exam} className="school-dash-group">
          <h4 className="school-dash-exam">{g.exam}</h4>
          <div className="school-dash-cards">
            {g.rows.map((row, idx) => (
              <div key={`${row.school}-${row.program}-${idx}`} className="school-dash-card">
                <div className="school-dash-card-top">
                  <span className="school-dash-school">{row.school}</span>
                  <span className="school-dash-score">
                    {row.scoreNum != null ? (
                      <strong>{row.scoreNum}</strong>
                    ) : (
                      row.scoreDisplay
                    )}
                  </span>
                </div>
                <div className="school-dash-program">{row.program}</div>
                {row.note?.trim() ? (
                  <div className="school-dash-note">{row.note}</div>
                ) : null}
                <div className="school-dash-bar-track">
                  <div
                    className="school-dash-bar-fill"
                    style={{
                      width: `${barPercent(row.scoreNum, globalMax)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
      <p className="school-dash-footer-hint">
        表格可在左侧编辑保存；条形为相对刻度（约 340～400），便于横向对比。
      </p>
    </div>
  );
}
