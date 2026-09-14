export const MAX_DIAGRAM_SOURCE_LENGTH = 20_000
export const MAX_DIAGRAMS_PER_POST = 50

const renderers = new Map()
let renderQueue = Promise.resolve()

export function normalizeDiagramLanguage(language = '') {
  return language.trim().toLowerCase()
}

export function validateDiagramSource(source) {
  if (!source.trim()) throw new Error('图表代码不能为空')
  if (source.length > MAX_DIAGRAM_SOURCE_LENGTH) {
    throw new Error(`图表代码不能超过 ${MAX_DIAGRAM_SOURCE_LENGTH} 个字符`)
  }
}

export function registerDiagramRenderer(language, renderer) {
  renderers.set(normalizeDiagramLanguage(language), renderer)
}

export function supportsDiagramLanguage(language) {
  return renderers.has(normalizeDiagramLanguage(language))
}

export function renderDiagram({ language, source, id, theme }) {
  const normalizedLanguage = normalizeDiagramLanguage(language)
  const renderer = renderers.get(normalizedLanguage)
  if (!renderer) throw new Error(`暂不支持 ${normalizedLanguage || '未知'} 图表`)
  validateDiagramSource(source)

  // Mermaid configuration is global. Serializing calls prevents diagrams with
  // different themes from racing against one another during rendering.
  const job = () => renderer({ source, id, theme })
  const result = renderQueue.then(job, job)
  renderQueue = result.then(() => undefined, () => undefined)
  return result
}

registerDiagramRenderer('mermaid', async ({ source, id, theme }) => {
  const { default: mermaid } = await import('mermaid')
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: theme === 'dark' ? 'dark' : 'default',
    suppressErrorRendering: true,
    flowchart: { htmlLabels: false },
  })
  const { svg } = await mermaid.render(id, source)
  return svg
})
