/**
 * 《660》订正截图 2026-05-13 批次 → 660_XX.png
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(__dirname, "..", "..", "学习资料", "错题截图", "高数");

const mapping = [
  ["屏幕截图 2026-05-13 104704.png", "660_34.png"],
  ["屏幕截图 2026-05-13 104755.png", "660_43.png"],
  ["屏幕截图 2026-05-13 104812.png", "660_46.png"],
  ["屏幕截图 2026-05-13 104824.png", "660_47.png"],
  ["屏幕截图 2026-05-13 104836.png", "660_48.png"],
  ["屏幕截图 2026-05-13 104847.png", "660_50.png"],
  ["屏幕截图 2026-05-13 104901.png", "660_52.png"],
  ["屏幕截图 2026-05-13 104916.png", "660_55.png"],
  ["屏幕截图 2026-05-13 104927.png", "660_56.png"],
  ["屏幕截图 2026-05-13 104941.png", "660_57.png"],
  ["屏幕截图 2026-05-13 105008.png", "660_60.png"],
  ["屏幕截图 2026-05-13 105018.png", "660_61.png"],
  ["屏幕截图 2026-05-13 105036.png", "660_67.png"],
  ["屏幕截图 2026-05-13 105043.png", "660_68.png"],
  ["屏幕截图 2026-05-13 105055.png", "660_69.png"],
  ["屏幕截图 2026-05-13 105104.png", "660_70.png"],
  ["屏幕截图 2026-05-13 105116.png", "660_71.png"],
  ["屏幕截图 2026-05-13 105129.png", "660_73.png"],
  ["屏幕截图 2026-05-13 105139.png", "660_74.png"],
  ["屏幕截图 2026-05-13 105156.png", "660_75.png"],
  ["屏幕截图 2026-05-13 105205.png", "660_76.png"],
  ["屏幕截图 2026-05-13 105219.png", "660_79.png"],
  ["屏幕截图 2026-05-13 105234.png", "660_80.png"],
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
