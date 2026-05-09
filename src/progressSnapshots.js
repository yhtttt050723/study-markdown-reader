import { normalizeRelPath } from "./markdownQuiz.js";
import { LS_PROGRESS_SNAPSHOTS, tryGetLocalStorage, trySetLocalStorage } from "./storageKeys.js";

/** 自然周内综合进度提升 ≥ 此值（百分点）则提示「吃饭奖励」 */
export const WEEKLY_REWARD_DELTA_PCT = 10;

/** @typedef {{ d: string, s: number }} ProgressSnapshot d=YYYY-MM-DD */

function localYmd(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(ymd, deltaDays) {
  const [y, mo, d] = ymd.split("-").map(Number);
  const dt = new Date(y, mo - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return localYmd(dt);
}

export function readProgressSnapshots() {
  try {
    const raw = tryGetLocalStorage(LS_PROGRESS_SNAPSHOTS);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x) => x && typeof x.d === "string" && Number.isFinite(Number(x.s)))
      .map((x) => ({ d: x.d, s: Math.round(Number(x.s) * 10) / 10 }))
      .sort((a, b) => a.d.localeCompare(b.d));
  } catch {
    return [];
  }
}

function writeSnapshots(list) {
  const trimmed = list.slice(-200);
  trySetLocalStorage(LS_PROGRESS_SNAPSHOTS, JSON.stringify(trimmed));
}

/**
 * 写入或更新「今天」的快照（同一天只保留一条，取最新分数）。
 */
export function upsertTodaySnapshot(score) {
  const s = Math.min(100, Math.max(0, Math.round(Number(score) * 10) / 10));
  const today = localYmd();
  const arr = readProgressSnapshots();
  const i = arr.findIndex((x) => x.d === today);
  if (i >= 0) arr[i] = { d: today, s };
  else arr.push({ d: today, s });
  arr.sort((a, b) => a.d.localeCompare(b.d));
  writeSnapshots(arr);
}

/**
 * 最近 7 个自然日（含今天）窗口内的进度增幅：窗口内最后一次快照 − 第一次快照。
 * @param {ProgressSnapshot[]} snapshots
 */
export function computeRollingSevenDayDelta(snapshots) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  const startStr = localYmd(start);
  const endStr = localYmd(end);
  const inWin = snapshots.filter((x) => x.d >= startStr && x.d <= endStr).sort((a, b) => a.d.localeCompare(b.d));
  if (inWin.length < 2) {
    return {
      startStr,
      endStr,
      startScore: inWin[0]?.s ?? null,
      endScore: inWin[inWin.length - 1]?.s ?? null,
      delta: null,
      snapshotsInWindow: inWin,
      reason: "need_two_days",
    };
  }
  const first = inWin[0].s;
  const last = inWin[inWin.length - 1].s;
  return {
    startStr,
    endStr,
    startScore: first,
    endScore: last,
    delta: Math.round((last - first) * 10) / 10,
    snapshotsInWindow: inWin,
    reason: null,
  };
}

/**
 * 窗口内每个自然日相对前一日的分数变化（有快照的日才显示）。
 */
export function dayOverDayDeltas(snapshots, startStr, endStr) {
  const map = Object.fromEntries(snapshots.map((x) => [x.d, x.s]));
  const out = [];
  let cursor = startStr;
  let prev = null;
  while (cursor <= endStr) {
    const s = map[cursor];
    if (s != null) {
      out.push({
        d: cursor,
        s,
        deltaFromPrev: prev == null ? null : Math.round((s - prev) * 10) / 10,
      });
      prev = s;
    } else {
      out.push({ d: cursor, s: null, deltaFromPrev: null });
    }
    cursor = addDays(cursor, 1);
  }
  return out;
}

const DAILY_MD = /^\d{4}-\d{2}-\d{2}\.md$/i;

/**
 * 统计「周期记录」下 YYYY-MM-DD.md 日报文件在日期区间内的数量。
 * @param {Array<{ name?: string, relativePath?: string }>} files
 * @param {string} startStr YYYY-MM-DD
 * @param {string} endStr YYYY-MM-DD
 */
export function countDailyReportsInRange(files, startStr, endStr) {
  if (!files?.length) return 0;
  let n = 0;
  for (const f of files) {
    const rp = normalizeRelPath(f.relativePath || "");
    if (!rp.includes("周期记录")) continue;
    const name = f.name || "";
    if (!DAILY_MD.test(name)) continue;
    const base = name.replace(/\.md$/i, "");
    if (base >= startStr && base <= endStr) n += 1;
  }
  return n;
}
