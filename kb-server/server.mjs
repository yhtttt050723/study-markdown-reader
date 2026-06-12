import cors from "cors";
import express from "express";
import { createPool, ensureSchema } from "./db.mjs";
import {
  checkOllamaReachable,
  ollamaChatModel,
  suggestTagsFromNote,
} from "./ollama.mjs";

const PORT = Number(process.env.KB_PORT || 5214);
const OPENAI_KEY = process.env.OPENAI_API_KEY || "";
const EMBED_MODEL = process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small";

async function fetchEmbedding(text) {
  if (!OPENAI_KEY || !text?.trim()) return null;
  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: text.slice(0, 8000) }),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`OpenAI embedding failed: ${r.status} ${err}`);
  }
  const j = await r.json();
  const vec = j?.data?.[0]?.embedding;
  if (!Array.isArray(vec) || vec.length !== 1536) return null;
  return vec;
}

function vecToSql(vec) {
  if (!vec) return null;
  return `[${vec.join(",")}]`;
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

let pool;

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    const ollama = await checkOllamaReachable();
    res.json({
      ok: true,
      pg: true,
      embedding: Boolean(OPENAI_KEY),
      ollama,
      ollamaModel: ollamaChatModel(),
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message) });
  }
});

/** 本地 Ollama（通义 Qwen 等）根据正文生成标签/关键词，不写库；前端自行合并进笔记再 PUT */
app.post("/api/llm/suggest-tags", async (req, res) => {
  const ok = await checkOllamaReachable();
  if (!ok) {
    return res.status(503).json({
      error: "Ollama 不可用：请确认已运行 ollama serve，且已拉取模型（如 qwen2.5:3b）。",
    });
  }
  try {
    const title = String(req.body?.title ?? "");
    const body = String(req.body?.body ?? "");
    const out = await suggestTagsFromNote({ title, body });
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

/** 树：一级标签 → 二级标签 → 笔记 id 列表 */
app.get("/api/tree", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, title, tag_l1, tag_l2, importance, keywords, vector_cluster, updated_at
     FROM notes ORDER BY tag_l1, tag_l2, updated_at DESC`
  );
  const byL1 = new Map();
  for (const row of rows) {
    const l1 = row.tag_l1 || "未分类";
    const l2 = row.tag_l2 || "未分类";
    if (!byL1.has(l1)) byL1.set(l1, new Map());
    const byL2 = byL1.get(l1);
    if (!byL2.has(l2)) byL2.set(l2, []);
    byL2.get(l2).push({
      id: row.id,
      title: row.title,
      importance: row.importance,
      keywords: row.keywords,
      vectorCluster: row.vector_cluster,
      updatedAt: row.updated_at,
    });
  }
  const tree = [...byL1.entries()].map(([label, l2map]) => ({
    tagL1: label,
    children: [...l2map.entries()].map(([tagL2, notes]) => ({
      tagL2,
      notes,
    })),
  }));
  res.json({ tree });
});

app.get("/api/notes", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, title, body, tag_l1, tag_l2, importance, keywords, vector_cluster, updated_at
     FROM notes ORDER BY updated_at DESC`
  );
  res.json({
    notes: rows.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      tagL1: r.tag_l1,
      tagL2: r.tag_l2,
      importance: r.importance,
      keywords: r.keywords || [],
      vectorCluster: r.vector_cluster || "",
      updatedAt: r.updated_at,
    })),
  });
});

app.put("/api/notes/:id", async (req, res) => {
  const id = req.params.id;
  const {
    title = "",
    body = "",
    tagL1 = "未分类",
    tagL2 = "未分类",
    importance = 3,
    keywords = [],
    vectorCluster = "",
    reindex = false,
  } = req.body || {};

  const kw = Array.isArray(keywords) ? keywords : String(keywords).split(/[,，;；\s]+/).filter(Boolean);
  const imp = Math.min(5, Math.max(1, Number(importance) || 3));

  let vecLiteral = null;
  if (reindex && OPENAI_KEY) {
    const text = `${title}\n${body}`.slice(0, 12000);
    const vec = await fetchEmbedding(text);
    vecLiteral = vecToSql(vec);
  }

  const ex = await pool.query("SELECT 1 FROM notes WHERE id = $1", [id]);

  if (ex.rows.length > 0) {
    if (vecLiteral) {
      await pool.query(
        `UPDATE notes SET title=$2, body=$3, tag_l1=$4, tag_l2=$5, importance=$6, keywords=$7, vector_cluster=$8, embedding=$9::vector, updated_at=now() WHERE id=$1`,
        [id, title, body, tagL1, tagL2, imp, kw, vectorCluster || "", vecLiteral]
      );
    } else {
      await pool.query(
        `UPDATE notes SET title=$2, body=$3, tag_l1=$4, tag_l2=$5, importance=$6, keywords=$7, vector_cluster=$8, updated_at=now() WHERE id=$1`,
        [id, title, body, tagL1, tagL2, imp, kw, vectorCluster || ""]
      );
    }
  } else if (vecLiteral) {
    await pool.query(
      `INSERT INTO notes (id, title, body, tag_l1, tag_l2, importance, keywords, vector_cluster, embedding, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::vector, now())`,
      [id, title, body, tagL1, tagL2, imp, kw, vectorCluster || "", vecLiteral]
    );
  } else {
    await pool.query(
      `INSERT INTO notes (id, title, body, tag_l1, tag_l2, importance, keywords, vector_cluster, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())`,
      [id, title, body, tagL1, tagL2, imp, kw, vectorCluster || ""]
    );
  }

  res.json({ ok: true });
});

app.delete("/api/notes/:id", async (req, res) => {
  await pool.query("DELETE FROM notes WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

/**
 * 向量二次划分：在同一 tag_l1 下，用余弦相似找近邻，按邻域多数 tag_l2 + keywords 交集给出建议
 */
app.post("/api/notes/:id/refine", async (req, res) => {
  const id = req.params.id;
  const { rows: self } = await pool.query(
    "SELECT id, tag_l1, tag_l2, keywords, embedding FROM notes WHERE id = $1",
    [id]
  );
  if (!self.length) return res.status(404).json({ error: "not found" });
  const row = self[0];
  if (!row.embedding) {
    return res.json({
      suggestedTagL2: row.tag_l2,
      suggestedKeywords: row.keywords || [],
      vectorCluster: row.vector_cluster || "",
      hint: "无 embedding：请配置 OPENAI_API_KEY 并在保存时 reindex，或忽略向量建议。",
    });
  }

  const { rows: neighbors } = await pool.query(
    `SELECT id, tag_l2, keywords, 1 - (embedding <=> $1::vector) AS sim
     FROM notes
     WHERE tag_l1 = $2 AND id <> $3 AND embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector
     LIMIT 12`,
    [row.embedding, row.tag_l1, id]
  );

  const tagVotes = new Map();
  const kwSet = new Set(row.keywords || []);
  for (const n of neighbors) {
    tagVotes.set(n.tag_l2, (tagVotes.get(n.tag_l2) || 0) + Number(n.sim));
  }
  let suggestedTagL2 = row.tag_l2;
  let best = 0;
  for (const [t, s] of tagVotes) {
    if (s > best) {
      best = s;
      suggestedTagL2 = t;
    }
  }

  const kwFreq = new Map();
  for (const n of neighbors) {
    for (const k of n.keywords || []) {
      if (!k) continue;
      kwFreq.set(k, (kwFreq.get(k) || 0) + 1);
    }
  }
  const suggestedKeywords = [...kwFreq.entries()]
    .filter(([k]) => kwSet.has(k) || kwFreq.get(k) >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([k]) => k);

  const vectorCluster =
    suggestedKeywords.length >= 2
      ? `${row.tag_l1} · ${suggestedTagL2} · ${suggestedKeywords.slice(0, 3).join("/")}`
      : `${row.tag_l1} · ${suggestedTagL2}`;

  res.json({
    suggestedTagL2,
    suggestedKeywords,
    vectorCluster,
    neighbors: neighbors.slice(0, 5).map((n) => ({ id: n.id, tagL2: n.tag_l2, sim: n.sim })),
  });
});

app.post("/api/notes/:id/apply-refine", async (req, res) => {
  const id = req.params.id;
  const { tagL2, keywords = [], vectorCluster = "" } = req.body || {};
  const kw = Array.isArray(keywords) ? keywords : [];
  await pool.query(
    `UPDATE notes SET tag_l2 = COALESCE($2, tag_l2), keywords = $3, vector_cluster = COALESCE(NULLIF($4, ''), vector_cluster), updated_at = now()
     WHERE id = $1`,
    [id, tagL2 || null, kw, vectorCluster]
  );
  res.json({ ok: true });
});

async function main() {
  pool = createPool();
  await ensureSchema(pool);
  app.listen(PORT, () => {
    const emb = OPENAI_KEY ? "OpenAI on" : "OpenAI off";
    console.log(
      `KB server http://localhost:${PORT}  (embedding: ${emb}; Ollama 标签: 模型 ${ollamaChatModel()})`
    );
  });
}

main().catch((e) => {
  const refused =
    e?.code === "ECONNREFUSED" ||
    e?.errno === -4078 ||
    (typeof e?.message === "string" && e.message.includes("ECONNREFUSED"));
  if (refused) {
    console.error(`
[知识库] 连不上 PostgreSQL（默认 127.0.0.1:5433）。
常见原因：
  · 未启动数据库：先打开 Docker Desktop，等待就绪后在本项目根目录执行  npm run kb:pg
  · 未装 Docker：安装 Docker Desktop，或使用本机已安装的 Postgres + pgvector，并设置环境变量 DATABASE_URL 后再 npm start
`);
  }
  console.error(e);
  process.exit(1);
});
