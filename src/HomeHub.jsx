import { useCallback, useEffect, useState } from "react";

const SECTIONS = [
  {
    id: "reader",
    title: "Markdown 浏览器",
    desc: "打开本地文件夹，浏览与编辑 .md / .mdc，侧栏快速录入、错题与预览。",
    tag: "资料",
  },
  {
    id: "notes",
    title: "学习笔记",
    desc: "独立速记本，自动保存在本机；适合碎片想法，不依赖当前打开的文件夹。",
    tag: "笔记",
  },
  {
    id: "progress",
    title: "进度中心",
    desc: "学习进度、本周推进、路径、练习统计、记账等看板入口。",
    tag: "规划",
  },
];

function scrollToDailyMemorize() {
  document
    .getElementById("home-daily-memorize")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * @param {object} props
 * @param {(id: string) => void} props.onSelectSection
 * @param {{ html: string, relativePath: string, loading: boolean, error: string, hasFile: boolean }} props.dailySecondPass
 * @param {() => void} [props.onOpenDailySecondPassInReader]
 * @param {{ html: string, relativePath: string, loading: boolean, error: string, hasFile: boolean }} props.dailyMemorize
 * @param {() => void} [props.onOpenDailyMemorizeInReader]
 */
export function HomeHub({
  onSelectSection,
  dailySecondPass,
  onOpenDailySecondPassInReader,
  dailyMemorize,
  onOpenDailyMemorizeInReader,
}) {
  const [secondPassOpen, setSecondPassOpen] = useState(false);

  const dsp = dailySecondPass ?? {
    html: "",
    relativePath: "",
    loading: false,
    error: "",
    hasFile: false,
  };
  const dm = dailyMemorize ?? {
    html: "",
    relativePath: "",
    loading: false,
    error: "",
    hasFile: false,
  };

  const closeSecondPass = useCallback(() => setSecondPassOpen(false), []);

  useEffect(() => {
    if (!secondPassOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeSecondPass();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [secondPassOpen, closeSecondPass]);

  return (
    <div className="home-hub">
      <header className="home-hub-header">
        <div className="home-hub-header-row">
          <div>
            <h1 className="home-hub-title">Study Markdown Reader</h1>
            <p className="home-hub-sub">选择工作区 · 同一套数据与快捷键习惯</p>
          </div>
          <div className="home-hub-shortcuts" role="group" aria-label="快捷入口">
            <button
              type="button"
              className="home-hub-shortcut"
              onClick={scrollToDailyMemorize}
            >
              每日要背 ↓
            </button>
          </div>
        </div>
      </header>
      <div className="home-hub-grid" role="navigation" aria-label="工作区">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className="home-hub-card"
            onClick={() => onSelectSection(s.id)}
          >
            <span className="home-hub-card-tag">{s.tag}</span>
            <span className="home-hub-card-title">{s.title}</span>
            <span className="home-hub-card-desc">{s.desc}</span>
          </button>
        ))}
        <button
          type="button"
          className="home-hub-card home-hub-card-daily"
          onClick={scrollToDailyMemorize}
        >
          <span className="home-hub-card-tag">背诵</span>
          <span className="home-hub-card-title">每日要背</span>
          <span className="home-hub-card-desc">
            自动选取文件名含「要背」的最新清单；今日二刷在下方区域内用按钮打开查看。
          </span>
        </button>
      </div>

      <section
        id="home-daily-memorize"
        className="home-hub-daily-memorize home-hub-daily-memorize-main"
        aria-labelledby="home-daily-memorize-h"
      >
        <div className="home-hub-daily-toolbar">
          <h2 id="home-daily-memorize-h" className="home-hub-daily-title">
            每日要背
          </h2>
          {dm.relativePath ? (
            <span className="home-hub-daily-path" title={dm.relativePath}>
              {dm.relativePath}
            </span>
          ) : null}
          <div className="home-hub-daily-actions">
            <button
              type="button"
              className="home-hub-second-pass-btn"
              title="在弹窗中查看今日二刷计划"
              onClick={() => setSecondPassOpen(true)}
            >
              查看今日二刷
            </button>
            {dm.hasFile && typeof onOpenDailyMemorizeInReader === "function" ? (
              <button
                type="button"
                className="home-hub-daily-open"
                onClick={onOpenDailyMemorizeInReader}
              >
                在浏览器中打开
              </button>
            ) : null}
          </div>
        </div>

        {dm.loading ? <p className="hint home-hub-daily-hint">加载中…</p> : null}
        {dm.error ? (
          <p className="home-hub-daily-error" role="alert">
            {dm.error}
          </p>
        ) : null}
        {!dm.loading && !dm.error && !dm.hasFile ? (
          <p className="hint home-hub-daily-hint">
            未找到含「要背」的笔记文件。请先打开 Study 资料库；将背诵清单保存为
            *要背*.md（建议文件名带日期，如 xxx-要背-2026-05-13.md）。
          </p>
        ) : null}
        {!dm.loading && !dm.error && dm.html ? (
          <div
            className="markdown home-hub-daily-markdown home-hub-daily-markdown-expanded"
            // eslint-disable-next-line react/no-danger -- 与资料预览同源 marked 输出
            dangerouslySetInnerHTML={{ __html: dm.html }}
          />
        ) : null}
        {!dm.loading && !dm.error && dm.hasFile && !dm.html ? (
          <p className="hint home-hub-daily-hint">文件为空。</p>
        ) : null}
      </section>

      {secondPassOpen ? (
        <div
          className="quiz-overlay home-hub-second-pass-overlay"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeSecondPass();
          }}
        >
          <div
            className="quiz-panel home-hub-second-pass-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="home-second-pass-modal-h"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="quiz-toolbar home-hub-second-pass-toolbar">
              <h2 id="home-second-pass-modal-h" className="quiz-title">
                每日二刷
              </h2>
              <div className="quiz-toolbar-btns">
                {dsp.hasFile && typeof onOpenDailySecondPassInReader === "function" ? (
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => {
                      onOpenDailySecondPassInReader();
                      closeSecondPass();
                    }}
                  >
                    在浏览器中打开
                  </button>
                ) : null}
                <button type="button" className="ghost-btn" onClick={closeSecondPass}>
                  关闭
                </button>
              </div>
            </div>
            {dsp.relativePath ? (
              <p className="home-hub-second-pass-meta">{dsp.relativePath}</p>
            ) : null}

            {dsp.loading ? <p className="hint">加载中…</p> : null}
            {dsp.error ? (
              <p className="home-hub-daily-error" role="alert">
                {dsp.error}
              </p>
            ) : null}
            {!dsp.loading && !dsp.error && !dsp.hasFile ? (
              <p className="hint">
                未找到「二刷计划」目录下的 .md。请将二刷文件放在 学习资料/二刷计划/ 下，文件名建议以日期开头（如
                2026-05-13-xxx.md）。
              </p>
            ) : null}
            {!dsp.loading && !dsp.error && dsp.html ? (
              <div
                className="markdown home-hub-second-pass-body"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: dsp.html }}
              />
            ) : null}
            {!dsp.loading && !dsp.error && dsp.hasFile && !dsp.html ? (
              <p className="hint">文件为空。</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
