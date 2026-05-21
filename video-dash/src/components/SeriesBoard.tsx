import { sumSeconds, useSeriesStore } from '../stores/seriesStore'
import { PartsTable } from './PartsTable'

function pct(watched: number, total: number) {
  if (total <= 0) return 0
  return Math.min(100, Math.round((watched / total) * 1000) / 10)
}

export function SeriesBoard() {
  const series = useSeriesStore((s) => s.series)
  const removeSeries = useSeriesStore((s) => s.removeSeries)

  if (series.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-slate-500 dark:border-slate-600 dark:text-slate-400">
        暂无课程。先在上方添加 BV 链接拉取分 P。
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {series.map((s) => {
        const { total, watched } = sumSeconds(s.parts)
        const p = pct(watched, total)
        return (
          <article
            key={s.bvid}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-700">
              <div>
                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                  {s.title}
                </h3>
                <p className="mt-1 font-mono text-xs text-slate-500">{s.bvid}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  共 {s.parts.length} P · 同步于 {s.fetchedAt}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-[width]"
                    style={{ width: `${p}%` }}
                  />
                </div>
                <span className="text-xs text-slate-600 dark:text-slate-300">
                  已看 {p}% · {Math.round(watched / 60)} / {Math.round(total / 60)} 分钟
                </span>
                <button
                  type="button"
                  className="text-xs text-red-600 underline-offset-2 hover:underline dark:text-red-400"
                  onClick={() => removeSeries(s.bvid)}
                >
                  移除此课
                </button>
              </div>
            </header>
            <div className="p-4">
              <PartsTable bvid={s.bvid} parts={s.parts} />
            </div>
          </article>
        )
      })}
    </div>
  )
}
