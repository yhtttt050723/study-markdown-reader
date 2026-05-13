/**
 * 学习笔记 · 方案 A：以 `## …` 为块边界；插入科目块与 fenced code。
 */

/** 插入「科目块」时的预设标题（不含 ## 前缀） */
export const NOTE_SUBJECT_BLOCK_PRESETS = [
  "数据结构",
  "高数",
  "概率论",
  "线代",
  "408-综合",
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
 */
export function buildSubjectBlockSnippet(title) {
  const t = String(title || "").trim() || "未命名";
  return `## 📌 ${t}\n\n`;
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
export function insertSubjectBlockAtSelection(body, start, end, title) {
  const lead = leadingNewlineIfNeeded(body, start);
  const block = buildSubjectBlockSnippet(title);
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
