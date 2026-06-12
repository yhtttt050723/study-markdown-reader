/**
 * 将 Study 仓库内 md/mdc 中旧路径 `...\Study\错题截图\...` 改为 `...\Study\学习资料\错题截图\...`（跳过 md-reader-app）。
 * 用法（在 md-reader-app 目录）：node scripts/fix-wrongshot-paths.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

const SKIP = new Set(["md-reader-app", "node_modules", ".git"]);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(md|mdc)$/i.test(e.name)) out.push(p);
  }
  return out;
}

/** 旧：d + \\ + Study + \\ + 错题截图 + \\ … → 插入 学习资料 + \\ */
const pairs = [
  ["d:\\\\Study\\\\错题截图\\\\", "d:\\\\Study\\\\学习资料\\\\错题截图\\\\"],
  ["D:\\\\Study\\\\错题截图\\\\", "D:\\\\Study\\\\学习资料\\\\错题截图\\\\"],
  ["d:\\Study\\错题截图\\", "d:\\Study\\学习资料\\错题截图\\"],
  ["D:\\Study\\错题截图\\", "D:\\Study\\学习资料\\错题截图\\"],
];

function fixContent(s) {
  let n = s;
  for (const [a, b] of pairs) {
    n = n.split(a).join(b);
  }
  return n;
}

let changed = 0;
for (const f of walk(ROOT)) {
  const raw = fs.readFileSync(f, "utf8");
  const n = fixContent(raw);
  if (n !== raw) {
    fs.writeFileSync(f, n, "utf8");
    console.log(f);
    changed++;
  }
}
console.error(`Done. Updated ${changed} files.`);
