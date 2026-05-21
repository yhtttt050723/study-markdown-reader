import type { Question } from '../api'

export function questionSource(q: Question): { pdf: string; path: string } {
  const meta = (q.content?.metadata || {}) as Record<string, unknown>
  const pdf = String(meta.source_pdf || '').trim()
  const path = String(meta.source_path || '').trim()
  return { pdf, path }
}

export function questionListLabel(q: Question): string {
  const title = String(q.content?.title || '').trim()
  const { pdf } = questionSource(q)
  if (title && pdf) return `${title} · ${pdf}`
  if (title) return title
  if (pdf) return pdf
  return `#${q.id}`
}
