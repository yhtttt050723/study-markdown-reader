import { useCallback, useEffect, useState } from 'react'
import { api, type PdfSource, type ProgressSummary, type Question, type TagTreeGroup } from '../api'
import { QuestionCard } from '../components/QuestionCard'
import { ScratchPad } from '../components/ScratchPad'
import { questionListLabel, questionSource } from '../utils/questionSource'
export function PracticePage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [pdfSources, setPdfSources] = useState<PdfSource[]>([])
  const [summary, setSummary] = useState<ProgressSummary | null>(null)
  const [tagTree, setTagTree] = useState<TagTreeGroup[]>([])
  const [pdfFilter, setPdfFilter] = useState('')
  const [tagGroupFilter, setTagGroupFilter] = useState('')
  const [tagChildFilter, setTagChildFilter] = useState('')
  const [practiceRound, setPracticeRound] = useState<1 | 2>(1)
  const [roundStatus, setRoundStatus] = useState<'' | 'pending' | 'done'>('')
  const [randomOrder, setRandomOrder] = useState(false)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [err, setErr] = useState('')

  const hasTopicFilter = Boolean(tagGroupFilter || tagChildFilter)

  const buildParams = useCallback(() => {
    const p = new URLSearchParams()
    if (pdfFilter) p.set('source_pdf', pdfFilter)
    const tag = tagChildFilter || tagGroupFilter
    if (tag) p.set('tags', tag)
    if (practiceRound) p.set('practice_round', String(practiceRound))
    if (roundStatus) p.set('round_status', roundStatus)
    if (randomOrder) p.set('order', 'random')
    p.set('limit', '500')
    return p
  }, [pdfFilter, tagGroupFilter, tagChildFilter, practiceRound, roundStatus, randomOrder])

  const load = useCallback(() => {
    api
      .listPracticeQuestions(buildParams())
      .then((qs) => {
        setQuestions(qs)
        setActiveId((prev) => {
          if (!qs.length) return null
          if (prev && qs.some((q) => q.id === prev)) return prev
          return qs[0].id
        })
      })
      .catch((e) => setErr(e.message))
  }, [buildParams])

  const loadSummary = useCallback(() => {
    api.progressSummary(pdfFilter || undefined).then(setSummary).catch(() => setSummary(null))
  }, [pdfFilter])

  useEffect(() => {
    api.listTagTree().then(setTagTree).catch(() => {})
    api.listPdfSources().then(setPdfSources).catch(() => {})
    api.backfillSourceTags?.().catch(() => {})
  }, [])

  useEffect(() => {
    load()
    loadSummary()
  }, [load, loadSummary])

  const clearFilters = () => {
    setPdfFilter('')
    setTagGroupFilter('')
    setTagChildFilter('')
    setRoundStatus('')
  }

  const currentIdx = questions.findIndex((q) => q.id === activeId)
  const current = currentIdx >= 0 ? questions[currentIdx] : questions[0]

  const goPrev = useCallback(() => {
    if (questions.length < 2) return
    const i = currentIdx <= 0 ? questions.length - 1 : currentIdx - 1
    setActiveId(questions[i].id)
  }, [questions, currentIdx])

  const goNext = useCallback(() => {
    if (questions.length < 2) return
    const i = currentIdx < 0 || currentIdx >= questions.length - 1 ? 0 : currentIdx + 1
    setActiveId(questions[i].id)
  }, [questions, currentIdx])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goPrev, goNext])

  const onSubmitted = () => {
    load()
    loadSummary()
  }

  const exportMd = (zip: boolean) => {
    const p = buildParams()
    p.set('include_answers', 'true')
    p.set('include_submissions', 'true')
    p.set('format', zip ? 'zip' : 'single')
    window.open(api.exportUrl(p), '_blank')
  }

  return (
    <div className="practice-layout">
      {questions.length > 0 && (
        <aside className="question-sidebar">
          <div className="question-sidebar-head">
            <strong>题目列表</strong>
            <span className="muted">{questions.length} 题</span>
          </div>
          <ul className="question-sidebar-list">
            {questions.map((q) => {
              const { pdf } = questionSource(q)
              const pr = q.practice
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    className={q.id === current?.id ? 'q-item active' : 'q-item'}
                    onClick={() => setActiveId(q.id)}
                  >
                    <span className="q-item-id">
                      #{q.id}
                      {pr?.round1 ? ' ·1✓' : ''}
                      {pr?.round2 ? ' ·2✓' : ''}
                    </span>
                    <span className="q-item-title">{questionListLabel(q)}</span>
                    {pdf && <span className="q-item-pdf">{pdf}</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>
      )}

      <main className="practice-main">
        {err && (
          <p className="practice-alert">
            无法连接 API：{err} — 请先启动 drillly/api（端口 5213）
          </p>
        )}

        {summary && summary.total > 0 && (
          <div className="practice-progress-summary card">
            <span>
              一刷 <strong>{summary.round1_done}</strong> / {summary.total}
            </span>
            <span style={{ marginLeft: 16 }}>
              二刷 <strong>{summary.round2_done}</strong> / {summary.total}
            </span>
            {pdfFilter && (
              <span className="muted" style={{ marginLeft: 12 }}>
                当前 PDF：{pdfFilter}
              </span>
            )}
          </div>
        )}

        <div className="filters">
          <select value={pdfFilter} onChange={(e) => setPdfFilter(e.target.value)}>
            <option value="">全部 PDF（来源）</option>
            {pdfSources.map((s) => (
              <option key={s.source_pdf} value={s.source_pdf}>
                {s.source_pdf}（{s.question_count}）
              </option>
            ))}
          </select>
          <select
            value={tagGroupFilter}
            onChange={(e) => {
              setTagGroupFilter(e.target.value)
              setTagChildFilter('')
            }}
          >
            <option value="">全部主题大标签</option>
            {tagTree.map((g) => (
              <option key={g.name} value={g.name}>
                {g.name}
              </option>
            ))}
          </select>
          <select
            value={tagChildFilter}
            onChange={(e) => setTagChildFilter(e.target.value)}
            disabled={!tagGroupFilter}
          >
            <option value="">全部小标签</option>
            {tagTree
              .find((g) => g.name === tagGroupFilter)
              ?.children.map((c) => (
                <option key={c.id} value={c.full_name}>
                  {c.name}
                </option>
              ))}
          </select>
          <select
            value={practiceRound}
            onChange={(e) => setPracticeRound(Number(e.target.value) as 1 | 2)}
            title="当前刷题轮次，提交后自动记入该轮进度"
          >
            <option value={1}>一刷模式</option>
            <option value={2}>二刷模式</option>
          </select>
          <select
            value={roundStatus}
            onChange={(e) => setRoundStatus(e.target.value as '' | 'pending' | 'done')}
          >
            <option value="">全部进度</option>
            <option value="pending">未完成</option>
            <option value="done">已完成</option>
          </select>
          <label className="filter-check">
            <input
              type="checkbox"
              checked={randomOrder}
              onChange={(e) => setRandomOrder(e.target.checked)}
            />
            随机顺序
          </label>
          {(pdfFilter || hasTopicFilter || roundStatus) && (
            <button type="button" className="btn" onClick={clearFilters}>
              清除筛选
            </button>
          )}
          <button type="button" className="btn" onClick={load}>
            刷新
          </button>
          {questions.length > 1 && (
            <>
              <button type="button" className="btn" onClick={goPrev}>
                上一题
              </button>
              <button type="button" className="btn" onClick={goNext}>
                下一题
              </button>
              <span className="muted" style={{ alignSelf: 'center' }}>
                {currentIdx + 1} / {questions.length}
              </span>
            </>
          )}
          <button type="button" className="btn" onClick={() => exportMd(false)}>
            导出 MD
          </button>
          <button type="button" className="btn" onClick={() => exportMd(true)}>
            导出 ZIP
          </button>
        </div>

        {current ? (
          <QuestionCard
            q={current}
            tagGroups={tagTree}
            practiceRound={practiceRound}
            onSubmitted={onSubmitted}
          />
        ) : (
          <div className="card practice-empty">
            <p>
              <strong>当前没有可练习的题目</strong>
            </p>
            <ul style={{ margin: '0.5rem 0', paddingLeft: '1.25rem', color: 'var(--muted)' }}>
              <li>先选 PDF 来源，或去「PDF 导入」入库</li>
              {(pdfFilter || hasTopicFilter || roundStatus) && (
                <li>筛选过严时可点「清除筛选」</li>
              )}
            </ul>
          </div>
        )}
      </main>
      <ScratchPad questionId={current?.id ?? null} />
    </div>
  )
}
