/** 课程名推断（与 video-dash/src/lib/seriesLabel.ts 一致） */

const PART_TITLE_RE =
  /^-\s*\[[^\]]*\]\s+\*\*P\d+\*\*\s*[（(]\d+s[）)]\s*—\s*\[([^\]]+)\]/;

export function extractPartNamesFromMarkdown(md) {
  const out = [];
  for (const line of md.split(/\r?\n/)) {
    const m = line.match(PART_TITLE_RE);
    if (m?.[1]) out.push(m[1].trim());
  }
  return out;
}

function looksLikeEpisodeChunk(title) {
  if (/开篇|欢迎来到|完整|考研|线代|零基础|学习指南/i.test(title)) return false;
  return (
    /^[\d.]+\s/.test(title) ||
    /选择\d|选择\s*\d|P\d+[-—]/.test(title) ||
    /^0\.0\s/.test(title) ||
    title.length < 8 ||
    /^讲解说明$/.test(title) ||
    /^课程白嫖指南$/.test(title)
  );
}

function subjectFromBlob(blob) {
  if (/计网|计算机网络|物理层|数据链路|TCP|UDP/i.test(blob)) return "计算机网络";
  if (/数据结构|线性表|树与二叉|图论|排序|查找/i.test(blob)) return "数据结构";
  if (/操作系统|进程|内存管理|文件管理|I\/O/i.test(blob)) return "操作系统";
  if (/组成原理|计组|计算机组成|CPU|指令系统|总线/i.test(blob))
    return "计算机组成原理";
  if (/高等数学|高数|函数极限|微积分|定积分|线代|线性代数|概率论/i.test(blob))
    return "高等数学";
  return null;
}

export function inferSeriesDisplayLabel(bvid, rawTitle, partNames, viewTitle) {
  const vt = (viewTitle || "").trim();
  if (vt && vt.length >= 6 && !looksLikeEpisodeChunk(vt)) {
    return vt.replace(/\s+/g, " ").trim();
  }

  const t = (rawTitle || "").trim();
  const sample = partNames.slice(0, 20).join("\n");
  const blob = `${t}\n${sample}`;

  if (/Kira.*线代|线代.*零基础/i.test(t) || /Kira/i.test(blob)) {
    return t.includes("Kira") ? t : "Kira · 27考研《线性代数》零基础";
  }

  if (/咸鱼|计算机网络的世界/i.test(blob)) {
    return "咸鱼 · 计算机网络（考研）";
  }

  if (/30讲高数|1000题高数|汤家凤/i.test(blob)) {
    return "考研数学 · 高等数学（30讲/1000题 合集）";
  }

  if (/答卷人|上帝视角|线性基础/i.test(t) || /答卷人|上帝视角/i.test(blob)) {
    return "线性代数基础 · 概念篇（答卷人/上帝视角）";
  }

  if (/最新学习指南/i.test(t)) {
    return "考研复习 · 学习指南（2025）";
  }

  const subject = subjectFromBlob(blob);
  const isChoiceDrill =
    /^计网\d|^数据结构\d|^操作系统\d|^组成原理\d/i.test(t) ||
    /选择\d|选择\s*\d/.test(t);

  if (subject && isChoiceDrill) {
    return `王道408 · ${subject} · 选择题精讲`;
  }

  if (subject && (/^0\.0\s|^1\.0_/.test(t) || /课程白嫖|白嫖指南/i.test(t))) {
    return `王道 · ${subject}（完整课程）`;
  }

  if (subject && /^第\d+章|^1\.\d+_/.test(t)) {
    return `高等数学 · ${t.replace(/^第\d+章[：:]\s*/, "")}`;
  }

  if (subject) {
    return `王道 · ${subject}`;
  }

  if (!looksLikeEpisodeChunk(t)) return t;

  return `${t}（${bvid}）`;
}

export function labelFromBvMarkdown(md, bvid, fallbackLabel) {
  const titleM = md.match(/^series_title:\s*["']?(.+?)["']?\s*$/im);
  const raw = titleM?.[1]?.trim() || fallbackLabel;
  const partNames = extractPartNamesFromMarkdown(md);
  return inferSeriesDisplayLabel(bvid, raw, partNames);
}
