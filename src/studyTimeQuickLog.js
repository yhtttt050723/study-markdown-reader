import { formatStudyDuration, localYmd } from "./studyDailyTime.js";
import { tryGetLocalStorage, trySetLocalStorage } from "./storageKeys.js";

export const LS_STUDY_TIME_QUICK = "smr-study-time-quick";
export const STUDY_TIME_PENDING_FENCE = "smr-study-time-pending";
export const THREE_HOUR_BLOCK_MINUTES = 180;

const PENDING_FILE_REL = "周期记录/学习时长待同步.md";

/**
 * @typedef {{ minutes: number, label: string, slotKey: string, addedAt: string }} QuickStudyBlock
 * @typedef {{ days: Record<string, { blocks: QuickStudyBlock[] }> }} PendingStudyLog
 */

export function emptyPendingLog() {
  return { days: {} };
}

export function readPendingStudyLog() {
  try {
    const raw = tryGetLocalStorage(LS_STUDY_TIME_QUICK);
    if (!raw) return emptyPendingLog();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyPendingLog();
    const days = parsed.days && typeof parsed.days === "object" ? parsed.days : {};
    return { days };
  } catch {
    return emptyPendingLog();
  }
}

/** @param {PendingStudyLog} data */
export function writePendingStudyLog(data) {
  trySetLocalStorage(LS_STUDY_TIME_QUICK, JSON.stringify(data));
}

/** @param {string} [folderPath] */
export function resolvePendingStudyTimeFilePath(folderPath) {
  if (!folderPath || typeof folderPath !== "string") return null;
  const trimmed = folderPath.replace(/[/\\]+$/, "");
  const sep = trimmed.includes("\\") ? "\\" : "/";
  return `${trimmed}${sep}${PENDING_FILE_REL.replace(/\//g, sep)}`;
}

/**
 * @param {PendingStudyLog} data
 */
export function buildPendingStudyTimeMarkdown(data) {
  const json = JSON.stringify(data, null, 2);
  return `# 学习时长 · 待写入日报

> 由 **Study Markdown Reader · 学习时长** 看板「快捷三小时段」维护。晚间可复制下方摘要或 @ \`日报学习总时长统计.mdc\` 合并进 \`周期记录/YYYY-MM-DD.md\`。

\`\`\`${STUDY_TIME_PENDING_FENCE}
${json}
\`\`\`
`;
}

/**
 * @param {string} md
 * @returns {PendingStudyLog}
 */
export function parsePendingStudyTimeMarkdown(md) {
  const body = md || "";
  const re = new RegExp(
    "```" + STUDY_TIME_PENDING_FENCE + "\\s*\\r?\\n([\\s\\S]*?)```",
    "m"
  );
  const m = body.match(re);
  if (!m) return emptyPendingLog();
  try {
    const parsed = JSON.parse(m[1].trim());
    const days = parsed?.days && typeof parsed.days === "object" ? parsed.days : {};
    return { days };
  } catch {
    return emptyPendingLog();
  }
}

/** @param {string} ymd @param {PendingStudyLog} log */
export function getPendingBlocksForDate(log, ymd) {
  const row = log?.days?.[ymd];
  if (!row || !Array.isArray(row.blocks)) return [];
  return row.blocks.filter((b) => b && Number(b.minutes) > 0);
}

/**
 * @param {string} ymd
 * @param {{ label?: string, minutes?: number }} [opts]
 */
export function addPendingThreeHourBlock(ymd, opts = {}) {
  const log = readPendingStudyLog();
  const date = ymd || localYmd();
  const existing = getPendingBlocksForDate(log, date);
  const n = existing.length + 1;
  const label = (opts.label || "").trim() || `学习段 #${n}（快捷 · 3 h）`;
  const minutes = Number(opts.minutes) > 0 ? Number(opts.minutes) : THREE_HOUR_BLOCK_MINUTES;
  const block = {
    minutes,
    label,
    slotKey: `quick-${date}-${Date.now()}`,
    addedAt: new Date().toISOString(),
  };
  const days = { ...log.days };
  days[date] = { blocks: [...existing, block] };
  const next = { days };
  writePendingStudyLog(next);
  return next;
}

/** @param {string} ymd @param {string} slotKey */
export function removePendingBlock(ymd, slotKey) {
  const log = readPendingStudyLog();
  const existing = getPendingBlocksForDate(log, ymd);
  const days = { ...log.days };
  const filtered = existing.filter((b) => b.slotKey !== slotKey);
  if (filtered.length) days[ymd] = { blocks: filtered };
  else delete days[ymd];
  const next = { days };
  writePendingStudyLog(next);
  return next;
}

/**
 * 合并日报解析结果与待同步快捷块（展示用）。
 * @param {ReturnType<import('./studyDailyTime.js').parseStudyMinutesFromReport>} report
 * @param {QuickStudyBlock[]} pending
 */
export function mergeStudyTimeDisplay(report, pending) {
  const base = report || { totalMinutes: 0, blocks: [], source: "none" };
  const pend = pending || [];
  const pendingMinutes = pend.reduce((s, b) => s + (Number(b.minutes) || 0), 0);
  return {
    ...base,
    pendingBlocks: pend,
    pendingMinutes,
    displayTotalMinutes: (base.totalMinutes || 0) + pendingMinutes,
  };
}

/**
 * @param {string} ymd
 * @param {QuickStudyBlock[]} pending
 */
export function formatPendingCopyForAgent(ymd, pending) {
  const blocks = pending || [];
  if (!blocks.length) {
    return `【${ymd} 学习时长待同步】\n（无快捷记录）`;
  }
  const lines = blocks.map((b, i) => {
    const dur = formatStudyDuration(b.minutes);
    return `${i + 1}. ${b.label} · ${dur}（${b.minutes} min）`;
  });
  const total = blocks.reduce((s, b) => s + b.minutes, 0);
  return [
    `【${ymd} 学习时长待同步 · 快捷三小时段】`,
    ...lines,
    `合计（待写入日报）：${formatStudyDuration(total)}（${total} min · ${blocks.length} 块）`,
    "",
    "请合并进当日日报「当日执行摘要」与 smr-study-time（时段起止可晚间补全）。",
  ].join("\n");
}
