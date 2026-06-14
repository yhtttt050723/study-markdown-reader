import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useMemo } from 'react'
import type { SeriesPart } from '../types'
import { bilibiliPartUrl } from '../lib/bvid'
import { useSeriesStore } from '../stores/seriesStore'

function formatDuration(sec: number) {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m >= 60) {
    const h = Math.floor(m / 60)
    const mm = m % 60
    return `${h}h${mm}m`
  }
  if (m > 0) return r ? `${m}m${r}s` : `${m}m`
  return `${r}s`
}

const helper = createColumnHelper<SeriesPart>()

export function PartsTable({ bvid, parts }: { bvid: string; parts: SeriesPart[] }) {
  const setWatched = useSeriesStore((s) => s.setWatched)

  const columns = useMemo(
    () => [
      helper.display({
        id: 'watched',
        header: '已看',
        cell: (ctx) => (
          <input
            type="checkbox"
            className="h-4 w-4 accent-sky-600"
            checked={ctx.row.original.watched}
            onChange={(e) =>
              setWatched(bvid, ctx.row.original.page, e.target.checked)
            }
          />
        ),
        size: 48,
      }),
      helper.accessor('page', {
        header: 'P',
        cell: (c) => <span className="tabular-nums">{c.getValue()}</span>,
        size: 40,
      }),
      helper.accessor('part', {
        header: '标题',
        cell: (c) => {
          const page = c.row.original.page
          const url = bilibiliPartUrl(bvid, page)
          return (
            <div className="flex min-w-0 items-start gap-2">
              <span className="line-clamp-2 min-w-0 flex-1 text-left">{c.getValue()}</span>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium text-sky-600 underline-offset-2 hover:bg-sky-50 hover:underline dark:text-sky-400 dark:hover:bg-sky-950/40"
                title={url}
              >
                打开
              </a>
            </div>
          )
        },
      }),
      helper.accessor('duration', {
        header: '时长',
        cell: (c) => (
          <span className="tabular-nums text-slate-600 dark:text-slate-300">
            {formatDuration(c.getValue())}
          </span>
        ),
        size: 72,
      }),
    ],
    [bvid, setWatched],
  )

  const table = useReactTable({
    data: parts,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.page),
  })

  return (
    <div className="max-h-[min(52vh,520px)] overflow-auto rounded-xl border border-slate-100 dark:border-slate-700">
      <table className="w-full min-w-[480px] border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  className="border-b border-slate-200 px-2 py-2 font-semibold text-slate-600 dark:border-slate-600 dark:text-slate-300"
                  style={{ width: h.getSize() }}
                >
                  {h.isPlaceholder
                    ? null
                    : flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-slate-100 odd:bg-white even:bg-slate-50/80 dark:border-slate-800 dark:odd:bg-slate-900 dark:even:bg-slate-800/40"
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-2 py-1.5 align-middle">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
