import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { fetchPagelist } from '../api/bilibili'
import { extractBvid } from '../lib/bvid'
import { useSeriesStore } from '../stores/seriesStore'

export function AddSeriesForm() {
  const [text, setText] = useState('')
  const upsertSeries = useSeriesStore((s) => s.upsertSeries)

  const mutation = useMutation({
    mutationFn: async (raw: string) => {
      const bvid = extractBvid(raw)
      if (!bvid) throw new Error('未识别到 BV 号，请粘贴含 BV1… 的链接')
      return fetchPagelist(bvid)
    },
    onSuccess: (record) => {
      upsertSeries(record)
      setText('')
    },
  })

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h2 className="mb-2 text-lg font-semibold text-slate-800 dark:text-slate-100">
        添加 B 站课程
      </h2>
      <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
        粘贴任意含 <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">BV1</code> 的链接或文案，拉取分 P 与时长（开发环境走 Vite 代理 <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">/bili</code>）。
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-sky-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-800"
          placeholder="https://www.bilibili.com/video/BV..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !mutation.isPending) mutation.mutate(text)
          }}
        />
        <button
          type="button"
          disabled={mutation.isPending || !text.trim()}
          className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => mutation.mutate(text)}
        >
          {mutation.isPending ? '拉取中…' : '拉取分 P'}
        </button>
      </div>
      {mutation.isError ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          {(mutation.error as Error).message}
        </p>
      ) : null}
    </section>
  )
}
