import katex from "katex";

const SLOT_CLASS = "smr-katex-slot";

/**
 * 将 Markdown 转为 HTML，并渲染 $...$ / $$...$$（跳过 fenced code）。
 * @param {import("marked").Marked} marked
 * @param {string} raw
 */
export function parseMarkdownWithMath(marked, raw) {
  const text = String(raw || "");
  if (!text.trim()) return "";

  const slots = [];
  let slotId = 0;

  const parts = splitByFencedCode(text);
  let md = "";

  for (const part of parts) {
    if (part.type === "fence") {
      md += part.value;
      continue;
    }
    md += replaceMathInSegment(part.value, slots, () => slotId++);
  }

  let html = marked.parse(md);

  for (const slot of slots) {
    const rendered = renderKatexSlot(slot);
    const needle = slot.placeholder;
    html = html.split(needle).join(rendered);
  }

  return html;
}

function splitByFencedCode(text) {
  const parts = [];
  const re = /```[\s\S]*?```/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push({ type: "text", value: text.slice(last, m.index) });
    }
    parts.push({ type: "fence", value: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  if (!parts.length) parts.push({ type: "text", value: text });
  return parts;
}

function replaceMathInSegment(segment, slots, nextId) {
  let s = segment;

  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
    const id = nextId();
    const placeholder = `<div class="${SLOT_CLASS} ${SLOT_CLASS}--block" data-smr-katex="${id}"></div>`;
    slots.push({ id, tex: tex.trim(), displayMode: true, placeholder });
    return `\n\n${placeholder}\n\n`;
  });

  s = s.replace(/\$([^\$\n]+?)\$/g, (_, tex) => {
    const id = nextId();
    const placeholder = `<span class="${SLOT_CLASS}" data-smr-katex="${id}"></span>`;
    slots.push({ id, tex: tex.trim(), displayMode: false, placeholder });
    return placeholder;
  });

  return s;
}

function renderKatexSlot({ tex, displayMode }) {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      strict: "ignore",
      trust: false,
    });
  } catch {
    return displayMode
      ? `<pre class="katex-error">${escapeHtml(tex)}</pre>`
      : `<code class="katex-error">${escapeHtml(tex)}</code>`;
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
