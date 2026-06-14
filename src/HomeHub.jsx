import { useCallback, useEffect, useState } from "react";
import { IconMemorize, IconNotes, IconProgress, IconReader } from "./uiIcons.jsx";

const SECTIONS = [
  {
    id: "reader",
    title: "Markdown 浏览器",
    desc: "打开本地文件夹，浏览与编辑 .md / .mdc，侧栏快速录入、错题与预览。",
    tag: "资料",
    Icon: IconReader,
  },
  {
    id: "notes",
    title: "学习笔记",
    desc: "独立速记本，自动保存在本机；适合碎片想法，不依赖当前打开的文件夹。",
    tag: "笔记",
    Icon: IconNotes,
  },
  {
    id: "progress",
    title: "进度中心",
    desc: "学习进度、视频进度、本周推进、路径、练习统计、记账等看板入口。",
    tag: "规划",
    Icon: IconProgress,
  },
];

const MODE_HINT = {
  "today-file": "今日要背清单",
  composed: "当日错题 + 知识点/摘要 自动汇总",
  "fallback-file": "暂无今日内容，展示最近要背清单",
  empty: "",
};

/**
 * @param {object} props
 * @param {(id: string) => void} props.onSelectSection
 * @param {{ html: string, relativePath: string, loading: boolean, error: string, hasContent: boolean, canOpenInReader: boolean, mode: string, ymd: string }} props.dailyMemorize
 * @param {{ html: string, relativePath: string, loading: boolean, error: string, hasFile: boolean }} props.dailySecondPass
 * @param {() => void} [props.onOpenDailySecondPassInReader]
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
    hasContent: false,
    canOpenInReader: false,
    mode: "empty",
    ymd: "",
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
        </div>
      </header>

      <div className="home-hub-layout">
        <nav className="home-hub-nav" aria-label="工作区">
          {SECTIONS.map((s) => {
            const CardIcon = s.Icon;
            return (
              <button
                key={s.id}
                type="button"
                className="home-hub-card home-hub-card--nav"
                onClick={() => onSelectSection(s.id)}
              >
                <span className="home-hub-card-icon" aria-hidden="true">
                  <CardIcon />
                </span>
                <span className="home-hub-card-body">
                  <span className="home-hub-card-tag">{s.tag}</span>
                  <span className="home-hub-card-title">{s.title}</span>
                  <span className="home-hub-card-desc">{s.desc}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <section
          id="home-daily-memorize"
          className="home-hub-daily-memorize home-hub-daily-memorize-main"
          aria-labelledby="home-daily-memorize-h"
        >
          <div className="home-hub-daily-toolbar">
            <div className="home-hub-daily-heading">
              <h2 id="home-daily-memorize-h" className="home-hub-daily-title">
                每日要背
                {dm.ymd ? (
                  <span className="home-hub-daily-date">{dm.ymd}</span>
                ) : null}
              </h2>
              {dm.relativePath ? (
                <p className="home-hub-daily-source" title={dm.relativePath}>
                  {MODE_HINT[dm.mode] || dm.relativePath}
                  {dm.relativePath && dm.mode !== "composed" ? ` · ${dm.relativePath}` : ""}
                </p>
              ) : MODE_HINT[dm.mode] ? (
                <p className="home-hub-daily-source">{MODE_HINT[dm.mode]}</p>
              ) : null}
            </div>
            <div className="home-hub-daily-actions">
              <button
                type="button"
                className="home-hub-second-pass-btn"
                title="在弹窗中查看今日二刷计划"
                onClick={() => setSecondPassOpen(true)}
              >
                查看今日二刷
              </button>
              {dm.canOpenInReader && typeof onOpenDailyMemorizeInReader === "function" ? (
                <button
                  type="button"
                  className="home-hub-daily-open"
                  onClick={onOpenDailyMemorizeInReader}
                >
                  打开来源文件
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
          {!dm.loading && !dm.error && !dm.hasContent ? (
            <p className="hint home-hub-daily-hint">
              今日（{dm.ymd || "本日"}）暂无可背内容。请先在错题本写入带日期的题目（
              <code>## 2026-05-30 …</code> 或 <code>- 日期：</code>
              ），或在笔记中填写 <code>## 📌 知识点 · 日期</code>；也可保存
              <code>*要背*-日期.md</code> 清单。
            </p>
          ) : null}
          {!dm.loading && !dm.error && dm.html ? (
            <div
              className="markdown home-hub-daily-markdown home-hub-daily-markdown-expanded"
              // eslint-disable-next-line react/no-danger -- 与资料预览同源 marked 输出
              dangerouslySetInnerHTML={{ __html: dm.html }}
            />
          ) : null}
        </section>
      </div>

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
