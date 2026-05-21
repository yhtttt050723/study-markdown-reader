import { lazy, Suspense, useState } from 'react'

const Monaco = lazy(() => import('@monaco-editor/react'))

type Props = {
  language: string
  value: string
  onChange: (v: string) => void
  height?: string
}

export function LazyCodeEditor({ language, value, onChange, height = '220px' }: Props) {
  const [armed, setArmed] = useState(false)

  if (!armed) {
    return (
      <div className="lazy-editor-fallback" style={{ position: 'relative' }}>
        <textarea
          className="code-fallback"
          style={{ height, width: '100%' }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />
        <button
          type="button"
          className="btn btn-primary"
          style={{ position: 'absolute', right: 8, bottom: 8, fontSize: '0.8rem' }}
          onClick={() => setArmed(true)}
        >
          加载完整编辑器
        </button>
      </div>
    )
  }

  return (
    <Suspense
      fallback={
        <textarea
          className="code-fallback"
          style={{ height, width: '100%' }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      }
    >
      <Monaco
        height={height}
        language={language === 'cpp' ? 'cpp' : language}
        value={value}
        onChange={(v) => onChange(v ?? '')}
        theme="vs-dark"
        loading={
          <div style={{ height, background: '#1e1e1e', color: '#aaa', padding: 8 }}>
            编辑器加载中…
          </div>
        }
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          scrollBeyondLastLine: false,
          automaticLayout: true,
        }}
      />
    </Suspense>
  )
}
