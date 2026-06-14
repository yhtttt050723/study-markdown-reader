import {
  LS_QUIZ_LOG,
  LS_SECOND_PLAN_FOCUS,
  tryGetLocalStorage,
  trySetLocalStorage,
} from "./storageKeys.js";

/** 相对路径统一为正斜杠（比较、分组） */
export function normalizeRelPath(p) {
  return (p || "").replaceAll("\\", "/").trim();
}

/** 重组 Study 根后，曾位于根下的这些一级目录现多在「学习资料」下 */
const STUDY_ROOT_MOVED_FIRST_SEGMENTS = new Set([
  "temp_wrongshots",
  "错题截图",
  "数学",
  "英语错题",
  "408",
  "考研择校",
  "二刷计划",
  "学习计划",
  "MDC归档",
]);

/**
 * 题目图片路径规范化：去引号、合并重复反斜杠、统一为 Windows 反斜杠，便于与磁盘一致。
 * @param {string} p
 */
export function canonicalImagePathForRead(p) {
  let s = (p || "").trim();
  if (!s) return s;
  s = s.replace(/^[`'"]+|[`'"]+$/g, "");
  if (/^file:\/\//i.test(s)) {
    s = s.replace(/^file:\/\/\/+/i, "").replace(/\//g, "\\");
  }
  s = s.replace(/\//g, "\\");
  s = s.replace(/\\+/g, "\\");
  return s.trim();
}

/**
 * 本机曾把「错题截图 / 数学 / 408 …」迁到「学习资料」下；从绝对路径自动补候选，不依赖 folderPath 前缀是否一致。
 * 例：`D:\Study\错题截图\高数\a.png` → 追加 `D:\Study\学习资料\错题截图\高数\a.png`
 */
export function tryInsertStudyMaterialsMirror(canonPath) {
  const canon = canonicalImagePathForRead(canonPath);
  const m = canon.match(/^([a-zA-Z]:\\[^\\]+)\\([^\\]+)(\\.+)$/);
  if (!m) return null;
  const base = m[1];
  const first = m[2];
  const tail = m[3].replace(/^\\/, "");
  if (first === "学习资料") return null;
  if (!STUDY_ROOT_MOVED_FIRST_SEGMENTS.has(first)) return null;
  if (["周期记录", "电子书", "软件"].includes(first)) return null;
  return `${base}\\学习资料\\${first}\\${tail}`;
}

export function enumerateImageLoadCandidates(rawFromMarkdown, studyRootFolder) {
  const canon = canonicalImagePathForRead(rawFromMarkdown);
  const out = [];
  const add = (x) => {
    const c = canonicalImagePathForRead(x);
    if (c && !out.includes(c)) out.push(c);
  };
  add(canon);
  add(rawFromMarkdown);

  const mirrored = tryInsertStudyMaterialsMirror(canon);
  if (mirrored) add(mirrored);

  const root = (studyRootFolder || "")
    .trim()
    .replace(/[/\\]+$/, "")
    .replace(/\//g, "\\");
  if (root && canon.toLowerCase().startsWith(root.toLowerCase() + "\\")) {
    const rest = canon.slice(root.length).replace(/^\\/, "");
    if (rest) {
      const first = rest.split("\\")[0];
      if (
        STUDY_ROOT_MOVED_FIRST_SEGMENTS.has(first) &&
        first !== "学习资料" &&
        first !== "周期记录" &&
        first !== "电子书" &&
        first !== "软件"
      ) {
        add(`${root}\\学习资料\\${rest}`);
      }
    }
  }
  return out;
}

/** 浏览器内把 UTF-8 路径编成 base64url（与主进程 smr-img 解码一致） */
export function utf8ToBase64Url(str) {
  if (typeof str !== "string" || !str) return "";
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

/** 是否像本机绝对路径（桌面端可走 smr-img://） */
export function isLocalAbsoluteImagePath(p) {
  const t = (p || "").trim();
  if (!t) return false;
  if (/^file:\/\//i.test(t)) return true;
  if (/^[a-zA-Z]:[\\/]/.test(t)) return true;
  if (t.startsWith("/") && !t.startsWith("//")) return true;
  return false;
}

/** Electron：由主进程 protocol 读盘，避免 data URL 过大、file:// 被拦截 */
export function localImageProtocolUrlFromRaw(rawPath) {
  const canon = canonicalImagePathForRead(rawPath);
  if (!canon || !isLocalAbsoluteImagePath(rawPath)) return "";
  const payload = utf8ToBase64Url(canon);
  if (!payload) return "";
  return `smr-img://dir/${payload}`;
}

/** 写入 imageDataMap 时同时挂上原始串与规范串，便于 lookup */
export function imagePathLookupKeys(rawFromMarkdown) {
  const t = (rawFromMarkdown || "").trim();
  const canon = canonicalImagePathForRead(t);
  return [...new Set([t, canon, canon.replace(/\\/g, "/")])];
}

/** 错题预览 / 随机刷题：不展示答案（纸质版自持） */
export function stripAnswerSectionsForPractice(md) {
  let s = md || "";
  s = s.replace(
    /####\s*正确答案与解析[\s\S]*?(?=\n#### |\n###\s*题目[:：]|$)/gi,
    ""
  );
  s = s.replace(/####\s*答案[\s\S]*?(?=\n#### |\n###\s*题目[:：]|$)/gi, "");
  s = s.replace(
    /###\s*正确解法[^\n]*[\s\S]*?(?=\n### |\n#### |\n###\s*题目[:：]|$)/gi,
    ""
  );
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * @param {string} md
 * @param {Record<string, string>} imageDataMap
 * @param {{ useSmrImgProtocol?: boolean }} [options] 桌面端为 true 时用 smr-img://（主进程读盘），最稳定
 */
export function injectLocalQuestionImages(md, imageDataMap, options = {}) {
  const useSmr = Boolean(options.useSmrImgProtocol);
  return (md || "").replace(
    /- 题目图片[:：]\s*([^\n]+(?:\.png|\.jpg|\.jpeg|\.webp|\.gif))/gi,
    (_m, p1) => {
      const rawPath = p1.trim();
      let displayUrl = "";
      if (useSmr && isLocalAbsoluteImagePath(rawPath)) {
        displayUrl = localImageProtocolUrlFromRaw(rawPath);
      }
      if (!displayUrl) {
        let dataUrl = null;
        for (const k of imagePathLookupKeys(rawPath)) {
          if (imageDataMap[k]) {
            dataUrl = imageDataMap[k];
            break;
          }
        }
        const canon = canonicalImagePathForRead(rawPath);
        const fallbackPath = canon.replaceAll("\\", "/");
        const fallbackUrl = fallbackPath.startsWith("file:///")
          ? fallbackPath
          : `file:///${fallbackPath.replace(/^\/+/, "")}`;
        displayUrl = dataUrl || fallbackUrl;
      }
      return `- 题目图片：${rawPath}\n\n![题目截图](${displayUrl})`;
    }
  );
}

/** 相对路径第一层文件夹名（与侧栏分组一致） */
export function folderTagFromRel(fileLabel) {
  const norm = normalizeRelPath(fileLabel);
  if (!norm.includes("/")) return "根目录";
  return norm.split("/")[0] || "根目录";
}

export function splitWrongBookBlocks(text) {
  const t = (text || "").replace(/\r\n/g, "\n");
  const chunks = t.split(/(?=^###\s*题目[:：]|^##\s*题目[:：])/m);
  return chunks.filter(
    (c) => /^###\s*题目[:：]/m.test(c) || /^##\s*题目[:：]/m.test(c)
  );
}

export function parseWrongBlock(block, fileLabel) {
  const tm =
    block.match(/^###\s*题目[:：]\s*(.+)$/m) || block.match(/^##\s*题目[:：]\s*(.+)$/m);
  const dm = block.match(/^-\s*日期[:：]\s*(.+)$/m);
  const sm = block.match(/^-\s*来源[:：]\s*(.+)$/m);
  const subm = block.match(/^-\s*科目[:：]\s*(.+)$/m);
  const im = block.match(/^-\s*题目图片[:：]\s*(.+)$/m);
  const title = tm ? tm[1].trim() : "未命名";
  const imagePath = im ? canonicalImagePathForRead(im[1]) : "";
  const subject = subm ? subm[1].trim() : "";
  return {
    kind: "wrongbook",
    fileLabel,
    folderTag: folderTagFromRel(fileLabel),
    title,
    firstDate: dm ? dm[1].trim() : "—",
    source: sm ? sm[1].trim() : "—",
    subject,
    imagePath,
    secondPassStandard: "",
    bodyForQuiz: stripAnswerSectionsForPractice(block),
  };
}

export function splitSecondPassBlocks(text) {
  const t = (text || "").replace(/\r\n/g, "\n");
  const chunks = t.split(/(?=^##\s*题目\s*\d*\s*[：:])/m);
  return chunks.filter((c) => /^##\s*题目\s*\d*\s*[：:]/m.test(c));
}

export function parseSecondPassBlock(block, fileLabel) {
  const tm = block.match(/^##\s*题目\s*\d*\s*[：:]\s*(.+)$/m);
  const sm = block.match(/^-\s*来源[:：]\s*(.+)$/m);
  const subm = block.match(/^-\s*科目[:：]\s*(.+)$/m);
  const im = block.match(/^-\s*题目图片[:：]\s*(.+)$/m);
  const stm = block.match(/^-\s*二刷标准[:：]\s*(.+)$/m);
  const title = tm ? tm[1].trim() : "未命名";
  const imagePath = im ? canonicalImagePathForRead(im[1]) : "";
  const subject = subm ? subm[1].trim() : "";
  return {
    kind: "secondpass",
    fileLabel,
    folderTag: folderTagFromRel(fileLabel),
    title,
    firstDate: "—",
    source: sm ? sm[1].trim() : "—",
    subject,
    imagePath,
    secondPassStandard: stm ? stm[1].trim() : "",
    bodyForQuiz: stripAnswerSectionsForPractice(block),
  };
}

export function isWrongBookFile(file) {
  const rp = normalizeRelPath(file.relativePath);
  if (rp.includes("二刷计划")) return false;
  if (!file.name?.includes("错题")) return false;
  if (!/\.md$/i.test(file.name || "")) return false;
  return true;
}

export function isSecondPassPlanFile(file) {
  const rp = normalizeRelPath(file.relativePath);
  if (!rp.includes("二刷计划")) return false;
  if (!/\.md$/i.test(file.name || "")) return false;
  return true;
}

/** Electron 或浏览器：读取单个 md 文件正文 */
export async function readMarkdownFileText(file, mode) {
  if (
    mode === "electron" &&
    typeof window.electronAPI?.readMarkdownFile === "function"
  ) {
    return await window.electronAPI.readMarkdownFile(file.fullPath);
  }
  if (file.fileObject && typeof file.fileObject.text === "function") {
    return await file.fileObject.text();
  }
  return "";
}

/** 侧栏分组：根据文件列表生成「默认展开」的 group → true */
export function buildExpandedGroupsSeed(files) {
  const seed = {};
  for (const f of files) {
    const normalized = normalizeRelPath(f.relativePath);
    const group = normalized.includes("/") ? normalized.split("/")[0] : "根目录";
    seed[group] = true;
  }
  return seed;
}

export const QUIZ_SUBJECT_PRESETS = ["概率论", "高数", "线性代数"];

export function quizItemMatchesSubjects(itemSubject, selectedSubjects) {
  if (!selectedSubjects.length) return true;
  const raw = (itemSubject || "").trim();
  if (!raw) return false;
  return selectedSubjects.some((sel) => {
    if (raw === sel || raw.includes(sel)) return true;
    if (sel === "高数") return raw.includes("高等数学") || raw.includes("微积分");
    if (sel === "线性代数") return raw.includes("线代");
    if (sel === "概率论") return raw.includes("概率统计") || raw.includes("数理统计");
    return false;
  });
}

export function filterQuizPool(items, opts) {
  const {
    quizSourceWrong,
    quizSourceSecond,
    quizSelectedFolders,
    quizSelectedSubjects,
    quizSecondPlanFocus,
    quizFileOnlyMode,
  } = opts;

  if (quizFileOnlyMode) {
    const rel = normalizeRelPath(quizSecondPlanFocus);
    if (!rel) return [];
    return items.filter(
      (it) =>
        it.kind === "secondpass" && normalizeRelPath(it.fileLabel) === rel
    );
  }

  return items.filter((it) => {
    if (it.kind === "wrongbook" && !quizSourceWrong) return false;
    if (it.kind === "secondpass" && !quizSourceSecond) return false;
    if (
      quizSelectedFolders.length &&
      !quizSelectedFolders.includes(it.folderTag)
    ) {
      return false;
    }
    if (!quizItemMatchesSubjects(it.subject, quizSelectedSubjects)) {
      return false;
    }
    return true;
  });
}

export function resolveSecondPlanFocusRel(planRelPaths) {
  if (!planRelPaths.length) return "";
  const raw = tryGetLocalStorage(LS_SECOND_PLAN_FOCUS);
  if (raw === "__ALL__") return "";
  if (raw && planRelPaths.includes(raw)) return raw;
  if (raw === null) {
    const d = new Date();
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
    const needle = `${ymd}.md`;
    const hit = planRelPaths.find(
      (rel) => rel.endsWith(`/${needle}`) || rel === needle
    );
    return hit || "";
  }
  return "";
}

export function appendQuizLog(entry) {
  try {
    const raw = tryGetLocalStorage(LS_QUIZ_LOG);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return;
    arr.push({ ...entry, at: new Date().toISOString() });
    const trimmed = arr.slice(-500);
    const payload = JSON.stringify(trimmed);
    trySetLocalStorage(LS_QUIZ_LOG, payload);
    if (typeof window !== "undefined" && window.electronAPI?.writeQuizLogFile) {
      void window.electronAPI.writeQuizLogFile(payload);
    }
  } catch {
    /* ignore */
  }
}

export function formatElapsed(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}分${String(r).padStart(2, "0")}秒` : `${r}秒`;
}
