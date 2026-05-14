import { normalizeRelPath } from "./markdownQuiz.js";
import { LS_VIDEO_PROGRESS, tryGetLocalStorage, trySetLocalStorage } from "./storageKeys.js";

/** Markdown 中 JSON 代码块语言标记 */
export const VIDEO_PROGRESS_FENCE = "smr-video-progress";

/**
 * @typedef {{ bvid: string, label: string, detailRelPath: string, totalSeconds?: number }} VideoSeriesRef
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
  return {
    bvid,
    label: label || bvid,
    detailRelPath,
    totalSeconds: Number.isFinite(totalSeconds) && totalSeconds > 0 ? totalSeconds : undefined,
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

- **dailyLog**：自然日 **YYYY-MM-DD → 当日看视频学习分钟数**（手改或看板内改），用于与「本周进度」相同的 **最近 7 日**窗口汇总「本周观看时长」。
- **series**：每个 B 站稿件一条，**detailRelPath** 指向同目录下的 BV 详情（分 P 勾选 + **（秒数）** 由 MDC / 助手从接口写入）。

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
