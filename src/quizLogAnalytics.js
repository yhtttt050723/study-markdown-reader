import { LS_QUIZ_LOG, tryGetLocalStorage } from "./storageKeys.js";

/** @typedef {{ at?: string, kind?: string, correct?: boolean, seconds?: number, title?: string, fileLabel?: string, folderTag?: string, subject?: string, imagePath?: string, quizItemId?: string, quizFileOnlyMode?: boolean, secondPlanFocus?: string }} QuizLogEntry */

/**
 * 读取本地刷题日志（最多约 500 条，新在后）。
 * @returns {QuizLogEntry[]}
 */
export function readQuizLog() {
  try {
    const raw = tryGetLocalStorage(LS_QUIZ_LOG);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function pct(c, n) {
  return n > 0 ? Math.round((c / n) * 1000) / 10 : 0;
}

/**
 * @param {QuizLogEntry[]} entries
 */
export function aggregateQuizStats(entries) {
  const total = entries.length;
  let correct = 0;
  let wrong = 0;
  let sumSec = 0;
  let sumSecOk = 0;
  let sumSecBad = 0;

  /** @type {Record<string, { n: number; c: number }>} */
  const byFolder = {};
  /** @type {Record<string, { n: number; c: number }>} */
  const bySubject = {};
  const byKind = {
    wrongbook: { n: 0, c: 0 },
    secondpass: { n: 0, c: 0 },
  };

  for (const e of entries) {
    const ok = Boolean(e.correct);
    if (ok) correct++;
    else wrong++;
    const sec = Number(e.seconds);
    const s = Number.isFinite(sec) ? sec : 0;
    sumSec += s;
    if (ok) sumSecOk += s;
    else sumSecBad += s;

    const k = e.kind === "secondpass" ? "secondpass" : "wrongbook";
    byKind[k].n += 1;
    if (ok) byKind[k].c += 1;

    const ft = (e.folderTag || "").trim() || "—";
    if (!byFolder[ft]) byFolder[ft] = { n: 0, c: 0 };
    byFolder[ft].n += 1;
    if (ok) byFolder[ft].c += 1;

    const subj = (e.subject || "").trim() || "（未填科目）";
    if (!bySubject[subj]) bySubject[subj] = { n: 0, c: 0 };
    bySubject[subj].n += 1;
    if (ok) bySubject[subj].c += 1;
  }

  const sortBuckets = (obj) =>
    Object.entries(obj)
      .map(([key, v]) => ({
        key,
        n: v.n,
        c: v.c,
        acc: pct(v.c, v.n),
      }))
      .sort((a, b) => b.n - a.n);

  return {
    total,
    correct,
    wrong,
    accuracyPct: pct(correct, total),
    avgSeconds: total ? Math.round((sumSec / total) * 10) / 10 : 0,
    avgSecondsCorrect: correct ? Math.round((sumSecOk / correct) * 10) / 10 : null,
    avgSecondsWrong: wrong ? Math.round((sumSecBad / wrong) * 10) / 10 : null,
    byKind,
    folders: sortBuckets(byFolder),
    subjects: sortBuckets(bySubject),
    recent: [...entries].reverse().slice(0, 30),
  };
}
