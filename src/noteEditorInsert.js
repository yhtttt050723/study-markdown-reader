/**
 * 学习笔记 · 方案 A：以 `## …` 为块边界；插入科目块与 fenced code。
 */

/** 插入「科目块」时的预设（title 写入 `## 📌 …`，icon 对应 noteSubjectIcons） */
export const NOTE_SUBJECT_BLOCK_PRESETS = [
  { title: "数据结构", icon: "ds", short: "数结" },
  { title: "计算机组成", icon: "co", short: "计组" },
  { title: "计算机网络", icon: "net", short: "计网" },
  { title: "操作系统", icon: "os", short: "OS" },
  { title: "高数", icon: "calc", short: "高数" },
  { title: "概率论", icon: "prob", short: "概率" },
  { title: "线代", icon: "linalg", short: "线代" },
  { title: "408-综合", icon: "408", short: "408" },
];

/** 插入代码块时的语言标识（fenced code 第一行） */
export const NOTE_CODE_FENCE_LANGS = [
  { id: "plaintext", label: "纯文本" },
  { id: "c", label: "C" },
  { id: "cpp", label: "C++" },
  { id: "java", label: "Java" },
  { id: "python", label: "Python" },
  { id: "javascript", label: "JavaScript" },
  { id: "pseudo", label: "伪代码" },
];

/**
 * @param {string} body
 * @returns {{ charStart: number, title: string }[]}
 */
export function extractH2Outline(body) {
  const s = String(body || "");
  const re = /^## (.+)$/gm;
  const out = [];
  let m;
  while ((m = re.exec(s)) !== null) {
    out.push({ charStart: m.index, title: m[1].trim() });
  }
  return out;
}

/**
 * 若插入点不在行首且上一字符不是换行，则先补换行，避免 `##` 粘在上一行末尾。
 * @param {string} body
 * @param {number} start
 */
export function leadingNewlineIfNeeded(body, start) {
  if (start <= 0) return "";
  const ch = body[start - 1];
  if (ch === "\n" || ch === "\r") return "";
  return "\n";
}

/**
 * @param {string} body
 * @param {number} start
 * @param {number} end
 * @param {string} insertText
 * @returns {{ nextBody: string, caret: number }}
 */
export function replaceSelection(body, start, end, insertText) {
  const b = String(body || "");
  const s = Math.max(0, Math.min(start, b.length));
  const e = Math.max(s, Math.min(end, b.length));
  const next = b.slice(0, s) + insertText + b.slice(e);
  const caret = s + insertText.length;
  return { nextBody: next, caret };
}

/**
 * @param {string} title 块标题（写入 `## 📌 …`）
 * @param {string} [dateYmd] 可选日期，写入 ` · YYYY-MM-DD` 便于每日要背抽取
 */
export function buildSubjectBlockSnippet(title, dateYmd) {
  const t = String(title || "").trim() || "未命名";
  const d = dateYmd && /^\d{4}-\d{2}-\d{2}$/.test(String(dateYmd)) ? ` · ${dateYmd}` : "";
  return `## 📌 ${t}${d}\n\n`;
}

/**
 * @param {string} lang
 * @returns {{ snippet: string, caretInside: number }} caretInside = 从 snippet 开头到光标（围栏内首行后）
 */
export function buildCodeFenceSnippet(lang) {
  const lg = /^[\w+#-]{1,32}$/.test(String(lang || "")) ? String(lang) : "plaintext";
  const innerOpen = `\`\`\`${lg}\n`;
  const innerClose = `\n\`\`\`\n`;
  const snippet = innerOpen + innerClose;
  /** 光标落在 opening fence 后的空行内（即 ```lang\n 之后） */
  const caretInside = innerOpen.length;
  return { snippet, caretInside };
}

/**
 * @param {string} body
 * @param {number} start
 * @param {number} end
 * @param {string} title
 */
export function insertSubjectBlockAtSelection(body, start, end, title, dateYmd) {
  const lead = leadingNewlineIfNeeded(body, start);
  const block = buildSubjectBlockSnippet(title, dateYmd);
  const insertText = lead + block;
  const { nextBody, caret } = replaceSelection(body, start, end, insertText);
  return { nextBody, caret };
}

/**
 * @param {string} body
 * @param {number} start
 * @param {number} end
 * @param {string} lang
 */
export function insertCodeFenceAtSelection(body, start, end, lang) {
  const lead = leadingNewlineIfNeeded(body, start);
  const { snippet, caretInside } = buildCodeFenceSnippet(lang);
  const insertText = lead + snippet;
  const { nextBody } = replaceSelection(body, start, end, insertText);
  const caret = start + lead.length + caretInside;
  return { nextBody, caret };
}

/**
 * 包裹选区，无选区时插入占位符并将光标置于占位符开头。
 */
export function insertWrapAtSelection(body, start, end, before, after, placeholder = "") {
  const b = String(body || "");
  const s = Math.max(0, Math.min(start, b.length));
  const e = Math.max(s, Math.min(end, b.length));
  const selected = b.slice(s, e);
  const inner = selected || placeholder;
  const insertText = before + inner + after;
  const { nextBody } = replaceSelection(b, s, e, insertText);
  const caret = selected ? s + insertText.length : s + before.length;
  return { nextBody, caret };
}

/**
 * @param {number} level 1–6
 */
export function insertHeadingAtSelection(body, start, end, level, placeholder = "标题") {
  const lv = Math.min(6, Math.max(1, Number(level) || 2));
  const hashes = "#".repeat(lv);
  const lead = leadingNewlineIfNeeded(body, start);
  const insertText = `${lead}${hashes} ${placeholder}\n\n`;
  const { nextBody } = replaceSelection(body, start, end, insertText);
  const caret = start + lead.length + hashes.length + 1;
  return { nextBody, caret };
}

export function insertLinkAtSelection(body, start, end, label, url) {
  const text = String(label || "链接文字").trim() || "链接文字";
  const href = String(url || "https://").trim() || "https://";
  const insertText = `[${text}](${href})`;
  const { nextBody, caret } = replaceSelection(body, start, end, insertText);
  return { nextBody, caret };
}

export function insertImageMarkdownAtSelection(body, start, end, alt, src) {
  const lead = leadingNewlineIfNeeded(body, start);
  const a = String(alt || "图片").trim() || "图片";
  const u = String(src || "").trim();
  const insertText = `${lead}![${a}](${u})\n`;
  const { nextBody, caret } = replaceSelection(body, start, end, insertText);
  return { nextBody, caret };
}

export function insertLinePrefixAtSelection(body, start, end, prefix, placeholder = "内容") {
  const lead = leadingNewlineIfNeeded(body, start);
  const insertText = `${lead}${prefix}${placeholder}\n`;
  const { nextBody } = replaceSelection(body, start, end, insertText);
  const caret = start + lead.length + prefix.length;
  return { nextBody, caret };
}

export function insertHorizontalRuleAtSelection(body, start, end) {
  const lead = leadingNewlineIfNeeded(body, start);
  const insertText = `${lead}---\n\n`;
  const { nextBody, caret } = replaceSelection(body, start, end, insertText);
  return { nextBody, caret };
}
