/**
 * 知识库 API（默认本机 5214）。
 * - Electron：直连 kb-server（不依赖 Vite 代理）。
 * - 浏览器 + `npm run dev`：走 Vite 代理 `/api` → kb-server。
 * - `file://`（打包 dist）：直连 127.0.0.1:5214。
 * - 覆盖：`VITE_KB_API_URL=http://127.0.0.1:5214`
 */
const KB_HOST = "127.0.0.1";
const KB_PORT = Number(import.meta.env.VITE_KB_PORT) || 5214;

function directKbBase() {
  return `http://${KB_HOST}:${KB_PORT}`;
}

function apiBase() {
  const b = import.meta.env.VITE_KB_API_URL;
  if (b && String(b).trim()) return String(b).replace(/\/$/, "");
  if (typeof window !== "undefined" && window.electronAPI) {
    return directKbBase();
  }
  if (typeof window !== "undefined" && window.location?.protocol === "file:") {
    return directKbBase();
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
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 10000);
  try {
    const r = await kbFetch("/api/health", { signal: ac.signal });
    if (!r.ok) {
      let error = `HTTP ${r.status}`;
      try {
        const j = await r.json();
        if (j.error) error = j.error;
      } catch {
        /* ignore */
      }
      return { ok: false, pg: false, embedding: false, ollama: false, error };
    }
    return r.json();
  } catch (e) {
    const msg = String(e.message || e);
    const hint =
      msg.includes("abort") || msg.includes("Abort")
        ? "连接超时：请确认已运行 npm run kb:pg 与 npm run kb:serve"
        : msg.includes("Failed to fetch") || msg.includes("NetworkError")
          ? "无法连接 kb-server：请在 md-reader-app 目录执行 npm run kb:serve"
          : msg;
    return { ok: false, pg: false, embedding: false, ollama: false, error: hint };
  } finally {
    clearTimeout(timer);
  }
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

/** 本地 Ollama：根据光标上下文续写（不写库） */
export async function kbCompleteFromOllama({ title, prefix, suffix }, options = {}) {
  const r = await kbFetch("/api/llm/complete", {
    method: "POST",
    body: JSON.stringify({ title, prefix, suffix }),
    signal: options.signal,
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
