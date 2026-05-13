import { normalizeRelPath } from "./markdownQuiz.js";

/**
 * 数据源：`周期记录/进度规划看板.md`（文件名或路径含「进度规划看板」）。
 * 可选机器可读块：
 * ```smr-plan-board
 * { "weekRange": "...", "phaseDoc": "...", "weekDoc": "..." }
 * ```
 * 正文：多个 `## 标题` 节；节内支持 `- [ ]` / `- [x]` 任务行，以及普通 `- 文本` 摘要行。
 */
export function isPlanBoardFile(file) {
  if (!file) return false;
  const name = file.name || "";
  const rp = normalizeRelPath(file.relativePath || "");
  return name.includes("进度规划看板") || rp.includes("进度规划看板");
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

  const fence = text.match(/```\s*smr-plan-board\s*([\s\S]*?)```/i);
  if (fence) {
    try {
      const j = JSON.parse(fence[1].trim());
      if (j && typeof j === "object") {
        for (const k of Object.keys(j)) {
          if (typeof j[k] === "string") meta[k] = j[k];
        }
      }
    } catch {
      /* ignore */
    }
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
