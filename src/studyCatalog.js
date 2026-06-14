import { normalizeRelPath } from "./markdownQuiz.js";

/**
 * 从 Study 文件夹内定位科目目录 .mdc（文件名 Math.mdc / 408.mdc）。
 * @param {Array<{ name?: string, relativePath?: string }>} files
 * @param {'Math.mdc' | '408.mdc'} basename
 */
export function findSubjectCatalogFile(files, basename) {
  if (!files?.length) return null;
  const direct = files.find((f) => f.name === basename);
  if (direct) return direct;
  const needle = "/" + basename;
  return (
    files.find((f) => normalizeRelPath(f.relativePath || "").replace(/\\/g, "/").endsWith(needle)) ??
    null
  );
}

/** @typedef {{ index: number, title: string }} CatalogChapter */

/**
 * 高等数学 / 线性代数 / 概率论：行形如「    第一章 xxx」
 * @param {string} block
 * @returns {CatalogChapter[]}
 */
export function extractChineseChapterLines(block) {
  const lines = (block || "").split(/\r?\n/);
  /** @type {CatalogChapter[]} */
  const out = [];
  const re = /^(\s*)第([^章节]+)章\s*(.*)$/;
  for (const line of lines) {
    const m = line.match(re);
    if (!m) continue;
    const indent = m[1].length;
    if (indent > 6) continue;
    const ord = out.length + 1;
    const title = `第${m[2]}章 ${(m[3] || "").trim()}`.trim();
    out.push({ index: ord, title });
  }
  return out;
}

/**
 * 408 书目：行形如「    第1章 xxx」
 * @param {string} block
 */
export function extractArabicChapterLines(block) {
  const lines = (block || "").split(/\r?\n/);
  /** @type {CatalogChapter[]} */
  const out = [];
  const re = /^\s*第(\d+)章\s*(.*)$/;
  for (const line of lines) {
    const m = line.match(re);
    if (!m) continue;
    const n = Number(m[1]);
    if (!Number.isFinite(n)) continue;
    const rest = (m[2] || "").trim();
    out.push({
      index: n,
      title: rest ? `第${n}章 ${rest}` : `第${n}章`,
    });
  }
  return out.sort((a, b) => a.index - b.index);
}

const MATH_SECTIONS = [
  { key: "高数", start: "高等数学目录：", end: "线性代数目录：" },
  { key: "线代", start: "线性代数目录：", end: "概率论目录：" },
  { key: "概率论", start: "概率论目录：", end: "张宇1000题目录：" },
];

/**
 * @param {string} md Math.mdc 全文
 * @returns {Record<'高数'|'线代'|'概率论', CatalogChapter[]>}
 */
export function parseMathCatalog(md) {
  const text = md || "";
  /** @type {Record<string, CatalogChapter[]>} */
  const result = { 高数: [], 线代: [], 概率论: [] };
  for (const { key, start, end } of MATH_SECTIONS) {
    const i0 = text.indexOf(start);
    if (i0 === -1) continue;
    const startPos = i0 + start.length;
    let endPos = text.length;
    if (end !== "\0") {
      const i1 = text.indexOf(end, startPos);
      if (i1 !== -1) endPos = i1;
    }
    const block = text.slice(startPos, endPos);
    result[key] = extractChineseChapterLines(block);
  }
  return result;
}

const CS408_SECTIONS = [
  { subject: "机组", marker: "计算机组成目录：" },
  { subject: "数据结构", marker: "数据结构目录：" },
  { subject: "计网", marker: "计算机网络目录：" },
  { subject: "操作系统", marker: "操作系统目录：" },
];

/**
 * @param {string} md 408.mdc 全文
 * @returns {Record<'机组'|'数据结构'|'计网'|'操作系统', CatalogChapter[]>}
 */
export function parse408Catalog(md) {
  const text = md || "";
  /** @type {Record<string, CatalogChapter[]>} */
  const result = {
    机组: [],
    数据结构: [],
    计网: [],
    操作系统: [],
  };
  const markers = CS408_SECTIONS.map((s) => s.marker);
  for (let s = 0; s < CS408_SECTIONS.length; s++) {
    const { subject, marker } = CS408_SECTIONS[s];
    const i0 = text.indexOf(marker);
    if (i0 === -1) continue;
    const startPos = i0 + marker.length;
    let endPos = text.length;
    const nextMarkers = markers.filter((m) => m !== marker);
    for (const nm of nextMarkers) {
      const j = text.indexOf(nm, startPos);
      if (j !== -1 && j < endPos) endPos = j;
    }
    const block = text.slice(startPos, endPos);
    result[subject] = extractArabicChapterLines(block);
  }
  return result;
}

export function chapterThroughToPct(through, totalChapters) {
  const t = Math.max(0, Number(through) || 0);
  const n = Math.max(0, Math.floor(totalChapters));
  if (n <= 0) return 0;
  return Math.min(100, Math.round((t / n) * 1000) / 10);
}

const ZHANGYU1000_SECTIONS = [
  { subject: "高数", phase: "基础", start: "张宇1000-高数-基础篇：", end: "张宇1000-高数-强化篇：" },
  { subject: "高数", phase: "强化", start: "张宇1000-高数-强化篇：", end: "张宇1000-线代-基础篇：" },
  { subject: "线代", phase: "基础", start: "张宇1000-线代-基础篇：", end: "张宇1000-线代-强化篇：" },
  { subject: "线代", phase: "强化", start: "张宇1000-线代-强化篇：", end: "张宇1000-概率论-基础篇：" },
  { subject: "概率论", phase: "基础", start: "张宇1000-概率论-基础篇：", end: "张宇1000-概率论-强化篇：" },
  { subject: "概率论", phase: "强化", start: "张宇1000-概率论-强化篇：", end: "张宇1000-综合篇：" },
];

/**
 * @typedef {{ 基础: CatalogChapter[], 强化: CatalogChapter[] }} ZhangYuSubjectPhases
 */

/**
 * 从 Math.mdc 解析《张宇1000题》分篇章节目录。
 * @param {string} md
 * @returns {{
 *   高数: ZhangYuSubjectPhases,
 *   线代: ZhangYuSubjectPhases,
 *   概率论: ZhangYuSubjectPhases,
 *   综合: CatalogChapter[],
 * }}
 */
export function parseZhangYu1000Catalog(md) {
  const text = md || "";
  /** @type {Record<string, ZhangYuSubjectPhases>} */
  const subjects = {
    高数: { 基础: [], 强化: [] },
    线代: { 基础: [], 强化: [] },
    概率论: { 基础: [], 强化: [] },
  };
  for (const { subject, phase, start, end } of ZHANGYU1000_SECTIONS) {
    const i0 = text.indexOf(start);
    if (i0 === -1) continue;
    const startPos = i0 + start.length;
    let endPos = text.length;
    const i1 = text.indexOf(end, startPos);
    if (i1 !== -1) endPos = i1;
    const block = text.slice(startPos, endPos);
    if (subjects[subject]) {
      subjects[subject][phase] = extractChineseChapterLines(block);
    }
  }
  let comprehensive = [];
  const compStart = "张宇1000-综合篇：";
  const i0 = text.indexOf(compStart);
  if (i0 !== -1) {
    comprehensive = extractChineseChapterLines(text.slice(i0 + compStart.length));
  }
  return { ...subjects, 综合: comprehensive };
}
