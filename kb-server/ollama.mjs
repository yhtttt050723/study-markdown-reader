/**
 * 本地 Ollama（默认 http://127.0.0.1:11434），无需 API Key。
 * 文档：https://github.com/ollama/ollama/blob/main/docs/api.md
 */

const DEFAULT_BASE = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "qwen2.5:3b";

export function ollamaBaseUrl() {
  return (process.env.OLLAMA_BASE_URL || DEFAULT_BASE).replace(/\/$/, "");
}

export function ollamaChatModel() {
  return process.env.OLLAMA_MODEL || DEFAULT_MODEL;
}

/** @returns {Promise<boolean>} */
export async function checkOllamaReachable() {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 2500);
    const r = await fetch(`${ollamaBaseUrl()}/api/tags`, { signal: ac.signal });
    clearTimeout(t);
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * @param {{ role: string, content: string }[]} messages
 * @returns {Promise<string>} assistant 正文
 */
export async function ollamaChat(messages) {
  const r = await fetch(`${ollamaBaseUrl()}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ollamaChatModel(),
      messages,
      stream: false,
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Ollama chat ${r.status}: ${t}`);
  }
  const j = await r.json();
  const content = j?.message?.content;
  if (typeof content !== "string") throw new Error("Ollama 返回无 message.content");
  return content;
}

/** 从模型输出中提取 JSON 对象（允许包裹在 markdown 代码块中） */
export function extractJsonObject(text) {
  const raw = String(text || "").trim();
  let s = raw;
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("模型输出中未找到 JSON 对象");
  return JSON.parse(s.slice(start, end + 1));
}

const SYSTEM_COMPLETE = `你是考研/专业课学习笔记写作助手。用户正在写 Markdown 笔记，光标位于「上文」与「下文」之间。
请续写光标处之后最自然的下一段内容（1–4 句，或若干 Markdown 列表项；可含 $...$ 公式）。
硬性要求：
- 只输出续写正文，不要重复上文，不要 JSON，不要代码块包裹，不要「好的/以下是」等客套
- 不要输出新的 ## 标题，除非上文末尾正在写标题行且明显未完成
- 若上文已完整或无法判断，只输出空字符串`;

/**
 * @param {{ title?: string, prefix: string, suffix?: string, maxPrefix?: number }} param0
 */
export function buildUserCompleteMessage({ title, prefix, suffix, maxPrefix = 7000 }) {
  const t = String(title || "").slice(0, 160);
  const pre = String(prefix || "").slice(-maxPrefix);
  const suf = String(suffix || "").slice(0, 400);
  return `笔记标题：${t || "未命名"}

---上文（光标前）---
${pre}

---下文（光标后，可能为空）---
${suf}

请直接输出续写内容：`;
}

/** @param {string} text */
export function sanitizeCompletion(text) {
  let s = String(text || "").trim();
  const fence = s.match(/^```(?:markdown|md)?\s*\n?([\s\S]*?)```$/i);
  if (fence) s = fence[1].trim();
  if (s.startsWith("续写：") || s.startsWith("续写:")) s = s.slice(3).trim();
  if (s.length > 720) s = s.slice(0, 720);
  return s;
}

/**
 * @param {{ title?: string, prefix: string, suffix?: string }} input
 * @returns {Promise<{ text: string }>}
 */
export async function completeNoteFromContext(input) {
  const content = await ollamaChat([
    { role: "system", content: SYSTEM_COMPLETE },
    { role: "user", content: buildUserCompleteMessage(input) },
  ]);
  const text = sanitizeCompletion(content);
  return { text };
}

const SYSTEM_SUGGEST_TAGS = `你是本地学习笔记助手（通义 Qwen）。用户笔记用于考研/专业课复习。
你必须只输出一个 JSON 对象，不要 Markdown 标题、不要解释文字、不要代码块标记。
JSON 字段与含义（字符串不要换行）：
- tagL1: 一级大类，如 数学、408、英语、政治、错题集、说明
- tagL2: 二级主题，具体章节或知识点短语
- importance: 整数 1-5，5 最紧急，未说明倾向时用 3
- keywords: 字符串数组，3-12 个可检索词，无空话
- summary: 一句话摘要，不超过 40 字

示例（格式示意）：
{"tagL1":"数学","tagL2":"概率论-分布","importance":4,"keywords":["泊松","期望"],"summary":"归纳常见分布的期望方差"}`;

/**
 * @param {{ title: string, body: string }} param0
 */
export function buildUserSuggestTagsMessage({ title, body }) {
  const t = String(title || "").slice(0, 200);
  const b = String(body || "").slice(0, 12000);
  return `笔记标题：${t}\n\n正文：\n${b}\n\n请输出符合要求的 JSON 对象。`;
}

/**
 * @param {{ title: string, body: string }} input
 * @returns {Promise<{ tagL1: string, tagL2: string, importance: number, keywords: string[], summary: string }>}
 */
export async function suggestTagsFromNote(input) {
  const content = await ollamaChat([
    { role: "system", content: SYSTEM_SUGGEST_TAGS },
    { role: "user", content: buildUserSuggestTagsMessage(input) },
  ]);
  let parsed;
  try {
    parsed = extractJsonObject(content);
  } catch (e) {
    throw new Error(`解析模型 JSON 失败: ${e.message}\n--- 原始输出 ---\n${content.slice(0, 800)}`);
  }
  const tagL1 = String(parsed.tagL1 || "未分类").trim() || "未分类";
  const tagL2 = String(parsed.tagL2 || "未分类").trim() || "未分类";
  let importance = Number(parsed.importance);
  if (!Number.isFinite(importance)) importance = 3;
  importance = Math.min(5, Math.max(1, Math.round(importance)));
  const keywords = Array.isArray(parsed.keywords)
    ? parsed.keywords.map((k) => String(k).trim()).filter(Boolean).slice(0, 20)
    : [];
  const summary = String(parsed.summary || "").trim().slice(0, 200);
  return { tagL1, tagL2, importance, keywords, summary };
}
