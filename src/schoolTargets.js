import { normalizeRelPath } from "./markdownQuiz.js";

/**
 * 是否为「择校看板」数据源文件（打开 Study 根目录后通常为 `考研择校/择校目标.md`）。
 */
export function isSchoolTargetsFile(file) {
  if (!file) return false;
  const name = file.name || "";
  const rp = normalizeRelPath(file.relativePath || "");
  return name.includes("择校目标") || rp.includes("择校目标");
}

function splitTableRow(line) {
  const parts = line.trim().split("|").map((s) => s.trim());
  if (parts[0] === "" && parts[parts.length - 1] === "") {
    return parts.slice(1, -1);
  }
  return parts.filter(Boolean);
}

function parseTableRows(body) {
  const lines = body.split("\n").filter((l) => /^\s*\|/.test(l));
  if (lines.length < 2) return [];

  const splitRow = splitTableRow;

  const rows = lines.map(splitRow);
  let headerIdx = rows.findIndex((r) => r.some((c) => /院校|学校/.test(c)));
  if (headerIdx === -1) headerIdx = 0;

  const headers = rows[headerIdx];
  const sepIdx = rows.findIndex(
    (r, i) =>
      i > headerIdx &&
      r.every((c) => /^[\s\-:]+$/.test(c.replace(/\|/g, "")))
  );
  const dataStart =
    sepIdx === -1 ? headerIdx + 1 : sepIdx + 1;

  const iSchool = headers.findIndex((h) => /院校|学校/.test(h));
  const iProg = headers.findIndex((h) => /专业|方向/.test(h));
  const iScore = headers.findIndex((h) => /分数|目标/.test(h));
  const iNote = headers.findIndex((h) => /备注|说明/.test(h));

  const out = [];
  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i];
    if (r.every((c) => /^[\s\-:]+$/.test(c))) continue;
    const school = iSchool >= 0 ? r[iSchool] || "" : r[0] || "";
    const program = iProg >= 0 ? r[iProg] || "" : r[1] || "";
    let scoreRaw = iScore >= 0 ? r[iScore] || "" : r[2] || "";
    const noteExtra = iNote >= 0 ? r[iNote] || "" : "";

    const numMatch = scoreRaw.match(/(\d{3})/);
    const scoreNum = numMatch ? Number(numMatch[1]) : NaN;
    let note = noteExtra;
    if (/以上/.test(scoreRaw) && !/以上/.test(note)) note = note ? `${note}；以上` : "以上";

    if (!school && !program) continue;
    out.push({
      school,
      program,
      scoreNum: Number.isFinite(scoreNum) ? scoreNum : null,
      scoreDisplay: scoreRaw || "—",
      note: note || "",
    });
  }
  return out;
}

/**
 * 解析「## 11408 / ## 22408」章节下的 Markdown 表格（逐行扫描，避免跨平台正则边界问题）。
 * @returns {{ groups: Array<{ exam: string, rows: Array }> }}
 */
export function parseSchoolTargetsMarkdown(md) {
  const lines = (md || "").replace(/\r\n/g, "\n").split("\n");
  const groups = [];
  let i = 0;
  while (i < lines.length) {
    const hm = lines[i].match(/^##\s*(11408|22408)\b/);
    if (hm) {
      const exam = hm[1];
      i += 1;
      const bodyLines = [];
      while (i < lines.length && !/^##\s+/.test(lines[i])) {
        bodyLines.push(lines[i]);
        i += 1;
      }
      const rows = parseTableRows(bodyLines.join("\n"));
      if (rows.length) groups.push({ exam, rows });
      continue;
    }
    i += 1;
  }
  return { groups };
}

export function summarizeSchoolTargets(groups) {
  let max = 0;
  let min = Infinity;
  for (const g of groups) {
    for (const r of g.rows) {
      if (r.scoreNum != null) {
        max = Math.max(max, r.scoreNum);
        min = Math.min(min, r.scoreNum);
      }
    }
  }
  return {
    maxScore: max || null,
    minScore: Number.isFinite(min) ? min : null,
    totalRows: groups.reduce((n, g) => n + g.rows.length, 0),
  };
}
