import React from 'react'
import { createRoot } from 'react-dom/client'
import DOMPurify from 'dompurify'
import { DiagramBlock } from './DiagramBlock.jsx'
import { MAX_DIAGRAMS_PER_POST, normalizeDiagramLanguage, supportsDiagramLanguage } from '../lib/diagramRenderers.js'

function useDocumentTheme() {
  const readTheme = () => document.documentElement.dataset.theme || 'light'
  const [theme, setTheme] = React.useState(readTheme)

  React.useEffect(() => {
    const observer = new MutationObserver(() => setTheme(readTheme()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  return theme
}

export function RenderedPostContent({ html, onHeadingsChange }) {
  const containerRef = React.useRef(null)
  const theme = useDocumentTheme()
  const cleanHTML = React.useMemo(() => DOMPurify.sanitize(html || ''), [html])

  React.useEffect(() => {
    const mountedDiagrams = []
    const usedHeadingIDs = new Set()
    const headings = []
    containerRef.current?.querySelectorAll('h1, h2, h3').forEach((heading) => {
      const text = heading.textContent?.trim() || ''
      if (!text) return
      const id = createHeadingId(text, usedHeadingIDs)
      heading.id = id
      headings.push({ id, text, level: Number(heading.tagName.slice(1)) })
    })
    onHeadingsChange?.(headings)
    let diagramCount = 0
    const blocks = containerRef.current?.querySelectorAll('pre > code[class]') || []

    blocks.forEach((code) => {
      const languageClass = [...code.classList].find((name) => name.startsWith('language-'))
      const language = normalizeDiagramLanguage(languageClass?.slice('language-'.length))
      if (!supportsDiagramLanguage(language)) return
      diagramCount += 1
      if (diagramCount > MAX_DIAGRAMS_PER_POST) return

      const original = code.parentElement
      const mount = document.createElement('div')
      original.replaceWith(mount)
      const root = createRoot(mount)
      root.render(<DiagramBlock language={language} source={code.textContent || ''} theme={theme} />)
      mountedDiagrams.push({ root, mount, original })
    })

    return () => mountedDiagrams.forEach(({ root, mount, original }) => {
      root.unmount()
      if (mount.isConnected) mount.replaceWith(original)
    })
  }, [cleanHTML, theme, onHeadingsChange])

  return <div ref={containerRef} className="rendered" dangerouslySetInnerHTML={{ __html: cleanHTML }} />
}
