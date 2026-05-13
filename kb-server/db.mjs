import pg from "pg";

const { Pool } = pg;

/** 与 `docker-compose.kb.yml` 一致；覆盖连接串时启动前设置 `DATABASE_URL` */
const resolvedDatabaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://studykb:studykb@127.0.0.1:5433/studykb";

export function createPool() {
  return new Pool({ connectionString: resolvedDatabaseUrl, max: 8 });
}

export async function ensureSchema(pool) {
  const fs = await import("fs");
  const path = await import("path");
  const { fileURLToPath } = await import("url");
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
  await pool.query(sql);
}
