/**
 * 知识库 API（默认本机）。
 * - `npm run dev`：走 Vite 代理 `/api` → `127.0.0.1:3847`。
 * - `file://`（含打包版 Electron 打开 dist）：直连 `http://127.0.0.1:3847`（需本机已起 kb-server）。
 * - 覆盖地址：构建前设 `VITE_KB_API_URL`。
 */
function apiBase() {
  const b = import.meta.env.VITE_KB_API_URL;
  if (b && String(b).trim()) return String(b).replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location?.protocol === "file:") {
    return "http://127.0.0.1:3847";
  }
  return "";
}

export async function kbFetch(path, options = {}) {
  const base = apiBase();
  const url = base ? `${base}${path}` : path;
  const r = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  return r;
}

export async function kbHealth() {
  const r = await kbFetch("/api/health");
  if (!r.ok) return { ok: false, pg: false, embedding: false, ollama: false };
  return r.json();
}

export async function kbGetTree() {
  const r = await kbFetch("/api/tree");
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function kbGetNotes() {
  const r = await kbFetch("/api/notes");
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function kbPutNote(id, payload) {
  const r = await kbFetch(`/api/notes/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function kbDeleteNote(id) {
  const r = await kbFetch(`/api/notes/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function kbRefineNote(id) {
  const r = await kbFetch(`/api/notes/${encodeURIComponent(id)}/refine`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function kbApplyRefine(id, { tagL2, keywords, vectorCluster }) {
  const r = await kbFetch(`/api/notes/${encodeURIComponent(id)}/apply-refine`, {
    method: "POST",
    body: JSON.stringify({ tagL2, keywords, vectorCluster }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/** 本地 Ollama：根据标题+正文建议标签（不写库） */
export async function kbSuggestTagsFromOllama({ title, body }) {
  const r = await kbFetch("/api/llm/suggest-tags", {
    method: "POST",
    body: JSON.stringify({ title, body }),
  });
  if (!r.ok) {
    let msg = await r.text();
    try {
      const j = JSON.parse(msg);
      if (j.error) msg = j.error;
    } catch {
      /* use raw */
    }
    throw new Error(msg);
  }
  return r.json();
}
