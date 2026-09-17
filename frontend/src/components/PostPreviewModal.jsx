import React from 'react'
import { X } from 'lucide-react'
import { RenderedPostContent } from './RenderedPostContent.jsx'
import '../post-preview.css'

export function PostPreviewModal({ preview, tags, onClose, onConfirm, isPublishing }) {
  React.useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !isPublishing) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isPublishing, onClose])

  return (
    <div className="previewBackdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isPublishing) onClose() }}>
      <section className="previewModal" role="dialog" aria-modal="true" aria-labelledby="preview-title">
        <header className="previewHeader">
          <div>
            <p className="eyebrow">Preview</p>
            <h2 id="preview-title">发布预览</h2>
          </div>
          <button className="iconButton" type="button" title="关闭预览" onClick={onClose} disabled={isPublishing}><X size={18} /></button>
        </header>
        <div className="previewScroll">
          <article className="previewArticle">
            <h1>{preview.title || '未命名文章'}</h1>
            {preview.summary && <p className="articleSummary">{preview.summary}</p>}
            {tags.length > 0 && <ul className="postTags" aria-label="文章标签">{tags.map((tag) => <li key={tag.id}>#{tag.name}</li>)}</ul>}
            <RenderedPostContent html={preview.content_html} />
          </article>
        </div>
        <footer className="previewActions">
          <button type="button" onClick={onClose} disabled={isPublishing}>返回编辑</button>
          <button className="button primary" type="button" onClick={onConfirm} disabled={isPublishing}>
            {isPublishing ? '正在保存...' : '确认保存'}
          </button>
        </footer>
      </section>
    </div>
  )
}
