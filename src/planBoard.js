import { normalizeRelPath } from "./markdownQuiz.js";

/** 机器可读块标签 */
export const PLAN_BOARD_FENCE = "smr-plan-board";
export const STATUS_BOARD_FENCE = "smr-status-board";
const META_FENCES = [PLAN_BOARD_FENCE, STATUS_BOARD_FENCE];

/**
 * `周期记录/进度规划看板.md`
 */
export function isPlanBoardFile(file) {
  if (!file) return false;
  const name = file.name || "";
  const rp = normalizeRelPath(file.relativePath || "");
  return name.includes("进度规划看板") || rp.includes("进度规划看板");
}

/**
 * `周期记录/个人状态情况看板.md`
 */
export function isStatusBoardFile(file) {
  if (!file) return false;
  const name = file.name || "";
  const rp = normalizeRelPath(file.relativePath || "");
  return name.includes("个人状态情况看板") || rp.includes("个人状态情况看板");
}

export function isChecklistBoardFile(file) {
  return isPlanBoardFile(file) || isStatusBoardFile(file);
}

export function checklistBoardTitle(file) {
  if (isStatusBoardFile(file)) return "个人状态情况看板";
  if (isPlanBoardFile(file)) return "进度规划看板";
  return "勾选看板";
}

/**
 * @param {string} md
 * @returns {{
 *   meta: Record<string, string>,
 *   sections: Array<{ title: string, items: Array<{ label: string, done: boolean | null }> }>
 * }}
 */
export function parsePlanBoardMarkdown(md) {
  const text = (md || "").replace(/\r\n/g, "\n");
  const meta = {};

  for (const tag of META_FENCES) {
    const re = new RegExp("```\\s*" + tag + "\\s*([\\s\\S]*?)```", "i");
    const fence = text.match(re);
    if (!fence) continue;
    try {
      const j = JSON.parse(fence[1].trim());
      if (j && typeof j === "object") {
        for (const k of Object.keys(j)) {
          const v = j[k];
          if (typeof v === "string") meta[k] = v;
          else if (typeof v === "number" || typeof v === "boolean") meta[k] = String(v);
        }
      }
    } catch {
      /* ignore */
    }
    break;
  }

  /** @type {Array<{ title: string, items: Array<{ label: string, done: boolean | null }> }>} */
  const sections = [];
  let current = null;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimEnd();
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      current = { title: h2[1].trim(), items: [] };
      sections.push(current);
      continue;
    }
    if (!current) continue;

    const cb = line.match(/^-\s*\[([ xX])\]\s*(.+)$/);
    if (cb) {
      current.items.push({
        label: cb[2].trim(),
        done: cb[1].toLowerCase() === "x",
      });
      continue;
    }

    const plain = line.match(/^-\s+(?!\[)(.+)$/);
    if (plain) {
      current.items.push({ label: plain[1].trim(), done: null });
    }
  }

  return { meta, sections };
}

/**
 * 将指定小节中的第 N 个可勾选项改为 done，写回整篇 Markdown。
 * @param {string} md
 * @param {number} sectionIndex
 * @param {number} itemIndex 仅计 `- [ ]` / `- [x]` 行
 * @param {boolean} done
 */
export function togglePlanBoardItem(md, sectionIndex, itemIndex, done) {
  const lines = (md || "").replace(/\r\n/g, "\n").split("\n");
  let sec = -1;
  let cbInSec = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (/^##\s+/.test(trimmed)) {
      sec += 1;
    }
    if (sec !== sectionIndex) continue;

    const cb = lines[i].match(/^(\s*)-\s*\[([ xX])\]\s*(.*)$/);
    if (!cb) continue;

    cbInSec += 1;
    if (cbInSec !== itemIndex) continue;

    const mark = done ? "x" : " ";
    lines[i] = `${cb[1]}- [${mark}] ${cb[3]}`;
    return lines.join("\n");
  }

  return md;
}

/**
 * @param {{ sections: Array<{ items: Array<{ done: boolean | null }> }> }} data
 */
export function summarizePlanBoardProgress(data) {
  let total = 0;
  let done = 0;
  for (const sec of data?.sections || []) {
    for (const it of sec.items || []) {
      if (it.done === null) continue;
      total += 1;
      if (it.done) done += 1;
    }
  }
  const pct = total > 0 ? Math.round((done / total) * 1000) / 10 : null;
  return { total, done, pct };
}
