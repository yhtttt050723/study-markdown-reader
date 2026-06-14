import {
  chapterThroughToPct,
} from "./studyCatalog.js";
import {
  BOOK660_DEFAULT_TOTAL_CALC,
  BOOK1000_COMPREHENSIVE_TOTAL,
  BOOK1000_DEFAULT_MAX,
  CS408_CHAPTER_DEFAULT_MAX,
  ENGLISH_BASIC_UNITS,
  ENGLISH_MUST_UNITS,
  MATH_CHAPTER_DEFAULT_MAX,
} from "./studyProgress.js";

/** @typedef {{ index: number, title: string }} CatalogChapter */

function MathSubjectTracks({
  title,
  subjectKey,
  chapters,
  zhangyuPhases,
  phase,
  onChange,
}) {
  const total =
    chapters && chapters.length > 0
      ? chapters.length
      : MATH_CHAPTER_DEFAULT_MAX[subjectKey] ?? 12;
  const maxSlider = Math.max(1, total);
  const bt = Math.min(Math.max(0, phase.basicThrough ?? 0), total);
  const st = Math.min(Math.max(0, phase.strengthenThrough ?? 0), total);

  const book660Total =
    typeof phase.book660Total === "number" && phase.book660Total > 0
      ? phase.book660Total
      : subjectKey === "高数"
        ? BOOK660_DEFAULT_TOTAL_CALC
        : 0;
  const show660 = book660Total > 0;
  const b660 = Math.min(Math.max(0, phase.book660Through ?? 0), book660Total);
  const pct660 = chapterThroughToPct(b660, book660Total);
  const caption660 = () => {
    const custom = typeof phase.book660Caption === "string" && phase.book660Caption.trim();
    if (custom) return phase.book660Caption.trim();
    if (b660 <= 0) return "未开始";
    if (b660 >= book660Total) return "《660》本分册已全部完成";
    return `已过至：第 ${b660} / ${book660Total} 题`;
  };

  const caption = (through) => {
    if (through <= 0) return "未开始";
    if (through >= total) return "已全部过完";
    const row = chapters?.[through - 1];
    return row ? `已过至：${row.title}` : `已过 ${through} / ${total} 章`;
  };

  return (
    <div className="progress-dash-module">
      <div className="progress-dash-module-title">{title}</div>

      <div className="progress-dash-track-block">
        <div className="progress-dash-track-head">
          <span className="progress-dash-track-name">红书基础篇</span>
          <span className="progress-dash-track-meta">
            {bt}/{total} 章 · {chapterThroughToPct(bt, total)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={total}
          value={bt}
          onChange={(e) =>
            onChange({
              ...phase,
              basicThrough: Number(e.target.value),
            })
          }
        />
        <p className="progress-dash-track-caption">{caption(bt)}</p>
        <div className="progress-dash-mini-bar" aria-hidden>
          <div
            className="progress-dash-mini-fill progress-dash-mini-fill--basic"
            style={{ width: `${chapterThroughToPct(bt, total)}%` }}
          />
        </div>
      </div>

      <div className="progress-dash-track-block">
        <div className="progress-dash-track-head">
          <span className="progress-dash-track-name">严选题</span>
          <span className="progress-dash-track-meta">
            {st}/{total} 章 · {chapterThroughToPct(st, total)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={total}
          value={st}
          onChange={(e) =>
            onChange({
              ...phase,
              strengthenThrough: Number(e.target.value),
            })
          }
        />
        <p className="progress-dash-track-caption">{caption(st)}</p>
        <div className="progress-dash-mini-bar" aria-hidden>
          <div
            className="progress-dash-mini-fill progress-dash-mini-fill--strict"
            style={{ width: `${chapterThroughToPct(st, total)}%` }}
          />
        </div>
      </div>

      {show660 ? (
        <div className="progress-dash-track-block">
          <div className="progress-dash-track-head">
            <span className="progress-dash-track-name">《660》</span>
            <span className="progress-dash-track-meta">
              {b660}/{book660Total} 题 · {pct660}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={book660Total}
            value={b660}
            onChange={(e) =>
              onChange({
                ...phase,
                book660Through: Number(e.target.value),
              })
            }
          />
          <p className="progress-dash-track-caption">{caption660()}</p>
          <div className="progress-dash-mini-bar" aria-hidden>
            <div
              className="progress-dash-mini-fill progress-dash-mini-fill--660"
              style={{ width: `${pct660}%` }}
            />
          </div>
        </div>
      ) : null}

      {(() => {
        const def = BOOK1000_DEFAULT_MAX[subjectKey] ?? { 基础: 0, 强化: 0 };
        const basicMax =
          zhangyuPhases?.基础?.length > 0
            ? zhangyuPhases.基础.length
            : def.基础;
        const strengthenMax =
          zhangyuPhases?.强化?.length > 0
            ? zhangyuPhases.强化.length
            : def.强化;
        if (basicMax <= 0 && strengthenMax <= 0) return null;

        const b1 = Math.min(Math.max(0, phase.book1000BasicThrough ?? 0), basicMax);
        const b2 = Math.min(
          Math.max(0, phase.book1000StrengthenThrough ?? 0),
          strengthenMax
        );
        const captionZy = (through, max, list, label) => {
          if (through <= 0) return `${label} · 未开始`;
          if (through >= max) return `${label} · 已全部过完`;
          const row = list?.[through - 1];
          return row ? `${label} · 已过至：${row.title}` : `${label} · 已过 ${through}/${max} 章`;
        };
        const customCap =
          typeof phase.book1000Caption === "string" && phase.book1000Caption.trim();

        return (
          <>
            {basicMax > 0 ? (
              <div className="progress-dash-track-block">
                <div className="progress-dash-track-head">
                  <span className="progress-dash-track-name">《张宇1000》基础篇</span>
                  <span className="progress-dash-track-meta">
                    {b1}/{basicMax} 章 · {chapterThroughToPct(b1, basicMax)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={basicMax}
                  value={b1}
                  onChange={(e) =>
                    onChange({
                      ...phase,
                      book1000BasicThrough: Number(e.target.value),
                    })
                  }
                />
                <p className="progress-dash-track-caption">
                  {customCap || captionZy(b1, basicMax, zhangyuPhases?.基础, "基础篇")}
                </p>
                <div className="progress-dash-mini-bar" aria-hidden>
                  <div
                    className="progress-dash-mini-fill progress-dash-mini-fill--1000"
                    style={{ width: `${chapterThroughToPct(b1, basicMax)}%` }}
                  />
                </div>
              </div>
            ) : null}
            {strengthenMax > 0 ? (
              <div className="progress-dash-track-block">
                <div className="progress-dash-track-head">
                  <span className="progress-dash-track-name">《张宇1000》强化篇</span>
                  <span className="progress-dash-track-meta">
                    {b2}/{strengthenMax} 章 · {chapterThroughToPct(b2, strengthenMax)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={strengthenMax}
                  value={b2}
                  onChange={(e) =>
                    onChange({
                      ...phase,
                      book1000StrengthenThrough: Number(e.target.value),
                    })
                  }
                />
                <p className="progress-dash-track-caption">
                  {captionZy(b2, strengthenMax, zhangyuPhases?.强化, "强化篇")}
                </p>
                <div className="progress-dash-mini-bar" aria-hidden>
                  <div
                    className="progress-dash-mini-fill progress-dash-mini-fill--1000"
                    style={{ width: `${chapterThroughToPct(b2, strengthenMax)}%` }}
                  />
                </div>
              </div>
            ) : null}
          </>
        );
      })()}
    </div>
  );
}

function ZhangYuComprehensiveTrack({ phase, chapters, onChange }) {
  const total =
    chapters?.length > 0 ? chapters.length : BOOK1000_COMPREHENSIVE_TOTAL;
  const th = Math.min(Math.max(0, phase.comprehensiveThrough ?? 0), total);
  const caption =
    th <= 0
      ? "综合篇 · 未开始"
      : th >= total
        ? "综合篇 · 四套测试卷已全部完成"
        : `综合篇 · 已过至：${chapters?.[th - 1]?.title ?? `第 ${th} 套`}`;

  return (
    <div className="progress-dash-module progress-dash-module--zhangyu-comp">
      <div className="progress-dash-module-title">《张宇1000》综合篇</div>
      <div className="progress-dash-track-head">
        <span className="progress-dash-track-name">测试卷</span>
        <span className="progress-dash-track-meta">
          {th}/{total} · {chapterThroughToPct(th, total)}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={total}
        value={th}
        onChange={(e) =>
          onChange({
            ...phase,
            comprehensiveThrough: Number(e.target.value),
          })
        }
      />
      <p className="progress-dash-track-caption">{caption}</p>
      <div className="progress-dash-mini-bar" aria-hidden>
        <div
          className="progress-dash-mini-fill progress-dash-mini-fill--1000"
          style={{ width: `${chapterThroughToPct(th, total)}%` }}
        />
      </div>
    </div>
  );
}

function Cs408SubjectTrack({
  title,
  subjectKey,
  chapters,
  phase,
  onChange,
}) {
  const total =
    chapters && chapters.length > 0
      ? chapters.length
      : CS408_CHAPTER_DEFAULT_MAX[subjectKey] ?? 8;
  const th = Math.min(Math.max(0, phase.through ?? 0), total);

  const caption =
    th <= 0
      ? "未开始"
      : th >= total
        ? "基础已全部过完"
        : `已过至：${chapters?.[th - 1]?.title ?? `第 ${th} 章`}`;

  return (
    <div className="progress-dash-module">
      <div className="progress-dash-module-title">{title}</div>
      <div className="progress-dash-track-head">
        <span className="progress-dash-track-name">基础进度</span>
        <span className="progress-dash-track-meta">
          {th}/{total} 章 · {chapterThroughToPct(th, total)}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={total}
        value={th}
        onChange={(e) =>
          onChange({
            ...phase,
            through: Number(e.target.value),
          })
        }
      />
      <p className="progress-dash-track-caption">{caption}</p>
      <div className="progress-dash-mini-bar" aria-hidden>
        <div
          className="progress-dash-mini-fill progress-dash-mini-fill--408"
          style={{ width: `${chapterThroughToPct(th, total)}%` }}
        />
      </div>
    </div>
  );
}

function EnglishUnitBlock({
  label,
  totalUnits,
  round1Unit,
  round2Unit,
  onRound1,
  onRound2,
}) {
  const barPct = (u) =>
    totalUnits ? Math.min(100, Math.round((u / totalUnits) * 100)) : 0;

  return (
    <div className="progress-dash-english-block">
      <h4 className="progress-dash-english-h4">
        {label}
        <span className="progress-dash-english-meta">共 {totalUnits} 单元</span>
      </h4>
      <div className="progress-dash-round">
        <div className="progress-dash-round-head">
          <span>一轮</span>
          <span className="progress-dash-round-caption">
            {round1Unit === 0
              ? "未开始"
              : round1Unit >= totalUnits
                ? "已完成一轮"
                : `已背到第 ${round1Unit} / ${totalUnits} 单元`}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={totalUnits}
          value={round1Unit}
          onChange={(e) => onRound1(Number(e.target.value))}
        />
        <div className="progress-dash-unit-bar" role="presentation" aria-hidden>
          <div
            className="progress-dash-unit-fill progress-dash-unit-fill--r1"
            style={{ width: `${barPct(round1Unit)}%` }}
          />
        </div>
      </div>
      <div className="progress-dash-round">
        <div className="progress-dash-round-head">
          <span>二轮</span>
          <span className="progress-dash-round-caption">
            {round2Unit === 0
              ? "未开始"
              : round2Unit >= totalUnits
                ? "已完成二轮"
                : `已背到第 ${round2Unit} / ${totalUnits} 单元`}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={totalUnits}
          value={round2Unit}
          onChange={(e) => onRound2(Number(e.target.value))}
        />
        <div className="progress-dash-unit-bar" role="presentation" aria-hidden>
          <div
            className="progress-dash-unit-fill progress-dash-unit-fill--r2"
            style={{ width: `${barPct(round2Unit)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function StudyProgressDashboard({
  data,
  onChange,
  onClose,
  sourceHint,
  mathCatalog,
  zhangyu1000Catalog,
  catalog408,
  catalogHint,
}) {
  const patchMath1 = (key, phase) => {
    onChange({
      ...data,
      math1: { ...data.math1, [key]: phase },
    });
  };
  const patchMath2 = (key, phase) => {
    onChange({
      ...data,
      math2: { ...data.math2, [key]: phase },
    });
  };
  const patch408 = (key, phase) => {
    onChange({
      ...data,
      cs408: { ...data.cs408, [key]: phase },
    });
  };

  const patchEnglishMust = (patch) => {
    onChange({
      ...data,
      english: {
        ...data.english,
        mustWords: { ...data.english.mustWords, ...patch },
      },
    });
  };
  const patchEnglishBasic = (patch) => {
    onChange({
      ...data,
      english: {
        ...data.english,
        basicWords: { ...data.english.basicWords, ...patch },
      },
    });
  };

  const math = mathCatalog || { 高数: [], 线代: [], 概率论: [] };
  const zy = zhangyu1000Catalog || {
    高数: { 基础: [], 强化: [] },
    线代: { 基础: [], 强化: [] },
    概率论: { 基础: [], 强化: [] },
    综合: [],
  };
  const cs = catalog408 || {
    机组: [],
    数据结构: [],
    计网: [],
    操作系统: [],
  };

  return (
    <div
      className="progress-dash-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="progress-dash-title"
    >
      <div className="progress-dash-panel">
        <div className="progress-dash-toolbar">
          <h2 id="progress-dash-title" className="progress-dash-title">
            学习进度看板
          </h2>
          <div className="progress-dash-toolbar-btns">
            <button type="button" className="ghost-btn" onClick={onClose}>
              关闭（Esc）
            </button>
          </div>
        </div>
        <p className="progress-dash-hint">
          {sourceHint ||
            `数据保存在本机 localStorage（smr-study-progress），可随时调整进度条。`}
        </p>
        {catalogHint ? (
          <p className="progress-dash-catalog-hint">{catalogHint}</p>
        ) : null}

        <div className="progress-dash-grid">
          <section className="progress-dash-col">
            <h3 className="progress-dash-col-title">数学一</h3>
            <div className="progress-dash-col-body">
              <MathSubjectTracks
                title="高数"
                subjectKey="高数"
                chapters={math.高数}
                zhangyuPhases={zy.高数}
                phase={data.math1.高数}
                onChange={(p) => patchMath1("高数", p)}
              />
              <MathSubjectTracks
                title="线代"
                subjectKey="线代"
                chapters={math.线代}
                zhangyuPhases={zy.线代}
                phase={data.math1.线代}
                onChange={(p) => patchMath1("线代", p)}
              />
              <MathSubjectTracks
                title="概率论"
                subjectKey="概率论"
                chapters={math.概率论}
                zhangyuPhases={zy.概率论}
                phase={data.math1.概率论}
                onChange={(p) => patchMath1("概率论", p)}
              />
              <ZhangYuComprehensiveTrack
                phase={data.zhangyu1000 ?? { comprehensiveThrough: 0 }}
                chapters={zy.综合}
                onChange={(p) =>
                  onChange({
                    ...data,
                    zhangyu1000: { ...data.zhangyu1000, ...p },
                  })
                }
              />
            </div>
          </section>

          <section className="progress-dash-col">
            <h3 className="progress-dash-col-title">数学二</h3>
            <div className="progress-dash-col-body">
              <MathSubjectTracks
                title="高数"
                subjectKey="高数"
                chapters={math.高数}
                zhangyuPhases={zy.高数}
                phase={data.math2.高数}
                onChange={(p) => patchMath2("高数", p)}
              />
              <MathSubjectTracks
                title="线代"
                subjectKey="线代"
                chapters={math.线代}
                zhangyuPhases={zy.线代}
                phase={data.math2.线代}
                onChange={(p) => patchMath2("线代", p)}
              />
            </div>
          </section>

          <section className="progress-dash-col">
            <h3 className="progress-dash-col-title">408</h3>
            <div className="progress-dash-col-body">
              <Cs408SubjectTrack
                title="数据结构"
                subjectKey="数据结构"
                chapters={cs.数据结构}
                phase={data.cs408.数据结构}
                onChange={(p) => patch408("数据结构", p)}
              />
              <Cs408SubjectTrack
                title="机组"
                subjectKey="机组"
                chapters={cs.机组}
                phase={data.cs408.机组}
                onChange={(p) => patch408("机组", p)}
              />
              <Cs408SubjectTrack
                title="计网"
                subjectKey="计网"
                chapters={cs.计网}
                phase={data.cs408.计网}
                onChange={(p) => patch408("计网", p)}
              />
              <Cs408SubjectTrack
                title="操作系统"
                subjectKey="操作系统"
                chapters={cs.操作系统}
                phase={data.cs408.操作系统}
                onChange={(p) => patch408("操作系统", p)}
              />
            </div>
          </section>

          <section className="progress-dash-col progress-dash-col--english">
            <h3 className="progress-dash-col-title">英语 · 单词</h3>
            <div className="progress-dash-col-body">
              <EnglishUnitBlock
                label="必考词"
                totalUnits={ENGLISH_MUST_UNITS}
                round1Unit={data.english.mustWords.round1Unit}
                round2Unit={data.english.mustWords.round2Unit}
                onRound1={(v) => patchEnglishMust({ round1Unit: v })}
                onRound2={(v) => patchEnglishMust({ round2Unit: v })}
              />
              <EnglishUnitBlock
                label="基础词"
                totalUnits={ENGLISH_BASIC_UNITS}
                round1Unit={data.english.basicWords.round1Unit}
                round2Unit={data.english.basicWords.round2Unit}
                onRound1={(v) => patchEnglishBasic({ round1Unit: v })}
                onRound2={(v) => patchEnglishBasic({ round2Unit: v })}
              />
            </div>
          </section>

          <section className="progress-dash-col progress-dash-col--muted">
            <h3 className="progress-dash-col-title">政治</h3>
            <div className="progress-dash-placeholder">
              <p>暂不记录</p>
              <p className="progress-dash-placeholder-sub">
                后续若开启政治进度，将在此处扩展。
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
