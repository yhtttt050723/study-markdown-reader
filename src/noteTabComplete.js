import { kbCompleteFromOllama } from "./kbApi.js";
import { LS_NOTES_TAB_COMPLETE, tryGetLocalStorage, trySetLocalStorage } from "./storageKeys.js";

/** 默认开启 Tab 补全 */
export function isTabCompleteEnabled() {
  const v = tryGetLocalStorage(LS_NOTES_TAB_COMPLETE);
  if (v === null || v === "") return true;
  return v !== "0" && v !== "false";
}

export function setTabCompleteEnabled(on) {
  trySetLocalStorage(LS_NOTES_TAB_COMPLETE, on ? "1" : "0");
}

/**
 * @param {{ title?: string, prefix: string, suffix?: string }} ctx
 * @param {AbortSignal} [signal]
 * @returns {Promise<string>}
 */
export async function fetchNoteCompletion(ctx, signal) {
  const r = await kbCompleteFromOllama(
    {
      title: ctx.title || "",
      prefix: ctx.prefix || "",
      suffix: ctx.suffix || "",
    },
    { signal },
  );
  return String(r.text || "").trim();
}
