import {
  extractTrailingIsoDateFromName,
  isDailyMemorizeMarkdown,
  pickLatestDailyMemorize,
} from "./dailyMemorize.js";
import { composeQuickNotesDailySections } from "./quickNotesDailyMemorize.js";
import {
  isWrongBookFile,
  normalizeRelPath,
  parseWrongBlock,
  splitWrongBookBlocks,
} from "./markdownQuiz.js";
import { listDailyReportFiles, localYmd } from "./studyDailyTime.js";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** @param {string} ymd */
export function pickDailyMemorizeFileForDate(files, ymd) {
  const list = (files || []).filter(isDailyMemorizeMarkdown);
  const today = list.filter((f) => extractTrailingIsoDateFromName(f.name) === ymd);
  if (today.length) {
    today.sort((a, b) => b.relativePath.localeCompare(a.relativePath, "zh-CN"));
    return today[0];
  }
  return null;
}

function isNoteMarkdown(file) {
  const rp = normalizeRelPath(file.relativePath);
  return (
    /\.mdc?$/i.test(file.name || "") &&
    (rp.includes("/笔记/") || rp.startsWith("笔记/") || rp.includes("\\笔记\\"))
  );
}

function isSummaryNoteFile(file, ymd) {
  const n = file.name || "";
  if (!/\.mdc?$/i.test(n)) return false;
  if (!n.includes("摘要")) return false;
  return n.includes(ymd) || extractTrailingIsoDateFromName(n) === ymd;
}

/** 提取 `## …ymd…` 至下一同级 `##` 的片段 */
export function extractH2SectionsForDate(text, ymd) {
  const t = (text || "").replace(/\r\n/g, "\n");
  const re = new RegExp(`^##\\s+(.+${ymd}.+)$`, "gm");
  const out = [];
  let m;
  while ((m = re.exec(t)) !== null) {
    const start = m.index;
    const title = m[1].trim();
    const after = t.slice(start + m[0].length);
    const next = after.search(/^##\s+/m);
    const body = (next === -1 ? after : after.slice(0, next)).trim();
    out.push({ title, body });
  }
  return out;
}

/** `## 📌 知识点 · 2026-05-30` 等分块 */
export function extractPinBlocksForDate(text, ymd) {
  const t = (text || "").replace(/\r\n/g, "\n");
  const re = new RegExp(
    `^##\\s*📌\\s*([^·\\n]+?)\\s*·\\s*${ymd}\\s*$`,
    "gm"
  );
  const out = [];
  let m;
  while ((m = re.exec(t)) !== null) {
    const label = m[1].trim();
    const start = m.index + m[0].length;
    const after = t.slice(start);
    const next = after.search(/^##\s/m);
    const body = (next === -1 ? after : after.slice(0, next)).trim();
    const placeholder = /^[（(].*[）)]\s*$|^\s*$/.test(body.replace(/\n/g, ""));
    if (!body || placeholder) continue;
    out.push({ label, body });
  }
  return out;
}

function extractField(block, label) {
  const re = new RegExp(`^[-*]\\s*${label}[:：]\\s*(.+)$`, "m");
  const m = block.match(re);
  return m ? m[1].trim() : "";
}

function extractSubsection(block, heading) {
  const re = new RegExp(
    `^####\\s*${heading}\\s*\\n([\\s\\S]*?)(?=^####\\s|^###\\s|^##\\s|$)`,
    "m"
  );
  const m = block.match(re);
  if (!m) return "";
  return m[1].trim();
}

/** 从错题块提炼背诵要点 */
function distillWrongBlock(block) {
  const titleM =
    block.match(/^###\s*题目[:：]\s*(.+)$/m) ||
    block.match(/^##\s*题目[:：]\s*(.+)$/m);
  const title = titleM ? titleM[1].trim() : "未命名";
  const tags = extractField(block, "错因标签");
  const point = extractField(block, "本次错误点");
  const strategy = extractSubsection(block, "下次避免策略");
  const analysis = extractSubsection(block, "错因分析");
  const lines = [];
  lines.push(`**${title}**`);
  if (tags) lines.push(`- 错因：${tags}`);
  const ap = point || analysis.replace(/\n+/g, " ").slice(0, 280);
  if (ap) lines.push(`- 要点：${ap}`);
  if (strategy) {
    const strat = strategy
      .split("\n")
      .map((l) => l.replace(/^[-*\d.]+\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 3);
    for (const s of strat) lines.push(`- 避免：${s}`);
  }
  return lines.join("\n");
}

function extractDailyReportSummary(text, ymd) {
  const t = (text || "").replace(/\r\n/g, "\n");
  const lines = [];
  const exec = t.match(/^##\s*当日执行摘要[^\n]*\n([\s\S]*?)(?=^##\s|$)/m);
  if (exec) {
    const bullets = exec[1]
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("-") && !/^-\s*\*\*说明/.test(l))
      .slice(0, 8);
    if (bullets.length) {
      lines.push("### 今日执行摘要");
      lines.push(...bullets);
    }
  }
  const seg = t.match(/^##\s*今日三小时段排期\s*\n([\s\S]*?)(?=^##\s|$)/m);
  if (seg) {
    const table = seg[1].trim().split("\n").slice(0, 8).join("\n");
    if (table) {
      lines.push("### 今日段排期");
      lines.push(table);
    }
  }
  if (!lines.length) return "";
  return `## 日报摘要 · ${ymd}\n\n${lines.join("\n\n")}\n`;
}

/**
 * @param {object} opts
 * @param {Array} opts.files
 * @param {Array} [opts.quickNotes] smr-quick-notes 笔记列表
 * @param {(file: object) => Promise<string>} opts.readFile
 * @param {string} [opts.todayYmd]
 */
export async function resolveDailyMemorize({ files, readFile, todayYmd, quickNotes }) {
  const ymd = todayYmd && ISO.test(todayYmd) ? todayYmd : localYmd();
  const dedicated = pickDailyMemorizeFileForDate(files, ymd);

  if (dedicated) {
    const markdown = await readFile(dedicated);
    return {
      ymd,
      mode: "today-file",
      markdown: typeof markdown === "string" ? markdown : "",
      sourceLabel: normalizeRelPath(dedicated.relativePath),
      openFile: dedicated,
      hasContent: Boolean((markdown || "").trim()),
    };
  }

  const wrongFiles = (files || []).filter(isWrongBookFile);
  const noteFiles = (files || []).filter(isNoteMarkdown);
  const summaryFiles = (files || []).filter((f) => isSummaryNoteFile(f, ymd));
  const dailyReports = listDailyReportFiles(files).filter((f) => {
    const m = (f.name || "").match(/^(\d{4}-\d{2}-\d{2})\.md$/i);
    return m && m[1] === ymd;
  });

  const parts = [];
  const sources = [];
  let openFile = null;

  for (const wf of wrongFiles) {
    let text = "";
    try {
      text = await readFile(wf);
    } catch {
      continue;
    }
    const sections = extractH2SectionsForDate(text, ymd);
    if (sections.length) {
      if (!openFile) openFile = wf;
      for (const sec of sections) {
        parts.push(`## ${sec.title}\n\n${sec.body}\n`);
        sources.push(normalizeRelPath(wf.relativePath));
      }
      continue;
    }
    const blocks = splitWrongBookBlocks(text)
      .map((b) => ({ block: b, parsed: parseWrongBlock(b, wf.relativePath) }))
      .filter(({ parsed }) => parsed.firstDate === ymd);
    if (!blocks.length) continue;
    if (!openFile) openFile = wf;
    const distilled = blocks.map(({ block }) => distillWrongBlock(block)).join("\n\n");
    parts.push(
      `## ${wf.name.replace(/\.md$/i, "")} · 当日错题要点\n\n${distilled}\n`
    );
    sources.push(normalizeRelPath(wf.relativePath));
  }

  for (const nf of noteFiles) {
    let text = "";
    try {
      text = await readFile(nf);
    } catch {
      continue;
    }
    const pins = extractPinBlocksForDate(text, ymd);
    if (!pins.length) continue;
    if (!openFile) openFile = nf;
    for (const p of pins) {
      parts.push(`## 📌 ${p.label} · ${ymd}\n\n${p.body}\n`);
      sources.push(normalizeRelPath(nf.relativePath));
    }
  }

  if (Array.isArray(quickNotes) && quickNotes.length) {
    const { sections, sources: qSources } = composeQuickNotesDailySections(quickNotes, ymd);
    for (const sec of sections) {
      parts.push(`## ${sec.heading}\n\n${sec.body}\n`);
      sources.push(sec.source);
    }
    if (qSources.length && !openFile) {
      openFile = null;
    }
  }

  for (const sf of summaryFiles) {
    let text = "";
    try {
      text = await readFile(sf);
    } catch {
      continue;
    }
    if (!text.trim()) continue;
    if (!openFile) openFile = sf;
    parts.push(`## 摘要笔记 · ${sf.name}\n\n${text.trim()}\n`);
    sources.push(normalizeRelPath(sf.relativePath));
  }

  if (dailyReports.length) {
    const dr = dailyReports[0];
    try {
      const text = await readFile(dr);
      const summary = extractDailyReportSummary(text, ymd);
      if (summary) {
        if (!openFile) openFile = dr;
        parts.unshift(summary);
        sources.push(normalizeRelPath(dr.relativePath));
      }
    } catch {
      /* ignore */
    }
  }

  if (parts.length) {
    const header = `# 每日要背 · ${ymd}\n\n> 由 **当日错题**、**📌 知识点/摘要笔记**、**学习笔记（smr-quick-notes）** 与 **日报** 自动汇总；早/晚各过一遍，能口述要点即可。\n\n`;
    return {
      ymd,
      mode: "composed",
      markdown: header + parts.join("\n---\n\n"),
      sourceLabel: `自动汇总 · ${sources.length} 处来源`,
      sources: [...new Set(sources)],
      openFile,
      hasContent: true,
    };
  }

  const fallback = pickLatestDailyMemorize(files);
  if (fallback) {
    const markdown = await readFile(fallback);
    const fbDate = extractTrailingIsoDateFromName(fallback.name);
    return {
      ymd,
      mode: "fallback-file",
      markdown: typeof markdown === "string" ? markdown : "",
      sourceLabel: fbDate
        ? `历史要背清单（${fbDate}，非今日）`
        : normalizeRelPath(fallback.relativePath),
      openFile: fallback,
      hasContent: Boolean((markdown || "").trim()),
    };
  }

  return {
    ymd,
    mode: "empty",
    markdown: "",
    sourceLabel: "",
    openFile: null,
    hasContent: false,
  };
}
