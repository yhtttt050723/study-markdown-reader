import { LazyCodeEditor } from './LazyCodeEditor'
import { useEffect, useState } from 'react'
import { api, type Question, type Submission, type TagTreeGroup } from '../api'
import { LatexText } from './LatexText'
import { questionImages } from '../utils/questionContent'
import { clipboardImageFile, imageFilesFromClipboard } from '../utils/clipboardImages'
import { questionSource, questionChapter } from '../utils/questionSource'
import { isPdfSourceTag, topicTagsFromQuestion } from '../utils/topicTags'

type Props = {
  q: Question
  tagGroups: TagTreeGroup[]
  practiceRound: 1 | 2
  onSubmitted: () => void
  onEdit?: () => void
  onDelete?: () => void
  /** 为 false 时（搜索/编辑弹窗打开）不拦截粘贴 */
  imagePasteEnabled?: boolean
}

function currentTopicGroup(q: Question): string {
  const meta = (q.content?.metadata || {}) as { tag_group?: string }
  if (meta.tag_group) return String(meta.tag_group)
  const g = topicTagsFromQuestion(q).find((t) => !t.name.includes('/'))
  return g?.name ?? ''
}

export function QuestionCard({
  q,
  tagGroups,
  practiceRound,
  onSubmitted,
  onEdit,
  onDelete,
  imagePasteEnabled = true,
}: Props) {
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
  const [subjectiveText, setSubjectiveText] = useState('')
  const [busy, setBusy] = useState(false)
  const [chapterDraft, setChapterDraft] = useState('')
  const [chapterBusy, setChapterBusy] = useState(false)
  const [chapterHint, setChapterHint] = useState('')
  const [imagePasteHint, setImagePasteHint] = useState('')
  const [imagePasteBusy, setImagePasteBusy] = useState(false)
  const startRef = useState(() => Date.now())[0]

  const loadSubs = () => {
    api.submissions(q.id).then(setSubs).catch(() => setSubs([]))
  }

  useEffect(() => {
    loadSubs()
    setSelected([])
    setSubjectiveText('')
    setShowExp(false)
    setChapterDraft(questionChapter(q))
    setChapterHint('')
    setImagePasteHint('')
  }, [q.id])

  useEffect(() => {
    if (!imagePasteEnabled) return
    const onPaste = async (e: ClipboardEvent) => {
      const t = e.target
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        (t instanceof HTMLElement && t.isContentEditable)
      ) {
        return
      }
      const raw = imageFilesFromClipboard(e)
      if (!raw.length) return
      e.preventDefault()
      setImagePasteBusy(true)
      setImagePasteHint('')
      try {
        for (let i = 0; i < raw.length; i++) {
          await api.uploadQuestionImage(q.id, clipboardImageFile(raw[i], i))
        }
        setImagePasteHint(`已粘贴 ${raw.length} 张附图`)
        onSubmitted()
      } catch (err) {
        setImagePasteHint(err instanceof Error ? err.message : '粘贴上传失败')
      } finally {
        setImagePasteBusy(false)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [q.id, imagePasteEnabled, onSubmitted])

  const src = questionSource(q)
  const badge =
    q.type === 'single_choice'
      ? 'badge-single'
      : q.type === 'multiple_choice'
        ? 'badge-multi'
        : q.type === 'subjective'
          ? 'badge-subjective'
          : 'badge-code'

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
      } else if (q.type === 'subjective') {
        answer = { value: subjectiveText }
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

  const saveChapter = async () => {
    const trimmed = chapterDraft.trim()
    if (trimmed === questionChapter(q)) return
    setChapterBusy(true)
    setChapterHint('')
    try {
      const prevMeta = (q.content?.metadata || {}) as Record<string, unknown>
      const metadata = { ...prevMeta }
      if (trimmed) metadata.chapter = trimmed
      else delete metadata.chapter
      await api.patchQuestion(q.id, {
        content: { ...q.content, metadata },
      })
      setChapterDraft(trimmed)
      setChapterHint('已保存')
      onSubmitted()
    } catch (e) {
      setChapterHint(e instanceof Error ? e.message : '保存失败')
    } finally {
      setChapterBusy(false)
    }
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
    <article className="card question-card">
      <header className="question-card-header">
        <span className={`badge ${badge}`}>
          {q.type === 'single_choice'
            ? '单选'
            : q.type === 'multiple_choice'
              ? '多选'
              : q.type === 'subjective'
                ? '大题/主观'
                : '代码'}
        </span>
        <strong className="question-card-title">{String(c.title || `题目 #${q.id}`)}</strong>
        <span className="question-admin-actions">
          {onEdit && (
            <button type="button" className="btn btn-sm" onClick={onEdit}>
              编辑
            </button>
          )}
          {onDelete && (
            <button type="button" className="btn btn-sm btn-danger" onClick={onDelete}>
              删除
            </button>
          )}
        </span>
        <div className="question-card-tools">
          <select
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
            <span className="round-badges">
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
              <span key={t.id} className="badge badge-tag">
                {t.name.split('/').slice(1).join('/')}
              </span>
            ))}
        </div>
      </header>
      <div className="question-meta-row">
        <label className="question-chapter-label" title="写入题目 metadata.chapter，错题导出与左侧列表会显示">
          <span className="question-chapter-label-text">章节编号</span>
          <input
            className="question-chapter-input"
            type="text"
            value={chapterDraft}
            onChange={(e) => {
              setChapterDraft(e.target.value)
              setChapterHint('')
            }}
            onBlur={() => {
              saveChapter().catch(() => {})
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            placeholder="如 6.1.6、§7.2、第七章"
            disabled={chapterBusy}
            maxLength={64}
          />
        </label>
        {chapterHint ? (
          <span
            className={
              chapterHint === '已保存' ? 'question-chapter-hint question-chapter-hint--ok' : 'question-chapter-hint'
            }
          >
            {chapterHint}
          </span>
        ) : null}
      </div>
      {(src.pdf || src.path) && (
        <p className="question-source" title={src.path || src.pdf}>
          出处：{src.pdf || '（未知 PDF）'}
          {src.path ? ` · ${src.path}` : ''}
        </p>
      )}

      {questionImages(q).length > 0 && (
        <div className="question-images">
          {questionImages(q).map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer">
              <img src={url} alt="题目附图" />
            </a>
          ))}
        </div>
      )}
      <p className="question-image-paste-hint muted">
        {imagePasteBusy
          ? '正在上传粘贴的截图…'
          : imagePasteHint || '题目附图：在此页 Ctrl+V 粘贴截图，或点「编辑」上传'}
      </p>

      <div className="stem">
        <LatexText text={String(c.stem || '')} />
      </div>

      {q.type === 'subjective' && (
        <textarea
          className="subjective-input"
          rows={6}
          style={{ width: '100%', marginTop: 8 }}
          placeholder="在此作答（主观题不自动判分，可对照解析后标记一刷/二刷完成）"
          value={subjectiveText}
          onChange={(e) => setSubjectiveText(e.target.value)}
        />
      )}

      {q.type !== 'coding' && q.type !== 'subjective' && (
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
