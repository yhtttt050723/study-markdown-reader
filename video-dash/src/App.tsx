import { AddSeriesForm } from './components/AddSeriesForm'
import { DashboardKpi } from './components/DashboardKpi'
import { SeriesBoard } from './components/SeriesBoard'
import { StudyFolderSyncPanel } from './components/StudyFolderSyncPanel'

export default function App() {
  return (
    <div className="min-h-screen bg-slate-100/80 dark:bg-slate-950">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-5 sm:px-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            视频学习看板
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            本地独立应用 · Vite + React + TS + Tailwind + TanStack Query / Table + Zustand
          </p>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
        <DashboardKpi />
        <StudyFolderSyncPanel />
        <AddSeriesForm />
        <SeriesBoard />
      </main>

      <footer className="mx-auto max-w-5xl px-4 py-8 text-center text-xs text-slate-400 sm:px-6">
        数据保存在本机浏览器 localStorage（键名 video-dash-series-v1）。生产环境需配置与开发相同的 B 站 API 代理或使用后端转发。
      </footer>
    </div>
  )
}
