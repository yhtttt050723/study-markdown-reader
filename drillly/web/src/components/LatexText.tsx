import { BlockMath, InlineMath } from 'react-katex'

/** 简单分段：$$块级$$ 与 $行内$ */
export function LatexText({ text }: { text: string }) {
  if (!text) return null
  const parts: { kind: 'text' | 'block' | 'inline'; value: string }[] = []
  let rest = text
  while (rest.length) {
    const block = rest.indexOf('$$')
    if (block === -1) {
      splitInline(rest, parts)
      break
    }
    if (block > 0) splitInline(rest.slice(0, block), parts)
    const end = rest.indexOf('$$', block + 2)
    if (end === -1) {
      parts.push({ kind: 'text', value: rest })
      break
    }
    parts.push({ kind: 'block', value: rest.slice(block + 2, end) })
    rest = rest.slice(end + 2)
  }
  return (
    <span>
      {parts.map((p, i) => {
        if (p.kind === 'block') {
          try {
            return <BlockMath key={i} math={p.value} errorColor="#dc2626" />
          } catch {
            return <code key={i}>{`$$${p.value}$$`}</code>
          }
        }
        if (p.kind === 'inline') {
          try {
            return <InlineMath key={i} math={p.value} errorColor="#dc2626" />
          } catch {
            return <code key={i}>{`$${p.value}$`}</code>
          }
        }
        return <span key={i}>{p.value}</span>
      })}
    </span>
  )
}

function splitInline(
  chunk: string,
  parts: { kind: 'text' | 'block' | 'inline'; value: string }[],
) {
  let rest = chunk
  while (rest.length) {
    const i = rest.indexOf('$')
    if (i === -1) {
      parts.push({ kind: 'text', value: rest })
      return
    }
    if (i > 0) parts.push({ kind: 'text', value: rest.slice(0, i) })
    const j = rest.indexOf('$', i + 1)
    if (j === -1) {
      parts.push({ kind: 'text', value: rest })
      return
    }
    parts.push({ kind: 'inline', value: rest.slice(i + 1, j) })
    rest = rest.slice(j + 1)
  }
}
