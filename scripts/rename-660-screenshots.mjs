/**
 * 将《660》订正用「屏幕截图 2026-05-11 …」按题号重命名为 660_XX.png（与错题本路径一致）。
 * 题号由截图内题号与时间顺序对应（见 学习资料/数学/高数错题.md 2026-05-13 小节说明）。
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(__dirname, "..", "..", "学习资料", "错题截图", "高数");

const mapping = [
  ["屏幕截图 2026-05-11 132633.png", "660_02.png"],
  ["屏幕截图 2026-05-11 133007.png", "660_08.png"],
  ["屏幕截图 2026-05-11 134107.png", "660_09.png"],
  ["屏幕截图 2026-05-11 134252.png", "660_10.png"],
  ["屏幕截图 2026-05-11 134429.png", "660_11.png"],
  ["屏幕截图 2026-05-11 134638.png", "660_12.png"],
  ["屏幕截图 2026-05-11 134917.png", "660_15.png"],
  ["屏幕截图 2026-05-11 135421.png", "660_18.png"],
  ["屏幕截图 2026-05-11 135728.png", "660_19.png"],
  ["屏幕截图 2026-05-11 140057.png", "660_20.png"],
  ["屏幕截图 2026-05-11 142645.png", "660_22.png"],
  ["屏幕截图 2026-05-11 142653.png", "660_23.png"],
  ["屏幕截图 2026-05-11 142702.png", "660_25.png"],
  ["屏幕截图 2026-05-11 142711.png", "660_26.png"],
  ["屏幕截图 2026-05-11 142721.png", "660_28.png"],
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
