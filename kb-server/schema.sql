CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  tag_l1 TEXT NOT NULL DEFAULT '未分类',
  tag_l2 TEXT NOT NULL DEFAULT '未分类',
  importance SMALLINT NOT NULL DEFAULT 3 CHECK (importance >= 1 AND importance <= 5),
  keywords TEXT[] NOT NULL DEFAULT '{}',
  vector_cluster TEXT NOT NULL DEFAULT '',
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notes_tag_l1_idx ON notes (tag_l1);
CREATE INDEX IF NOT EXISTS notes_tag_l2_idx ON notes (tag_l2);
CREATE INDEX IF NOT EXISTS notes_updated_idx ON notes (updated_at DESC);

-- 有嵌入时再建 ANN 索引（数据量少时可直接全表扫）
-- CREATE INDEX IF NOT EXISTS notes_embedding_idx ON notes USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
