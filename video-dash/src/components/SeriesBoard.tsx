import { useMemo, useState, type ReactNode } from 'react'
import {
  CONTENT_TYPE_LABELS,
  CONTENT_TYPES,
  SUBJECTS,
  compareGroupKeys,
  groupKey,
  type ContentType,
  type Subject,
} from '../lib/seriesTaxonomy'
import {
  formatSeriesMinutes,
  formatSeriesPercent,
} from '../lib/durationFormat'
import { bilibiliSeriesUrl } from '../lib/bvid'
import { sumSeconds, useSeriesStore } from '../stores/seriesStore'
import { SeriesFilterBar, type SeriesFilters } from './SeriesFilterBar'
import { PartsTable } from './PartsTable'

export function SeriesBoard() {
  const series = useSeriesStore((s) => s.series)
  const removeSeries = useSeriesStore((s) => s.removeSeries)
  const setSeriesMeta = useSeriesStore((s) => s.setSeriesMeta)
  const [filters, setFilters] = useState<SeriesFilters>({
    subject: 'all',
    contentType: 'all',
  })

  const counts = useMemo(() => {
    const bySubject: Partial<Record<Subject, number>> = {}
    const byContentType: Partial<Record<ContentType, number>> = {}
    for (const s of series) {
      bySubject[s.subject] = (bySubject[s.subject] || 0) + 1
      byContentType[s.contentType] = (byContentType[s.contentType] || 0) + 1
    }
    return { total: series.length, bySubject, byContentType }
  }, [series])

  const filtered = useMemo(() => {
    return series.filter((s) => {
      if (filters.subject !== 'all' && s.subject !== filters.subject) return false
      if (filters.contentType !== 'all' && s.contentType !== filters.contentType)
        return false
      return true
    })
  }, [series, filters])

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>()
    for (const s of filtered) {
      const key = groupKey(s.subject, s.contentType)
      const list = map.get(key) || []
      list.push(s)
      map.set(key, list)
    }
    return Array.from(map.entries()).sort(([a], [b]) => compareGroupKeys(a, b))
  }, [filtered])

  const displayCounts = useMemo(() => {
    const bySubject: Partial<Record<Subject, number>> = {}
    const byContentType: Partial<Record<ContentType, number>> = {}
    for (const s of filtered) {
      bySubject[s.subject] = (bySubject[s.subject] || 0) + 1
      byContentType[s.contentType] = (byContentType[s.contentType] || 0) + 1
    }
    return { total: filtered.length, bySubject, byContentType }
  }, [filtered])

  if (series.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-slate-500 dark:border-slate-600 dark:text-slate-400">
        暂无课程。先在上方添加 BV 链接拉取分 P。
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <SeriesFilterBar
        filters={filters}
        onChange={setFilters}
        counts={displayCounts}
      />

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500 dark:border-slate-600">
          当前筛选下没有课程。试试切换「全部科目」或「全部」类型。
        </p>
      ) : (
        grouped.map(([sectionTitle, items]) => (
          <section key={sectionTitle} className="flex flex-col gap-4">
            <h3 className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100/95 py-2 text-sm font-semibold text-slate-700 backdrop-blur dark:border-slate-700 dark:bg-slate-950/95 dark:text-slate-200">
              {sectionTitle}
              <span className="ml-2 font-normal text-slate-500">({items.length})</span>
            </h3>
            {items.map((s) => {
              const { total, watched } = sumSeconds(s.parts)
              const p = formatSeriesPercent(watched, total)
              return (
                <article
                  key={s.bvid}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-700">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        <Badge tone="subject">{s.subject}</Badge>
                        <Badge tone="type">
                          {CONTENT_TYPE_LABELS[s.contentType]}
                        </Badge>
                      </div>
                      <h4 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                        {s.title}
                      </h4>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-slate-500">
                        <span>{s.bvid}</span>
                        <a
                          href={bilibiliSeriesUrl(s.bvid)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-sans font-medium text-sky-600 underline-offset-2 hover:underline dark:text-sky-400"
                        >
                          打开合集 ↗
                        </a>
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        共 {s.parts.length} P · 同步于 {s.fetchedAt}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <label className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                          科目
                          <select
                            className="rounded border border-slate-200 bg-white px-1.5 py-0.5 dark:border-slate-600 dark:bg-slate-800"
                            value={s.subject}
                            onChange={(e) =>
                              setSeriesMeta(s.bvid, {
                                subject: e.target.value as Subject,
                              })
                            }
                          >
                            {SUBJECTS.map((sub) => (
                              <option key={sub} value={sub}>
                                {sub}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                          类型
                          <select
                            className="rounded border border-slate-200 bg-white px-1.5 py-0.5 dark:border-slate-600 dark:bg-slate-800"
                            value={s.contentType}
                            onChange={(e) =>
                              setSeriesMeta(s.bvid, {
                                contentType: e.target.value as ContentType,
                              })
                            }
                          >
                            {CONTENT_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {CONTENT_TYPE_LABELS[t]}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-[width]"
                          style={{ width: `${p}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-600 dark:text-slate-300">
                        已看 {p}% · {formatSeriesMinutes(watched)} /{' '}
                        {formatSeriesMinutes(total)} 分钟
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
          </section>
        ))
      )}

      {filters.subject !== 'all' || filters.contentType !== 'all' ? (
        <p className="text-center text-xs text-slate-400">
          库内共 {counts.total} 个系列 · 当前筛选 {filtered.length} 个
        </p>
      ) : null}
    </div>
  )
}

function Badge({
  children,
  tone,
}: {
  children: ReactNode
  tone: 'subject' | 'type'
}) {
  const cls =
    tone === 'subject'
      ? 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200'
      : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {children}
    </span>
  )
}
