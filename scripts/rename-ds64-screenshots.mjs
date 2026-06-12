/**
 * 王道 DS 第六章 §6.4 错题截图：按采集时间 → ds64_题号.png
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(__dirname, "..", "..", "学习资料", "错题截图", "408-数结");

const mapping = [
  ["屏幕截图 2026-05-13 205250.png", "ds64_10.png"],
  ["屏幕截图 2026-05-13 205309.png", "ds64_11.png"],
  ["屏幕截图 2026-05-13 205319.png", "ds64_13.png"],
  ["屏幕截图 2026-05-13 205327.png", "ds64_14.png"],
  ["屏幕截图 2026-05-13 205335.png", "ds64_20.png"],
  ["屏幕截图 2026-05-13 205344.png", "ds64_21.png"],
  ["屏幕截图 2026-05-13 205354.png", "ds64_24.png"],
  ["屏幕截图 2026-05-13 205405.png", "ds64_29.png"],
  ["屏幕截图 2026-05-13 205423.png", "ds64_33.png"],
  ["屏幕截图 2026-05-13 205440.png", "ds64_41.png"],
  ["屏幕截图 2026-05-13 205449.png", "ds64_46.png"],
];

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
