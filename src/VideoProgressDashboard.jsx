import { useCallback, useEffect, useMemo, useState } from "react";
import { parseVideoDetailChecklist } from "./videoDetailParse.js";
import {
  enumerateDatesInclusive,
  joinFolderRel,
  sumDailyLogMinutesInRange,
  creditWatchedDeltaToDailyLog,
  discoverSeriesFromStudyMarkdownFiles,
  mergeDiscoveredSeries,
} from "./videoProgress.js";

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatSec(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  if (s < 60) return `${s} 秒`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return r ? `${m} 分 ${r} 秒` : `${m} 分`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h} 小时 ${mm} 分`;
}

/**
 * @param {{
 *   data: { dailyLog: Record<string, number>, series: Array<{ bvid: string, label: string, detailRelPath: string, totalSeconds?: number }> },
 *   onChange: (next: object) => void,
 *   onClose: () => void,
 *   sourceHint: string | null,
 *   weekStart: string,
 *   weekEnd: string,
 *   folderPath: string | null,
 *   hasApi: boolean,
 * }} props
 */
export function VideoProgressDashboard({
  data,
  onChange,
  onClose,
  sourceHint,
  weekStart,
  weekEnd,
  folderPath,
  hasApi,
}) {
  const weekDates = useMemo(
    () => enumerateDatesInclusive(weekStart, weekEnd),
    [weekStart, weekEnd]
  );

  const weekMinutes = useMemo(
    () => sumDailyLogMinutesInRange(data.dailyLog || {}, weekStart, weekEnd),
    [data.dailyLog, weekStart, weekEnd]
  );

  const [parsedMap, setParsedMap] = useState(() => new Map());
  const [seriesDiscoverDone, setSeriesDiscoverDone] = useState(false);

  const effectiveSeries = useMemo(() => data.series || [], [data.series]);

  const loadDetails = useCallback(async () => {
    if (!folderPath || !hasApi || typeof window.electronAPI?.readMarkdownFile !== "function") {
      setParsedMap(new Map());
      return;
    }
    const next = new Map();
    for (const s of effectiveSeries) {
      const fp = joinFolderRel(folderPath, s.detailRelPath);
      if (!fp) continue;
      try {
        const md = await window.electronAPI.readMarkdownFile(fp);
        const stats = parseVideoDetailChecklist(md);
        next.set(s.bvid, stats);
      } catch {
        next.set(s.bvid, null);
      }
    }
    setParsedMap(next);
  }, [folderPath, hasApi, effectiveSeries]);

  useEffect(() => {
    if (!folderPath || !hasApi || seriesDiscoverDone) return;
    if (typeof window.electronAPI?.listMarkdownFiles !== "function") return;
    let cancelled = false;
    (async () => {
      try {
        const files = await window.electronAPI.listMarkdownFiles(folderPath);
        if (cancelled) return;
        const discovered = discoverSeriesFromStudyMarkdownFiles(files);
        setSeriesDiscoverDone(true);
        if (discovered.length > (data.series?.length || 0)) {
          onChange(mergeDiscoveredSeries(data, discovered));
        }
      } catch {
        if (!cancelled) setSeriesDiscoverDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [folderPath, hasApi, seriesDiscoverDone, data, onChange]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadDetails();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [loadDetails]);

  const patchDaily = useCallback(
    (dateStr, minutes) => {
      const n = Math.max(0, Math.min(24 * 60, Math.round(Number(minutes) || 0)));
      const dailyLog = { ...data.dailyLog };
      if (n <= 0) delete dailyLog[dateStr];
      else dailyLog[dateStr] = n;
      onChange({ ...data, dailyLog });
    },
    [data, onChange]
  );

  const weekHours = (weekMinutes / 60).toFixed(1);

  const uncreditedMinutes = useMemo(() => {
    let sec = 0;
    for (const s of effectiveSeries) {
      const stats = parsedMap.get(s.bvid);
      if (!stats) continue;
      const credited = Math.max(0, Math.floor(Number(s.creditedWatchedSeconds) || 0));
      sec += Math.max(0, stats.doneSeconds - credited);
    }
    return Math.round(sec / 60);
  }, [effectiveSeries, parsedMap]);

  const syncChecklistToDaily = useCallback(
    (forceUncredited = false) => {
      const updates = effectiveSeries
        .map((s) => {
          const stats = parsedMap.get(s.bvid);
          if (!stats) return null;
          return {
            bvid: s.bvid,
            label: s.label,
            detailRelPath: s.detailRelPath,
            watchedSeconds: stats.doneSeconds,
            totalSeconds: stats.totalSeconds,
          };
        })
        .filter(Boolean);
      if (updates.length === 0) return;
      const { data: next, addedMinutes } = creditWatchedDeltaToDailyLog(
        data,
        updates,
        todayYmd(),
        { forceUncredited }
      );
      onChange(next);
      return addedMinutes;
    },
    [data, onChange, parsedMap, effectiveSeries]
  );

  return (
    <div
      className="progress-dash-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="video-progress-dash-title"
    >
      <div className="progress-dash-panel">
        <div className="progress-dash-toolbar">
          <h2 id="video-progress-dash-title" className="progress-dash-title">
            视频进度看板
          </h2>
          <div className="progress-dash-toolbar-btns">
            <button type="button" className="ghost-btn" onClick={onClose}>
              关闭（Esc）
            </button>
          </div>
        </div>

        <p className="progress-dash-hint">
          {sourceHint ||
            "「本周观看」= 下方 dailyLog 分钟之和；「B 站系列」= 详情 .md 里累计勾选时长。二者不同属正常；用 video-dash 勾选或点「同步勾选→登记」可把新观看记入 dailyLog。"}
        </p>

        <div className="video-prog-week-banner">
          <div className="video-prog-week-stat">
            <span className="video-prog-week-label">本周观看（登记）</span>
            <strong className="video-prog-week-value">
              {weekMinutes} 分钟
            </strong>
            <span className="video-prog-week-sub">约 {weekHours} 小时 · 窗口 {weekStart} ～ {weekEnd}</span>
          </div>
          {uncreditedMinutes > 0 && folderPath && hasApi ? (
            <div className="video-prog-sync-row">
              <p className="video-prog-sync-hint">
                检测到约 <strong>{uncreditedMinutes} 分钟</strong> 已勾选尚未计入登记。
              </p>
              <button
                type="button"
                className="ghost-btn video-prog-sync-btn"
                onClick={() => syncChecklistToDaily(true)}
              >
                同步勾选 → 记入今日登记
              </button>
            </div>
          ) : null}
        </div>

        <section className="video-prog-section">
          <h3 className="video-prog-section-title">最近 7 日 · 每日观看分钟</h3>
          <p className="video-prog-section-lead">
            看完课后在此填「当日累计」；<strong>与下方 B 站勾选进度是两套数据</strong>。video-dash 新勾选会自动写入；也可用上方的「同步勾选→登记」。
          </p>
          <div className="video-prog-daily-grid">
            {weekDates.map((d) => (
              <label key={d} className="video-prog-daily-row">
                <span className="video-prog-daily-date">{d}</span>
                <input
                  type="number"
                  min={0}
                  max={1440}
                  step={1}
                  className="video-prog-daily-input"
                  value={data.dailyLog?.[d] ?? ""}
                  placeholder="0"
                  onChange={(e) => patchDaily(d, e.target.value === "" ? 0 : e.target.value)}
                />
                <span className="video-prog-daily-unit">分钟</span>
              </label>
            ))}
          </div>
        </section>

        <section className="video-prog-section">
          <h3 className="video-prog-section-title">B 站系列 · 勾选与时长</h3>
          <p className="video-prog-section-lead">
            进度条 = 详情文件中 <code>[x]</code> 分 P 的时长合计 ÷ 全稿分 P 时长合计；时长来自 MDC 写入的 <code>（NNNs）</code>。
          </p>
          {!folderPath || !hasApi ? (
            <p className="progress-dash-placeholder-sub">打开本地资料库文件夹后，将自动读取各 BV 详情 .md。</p>
          ) : null}
          {effectiveSeries.length === 0 ? (
            <p className="progress-dash-placeholder-sub">
              尚无系列：请在「学习视频进度」目录放置 <code>BV*.md</code>，或在 video-dash 中同步后刷新。
            </p>
          ) : (
            <div className="video-prog-series-list">
              {effectiveSeries.map((s) => {
                const stats = parsedMap.get(s.bvid);
                const totalS = stats?.totalSeconds ?? s.totalSeconds ?? 0;
                const doneS = stats?.doneSeconds ?? 0;
                const pct = totalS > 0 ? Math.min(100, Math.round((doneS / totalS) * 1000) / 10) : 0;
                const doneP = stats?.doneParts ?? 0;
                const totalP = stats?.totalParts ?? 0;
                return (
                  <div key={s.bvid} className="video-prog-series-card">
                    <div className="video-prog-series-head">
                      <strong>{s.label}</strong>
                      <code className="video-prog-bvid">{s.bvid}</code>
                    </div>
                    <p className="video-prog-series-path">
                      <code>{s.detailRelPath}</code>
                    </p>
                    {!stats && folderPath && hasApi ? (
                      <p className="video-prog-warn">未读到详情或文件中尚无分 P 行。</p>
                    ) : null}
                    {stats ? (
                      <>
                        <div className="video-prog-bar-track" aria-hidden>
                          <div className="video-prog-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="video-prog-series-meta">
                          已勾选 <strong>{formatSec(doneS)}</strong> / 全稿 <strong>{formatSec(totalS)}</strong>（
                          {doneP}/{totalP} P）· {pct}%
                        </p>
                      </>
                    ) : null}
                    <a
                      className="video-prog-link"
                      href={`https://www.bilibili.com/video/${s.bvid}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      打开合集
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
