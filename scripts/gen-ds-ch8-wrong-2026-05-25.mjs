/**
 * 2026-05-25 晚间挑出的 408-数结「屏幕截图*.png」→ 错题本 + 二刷（不重命名）
 * 按文件名时间序：§8.3×5 → §8.4×11 → §8.5×4 → §8.6×9 → §8.7×6（共 35；多 1 张见 manifest）
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const shotDir = path.resolve(__dirname, "..", "..", "学习资料", "错题截图", "408-数结");
const studyRoot = path.resolve(__dirname, "..", "..");

const sections = [
  {
    studyDate: "2026-05-22",
    studySlot: "14:00—17:30",
    code: "8.3",
    mdc: "§8.3 交换排序",
    sub: "8.3.3 本节试题精选",
    count: 5,
    erbrushFile: "2026-05-22-数据结构-第八章83-85-二刷.md",
    erbrushStart: 1,
  },
  {
    studyDate: "2026-05-22",
    studySlot: "14:00—17:30",
    code: "8.4",
    mdc: "§8.4 选择排序",
    sub: "8.4.3 本节试题精选",
    count: 11,
    erbrushFile: "2026-05-22-数据结构-第八章83-85-二刷.md",
    erbrushStart: 6,
  },
  {
    studyDate: "2026-05-22",
    studySlot: "14:00—17:30",
    code: "8.5",
    mdc: "§8.5 归并排序、基数排序和计数排序",
    sub: "8.5.4 本节试题精选",
    count: 4,
    erbrushFile: "2026-05-22-数据结构-第八章83-85-二刷.md",
    erbrushStart: 17,
  },
  {
    studyDate: "2026-05-25",
    studySlot: "20:10—20:47",
    code: "8.6",
    mdc: "§8.6 各种内部排序算法的比较及应用",
    sub: "8.6.3 本节试题精选",
    count: 9,
    erbrushFile: "2026-05-25-数据结构-第八章86-87-二刷.md",
    erbrushStart: 1,
  },
  {
    studyDate: "2026-05-25",
    studySlot: "20:10—20:47",
    code: "8.7",
    mdc: "§8.7 外部排序",
    sub: "8.7.6 本节试题精选",
    count: 6,
    erbrushFile: "2026-05-25-数据结构-第八章86-87-二刷.md",
    erbrushStart: 10,
  },
];

function parseShotTime(name) {
  const m = name.match(/(\d{4}-\d{2}-\d{2})\s+(\d{6})\.png$/);
  if (!m) return { date: "", iso: "" };
  const t = m[2];
  const iso = `${m[1]} ${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)} +08:00`;
  return { date: m[1], iso };
}

const raw = fs
  .readdirSync(shotDir)
  .filter((f) => f.startsWith("屏幕截图") && f.endsWith(".png"))
  .sort();

const expected = sections.reduce((s, x) => s + x.count, 0);
if (raw.length < expected) {
  console.error(`need ${expected} screenshots, got ${raw.length}`);
  process.exit(1);
}
const extra = raw.length > expected ? raw.slice(expected) : [];

const entries = [];
let idx = 0;
for (const sec of sections) {
  for (let i = 0; i < sec.count; i++) {
    const file = raw[idx++];
    const { iso } = parseShotTime(file);
    const imgPath = `d:\\\\Study\\\\学习资料\\\\错题截图\\\\408-数结\\\\${file}`;
    const qNum = sec.erbrushStart + (sec.code === sections.find((s) => s.erbrushFile === sec.erbrushFile && s.erbrushStart < sec.erbrushStart)?.erbrushStart ? 0 : 0);
    entries.push({
      ...sec,
      file,
      imgPath,
      recordTime: iso,
      erbrushQ: sec.erbrushStart + i,
      seqInSection: i + 1,
    });
  }
}

function wrongBlock(e, globalIdx) {
  return `### 题目：${e.mdc} · 截图序 ${e.seqInSection}（${e.file.replace(".png", "")}）

- **日期**：${e.studyDate}
- **记录时间（本机）**：**${e.recordTime}**（截图文件名）
- **学习时段**：${e.studySlot}
- **科目**：408-数据结构
- **章节**：第 8 章 排序 · ${e.mdc} · ${e.sub}
- **来源**：王道习题 · 本节试题精选
- **题目图片**：${e.imgPath}

#### 原题（OCR整理）

[见截图]

#### 我的作答（从截图提取）

[见截图]

#### 答案

（见纸质版，此处不录。）

#### 错因分析

- **错因标签**：待补
- **本次错误点**：待补

#### 下次避免策略

1. 闭卷重做该题，对照教材 ${e.mdc} 性质与复杂度。
2. 口述「为何错选 / 漏判」一句再勾二刷。

#### 二刷计划

- **二刷**：\`学习资料\\二刷计划\\${e.erbrushFile}\` 题目 **${e.erbrushQ}**
`;
}

function erbrushItem(e) {
  return `## 题目 ${e.erbrushQ}：DS ${e.mdc} · ${e.file}

- [ ] 完成
- 科目：408-数据结构
- 题目图片：${e.imgPath}
- 二刷标准：闭卷重做；口述考点一句；答案以纸质版为准。
`;
}

// --- 二刷 files ---
const byErbrush = {};
for (const e of entries) {
  if (!byErbrush[e.erbrushFile]) byErbrush[e.erbrushFile] = [];
  byErbrush[e.erbrushFile].push(e);
}

for (const [fname, list] of Object.entries(byErbrush)) {
  const is22 = fname.includes("05-22");
  const header = is22
    ? `# 2026-05-22 二刷任务 · 408 数据结构 · 第 8 章 §8.3—8.5

> **学习日**：**2026-05-22 14:00—17:30**。  
> **错题本**：\`学习资料\\408\\数据结构错题.md\` → **\`## 2026-05-22 · 第 8 章 排序 §8.3—8.5\`**。  
> **截图**：\`学习资料\\错题截图\\408-数结\\\` · 保留 **「屏幕截图 …」** 原名（共 **${list.length}** 张）。  
> **薄弱**：**§8.4 选择排序** 错 **11** 题，二刷优先。

- **题目数量**：**${list.length}**（§8.3×5 + §8.4×11 + §8.5×4）

---

`
    : `# 2026-05-25 二刷任务 · 408 数据结构 · 第 8 章 §8.6—8.7

> **学习日**：**2026-05-25 20:10—20:47**。  
> **错题本**：\`学习资料\\408\\数据结构错题.md\` → **\`## 2026-05-25 · 第 8 章 排序 §8.6—8.7\`**。  
> **截图**：同上目录 · **「屏幕截图 …」** 原名（**${list.length}** 张）。

- **题目数量**：**${list.length}**（§8.6×9 + §8.7×6）

---

`;

  let body = "";
  let curSec = "";
  for (const e of list) {
    if (e.code !== curSec) {
      curSec = e.code;
      body += `## ${e.mdc}（错 ${sections.find((s) => s.code === e.code).count}）\n\n`;
    }
    body += erbrushItem(e) + "\n";
  }
  const out = path.join(studyRoot, "学习资料", "二刷计划", fname);
  fs.writeFileSync(out, header + body, "utf-8");
  console.log("wrote", out);
}

// --- manifest ---
const manifest = entries.map((e) => ({
  file: e.file,
  recordTime: e.recordTime,
  studyDate: e.studyDate,
  section: e.mdc,
  erbrush: `${e.erbrushFile} 题目 ${e.erbrushQ}`,
}));
if (extra.length) manifest.push({ note: "extra screenshots not mapped", files: extra });
fs.writeFileSync(
  path.join(shotDir, "rename-manifest-2026-05-25-ch8.json"),
  JSON.stringify(manifest, null, 2),
  "utf-8"
);

// --- markdown tables for 错题本 ---
function tableRows(list) {
  return list
    .map(
      (e) =>
        `| ${e.seqInSection} | ${e.recordTime} | \`${e.file}\` | ${e.erbrushQ} | 待补 |`
    )
    .join("\n");
}

const e22 = entries.filter((e) => e.studyDate === "2026-05-22");
const e25 = entries.filter((e) => e.studyDate === "2026-05-25");

const md22 = `## 2026-05-22 · 第 8 章 排序 §8.3—8.5（14:00—17:30）

> **时段**：**2026-05-22 14:00—17:30**。 **61** 题 **错 20**（§8.3 错 5 · §8.4 错 **11** · §8.5 错 4）。  
> **截图**：\`d:\\Study\\学习资料\\错题截图\\408-数结\\\` · 文件名 **「屏幕截图 YYYY-MM-DD HHmmss.png」**（挑错时间 **2026-05-25 20:51—20:57**）。  
> **二刷**：\`学习资料\\二刷计划\\2026-05-22-数据结构-第八章83-85-二刷.md\`（**20** 题）。  
> **🔴 优先二刷 §8.4**（堆排序 / 简单选择）。

### 错题密度（\`408.mdc\`）

| 节 | 错数 | 错率 | 二刷题号 |
|:---|:---:|:---:|:---|
| §8.3 交换排序 · 8.3.3 | 5 | 75.0% | 1—5 |
| §8.4 选择排序 · 8.4.3 | **11** | **52.4%** | **6—16** |
| §8.5 归并/基数/计数 · 8.5.4 | 4 | 80.0% | 17—20 |

### 截图 ↔ 二刷（按挑错时间序）

#### §8.3（5）

| 序 | 记录时间 | 截图文件 | 二刷题号 | 题号/考点 |
|:---:|:---|:---|:---:|:---|
${tableRows(e22.filter((x) => x.code === "8.3"))}

#### §8.4（11）🔴

| 序 | 记录时间 | 截图文件 | 二刷题号 | 题号/考点 |
|:---:|:---|:---|:---:|:---|
${tableRows(e22.filter((x) => x.code === "8.4"))}

#### §8.5（4）

| 序 | 记录时间 | 截图文件 | 二刷题号 | 题号/考点 |
|:---:|:---|:---|:---:|:---|
${tableRows(e22.filter((x) => x.code === "8.5"))}

---

${e22.map((e, i) => wrongBlock(e, i)).join("\n---\n\n")}
`;

const md25 = `## 2026-05-25 · 第 8 章 排序 §8.6—8.7（20:10—20:47）

> **时段**：**2026-05-25 20:10—20:47**。 **38** 题 **错 15**（§8.6 错 9 · §8.7 错 6）。  
> **截图**：同目录 **「屏幕截图 …」** 原名（挑错接续 **20:51—20:57**）。  
> **二刷**：\`学习资料\\二刷计划\\2026-05-25-数据结构-第八章86-87-二刷.md\`（**15** 题）。

### 截图 ↔ 二刷

#### §8.6（9）

| 序 | 记录时间 | 截图文件 | 二刷题号 | 题号/考点 |
|:---:|:---|:---|:---:|:---|
${tableRows(e25.filter((x) => x.code === "8.6"))}

#### §8.7（6）

| 序 | 记录时间 | 截图文件 | 二刷题号 | 题号/考点 |
|:---:|:---|:---|:---:|:---|
${tableRows(e25.filter((x) => x.code === "8.7"))}

---

${e25.map((e, i) => wrongBlock(e, i)).join("\n---\n\n")}
`;

// patch 数据结构错题.md
const wrongBook = path.join(studyRoot, "学习资料", "408", "数据结构错题.md");
let book = fs.readFileSync(wrongBook, "utf-8");
const start22 = book.indexOf("## 2026-05-22 · 第 8 章 排序 §8.3—8.5");
const start25old = book.indexOf("## 2026-05-25 · 第 8 章 排序");
if (start22 === -1) {
  book = book.trimEnd() + "\n\n---\n\n" + md22.trim() + "\n\n---\n\n" + md25.trim() + "\n";
} else {
  const cutAt = start25old !== -1 && start25old > start22 ? start25old : book.length;
  book = book.slice(0, start22).trimEnd() + "\n\n" + md22.trim() + "\n\n---\n\n" + md25.trim() + "\n";
}
fs.writeFileSync(wrongBook, book.replace(/\n---\n\n---\n\n/g, "\n---\n\n"), "utf-8");
console.log("patched", wrongBook);
console.log("entries", entries.length, "extra", extra);
