import type { InboxProcessBody, InboxProcessResult } from '../api'

export type InboxStreamEvent =
  | { type: 'plan'; total_files: number; pending_files: number; skipped_files: number }
  | { type: 'skip'; file: string; reason: string }
  | { type: 'file_start'; file: string; file_index: number; file_total: number }
  | { type: 'splitting'; file: string }
  | { type: 'split_done'; file: string; batches: number; total_pages: number }
  | {
      type: 'batch_start'
      file: string
      batch_index: number
      batch_total: number
      page_start: number
      page_end: number
    }
  | {
      type: 'batch_done'
      file: string
      batch_index: number
      batch_total: number
      questions: number
      pdf_tag?: string
    }
  | { type: 'file_done'; file: string; result: InboxProcessResult['results'][0] }
  | { type: 'file_error'; file: string; error: string }
  | { type: 'complete' } & InboxProcessResult
  | { type: 'fatal'; error: string }

function parseSseChunk(buffer: string): { events: InboxStreamEvent[]; rest: string } {
  const events: InboxStreamEvent[] = []
  const parts = buffer.split('\n\n')
  const rest = parts.pop() ?? ''
  for (const block of parts) {
    const line = block.split('\n').find((l) => l.startsWith('data: '))
    if (!line) continue
    try {
      events.push(JSON.parse(line.slice(6)) as InboxStreamEvent)
    } catch {
      /* ignore malformed */
    }
  }
  return { events, rest }
}

export async function streamInboxProcessAll(
  body: InboxProcessBody,
  onEvent: (ev: InboxStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const r = await fetch('/api/import/inbox/process-all/stream/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!r.ok) {
    const text = await r.text()
    throw new Error(text || r.statusText)
  }
  const reader = r.body?.getReader()
  if (!reader) throw new Error('浏览器不支持流式响应')

  const dec = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const parsed = parseSseChunk(buf)
    buf = parsed.rest
    for (const ev of parsed.events) onEvent(ev)
  }
  if (buf.trim()) {
    const parsed = parseSseChunk(buf + '\n\n')
    for (const ev of parsed.events) onEvent(ev)
  }
}

export function inboxStreamPercent(
  fileIndex: number,
  fileTotal: number,
  batchIndex: number,
  batchTotal: number,
): number {
  if (fileTotal <= 0) return 0
  const fileBase = Math.max(0, fileIndex - 1) / fileTotal
  const inFile = batchTotal > 0 ? batchIndex / batchTotal / fileTotal : 1 / fileTotal
  return Math.min(99, Math.round((fileBase + inFile) * 100))
}
