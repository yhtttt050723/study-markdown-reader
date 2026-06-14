import { normalizeRelPath } from "./markdownQuiz.js";

export const STUDY_TIME_FENCE = "smr-study-time";

const DAILY_MD = /^(\d{4}-\d{2}-\d{2})\.md$/i;

const SKIP_LINE =
  /午饭|当前（|说明：|待做|修订记录|本机时间锚点|今日学习合计|^\s*-\s*\*\*说明|计组.*习题.*→|§8\.\d.*→/i;

/** 从 bullet 行提取时段键，用于去重 */
function extractTimeSlotKey(line) {
  const m = line.match(/\*\*(\d{1,2}:\d{2})—(\d{1,2}:\d{2})\*\*/);
  return m ? `${m[1]}—${m[2]}` : null;
}

function extractBlockLabel(line) {
  const m = line.match(
    /^\s*-\s*\*\*(\d{1,2}:\d{2})—(\d{1,2}:\d{2})\*\*[^*]*\*\*([^*]+)\*\*/
  );
  if (m) return `${m[1]}—${m[2]} ${m[3].trim()}`;
  return line.replace(/^\s*-\s*/, "").slice(0, 120);
}

function parseMinutesFromLine(line, { requireExplicitDuration = false } = {}) {
  const hasExplicit =
    /约\s*\*\*(\d+\s*h(\s*\d+\s*min)?|\d+\s*min)\*\*/i.test(line) ||
    /（约\s*\*\*(\d+\s*h(\s*\d+\s*min)?|\d+\s*min)\*\*）/i.test(line);

  const hm =
    line.match(/约\s*\*\*(\d+)\s*h\s*(\d+)\s*min\*\*/i) ||
    line.match(/（约\s*\*\*(\d+)\s*h\s*(\d+)\s*min\*\*）/i) ||
    line.match(/约\s*(\d+)\s*h\s*(\d+)\s*min/i);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2]);

  const hOnly =
    line.match(/约\s*\*\*(\d+)\s*h\*\*/i) ||
    line.match(/（约\s*\*\*(\d+)\s*h\*\*）/i) ||
    line.match(/约\s*(\d+)\s*h(?!(\s*\d+\s*min))/i);
  if (hOnly) return Number(hOnly[1]) * 60;

  const mOnly =
    line.match(/约\s*\*\*(\d+)\s*min\*\*/i) ||
    line.match(/（约\s*\*\*(\d+)\s*min\*\*）/i) ||
    line.match(/约\s*(\d+)\s*min/i);
  if (mOnly) return Number(mOnly[1]);

  if (requireExplicitDuration && !hasExplicit) return 0;

  const tr = line.match(/\*\*(\d{1,2}):(\d{2})—(\d{1,2}):(\d{2})\*\*/);
  if (tr) {
    const start = Number(tr[1]) * 60 + Number(tr[2]);
    const end = Number(tr[3]) * 60 + Number(tr[4]);
    if (end > start) return end - start;
  }
  return 0;
}

/**
 * @param {Array<{ name?: string, relativePath?: string, fullPath?: string }>} files
 */
export function listDailyReportFiles(files) {
  if (!files?.length) return [];
  return files
    .filter((f) => {
      const rp = normalizeRelPath(f.relativePath || "");
      if (!rp.includes("周期记录")) return false;
      const name = f.name || "";
      return DAILY_MD.test(name);
    })
    .map((f) => ({
      ...f,
      date: (f.name || "").replace(/\.md$/i, ""),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 从日报 Markdown 解析学习时长（仅「当日执行摘要」中带「约 X min」的行；可选 `smr-study-time` JSON）。
 * @param {string} md
 */
export function parseStudyMinutesFromReport(md) {
  const body = md || "";
  const fenceRe = new RegExp(
    "```" + STUDY_TIME_FENCE + "\\s*\\r?\\n([\\s\\S]*?)```",
    "m"
  );
  const fm = body.match(fenceRe);
  if (fm) {
    try {
      const j = JSON.parse(fm[1].trim());
      const total = Number(j.totalMinutes);
      if (Number.isFinite(total) && total >= 0) {
        const rawBlocks = Array.isArray(j.blocks)
          ? j.blocks
              .filter((b) => b && Number.isFinite(Number(b.minutes)))
              .map((b) => ({
                minutes: Number(b.minutes),
                label: String(b.label || "").trim() || "学习块",
                slotKey: b.slotKey || undefined,
              }))
          : [];
        const seen = new Set();
        const blocks = [];
        for (const b of rawBlocks) {
          const key = b.slotKey || b.label;
          if (key && seen.has(key)) continue;
          if (key) seen.add(key);
          blocks.push(b);
        }
        const sum = blocks.reduce((s, b) => s + b.minutes, 0);
        return {
          totalMinutes: Math.round(total > 0 ? total : sum),
          blocks: blocks.length ? blocks : [{ minutes: Math.round(total), label: "合计（JSON）" }],
          source: "smr-study-time",
        };
      }
    } catch {
      /* fall through */
    }
  }

  const blocks = [];
  const seenSlots = new Set();
  const lines = body.split(/\r?\n/);
  let inSummary = false;
  for (const line of lines) {
    if (/^##\s*当日执行摘要/.test(line)) {
      inSummary = true;
      continue;
    }
    // 摘要结束：--- 分隔线，或任意 Markdown 标题（含 # 一级「📅 每日复习日报」）
    if (inSummary && (/^---\s*$/.test(line.trim()) || /^#{1,6}\s/.test(line))) {
      break;
    }
    if (!inSummary) continue;
    if (!/^\s*-\s*\*\*\d{1,2}:\d{2}—/.test(line)) continue;
    if (SKIP_LINE.test(line)) continue;
    const slotKey = extractTimeSlotKey(line);
    if (slotKey && seenSlots.has(slotKey)) continue;
    const minutes = parseMinutesFromLine(line, { requireExplicitDuration: true });
    if (minutes > 0) {
      if (slotKey) seenSlots.add(slotKey);
      blocks.push({ minutes, label: extractBlockLabel(line), slotKey: slotKey || undefined });
    }
  }

  const totalMinutes = blocks.reduce((s, b) => s + b.minutes, 0);
  return {
    totalMinutes,
    blocks,
    source: blocks.length ? "summary" : "none",
  };
}

/** @param {number} minutes */
export function formatStudyDuration(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m === 0) return "0";
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  if (r === 0) return `${h} h`;
  return `${h} h ${r} min`;
}

/** @param {number} minutes */
export function formatStudyDurationShort(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m === 0) return "—";
  const h = m / 60;
  if (h < 1) return `${m}m`;
  return h >= 10 ? `${h.toFixed(0)}h` : `${h.toFixed(1)}h`;
}

export function localYmd(date = new Date()) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

/** @param {string} ymd @param {number} deltaDays */
export function addDaysYmd(ymd, deltaDays) {
  const [y, mo, d] = ymd.split("-").map(Number);
  const dt = new Date(y, mo - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return localYmd(dt);
}

/**
 * @param {number} year
 * @param {number} month 1-12
 */
export function buildMonthGrid(year, month) {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const daysInMonth = last.getDate();
  let startPad = first.getDay() - 1;
  if (startPad < 0) startPad = 6;
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const m = String(month).padStart(2, "0");
    const day = String(d).padStart(2, "0");
    cells.push(`${year}-${m}-${day}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return { cells, daysInMonth, year, month };
}

/**
 * @param {Array<{ date: string, fullPath?: string }>} reportFiles
 * @param {string} startYmd
 * @param {string} endYmd
 * @param {(path: string) => Promise<string>} readText
 */
export async function loadStudyTimeByDate(reportFiles, startYmd, endYmd, readText) {
  /** @type {Record<string, ReturnType<typeof parseStudyMinutesFromReport>>} */
  const map = {};
  const inRange = reportFiles.filter((f) => f.date >= startYmd && f.date <= endYmd);
  await Promise.all(
    inRange.map(async (f) => {
      if (!f.fullPath) return;
      try {
        const md = await readText(f.fullPath);
        map[f.date] = parseStudyMinutesFromReport(md);
      } catch {
        map[f.date] = { totalMinutes: 0, blocks: [], source: "error" };
      }
    })
  );
  return map;
}
