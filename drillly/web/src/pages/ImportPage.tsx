import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type ImportTask, type InboxFile, type InboxProcessResult } from '../api'
import {
  inboxStreamPercent,
  streamInboxProcessAll,
  type InboxStreamEvent,
} from '../api/inboxStream'
import { importZh as t } from '../i18n/importZh'

type ImportProgress = {
  active: boolean
  percent: number
  fileTotal: number
  fileIndex: number
  fileName: string
  batchTotal: number
  batchIndex: number
  pageLabel: string
  logs: string[]
}

export function ImportPage() {
  const [providers, setProviders] = useState<
    { id: string; label: string; model: string; available?: boolean }[]
  >([])
  const [provider, setProvider] = useState('tongyi')
  const [pagesPerBatch, setPagesPerBatch] = useState(5)
  const [pdfTags, setPdfTags] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [task, setTask] = useState<ImportTask | null>(null)
  const [preview, setPreview] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [inboxDir, setInboxDir] = useState('')
  const [inboxFiles, setInboxFiles] = useState<InboxFile[]>([])
  const [progress, setProgress] = useState<ImportProgress>({
    active: false,
    percent: 0,
    fileTotal: 0,
    fileIndex: 0,
    fileName: '',
    batchTotal: 0,
    batchIndex: 0,
    pageLabel: '',
    logs: [],
  })
  const abortRef = useRef<AbortController | null>(null)
  const logEndRef = useRef<HTMLDivElement | null>(null)

  const loadInbox = useCallback(() => {
    api.getInbox().then((r) => {
      setInboxDir(r.inbox_dir)
      setInboxFiles(r.files)
    })
  }, [])

  useEffect(() => {
    api.providers().then((p) => {
      setProviders(p)
      const tongyi = p.find((x) => x.id === 'tongyi')
      setProvider(tongyi?.available ? 'tongyi' : p[0]?.id || 'mock')
    })
    loadInbox()
  }, [loadInbox])

  const upload = async () => {
    if (!file) return alert(t.selectPdf)
    setBusy(true)
    setMsg('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('tags', pdfTags)
      fd.append('pages_per_batch', String(pagesPerBatch))
      const res = await api.uploadPdf(fd)
      setTask(await api.getTask(res.task_id))
      setMsg(t.splitBatches(res.batches))
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t.uploadFail)
    } finally {
      setBusy(false)
    }
  }

  const parseBatch = async (batchId: number) => {
    if (!task) return
    setBusy(true)
    try {
      const res = await api.parseBatch(task.id, batchId, provider)
      setPreview(JSON.stringify(res.questions, null, 2))
      setTask(await api.getTask(task.id))
      setMsg(t.parsedMeta(res.count, res.pdf_tag, res.source_pdf))
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t.parseFail)
    } finally {
      setBusy(false)
    }
  }

  const confirmBatch = async (batchId: number) => {
    if (!task) return
    setBusy(true)
    try {
      const res = await api.confirmBatch(task.id, batchId)
      setMsg(t.confirmed(res.created_question_ids.join(', ')))
      setTask(await api.getTask(task.id))
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t.confirmFail)
    } finally {
      setBusy(false)
    }
  }

  const appendLog = (line: string) => {
    setProgress((p) => {
      const logs = [...p.logs, line]
      if (logs.length > 200) logs.shift()
      return { ...p, logs }
    })
    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 0)
  }

  const handleStreamEvent = (ev: InboxStreamEvent) => {
    switch (ev.type) {
      case 'plan':
        setProgress((p) => ({
          ...p,
          fileTotal: ev.pending_files,
          fileIndex: 0,
          percent: 0,
        }))
        appendLog(t.logPlan(ev.pending_files, ev.skipped_files))
        break
      case 'skip':
        appendLog(t.logSkip(ev.file, ev.reason))
        break
      case 'file_start':
        setProgress((p) => ({
          ...p,
          fileIndex: ev.file_index,
          fileTotal: ev.file_total,
          fileName: ev.file,
          batchTotal: 0,
          batchIndex: 0,
          pageLabel: '',
          percent: inboxStreamPercent(ev.file_index, ev.file_total, 0, 1),
        }))
        appendLog(t.logFileStart(ev.file, ev.file_index, ev.file_total))
        break
      case 'split_done':
        setProgress((p) => ({
          ...p,
          batchTotal: ev.batches,
          batchIndex: 0,
        }))
        appendLog(t.logSplit(ev.file, ev.batches, ev.total_pages))
        break
      case 'batch_start':
        setProgress((p) => ({
          ...p,
          batchIndex: ev.batch_index,
          batchTotal: ev.batch_total,
          pageLabel: t.pageRange(ev.page_start, ev.page_end),
          percent: inboxStreamPercent(p.fileIndex, p.fileTotal, ev.batch_index - 1, ev.batch_total),
        }))
        break
      case 'batch_done':
        setProgress((p) => ({
          ...p,
          batchIndex: ev.batch_index,
          percent: inboxStreamPercent(p.fileIndex, p.fileTotal, ev.batch_index, ev.batch_total),
        }))
        appendLog(t.logBatch(ev.file, ev.batch_index, ev.batch_total, ev.questions))
        break
      case 'file_done':
        appendLog(
          t.logFileDone(
            ev.file,
            ev.result.parsed_questions,
            ev.result.pdf_tag ?? undefined,
          ),
        )
        break
      case 'file_error':
        appendLog(t.logFileError(ev.file, ev.error))
        break
      case 'fatal':
        appendLog(t.logFileError('—', ev.error))
        break
      default:
        break
    }
  }

  const processInboxAll = async () => {
    const pending = inboxFiles.filter((f) => !f.imported)
    if (!pending.length && !inboxFiles.length) return alert(t.inboxEmpty)
    const n = pending.length || inboxFiles.length
    if (!confirm(t.confirmBatch(n))) return

    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    setBusy(true)
    setMsg('')
    setProgress({
      active: true,
      percent: 0,
      fileTotal: pending.length,
      fileIndex: 0,
      fileName: '',
      batchTotal: 0,
      batchIndex: 0,
      pageLabel: '',
      logs: [],
    })

    let summary: InboxProcessResult | undefined

    try {
      await streamInboxProcessAll(
        {
          provider,
          tags: pdfTags,
          pages_per_batch: pagesPerBatch,
          auto_confirm: true,
        },
        (ev) => {
          handleStreamEvent(ev)
          if (ev.type === 'complete') {
            summary = {
              processed: ev.processed,
              skipped: ev.skipped,
              results: ev.results,
              skipped_files: ev.skipped_files,
              errors: ev.errors,
            }
          }
        },
        ac.signal,
      )

      if (summary) {
        const lines = summary.results.map((r) => t.batchItem(r.file, r.pdf_tag, r.source_path))
        setMsg(
          t.batchDone(summary.processed, summary.skipped ?? 0, summary.errors.length) +
            (lines.length ? `\n${lines.join('\n')}` : ''),
        )
      }
      setProgress((p) => ({ ...p, percent: 100, active: false }))
      appendLog(t.progressDone)
      loadInbox()
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        setMsg('已取消')
      } else {
        setMsg(e instanceof Error ? e.message : t.batchFail)
      }
      setProgress((p) => ({ ...p, active: false }))
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }

  const cancelImport = () => {
    abortRef.current?.abort()
  }

  return (
    <div className="import-page">
      <h2>{t.title}</h2>

      <div className="card inbox-card">
        <h3>{t.inboxTitle}</h3>
        <p style={{ fontSize: '0.9rem' }}>
          {t.putPdf}
          <code style={{ marginLeft: 4 }}>{inboxDir || t.loading}</code>
        </p>
        <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{t.inboxHint}</p>
        <div style={{ marginTop: 8 }}>
          <button type="button" className="btn" onClick={loadInbox} disabled={busy}>
            {t.refresh}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginLeft: 8 }}
            disabled={busy || !inboxFiles.length}
            onClick={processInboxAll}
          >
            {t.processAll(inboxFiles.filter((f) => !f.imported).length || inboxFiles.length)}
          </button>
          {busy && (
            <button type="button" className="btn" style={{ marginLeft: 8 }} onClick={cancelImport}>
              取消
            </button>
          )}
        </div>
        {(progress.active || progress.logs.length > 0) && (
          <div className="import-progress card" style={{ marginTop: 12 }}>
            <div className="import-progress-head">
              <strong>{t.progressTitle}</strong>
              <span>{progress.percent}%</span>
            </div>
            <div className="import-progress-bar" aria-hidden>
              <div className="import-progress-fill" style={{ width: `${progress.percent}%` }} />
            </div>
            <p className="import-progress-detail">
              {progress.fileTotal > 0
                ? t.progressFiles(progress.fileIndex || 0, progress.fileTotal)
                : t.progressWaiting}
              {progress.fileName ? ` · ${progress.fileName}` : ''}
            </p>
            {progress.batchTotal > 0 && (
              <p className="import-progress-detail muted">
                {t.progressBatches(progress.batchIndex, progress.batchTotal, progress.pageLabel)}
              </p>
            )}
            <pre className="import-progress-log">
              {progress.logs.join('\n')}
              <div ref={logEndRef} />
            </pre>
          </div>
        )}
        {inboxFiles.length > 0 && (
          <ul style={{ marginTop: 12, fontSize: '0.9rem' }}>
            {inboxFiles.map((f) => (
              <li key={f.name}>
                {f.name}（{f.size_mb} MB）
                {f.imported ? (
                  <span style={{ marginLeft: 8, color: 'var(--muted)' }}>{t.inboxImported}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3>{t.manualTitle}</h3>
        <p>
          <label>
            {t.pagesPerBatch}{' '}
            <input
              type="number"
              min={1}
              max={20}
              value={pagesPerBatch}
              onChange={(e) => setPagesPerBatch(Number(e.target.value))}
            />
          </label>
        </p>
        <p>
          <label>
            {t.model}{' '}
            <select value={provider} onChange={(e) => setProvider(e.target.value)}>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {p.available === false ? t.noKey : ''}
                </option>
              ))}
            </select>
          </label>
        </p>
        <p>
          <label>
            {t.pdfTags}{' '}
            <input
              value={pdfTags}
              onChange={(e) => setPdfTags(e.target.value)}
              style={{ width: 280 }}
            />
          </label>
        </p>
        <p>
          <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </p>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={upload}>
          {t.upload}
        </button>
        {msg && <p style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{msg}</p>}
      </div>

      {task && (
        <div className="card">
          <h3>{t.taskHeader(task.id, task.original_name, task.total_pages)}</h3>
          <table className="import-table">
            <thead>
              <tr>
                <th>{t.colBatch}</th>
                <th>{t.colPages}</th>
                <th>{t.colStatus}</th>
                <th>{t.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {task.batches.map((b) => (
                <tr key={b.id}>
                  <td>{b.id}</td>
                  <td>{t.pageRange(b.page_start, b.page_end)}</td>
                  <td>{b.status}</td>
                  <td>
                    <button type="button" className="btn" disabled={busy} onClick={() => parseBatch(b.id)}>
                      {t.parse}
                    </button>
                    <button type="button" className="btn" disabled={busy} onClick={() => confirmBatch(b.id)}>
                      {t.confirm}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {preview && (
        <div className="card">
          <h3>{t.previewJson}</h3>
          <pre style={{ overflow: 'auto', maxHeight: 360, fontSize: 12 }}>{preview}</pre>
        </div>
      )}
    </div>
  )
}
