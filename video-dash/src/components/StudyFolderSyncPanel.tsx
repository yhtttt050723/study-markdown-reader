import { useCallback, useEffect, useRef, useState } from 'react'
import {
  applyWatchedToMarkdown,
  buildMarkdownFromSeries,
  findBvMarkdownHandle,
  readFileText,
  writeFileText,
} from '../lib/markdownSync'
import { syncVideoProgressBoard } from '../lib/videoProgressBoardSync'
import {
  clearStudyVideoDirHandle,
  ensureDirWritable,
  loadStudyVideoDirHandle,
  saveStudyVideoDirHandle,
} from '../lib/studyDirDb'
import type { SeriesRecord } from '../types'
import { useSeriesStore } from '../stores/seriesStore'

async function syncSeriesList(
  dir: FileSystemDirectoryHandle,
  list: SeriesRecord[],
): Promise<void> {
  for (const ser of list) {
    const found = await findBvMarkdownHandle(dir, ser.bvid)
    if (found) {
      const raw = await readFileText(found.handle)
      const next = applyWatchedToMarkdown(raw, ser)
      await writeFileText(found.handle, next)
    } else {
      const name = `${ser.bvid}-video-dash.md`
      const fh = await dir.getFileHandle(name, { create: true })
      await writeFileText(fh, buildMarkdownFromSeries(ser))
    }
  }
}

export function StudyFolderSyncPanel() {
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(
    null,
  )
  const [dirLabel, setDirLabel] = useState<string>('')
  const [syncing, setSyncing] = useState(false)
  const [lastErr, setLastErr] = useState<string | null>(null)
  const [lastOkAt, setLastOkAt] = useState<string | null>(null)
  const dirRef = useRef<FileSystemDirectoryHandle | null>(null)
  dirRef.current = dirHandle

  const runSync = useCallback(async (list: SeriesRecord[]) => {
    const dir = dirRef.current
    if (!dir || list.length === 0) return
    setSyncing(true)
    setLastErr(null)
    try {
      const granted = await ensureDirWritable(dir)
      if (!granted) throw new Error('没有写入权限')
      await syncSeriesList(dir, list)
      await syncVideoProgressBoard(dir, list)
      setLastOkAt(new Date().toLocaleString())
    } catch (e) {
      setLastErr((e as Error).message || String(e))
    } finally {
      setSyncing(false)
    }
  }, [])

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const unsub = useSeriesStore.subscribe(() => {
      if (!dirRef.current) return
      clearTimeout(t)
      t = setTimeout(() => {
        void runSync(useSeriesStore.getState().series)
      }, 700)
    })
    return () => {
      unsub()
      clearTimeout(t)
    }
  }, [runSync])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const h = await loadStudyVideoDirHandle()
        if (cancelled || !h) return
        const ok = await ensureDirWritable(h)
        if (!ok) return
        setDirHandle(h)
        setDirLabel(h.name || '已连接文件夹')
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const pickFolder = async () => {
    setLastErr(null)
    if (!window.showDirectoryPicker) {
      setLastErr('当前浏览器不支持文件夹选择（请使用 Chrome / Edge 最新版，且需 HTTPS 或 localhost）。')
      return
    }
    try {
      const h = await window.showDirectoryPicker({ mode: 'readwrite' })
      const granted = await ensureDirWritable(h)
      if (!granted) throw new Error('未授予读写权限')
      await saveStudyVideoDirHandle(h)
      setDirHandle(h)
      setDirLabel(h.name)
      await runSync(useSeriesStore.getState().series)
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setLastErr((e as Error).message || String(e))
    }
  }

  const disconnect = async () => {
    await clearStudyVideoDirHandle()
    setDirHandle(null)
    setDirLabel('')
    setLastErr(null)
    setLastOkAt(null)
  }

  return (
    <section className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-5 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/30">
      <h2 className="mb-2 text-lg font-semibold text-emerald-900 dark:text-emerald-100">
        同步到 Study Markdown Reader
      </h2>
      <p className="mb-3 text-sm text-emerald-800/90 dark:text-emerald-200/80">
        选择本机 **`学习资料\学习视频进度`** 文件夹（与 Reader 打开的 Study 目录里路径一致）。勾选分 P 后会**自动**把 <code className="rounded bg-white/60 px-1 dark:bg-black/20">- [x]</code> 写回对应的{' '}
        <code className="rounded bg-white/60 px-1 dark:bg-black/20">BV*.md</code>
        ，Reader 里「视频进度看板」重新打开或点刷新即可看到一致勾选；<strong>新勾选的分 P</strong> 会自动累加到当日 <code>dailyLog</code>（本周观看分钟）。
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {!dirHandle ? (
          <button
            type="button"
            onClick={() => void pickFolder()}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-emerald-500"
          >
            选择「学习视频进度」文件夹
          </button>
        ) : (
          <>
            <span className="rounded-lg bg-white/80 px-3 py-1.5 text-sm text-emerald-900 dark:bg-black/30 dark:text-emerald-100">
              已连接：<strong>{dirLabel}</strong>
            </span>
            <button
              type="button"
              disabled={syncing}
              onClick={() => void runSync(useSeriesStore.getState().series)}
              className="rounded-xl border border-emerald-600 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
            >
              {syncing ? '写入中…' : '立即同步一次'}
            </button>
            <button
              type="button"
              onClick={() => void disconnect()}
              className="text-sm text-slate-600 underline-offset-2 hover:underline dark:text-slate-300"
            >
              断开并清除记忆
            </button>
          </>
        )}
      </div>
      {lastErr ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{lastErr}</p>
      ) : null}
      {lastOkAt && dirHandle ? (
        <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
          上次写入磁盘：{lastOkAt}
        </p>
      ) : null}
    </section>
  )
}
