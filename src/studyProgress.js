import { normalizeRelPath } from "./markdownQuiz.js";
import { LS_STUDY_PROGRESS, tryGetLocalStorage, trySetLocalStorage } from "./storageKeys.js";

/** Markdown 中 JSON 代码块语言标记（与择校等一致：专用 fenced block） */
export const STUDY_PROGRESS_FENCE = "smr-progress";

/**
 * 是否为「学习进度」数据文件：文件名或相对路径包含「学习进度」。
 * @param {{ name?: string, relativePath?: string } | null} file
 */
export function isStudyProgressFile(file) {
  if (!file) return false;
  const name = file.name || "";
  const rp = normalizeRelPath(file.relativePath || "");
  return name.includes("学习进度") || rp.includes("学习进度");
}

/**
 * 在已打开的文件夹根目录生成默认「学习进度.md」路径（Electron）。
 * @param {string} folderPath
 */
export function resolveStudyProgressDefaultPath(folderPath) {
  if (!folderPath || typeof folderPath !== "string") return null;
  const trimmed = folderPath.replace(/[/\\]+$/, "");
  const sep = trimmed.includes("\\") ? "\\" : "/";
  return `${trimmed}${sep}周期记录${sep}学习进度.md`;
}

/** 必考词单元数 */
export const ENGLISH_MUST_UNITS = 26;
/** 基础词单元数 */
export const ENGLISH_BASIC_UNITS = 29;

/** 无科目目录文件时用于 clamp / 迁移的旧版章节数（与仓库内 Math.mdc / 408.mdc 一致） */
export const MATH_CHAPTER_DEFAULT_MAX = {
  高数: 12,
  线代: 6,
  概率论: 8,
};

/** 《张宇1000题》无目录块时的默认章数（与 Math.mdc 张宇1000 分篇一致） */
export const BOOK1000_DEFAULT_MAX = {
  高数: { 基础: 19, 强化: 18 },
  线代: { 基础: 6, 强化: 9 },
  概率论: { 基础: 6, 强化: 9 },
};

export const BOOK1000_COMPREHENSIVE_TOTAL = 4;

export const CS408_CHAPTER_DEFAULT_MAX = {
  机组: 7,
  数据结构: 8,
  计网: 6,
  操作系统: 5,
};

/**
 * @typedef {{
 *   basicThrough: number,
 *   strengthenThrough: number,
 *   book660Through?: number,
 *   book660Total?: number,
 *   book660Caption?: string,
 *   book1000BasicThrough?: number,
 *   book1000StrengthenThrough?: number,
 *   book1000Caption?: string,
 * }} MathSubjectProgress
 * @typedef {{ comprehensiveThrough: number, comprehensiveTotal?: number }} ZhangYu1000ComprehensiveProgress
 * @typedef {{ through: number }} Cs408SubjectProgress
 */

/** 《660》高数分册默认总题数（与 `周期记录/进度规划看板.md` 一致；线代/概率开做后可写 `book660Total`） */
export const BOOK660_DEFAULT_TOTAL_CALC = 360;

/**
 * basicThrough / strengthenThrough：按红书基础篇 / 严选题 **已过章节数**（0～目录章数，与章节条目对齐）。
 * book660Through / book660Total：《660》当前分册已做题数 / 本分册总题数（高数默认总题数 360；`book660Total: 0` 表示不在看板显示该科 660 条）。
 * book660Caption：看板「《660》」条下说明文字（可选，如已过至章节）。
 * book1000BasicThrough / book1000StrengthenThrough：《张宇1000题》基础篇 / 强化篇已过章节数（与 Math.mdc 张宇1000 目录对齐）。
 * book1000Caption：看板「《张宇1000》」说明（可选）。
 * zhangyu1000.comprehensiveThrough：综合篇测试卷已过数量（0–4）。
 * cs408.through：408 单科基础已过章节数。
 */
export const DEFAULT_STUDY_PROGRESS = {
  math1: {
    高数: {
      basicThrough: 12,
      strengthenThrough: 12,
      book660Through: 80,
      book660Total: BOOK660_DEFAULT_TOTAL_CALC,
      book660Caption: "已过至：第六章 定积分应用（第 80 题）",
    },
    线代: { basicThrough: 4, strengthenThrough: 3, book660Through: 0, book660Total: 0 },
    概率论: { basicThrough: 3, strengthenThrough: 2, book660Through: 0, book660Total: 0 },
  },
  math2: {
    高数: {
      basicThrough: 12,
      strengthenThrough: 12,
      book660Through: 80,
      book660Total: BOOK660_DEFAULT_TOTAL_CALC,
      book660Caption: "已过至：第六章 定积分应用（第 80 题）",
    },
    线代: { basicThrough: 4, strengthenThrough: 3, book660Through: 0, book660Total: 0 },
  },
  cs408: {
    数据结构: { through: 7 },
    机组: { through: 6 },
    计网: { through: 6 },
    操作系统: { through: 5 },
  },
  english: {
    mustWords: { round1Unit: 0, round2Unit: 0 },
    basicWords: { round1Unit: 0, round2Unit: 0 },
  },
  zhangyu1000: {
    comprehensiveThrough: 0,
    comprehensiveTotal: BOOK1000_COMPREHENSIVE_TOTAL,
  },
};

function clampUnit(n, max) {
  const x = Math.floor(Number(n));
  if (!Number.isFinite(x)) return 0;
  return Math.min(max, Math.max(0, x));
}

function clampThroughValue(v, maxChapters) {
  const m = Math.max(0, Math.floor(maxChapters));
  if (m <= 0) return Math.max(0, Math.floor(Number(v) || 0));
  return clampUnit(v, m);
}

/**
 * @param {string} key
 * @param {import('./studyCatalog.js').CatalogChapter[]|undefined} chapters
 */
function maxChForMath(key, chapters) {
  if (chapters && chapters.length > 0) return chapters.length;
  return MATH_CHAPTER_DEFAULT_MAX[key] ?? 12;
}

/**
 * @param {string} key
 * @param {import('./studyCatalog.js').CatalogChapter[]|undefined} chapters
 */
function maxCh408(key, chapters) {
  if (chapters && chapters.length > 0) return chapters.length;
  return CS408_CHAPTER_DEFAULT_MAX[key] ?? 8;
}

/**
 * @param {string} key 高数 | 线代 | 概率论
 * @param {Record<string, unknown>} pr
 */
/**
 * @param {string} key
 * @param {Record<string, unknown>} pr
 * @param {import('./studyCatalog.js').ZhangYuSubjectPhases|undefined} zy
 */
function normalizeBook1000(key, pr, zy) {
  const def = BOOK1000_DEFAULT_MAX[key] ?? { 基础: 0, 强化: 0 };
  const basicMax =
    zy?.基础?.length > 0 ? zy.基础.length : def.基础;
  const strengthenMax =
    zy?.强化?.length > 0 ? zy.强化.length : def.强化;
  const showBasic = basicMax > 0;
  const showStrengthen = strengthenMax > 0;
  const book1000BasicThrough = showBasic
    ? clampUnit(pr.book1000BasicThrough ?? 0, basicMax)
    : 0;
  const book1000StrengthenThrough = showStrengthen
    ? clampUnit(pr.book1000StrengthenThrough ?? 0, strengthenMax)
    : 0;
  const cap = pr.book1000Caption;
  const book1000Caption = typeof cap === "string" ? cap.trim() : "";
  return { book1000BasicThrough, book1000StrengthenThrough, book1000Caption };
}

function normalizeZhangYuComprehensive(patch, comprehensiveChapters) {
  const base = DEFAULT_STUDY_PROGRESS.zhangyu1000;
  const row = patch && typeof patch === "object" ? patch : {};
  const totalRaw = Math.floor(Number(row.comprehensiveTotal));
  const total =
    comprehensiveChapters?.length > 0
      ? comprehensiveChapters.length
      : Number.isFinite(totalRaw) && totalRaw > 0
        ? totalRaw
        : BOOK1000_COMPREHENSIVE_TOTAL;
  const through = clampUnit(row.comprehensiveThrough ?? base.comprehensiveThrough, total);
  return { comprehensiveThrough: through, comprehensiveTotal: total };
}

function normalizeBook660(key, pr) {
  const explicitTotal = Math.floor(Number(pr.book660Total));
  const defaultTotal = key === "高数" ? BOOK660_DEFAULT_TOTAL_CALC : 0;
  const book660Total =
    Number.isFinite(explicitTotal) && explicitTotal > 0 ? explicitTotal : defaultTotal;
  const throughRaw = Math.floor(Number(pr.book660Through));
  const book660Through =
    book660Total > 0
      ? clampUnit(Number.isFinite(throughRaw) ? throughRaw : 0, book660Total)
      : 0;
  const cap = pr.book660Caption;
  const book660Caption = typeof cap === "string" ? cap.trim() : "";
  return { book660Total, book660Through, book660Caption };
}

function normalizeMathRow(key, row, chapters, zhangyuSlice) {
  const max = maxChForMath(key, chapters);
  const pr = row && typeof row === "object" ? row : {};
  const b660 = normalizeBook660(key, pr);
  const b1000 = normalizeBook1000(key, pr, zhangyuSlice?.[key]);
  const hasThrough =
    typeof pr.basicThrough === "number" || typeof pr.strengthenThrough === "number";
  if (hasThrough) {
    return {
      basicThrough: clampThroughValue(pr.basicThrough ?? 0, max),
      strengthenThrough: clampThroughValue(pr.strengthenThrough ?? 0, max),
      ...b660,
      ...b1000,
    };
  }
  if ("basicPct" in pr || "strengthenPct" in pr) {
    const n = max;
    return {
      basicThrough: n ? Math.round(((Number(pr.basicPct) || 0) / 100) * n) : 0,
      strengthenThrough: n ? Math.round(((Number(pr.strengthenPct) || 0) / 100) * n) : 0,
      ...b660,
      ...b1000,
    };
  }
  return {
    basicThrough: clampThroughValue(pr.basicThrough ?? 0, max),
    strengthenThrough: clampThroughValue(pr.strengthenThrough ?? 0, max),
    ...b660,
    ...b1000,
  };
}

function normalize408Row(key, row, chapters) {
  const max = maxCh408(key, chapters);
  const pr = row && typeof row === "object" ? row : {};
  if (typeof pr.through === "number") {
    return { through: clampThroughValue(pr.through, max) };
  }
  if ("basicPct" in pr || "strengthenPct" in pr) {
    const n = max;
    const pct = Number(pr.basicPct ?? pr.strengthenPct ?? 0);
    return { through: n ? Math.round((pct / 100) * n) : 0 };
  }
  return { through: clampThroughValue(pr.through ?? 0, max) };
}

function mergeMathMap(base, patch, catalogSlice, zhangyuSlice) {
  const out = {};
  for (const key of Object.keys(base)) {
    const ch = catalogSlice?.[key];
    const rowPatch =
      patch && typeof patch[key] === "object" && patch[key] != null
        ? { ...base[key], ...patch[key] }
        : base[key];
    out[key] = normalizeMathRow(key, rowPatch, ch, zhangyuSlice);
  }
  return out;
}

function mergeCs408Map(base, patch, catalogSlice) {
  const out = {};
  for (const key of Object.keys(base)) {
    const ch = catalogSlice?.[key];
    const rowPatch =
      patch && typeof patch[key] === "object" && patch[key] != null
        ? { ...base[key], ...patch[key] }
        : base[key];
    out[key] = normalize408Row(key, rowPatch, ch);
  }
  return out;
}

/**
 * 合并进度 JSON；可选传入已解析的科目目录用于章节 clamp。
 * @param {typeof DEFAULT_STUDY_PROGRESS} base
 * @param {object} patch
 * @param {{ math?: object, cs408?: object, zhangyu1000?: import('./studyCatalog.js').ReturnType<typeof import('./studyCatalog.js').parseZhangYu1000Catalog> } | undefined} catalog
 */
export function mergeStudyProgressData(base, patch, catalog) {
  if (patch == null || typeof patch !== "object") return base;
  const mathCat = catalog?.math;
  const csCat = catalog?.cs408;
  const zy = catalog?.zhangyu1000;
  const zySubjects = zy
    ? { 高数: zy.高数, 线代: zy.线代, 概率论: zy.概率论 }
    : undefined;
  return {
    math1: mergeMathMap(base.math1, patch.math1, mathCat, zySubjects),
    math2: mergeMathMap(base.math2, patch.math2, mathCat, zySubjects),
    cs408: mergeCs408Map(base.cs408, patch.cs408, csCat),
    zhangyu1000: normalizeZhangYuComprehensive(patch.zhangyu1000, zy?.综合),
    english: {
      mustWords: {
        round1Unit: clampUnit(
          patch?.english?.mustWords?.round1Unit ?? base.english.mustWords.round1Unit,
          ENGLISH_MUST_UNITS
        ),
        round2Unit: clampUnit(
          patch?.english?.mustWords?.round2Unit ?? base.english.mustWords.round2Unit,
          ENGLISH_MUST_UNITS
        ),
      },
      basicWords: {
        round1Unit: clampUnit(
          patch?.english?.basicWords?.round1Unit ?? base.english.basicWords.round1Unit,
          ENGLISH_BASIC_UNITS
        ),
        round2Unit: clampUnit(
          patch?.english?.basicWords?.round2Unit ?? base.english.basicWords.round2Unit,
          ENGLISH_BASIC_UNITS
        ),
      },
    },
  };
}

export function readStudyProgress() {
  try {
    const raw = tryGetLocalStorage(LS_STUDY_PROGRESS);
    if (!raw) {
      return structuredClone(DEFAULT_STUDY_PROGRESS);
    }
    const parsed = JSON.parse(raw);
    return mergeStudyProgressData(structuredClone(DEFAULT_STUDY_PROGRESS), parsed);
  } catch {
    return structuredClone(DEFAULT_STUDY_PROGRESS);
  }
}

export function writeStudyProgress(data) {
  try {
    trySetLocalStorage(LS_STUDY_PROGRESS, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} md
 * @param {{ math?: object, cs408?: object } | undefined} catalog
 */
export function parseStudyProgressFromMarkdown(md, catalog) {
  const body = md || "";
  const re = new RegExp(
    "```" + STUDY_PROGRESS_FENCE + "\\s*\\r?\\n([\\s\\S]*?)```",
    "m"
  );
  const m = body.match(re);
  if (!m) {
    return structuredClone(DEFAULT_STUDY_PROGRESS);
  }
  try {
    const parsed = JSON.parse(m[1].trim());
    return mergeStudyProgressData(structuredClone(DEFAULT_STUDY_PROGRESS), parsed, catalog);
  } catch {
    return structuredClone(DEFAULT_STUDY_PROGRESS);
  }
}

/**
 * @param {typeof DEFAULT_STUDY_PROGRESS} data
 */
export function buildStudyProgressMarkdown(data) {
  const json = JSON.stringify(data, null, 2);
  return `# 学习进度

本文件由 Study Markdown Reader 维护。下方以 \`${STUDY_PROGRESS_FENCE}\` 标记的 JSON 代码块与顶栏「学习进度」看板一致；进度字段与 \`科目目录/Math.mdc\`、\`科目目录/408.mdc\` 中章节对应（basicThrough / strengthenThrough / through 表示已过章节数）。**《660》**：每科可选 **book660Through**、**book660Total**、**book660Caption**。**《张宇1000题》**：**book1000BasicThrough** / **book1000StrengthenThrough**（与 Math.mdc「张宇1000」分篇章节对齐）、**book1000Caption**；综合篇见根级 **zhangyu1000.comprehensiveThrough**（测试卷 0–4）。可直接改 JSON 后 **Ctrl+S** 保存，再点「刷新 UI」或重新打开看板即可同步。

\`\`\`${STUDY_PROGRESS_FENCE}
${json}
\`\`\`
`;
}
