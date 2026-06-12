/**
 * 2026-05-20 408-数结 错题截图 → ds72/ds73/ds74/ds75/ds81/ds82_*.png
 * 按采集时间序：§7.2×5 → §7.3×8 → §7.4×7 → §7.5×5 → §8.1×1 → §8.2×4（共 30 错，截图 29 张，§8.2 缺 1 张待补）
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(__dirname, "..", "..", "学习资料", "错题截图", "408-数结");

const sections = [
  { prefix: "ds72", count: 5, label: "§7.2 查找" },
  { prefix: "ds73", count: 8, label: "§7.3" },
  { prefix: "ds74", count: 7, label: "§7.4 B树/B+树" },
  { prefix: "ds75", count: 5, label: "§7.5 散列表" },
  { prefix: "ds81", count: 1, label: "§8.1 插入排序" },
  { prefix: "ds82", count: 4, label: "§8.2 希尔排序" },
];

const raw = fs
  .readdirSync(dir)
  .filter((f) => f.includes("2026-05-20") && f.endsWith(".png"))
  .sort();

const mapping = [];
let idx = 0;
for (const sec of sections) {
  for (let i = 1; i <= sec.count; i++) {
    const to = `${sec.prefix}_w${String(i).padStart(2, "0")}.png`;
    if (idx < raw.length) {
      mapping.push([raw[idx], to, sec.label]);
      idx++;
    } else {
      console.warn("no screenshot for", to, sec.label);
    }
  }
}

if (idx < raw.length) {
  console.warn("extra screenshots:", raw.slice(idx));
}

for (const [from, to] of mapping) {
  const a = path.join(dir, from);
  const b = path.join(dir, to);
  if (!fs.existsSync(a)) {
    console.error("missing:", from);
    process.exitCode = 1;
    continue;
  }
  if (fs.existsSync(b)) fs.unlinkSync(b);
  fs.renameSync(a, b);
  console.log("OK", from, "->", to);
}

const manifest = mapping.map(([from, to, label]) => ({ from, to, label }));
fs.writeFileSync(
  path.join(dir, "rename-manifest-2026-05-20.json"),
  JSON.stringify(manifest, null, 2),
  "utf-8"
);
console.log("manifest written, total", mapping.length);
