import React from 'react'
import DOMPurify from 'dompurify'
import { Check, Clipboard, Code2 } from 'lucide-react'
import { renderDiagram } from '../lib/diagramRenderers.js'
import '../diagrams.css'

let diagramSequence = 0

export function DiagramBlock({ language, source, theme = 'light' }) {
  const [svg, setSVG] = React.useState('')
  const [error, setError] = React.useState('')
  const [showSource, setShowSource] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const id = React.useMemo(() => `diagram-${++diagramSequence}`, [])

  React.useEffect(() => {
    let cancelled = false
    setSVG('')
    setError('')

    renderDiagram({ language, source, id, theme })
      .then((result) => {
        if (cancelled) return
        setSVG(DOMPurify.sanitize(result, {
          USE_PROFILES: { svg: true, svgFilters: true },
        }))
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '图表渲染失败')
      })

    return () => { cancelled = true }
  }, [id, language, source, theme])

  async function copySource() {
    try {
      await navigator.clipboard.writeText(source)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <figure className="diagramBlock">
      <div className="diagramToolbar">
        <span>{language}</span>
        <div>
          <button type="button" onClick={() => setShowSource((value) => !value)}>
            <Code2 size={15} />{showSource ? '隐藏源码' : '查看源码'}
          </button>
          <button type="button" onClick={copySource}>
            {copied ? <Check size={15} /> : <Clipboard size={15} />}
            {copied ? '已复制' : '复制源码'}
          </button>
        </div>
      </div>
      <div className="diagramCanvas" aria-busy={!svg && !error}>
        {!svg && !error && <p className="muted">正在渲染图表...</p>}
        {svg && <div dangerouslySetInnerHTML={{ __html: svg }} />}
        {error && <p className="diagramError">图表渲染失败：{error}</p>}
      </div>
      {(showSource || error) && <pre className="diagramSource"><code>{source}</code></pre>}
    </figure>
  )
}
