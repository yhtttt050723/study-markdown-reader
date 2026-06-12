/**
 * 将 408-数结 目录下 2026-05-11 三道「屏幕截图」重命名为 ds63_12 / ds63_13 / ds63_w03（与错题 md 一致）。
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(__dirname, "..", "..", "学习资料", "错题截图", "408-数结");

const mapping = [
  ["屏幕截图 2026-05-11 172944.png", "ds63_12.png"],
  ["屏幕截图 2026-05-11 173032.png", "ds63_13.png"],
  ["屏幕截图 2026-05-11 173047.png", "ds63_w03.png"],
];

for (const [from, to] of mapping) {
  const a = path.join(dir, from);
  const b = path.join(dir, to);
  if (!fs.existsSync(a)) {
    console.error("源文件不存在:", a);
    process.exitCode = 1;
    continue;
  }
  if (fs.existsSync(b)) {
    fs.unlinkSync(b);
  }
  fs.renameSync(a, b);
  console.log("OK:", from, "->", to);
}
