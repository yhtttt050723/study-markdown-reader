import { normalizeRelPath } from "./markdownQuiz.js";
import { LS_VIDEO_PROGRESS, tryGetLocalStorage, trySetLocalStorage } from "./storageKeys.js";
import { labelFromBvMarkdown } from "./seriesLabel.js";

/** Markdown 中 JSON 代码块语言标记 */
export const VIDEO_PROGRESS_FENCE = "smr-video-progress";

/**
 * @typedef {{ bvid: string, label: string, detailRelPath: string, totalSeconds?: number, creditedWatchedSeconds?: number }} VideoSeriesRef
 * @typedef {{ dailyLog: Record<string, number>, series: VideoSeriesRef[] }} VideoProgressData
 */

/**
 * @param {{ name?: string, relativePath?: string } | null} file
 */
export function isVideoProgressFile(file) {
  if (!file) return false;
  const name = file.name || "";
  const rp = normalizeRelPath(file.relativePath || "");
  return name.includes("视频进度看板数据") || rp.includes("视频进度看板数据");
}

/**
 * @param {string} folderPath
 */
export function resolveVideoProgressDefaultPath(folderPath) {
  if (!folderPath || typeof folderPath !== "string") return null;
  const trimmed = folderPath.replace(/[/\\]+$/, "");
  const sep = trimmed.includes("\\") ? "\\" : "/";
  return `${trimmed}${sep}学习资料${sep}学习视频进度${sep}视频进度看板数据.md`;
}

/**
 * @param {string} folderPath
 * @param {string} relPath 使用 `/` 或 `\` 均可
 */
export function joinFolderRel(folderPath, relPath) {
  if (!folderPath || !relPath) return null;
  const sep = folderPath.includes("\\") ? "\\" : "/";
  const tail = String(relPath).replace(/\//g, sep).replace(/^[\\/]+/, "");
  return `${folderPath.replace(/[/\\]+$/, "")}${sep}${tail}`;
}

export const DEFAULT_VIDEO_PROGRESS = {
  dailyLog: {},
  series: [],
};

function normalizeDailyLog(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
    const n = Math.round(Number(v));
    if (!Number.isFinite(n) || n < 0 || n > 24 * 60) continue;
    out[k] = n;
  }
  return out;
}

function normalizeSeriesEntry(row) {
  if (!row || typeof row !== "object") return null;
  const bvid = typeof row.bvid === "string" ? row.bvid.trim() : "";
  const label = typeof row.label === "string" ? row.label.trim() : "";
  const detailRelPath =
    typeof row.detailRelPath === "string" ? row.detailRelPath.trim().replace(/\//g, "\\") : "";
  if (!bvid || !detailRelPath) return null;
  const totalSeconds = Math.floor(Number(row.totalSeconds));
  const creditedWatchedSeconds = Math.floor(Number(row.creditedWatchedSeconds));
  return {
    bvid,
    label: label || bvid,
    detailRelPath,
    totalSeconds: Number.isFinite(totalSeconds) && totalSeconds > 0 ? totalSeconds : undefined,
    creditedWatchedSeconds:
      Number.isFinite(creditedWatchedSeconds) && creditedWatchedSeconds >= 0
        ? creditedWatchedSeconds
        : undefined,
  };
}

/**
 * @param {VideoProgressData} base
 * @param {unknown} patch
 */
export function mergeVideoProgressData(base, patch) {
  if (patch == null || typeof patch !== "object") return base;
  const p = /** @type {Record<string, unknown>} */ (patch);
  const dailyLog = normalizeDailyLog({
    ...base.dailyLog,
    ...(typeof p.dailyLog === "object" && p.dailyLog ? p.dailyLog : {}),
  });
  const byBvid = new Map();
  for (const s of base.series || []) {
    byBvid.set(s.bvid, { ...s });
  }
  if (Array.isArray(p.series)) {
    for (const row of p.series) {
      const s = normalizeSeriesEntry(row);
      if (!s) continue;
      byBvid.set(s.bvid, { ...byBvid.get(s.bvid), ...s });
    }
  }
  const series = Array.from(byBvid.values());
  return { dailyLog, series };
}

const SKIP_BV_MD = new Set(["总览.md", "视频进度看板数据.md"]);

/**
 * 从 BV 详情 md 文本推断可读课程名（需调用方传入 content）。
 * @param {string} md
 * @param {string} bvid
 * @param {string} fallbackLabel
 */
export function seriesLabelFromMarkdown(md, bvid, fallbackLabel) {
  return labelFromBvMarkdown(md, bvid, fallbackLabel);
}

/**
 * 从 Study 根目录 markdown 文件列表中发现 BV 系列（仅文件名；有 content 时用 seriesLabelFromMarkdown）。
 * @param {Array<{ name?: string, relativePath?: string, content?: string }>} files
 * @returns {VideoSeriesRef[]}
 */
export function discoverSeriesFromStudyMarkdownFiles(files) {
  const byBvid = new Map();
  for (const f of files || []) {
    const name = f.name || "";
    if (!name.toLowerCase().endsWith(".md")) continue;
    if (SKIP_BV_MD.has(name)) continue;
    const rp = normalizeRelPath(f.relativePath || "");
    if (!rp.includes("学习视频进度")) continue;
    const m = name.match(/^(BV[\w]+)/i);
    if (!m) continue;
    const bvid = m[1];
    const rest = name.replace(/^BV[\w]+-?/i, "").replace(/\.md$/i, "").trim();
    const fallback = rest && rest.toLowerCase() !== "video-dash" ? rest : bvid;
    const label =
      typeof f.content === "string" && f.content.trim()
        ? labelFromBvMarkdown(f.content, bvid, fallback)
        : fallback;
    const detailRelPath = rp.replace(/\//g, "\\");
    byBvid.set(bvid, { bvid, label, detailRelPath });
  }
  return Array.from(byBvid.values());
}

/**
 * @param {VideoProgressData} data
 * @param {VideoSeriesRef[]} discovered
 */
export function mergeDiscoveredSeries(data, discovered) {
  return mergeVideoProgressData(data, { series: discovered });
}

export function readVideoProgress() {
  try {
    const raw = tryGetLocalStorage(LS_VIDEO_PROGRESS);
    if (!raw) return structuredClone(DEFAULT_VIDEO_PROGRESS);
    const parsed = JSON.parse(raw);
    return mergeVideoProgressData(structuredClone(DEFAULT_VIDEO_PROGRESS), parsed);
  } catch {
    return structuredClone(DEFAULT_VIDEO_PROGRESS);
  }
}

/**
 * @param {VideoProgressData} data
 */
export function writeVideoProgress(data) {
  try {
    trySetLocalStorage(LS_VIDEO_PROGRESS, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} md
 */
export function parseVideoProgressFromMarkdown(md) {
  const body = md || "";
  const re = new RegExp("```" + VIDEO_PROGRESS_FENCE + "\\s*\\r?\\n([\\s\\S]*?)```", "m");
  const m = body.match(re);
  if (!m) return structuredClone(DEFAULT_VIDEO_PROGRESS);
  try {
    const parsed = JSON.parse(m[1].trim());
    return mergeVideoProgressData(structuredClone(DEFAULT_VIDEO_PROGRESS), parsed);
  } catch {
    return structuredClone(DEFAULT_VIDEO_PROGRESS);
  }
}

/**
 * @param {VideoProgressData} data
 */
export function buildVideoProgressMarkdown(data) {
  const json = JSON.stringify(data, null, 2);
  return `# 视频进度看板数据

本文件由 Study Markdown Reader **视频进度看板** 读写。下方 \`${VIDEO_PROGRESS_FENCE}\` 代码块中：

- **dailyLog**：自然日 **YYYY-MM-DD → 当日看视频学习分钟数**（手改、看板内改，或 **video-dash 勾选新分 P 时自动累加**）。
- **series**：每个 B 站稿件一条，**detailRelPath** 指向 BV 详情；**creditedWatchedSeconds** 为已计入 dailyLog 的勾选秒数（避免重复累计）。

\`\`\`${VIDEO_PROGRESS_FENCE}
${json}
\`\`\`
`;
}

/**
 * @param {Record<string, number>} dailyLog
 * @param {string} startStr YYYY-MM-DD
 * @param {string} endStr YYYY-MM-DD
 */
export function sumDailyLogMinutesInRange(dailyLog, startStr, endStr) {
  if (!dailyLog || typeof dailyLog !== "object") return 0;
  let sum = 0;
  for (const [d, min] of Object.entries(dailyLog)) {
    if (d >= startStr && d <= endStr) sum += Math.max(0, Math.round(Number(min) || 0));
  }
  return sum;
}

function addOneDay(ymd) {
  const [y, mo, d] = ymd.split("-").map(Number);
  const dt = new Date(y, mo - 1, d);
  dt.setDate(dt.getDate() + 1);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * @param {string} startStr
 * @param {string} endStr
 * @returns {string[]}
 */
export function enumerateDatesInclusive(startStr, endStr) {
  const out = [];
  let cur = startStr;
  let guard = 0;
  while (cur <= endStr && guard++ < 40) {
    out.push(cur);
    cur = addOneDay(cur);
  }
  return out;
}

function todayYmdLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 将勾选增量计入 dailyLog；首次见到某 BV 仅建立 baseline，不灌入历史勾选。
 * @param {VideoProgressData} data
 * @param {Array<{ bvid: string, label?: string, detailRelPath?: string, watchedSeconds: number, totalSeconds?: number }>} updates
 * @param {string} [dateStr]
 * @param {{ forceUncredited?: boolean }} [opts] forceUncredited=true 时把尚未 credited 的已勾选全部记入当日（用于首次对齐）
 */
export function creditWatchedDeltaToDailyLog(data, updates, dateStr = todayYmdLocal(), opts = {}) {
  const forceUncredited = Boolean(opts.forceUncredited);
  const dailyLog = { ...data.dailyLog };
  const byBvid = new Map();
  for (const s of data.series || []) {
    byBvid.set(s.bvid, { ...s });
  }
  let addedMinutes = 0;

  for (const u of updates) {
    if (!u?.bvid) continue;
    const prev = byBvid.get(u.bvid) || {
      bvid: u.bvid,
      label: u.label || u.bvid,
      detailRelPath: u.detailRelPath || "",
    };
    const credited = Math.max(0, Math.floor(Number(prev.creditedWatchedSeconds) || 0));
    const watched = Math.max(0, Math.floor(Number(u.watchedSeconds) || 0));

    if (prev.creditedWatchedSeconds == null) {
      if (forceUncredited && watched > 0) {
        addedMinutes += Math.round(watched / 60);
        prev.creditedWatchedSeconds = watched;
      } else {
        prev.creditedWatchedSeconds = watched;
      }
    } else {
      const delta = Math.max(0, watched - credited);
      if (delta > 0) {
        addedMinutes += Math.round(delta / 60);
        prev.creditedWatchedSeconds = watched;
      }
    }
    if (u.label) prev.label = u.label;
    if (u.detailRelPath) prev.detailRelPath = u.detailRelPath;
    if (u.totalSeconds > 0) prev.totalSeconds = Math.floor(u.totalSeconds);
    byBvid.set(u.bvid, prev);
  }

  if (addedMinutes > 0) {
    const today = dateStr;
    dailyLog[today] = Math.min(24 * 60, (dailyLog[today] || 0) + addedMinutes);
  }

  return {
    data: { dailyLog, series: Array.from(byBvid.values()) },
    addedMinutes,
  };
}
