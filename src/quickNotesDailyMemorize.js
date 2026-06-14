import { extractPinBlocksForDate } from "./resolveDailyMemorize.js";

function snippetFromBody(body, maxLen = 380) {
  const lines = String(body || "").replace(/\r\n/g, "\n").split("\n");
  const picked = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t || /^#{1,6}\s/.test(t)) continue;
    if (/^[-*]\s/.test(t) || /^>\s/.test(t) || /^\d+[.)]\s/.test(t) || t.length >= 12) {
      picked.push(t.replace(/^[-*]\s*/, ""));
    }
    if (picked.join("\n").length >= maxLen) break;
  }
  let s = picked.join("\n").trim();
  if (!s) {
    const plain = String(body || "")
      .replace(/^#+\s.+$/gm, "")
      .replace(/\s+/g, " ")
      .trim();
    s = plain.slice(0, maxLen);
  }
  if (s.length > maxLen) s = `${s.slice(0, maxLen)}…`;
  return s;
}

/**
 * 从 smr-quick-notes 抽取当日要背片段：优先 📌·日期块，否则摘录今日更新/高重点笔记。
 * @param {Array<{ title?: string, body?: string, updatedAt?: string, importance?: number }>} notes
 * @param {string} ymd
 */
export function composeQuickNotesDailySections(notes, ymd) {
  const sections = [];
  const sources = [];
  const seen = new Set();

  for (const note of notes || []) {
    const title = String(note.title || "未命名").trim() || "未命名";
    const body = String(note.body || "");
    const pins = extractPinBlocksForDate(body, ymd);
    for (const p of pins) {
      const key = `pin:${p.label}:${p.body.slice(0, 40)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      sections.push({
        heading: `📌 ${p.label} · ${ymd}`,
        body: p.body,
        source: `学习笔记 · ${title}`,
      });
      sources.push(`学习笔记 · ${title}`);
    }
  }

  if (sections.length >= 2) {
    return { sections, sources: [...new Set(sources)] };
  }

  const candidates = (notes || [])
    .filter((n) => {
      const upd = String(n.updatedAt || "").slice(0, 10);
      const imp = Number(n.importance);
      return upd === ymd || (Number.isFinite(imp) && imp >= 4);
    })
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
    .slice(0, 4);

  for (const note of candidates) {
    const title = String(note.title || "未命名").trim() || "未命名";
    const body = snippetFromBody(note.body);
    if (!body) continue;
    const key = `snip:${title}:${body.slice(0, 40)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sections.push({
      heading: `学习笔记摘录 · ${title}`,
      body,
      source: `学习笔记 · ${title}`,
    });
    sources.push(`学习笔记 · ${title}`);
    if (sections.length >= 4) break;
  }

  return { sections, sources: [...new Set(sources)] };
}
