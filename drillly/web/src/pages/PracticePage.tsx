import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, type PdfSource, type ProgressSummary, type Question, type TagTreeGroup } from '../api'
import { QuestionCard } from '../components/QuestionCard'
import { QuestionSidebar } from '../components/QuestionSidebar'
import { QuestionEditor } from '../components/QuestionEditor'
import { QuestionSearchPalette } from '../components/QuestionSearchPalette'
import { ScratchPad } from '../components/ScratchPad'
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
  const [searchText, setSearchText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeId, setActiveId] = useState<number | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorQuestion, setEditorQuestion] = useState<Question | null>(null)
  const [err, setErr] = useState('')

  const hasTopicFilter = Boolean(tagGroupFilter || tagChildFilter)
  const hasSearch = Boolean(searchQuery)

  useEffect(() => {
    const t = window.setTimeout(() => setSearchQuery(searchText.trim()), 300)
    return () => window.clearTimeout(t)
  }, [searchText])

  const buildFilterParams = useCallback(() => {
    const p = new URLSearchParams()
    if (pdfFilter) p.set('source_pdf', pdfFilter)
    const tag = tagChildFilter || tagGroupFilter
    if (tag) p.set('tags', tag)
    if (practiceRound) p.set('practice_round', String(practiceRound))
    if (roundStatus) p.set('round_status', roundStatus)
    return p
  }, [pdfFilter, tagGroupFilter, tagChildFilter, practiceRound, roundStatus])

  const buildParams = useCallback(() => {
    const p = buildFilterParams()
    if (searchQuery) p.set('search', searchQuery)
    if (randomOrder) p.set('order', 'random')
    p.set('limit', '200')
    return p
  }, [buildFilterParams, searchQuery, randomOrder])

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
  }, [])

  useEffect(() => {
    load()
    loadSummary()
  }, [load, loadSummary])

  useEffect(() => {
    let lastFocus = 0
    const onFocus = () => {
      const now = Date.now()
      if (now - lastFocus < 30_000) return
      lastFocus = now
      load()
      loadSummary()
      api.listPdfSources().then(setPdfSources).catch(() => {})
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load, loadSummary])

  const clearFilters = () => {
    setPdfFilter('')
    setTagGroupFilter('')
    setTagChildFilter('')
    setRoundStatus('')
    setSearchText('')
    setSearchQuery('')
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
      if ((e.ctrlKey || e.metaKey) && (e.key === 'q' || e.key === 'Q')) {
        e.preventDefault()
        setPaletteOpen(true)
        return
      }
      if (paletteOpen) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goPrev, goNext, paletteOpen])

  const paletteFilterParams = useMemo(() => buildFilterParams(), [buildFilterParams])

  const onPaletteSelect = (q: Question, query: string) => {
    setSearchText(query)
    setSearchQuery(query)
    setActiveId(q.id)
  }

  const openCreate = () => {
    setEditorQuestion(null)
    setEditorOpen(true)
  }

  const openEdit = (q: Question) => {
    setEditorQuestion(q)
    setEditorOpen(true)
  }

  const onEditorSaved = (q: Question) => {
    load()
    loadSummary()
    setActiveId(q.id)
  }

  const deleteCurrent = async () => {
    if (!current) return
    if (!window.confirm(`确定删除题目 #${current.id}？提交记录将一并删除，不可恢复。`)) return
    try {
      await api.deleteQuestion(current.id)
      load()
      loadSummary()
    } catch (e) {
      alert(e instanceof Error ? e.message : '删除失败')
    }
  }

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
      <QuestionSearchPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        filterParams={paletteFilterParams}
        onSelect={onPaletteSelect}
      />
      <QuestionEditor
        open={editorOpen}
        question={editorQuestion}
        onClose={() => setEditorOpen(false)}
        onSaved={onEditorSaved}
      />
      {questions.length > 0 && (
        <aside className="question-sidebar">
          <div className="question-sidebar-head">
            <strong>题目列表</strong>
            <span className="muted">{questions.length} 题</span>
          </div>
          <QuestionSidebar
            questions={questions}
            activeId={current?.id ?? null}
            onSelect={setActiveId}
          />
        </aside>
      )}

      <main className="practice-main">
        {err && (
          <p className="practice-alert">
            无法连接 API：{err} — 请先启动 drillly/api（端口 5213）
          </p>
        )}

        {summary && summary.total > 0 && (
          <div className="kpi-strip">
            <div className="kpi-card">
              <div className="kpi-label">一刷进度</div>
              <div className="kpi-value">
                {summary.round1_done}
                <span> / {summary.total}</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">二刷进度</div>
              <div className="kpi-value">
                {summary.round2_done}
                <span> / {summary.total}</span>
              </div>
            </div>
            {pdfFilter && (
              <div className="kpi-card">
                <div className="kpi-label">当前来源</div>
                <div className="kpi-meta">{pdfFilter}</div>
              </div>
            )}
          </div>
        )}

        <div className="practice-toolbar">
          <div className="toolbar-section">
            <span className="toolbar-label">搜索与筛选</span>
            <input
              type="search"
              className="filter-search"
              placeholder="搜索题干…（Ctrl+Q）"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              aria-label="搜索题目"
            />
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
            {(pdfFilter || hasTopicFilter || roundStatus || hasSearch) && (
              <button type="button" className="btn" onClick={clearFilters}>
                清除筛选
              </button>
            )}
          </div>
          <div className="toolbar-section">
            <span className="toolbar-label">操作</span>
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              新建题目
            </button>
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
                <span className="nav-counter">
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
        </div>

        {current ? (
          <QuestionCard
            q={current}
            tagGroups={tagTree}
            practiceRound={practiceRound}
            onSubmitted={onSubmitted}
            onEdit={() => openEdit(current)}
            onDelete={deleteCurrent}
            imagePasteEnabled={!paletteOpen && !editorOpen}
          />
        ) : (
          <div className="card practice-empty">
            <p>
              <strong>当前没有可练习的题目</strong>
            </p>
            <ul>
              <li>先选 PDF 来源，或去「PDF 导入」入库</li>
              {(pdfFilter || hasTopicFilter || roundStatus || hasSearch) && (
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
