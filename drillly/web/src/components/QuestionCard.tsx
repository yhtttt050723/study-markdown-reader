import { LazyCodeEditor } from './LazyCodeEditor'
import { useEffect, useState } from 'react'
import { api, type Question, type Submission, type TagTreeGroup } from '../api'
import { LatexText } from './LatexText'
import { questionSource } from '../utils/questionSource'
import { isPdfSourceTag, topicTagsFromQuestion } from '../utils/topicTags'

type Props = {
  q: Question
  tagGroups: TagTreeGroup[]
  practiceRound: 1 | 2
  onSubmitted: () => void
}

function currentTopicGroup(q: Question): string {
  const meta = (q.content?.metadata || {}) as { tag_group?: string }
  if (meta.tag_group) return String(meta.tag_group)
  const g = topicTagsFromQuestion(q).find((t) => !t.name.includes('/'))
  return g?.name ?? ''
}

export function QuestionCard({ q, tagGroups, practiceRound, onSubmitted }: Props) {
  const c = q.content
  const [selected, setSelected] = useState<string[]>([])
  const [code, setCode] = useState((c.language as string) || 'python')
  const [editorCode, setEditorCode] = useState(
    (c.starterCode as string) || (c.language === 'python' ? 'a, b = map(int, input().split())\nprint(a + b)' : ''),
  )
  const [showExp, setShowExp] = useState(false)
  const [subs, setSubs] = useState<Submission[]>([])
  const [expanded, setExpanded] = useState<number | null>(null)
  const [runOut, setRunOut] = useState('')
  const [busy, setBusy] = useState(false)
  const startRef = useState(() => Date.now())[0]

  const loadSubs = () => {
    api.submissions(q.id).then(setSubs).catch(() => setSubs([]))
  }

  useEffect(() => {
    loadSubs()
    setSelected([])
    setShowExp(false)
  }, [q.id])

  const src = questionSource(q)
  const badge =
    q.type === 'single_choice' ? 'badge-single' : q.type === 'multiple_choice' ? 'badge-multi' : 'badge-code'

  const toggle = (key: string) => {
    if (q.type === 'single_choice') setSelected([key])
    else {
      setSelected((prev) =>
        prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
      )
    }
  }

  const submit = async () => {
    setBusy(true)
    try {
      let answer: Record<string, unknown>
      if (q.type === 'coding') {
        answer = { value: editorCode, code: editorCode, language: code }
      } else if (q.type === 'single_choice') {
        answer = { value: selected[0] }
      } else {
        answer = { value: selected }
      }
      await api.submit({
        question_id: q.id,
        answer,
        language: q.type === 'coding' ? code : undefined,
        duration_ms: Date.now() - startRef,
        practice_round: practiceRound,
      })
      setShowExp(true)
      loadSubs()
      onSubmitted()
    } catch (e) {
      alert(e instanceof Error ? e.message : '提交失败')
    } finally {
      setBusy(false)
    }
  }

  const setGroupTag = async (groupName: string) => {
    const pdfIds = q.tags.filter((t) => isPdfSourceTag(t.name)).map((t) => t.id)
    const childTags = topicTagsFromQuestion(q).filter((t) => t.name.includes('/'))
    let tagIds = childTags
      .filter((t) => !groupName || t.name.startsWith(`${groupName}/`))
      .map((t) => t.id)

    if (groupName) {
      let groupId = tagGroups.find((g) => g.name === groupName)?.id
      if (!groupId) {
        const created = await api.createTag({ name: groupName })
        groupId = created.id
      }
      tagIds = [groupId, ...tagIds]
    }

    await api.patchQuestion(q.id, { tag_ids: [...pdfIds, ...tagIds] })
    onSubmitted()
  }

  const markRound = async (round: 1 | 2, done: boolean) => {
    setBusy(true)
    try {
      await api.setPracticeProgress(q.id, round, done)
      onSubmitted()
    } catch (e) {
      alert(e instanceof Error ? e.message : '更新进度失败')
    } finally {
      setBusy(false)
    }
  }

  const runCode = async () => {
    setBusy(true)
    try {
      const r = await api.runCode({ language: code, code: editorCode })
      setRunOut(
        [r.stdout && `stdout:\n${r.stdout}`, r.stderr && `stderr:\n${r.stderr}`, `exit: ${r.exit_code}`]
          .filter(Boolean)
          .join('\n'),
      )
    } catch (e) {
      setRunOut(e instanceof Error ? e.message : '运行失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="card">
      <header style={{ marginBottom: '0.75rem' }}>
        <span className={`badge ${badge}`}>
          {q.type === 'single_choice' ? '单选' : q.type === 'multiple_choice' ? '多选' : '代码'}
        </span>
        <strong>{String(c.title || `题目 #${q.id}`)}</strong>
        <select
          style={{ marginLeft: 8 }}
          value={currentTopicGroup(q)}
          onChange={(e) => {
            setGroupTag(e.target.value).catch((err) =>
              alert(err instanceof Error ? err.message : '更新主题大标签失败'),
            )
          }}
          title="主题大标签（与 PDF 来源分开）"
        >
          <option value="">无主题大标签</option>
          {(() => {
            const cur = currentTopicGroup(q)
            const extra = cur && !tagGroups.some((g) => g.name === cur) ? [cur] : []
            return [...extra, ...tagGroups.map((g) => g.name)].map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))
          })()}
        </select>
        {q.practice && (
          <span className="round-badges" style={{ marginLeft: 8 }}>
            <span className={q.practice.round1 ? 'badge round-done' : 'badge round-pending'}>
              一刷{q.practice.round1 ? '✓' : '○'}
            </span>
            <span className={q.practice.round2 ? 'badge round-done' : 'badge round-pending'}>
              二刷{q.practice.round2 ? '✓' : '○'}
            </span>
          </span>
        )}
        {topicTagsFromQuestion(q)
          .filter((t) => t.name.includes('/'))
          .map((t) => (
            <span key={t.id} className="badge" style={{ background: '#f1f5f9' }}>
              {t.name.split('/').slice(1).join('/')}
            </span>
          ))}
      </header>
      {(src.pdf || src.path) && (
        <p className="question-source" title={src.path || src.pdf}>
          出处：{src.pdf || '（未知 PDF）'}
          {src.path ? ` · ${src.path}` : ''}
        </p>
      )}

      <div className="stem">
        <LatexText text={String(c.stem || '')} />
      </div>

      {q.type !== 'coding' && (
        <div className="options">
          {(c.options as { key: string; content: string }[] | undefined)?.map((o) => (
            <label key={o.key}>
              <input
                type={q.type === 'single_choice' ? 'radio' : 'checkbox'}
                name={`q-${q.id}`}
                checked={selected.includes(o.key)}
                onChange={() => toggle(o.key)}
              />{' '}
              <strong>{o.key}.</strong> <LatexText text={o.content} />
            </label>
          ))}
        </div>
      )}

      {q.type === 'coding' && (
        <>
          <select value={code} onChange={(e) => setCode(e.target.value)} style={{ marginBottom: 8 }}>
            <option value="python">Python</option>
            <option value="java">Java</option>
            <option value="c">C</option>
            <option value="cpp">C++</option>
          </select>
          <LazyCodeEditor
            language={code === 'cpp' ? 'cpp' : code}
            value={editorCode}
            onChange={setEditorCode}
          />
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <button type="button" className="btn" onClick={runCode} disabled={busy}>
              运行
            </button>
          </div>
          {runOut && <pre className="runner-out">{runOut}</pre>}
        </>
      )}

      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
          提交（记入{practiceRound === 1 ? '一刷' : '二刷'}）
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => markRound(1, !q.practice?.round1)}
        >
          {q.practice?.round1 ? '取消一刷' : '标记一刷完成'}
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => markRound(2, !q.practice?.round2)}
        >
          {q.practice?.round2 ? '取消二刷' : '标记二刷完成'}
        </button>
      </div>

      {showExp && Boolean(c.explanation) && (
        <div className="explanation">
          <strong>解析</strong>
          <div>
            <LatexText text={String(c.explanation)} />
          </div>
        </div>
      )}

      <section className="sub-list">
        <strong>提交记录 ({subs.length})</strong>
        {subs.map((s) => (
          <div key={s.id} className="sub-item">
            <button type="button" className="btn" onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
              {new Date(s.created_at).toLocaleString()} · {s.is_correct ? '✓' : '✗'} · {s.score}
            </button>
            {expanded === s.id && q.type === 'coding' && (
              <>
                <pre className="runner-out" style={{ marginTop: 8 }}>
                  {String(s.answer.code || s.answer.value || '')}
                </pre>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setEditorCode(String(s.answer.code || s.answer.value || ''))}
                >
                  恢复此代码
                </button>
              </>
            )}
          </div>
        ))}
      </section>
    </article>
  )
}
