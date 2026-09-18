import React from 'react'
import DOMPurify from 'dompurify'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold,
  Braces,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Plus,
  Quote,
  Redo2,
  RemoveFormatting,
  Save,
  Strikethrough,
  Undo2,
} from 'lucide-react'
import { get, post, put } from '../lib/api.js'
import { useNavigate, useParams } from 'react-router-dom'
import { DiagramBlock } from '../components/DiagramBlock.jsx'
import { insertMermaidBlock, continueWritingAfterCode } from '../lib/editorBlocks.js'
import { PostPreviewModal } from '../components/PostPreviewModal.jsx'
import { RevisionHistory } from '../components/RevisionHistory.jsx'
import { markdownToPost, postToMarkdown } from '../lib/markdown.js'
import { useUnsavedPostChanges } from '../lib/useUnsavedPostChanges.js'
import { deleteDraft, getDraft, saveDraft } from '../lib/draftStorage.js'

const emptyDoc = { type: 'doc', content: [{ type: 'paragraph' }] }

export function EditPost({ user }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === 'new'
  const [meta, setMeta] = React.useState({
    title: '',
    slug: '',
    summary: '',
    status: 'published',
    category_id: '',
    series_id: '',
    series_position: 0,
    tag_ids: [],
  })
  const [categories, setCategories] = React.useState([])
  const [tags, setTags] = React.useState([])
  const [series, setSeries] = React.useState([])
  const [message, setMessage] = React.useState('')
  const [error, setError] = React.useState('')
  const [preview, setPreview] = React.useState(null)
  const [isPublishing, setIsPublishing] = React.useState(false)
  const [revisions, setRevisions] = React.useState(null)
  const [isRestoring, setIsRestoring] = React.useState(false)
  const [postReady, setPostReady] = React.useState(isNew)
  const [draftChecked, setDraftChecked] = React.useState(false)
  const importInputRef = React.useRef(null)
  const [editorRevision, setEditorRevision] = React.useState(0)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: {
          defaultLanguage: 'text',
          enableTabIndentation: true,
          tabSize: 2,
        },
      }),
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: '开始写作...' }),
    ],
    content: emptyDoc,
    onUpdate: () => setEditorRevision((value) => value + 1),
    onSelectionUpdate: () => setEditorRevision((value) => value + 1),
  })

  const { isDirty, markBaseline, finishSave } = useUnsavedPostChanges(meta, editor?.getJSON() || emptyDoc)

  React.useEffect(() => {
    get('/api/categories').then((data) => setCategories(data.items || []))
    get('/api/tags').then((data) => setTags(data.items || []))
    get("/api/series").then((data) => setSeries(data.items || []))
  }, [])

  React.useEffect(() => {
    if (!editor || isNew) return
    let cancelled = false
    get(`/api/posts/${id}`).then((data) => {
      if (cancelled) return
      const loadedMeta = {
        title: data.title,
        slug: data.slug,
        summary: data.summary,
        status: data.status,
        category_id: data.category_id || '',
        series_id: data.series_id || '',
        series_position: data.series_position || 0,
        tag_ids: (data.tags || []).map((tag) => tag.id),
      }
      setMeta(loadedMeta)
      editor.commands.setContent(data.content_json || data.content_html || emptyDoc)
      markBaseline(loadedMeta, editor.getJSON())
      setPostReady(true)
    }).catch((err) => { if (!cancelled) { setError(err.message); setPostReady(true) } })
    return () => { cancelled = true }
  }, [editor, id, isNew])

  React.useEffect(() => {
    if (!editor || !user?.id || !postReady || draftChecked) return
    let cancelled = false
    getDraft(user.id, id).then(async (draft) => {
      if (cancelled || !draft?.payload?.meta || !draft.payload.content_json) return
      if (window.confirm("\u53d1\u73b0\u672c\u5730\u8349\u7a3f\uff0c\u662f\u5426\u6062\u590d\u7ee7\u7eed\u7f16\u8f91\uff1f")) {
        setMeta(draft.payload.meta)
        editor.commands.setContent(draft.payload.content_json)
        setMessage("\u5df2\u6062\u590d\u672c\u5730\u8349\u7a3f")
      } else {
        await deleteDraft(user.id, id).catch(() => undefined)
      }
    }).catch(() => undefined).finally(() => { if (!cancelled) setDraftChecked(true) })
    return () => { cancelled = true }
  }, [editor, user?.id, id, postReady, draftChecked])

  React.useEffect(() => {
    if (!editor || !user?.id || !draftChecked) return
    const timer = window.setInterval(() => {
      if (!isDirty) return
      saveDraft(user.id, id, { meta, content_json: editor.getJSON() }).catch(() => undefined)
    }, 10000)
    return () => window.clearInterval(timer)
  }, [editor, user?.id, id, draftChecked, isDirty, meta, editorRevision])

  function buildPostBody() {
    if (!editor) return null
    return {
      ...meta,
      category_id: meta.category_id ? Number(meta.category_id) : null,
      series_id: meta.series_id ? Number(meta.series_id) : null,
      series_position: Number(meta.series_position) || 0,
      tag_ids: meta.tag_ids.map(Number),
      content_json: editor.getJSON(),
      content_html: DOMPurify.sanitize(editor.getHTML()),
    }
  }

  function openPreview() {
    const body = buildPostBody()
    if (!body) return
    setError('')
    setPreview(body)
  }

  async function save() {
    if (!preview) return
    setError('')
    setIsPublishing(true)
    try {
      const data = isNew
        ? await post('/api/posts', preview)
        : await put(`/api/posts/${id}`, preview)
      setMessage("\u5df2\u4fdd\u5b58\uff0c\u7f13\u5b58\u5df2\u5237\u65b0")
      setPreview(null)
      if (user?.id) await deleteDraft(user.id, id).catch(() => undefined)
      if (finishSave(meta, preview.content_json)) navigate(`/post/${data.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsPublishing(false)
    }
  }

  function toggleTag(tagID) {
    const exists = meta.tag_ids.includes(tagID)
    setMeta({
      ...meta,
      tag_ids: exists
        ? meta.tag_ids.filter((id) => id !== tagID)
        : [...meta.tag_ids, tagID],
    })
  }

  async function addCategory() {
    const name = window.prompt('分类名称')
    if (!name) return
    const slug = window.prompt(
      '分类 Slug (英文字母/数字)',
      name.toLowerCase().replace(/\s+/g, '-'),
    )
    if (!slug) return
    try {
      const item = await post('/api/categories', { name, slug })
      setCategories([...categories, item])
      setMeta({ ...meta, category_id: String(item.id) })
    } catch (err) {
      setError(err.message)
    }
  }

  async function addTag() {
    const name = window.prompt('标签名称')
    if (!name) return
    const slug = window.prompt(
      '标签 Slug (英文字母/数字)',
      name.toLowerCase().replace(/\s+/g, '-'),
    )
    if (!slug) return
    try {
      const item = await post('/api/tags', { name, slug })
      setTags([...tags, item])
      setMeta({ ...meta, tag_ids: [...meta.tag_ids, item.id] })
    } catch (err) {
      setError(err.message)
    }
  }

  async function addSeries() {
    const title = window.prompt("\u7cfb\u5217\u540d\u79f0")
    if (!title) return
    const slug = window.prompt("\u7cfb\u5217 Slug", title.toLowerCase().split(" ").join("-"))
    if (!slug) return
    try {
      const item = await post("/api/series", { title, slug, description: "" })
      setSeries([...series, item])
      setMeta({ ...meta, series_id: String(item.id), series_position: 0 })
    } catch (err) {
      setError(err.message)
    }
  }

  async function loadRevisions() {
    if (isNew) return
    try {
      const data = await get("/api/posts/" + id + "/revisions")
      setRevisions(data.items || [])
    } catch (err) {
      setError(err.message)
    }
  }

  async function restoreRevision(revision) {
    if (!editor || !window.confirm("\u6062\u590d\u540e\u4f1a\u521b\u5efa\u4e00\u4e2a\u65b0\u7248\u672c\uff0c\u4e0d\u4f1a\u8986\u76d6\u539f\u7248\u672c\u3002\u786e\u5b9a\u7ee7\u7eed\u5417\uff1f")) return
    setError("")
    setIsRestoring(true)
    try {
      const data = await post("/api/posts/" + id + "/revisions/" + revision.id + "/restore", {})
      const restoredMeta = {
        title: data.title, slug: data.slug, summary: data.summary, status: data.status,
        category_id: data.category_id || "", series_id: data.series_id || "",
        series_position: data.series_position || 0, tag_ids: (data.tags || []).map((tag) => tag.id),
      }
      setMeta(restoredMeta)
      editor.commands.setContent(data.content_json || emptyDoc)
      markBaseline(restoredMeta, editor.getJSON())
      setMessage("\u5df2\u521b\u5efa\u6062\u590d\u7248\u672c")
      await loadRevisions()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsRestoring(false)
    }
  }

  function downloadMarkdown(markdown, filename) {
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  function currentExportPost() {
    const body = buildPostBody()
    if (!body) return null
    return { ...body, tags: tags.filter((tag) => body.tag_ids.includes(tag.id)), series: series.find((item) => item.id === body.series_id) }
  }

  async function exportMarkdown(includeSeries) {
    const current = currentExportPost()
    if (!current) return
    try {
      if (isNew || !includeSeries) {
        downloadMarkdown(postToMarkdown(current), (current.slug || "article") + ".md")
        return
      }
      const data = await get("/api/posts/" + id + "/export?include_series=true")
      const markdown = (data.items || []).map(postToMarkdown).join("\n<!-- next article -->\n\n")
      downloadMarkdown(markdown, (current.series?.slug || current.slug || "series") + ".md")
    } catch (err) {
      setError(err.message)
    }
  }

  async function importMarkdown(event) {
    const file = event.target.files?.[0]
    if (!file || !editor) return
    try {
      const parsed = markdownToPost(await file.text())
      const importedTags = String(parsed.frontmatter.tags || "").split(",").map((name) => name.trim()).filter(Boolean)
      const importedSeries = series.find((item) => item.slug === parsed.frontmatter.series)
      setMeta({
        ...meta,
        title: parsed.frontmatter.title || meta.title, slug: parsed.frontmatter.slug || meta.slug,
        summary: parsed.frontmatter.summary || "", status: parsed.frontmatter.status || meta.status,
        tag_ids: tags.filter((tag) => importedTags.includes(tag.name)).map((tag) => tag.id),
        series_id: importedSeries ? String(importedSeries.id) : "",
        series_position: Number(parsed.frontmatter.series_position) || 0,
      })
      editor.commands.setContent(parsed.content)
      setMessage("\u5df2\u5bfc\u5165 Markdown\uff0c\u8bf7\u786e\u8ba4\u540e\u4fdd\u5b58")
    } catch (err) {
      setError(err.message || "Markdown \u5bfc\u5165\u5931\u8d25")
    } finally {
      event.target.value = ""
    }
  }

  const toolbarGroups = [
    [
      {
        title: '撤销',
        icon: Undo2,
        action: () => editor?.chain().focus().undo().run(),
      },
      {
        title: '重做',
        icon: Redo2,
        action: () => editor?.chain().focus().redo().run(),
      },
    ],
    [
      {
        title: '粗体',
        icon: Bold,
        active: editor?.isActive('bold'),
        action: () => editor?.chain().focus().toggleBold().run(),
      },
      {
        title: '斜体',
        icon: Italic,
        active: editor?.isActive('italic'),
        action: () => editor?.chain().focus().toggleItalic().run(),
      },
      {
        title: '删除线',
        icon: Strikethrough,
        active: editor?.isActive('strike'),
        action: () => editor?.chain().focus().toggleStrike().run(),
      },
      {
        title: '行内代码',
        icon: Code2,
        active: editor?.isActive('code'),
        action: () => editor?.chain().focus().toggleCode().run(),
      },
    ],
    [
      {
        title: '\u4ee3\u7801\u5757',
        icon: Braces,
        active: editor?.isActive('codeBlock'),
        action: () => editor?.chain().focus().toggleCodeBlock({ language: 'text' }).run(),
      },
      {
        title: '\u4e00\u7ea7\u6807\u9898',
        icon: Heading1,
        active: editor?.isActive('heading', { level: 1 }),
        action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(),
      },
      {
        title: '二级标题',
        icon: Heading2,
        active: editor?.isActive('heading', { level: 2 }),
        action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        title: '三级标题',
        icon: Heading3,
        active: editor?.isActive('heading', { level: 3 }),
        action: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(),
      },
    ],
    [
      {
        title: '无序列表',
        icon: List,
        active: editor?.isActive('bulletList'),
        action: () => editor?.chain().focus().toggleBulletList().run(),
      },
      {
        title: '有序列表',
        icon: ListOrdered,
        active: editor?.isActive('orderedList'),
        action: () => editor?.chain().focus().toggleOrderedList().run(),
      },
      {
        title: '引用',
        icon: Quote,
        active: editor?.isActive('blockquote'),
        action: () => editor?.chain().focus().toggleBlockquote().run(),
      },
    ],
    [
      {
        title: '链接',
        icon: LinkIcon,
        active: editor?.isActive('link'),
        action: () => {
          const href = window.prompt(
            'URL',
            editor?.getAttributes('link').href || 'https://',
          )
          if (href === null) return
          if (href === '') editor?.chain().focus().unsetLink().run()
          else editor?.chain().focus().setLink({ href }).run()
        },
      },
      {
        title: '清除格式',
        icon: RemoveFormatting,
        action: () =>
          editor?.chain().focus().unsetAllMarks().clearNodes().run(),
      },
    ],
  ]

  const activeCodeLanguage = editor?.isActive('codeBlock')
    ? editor.getAttributes('codeBlock').language || 'text'
    : ''
  const activeCodeSource = editor?.isActive('codeBlock')
    ? editor.state.selection.$from.parent.textContent
    : ''

  function setCodeLanguage(language) {
    if (!editor?.isActive('codeBlock')) return
    editor.chain().focus().updateAttributes('codeBlock', { language }).run()
  }

  return (
    <section className="editorPage">
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Editor</p>
          <h1>{isNew ? '新建文章' : '编辑文章'}</h1>
        </div>
        <input ref={importInputRef} type="file" accept=".md,text/markdown,text/plain" hidden onChange={importMarkdown} />
        <div className="actions">
          <button className="button" type="button" onClick={() => importInputRef.current?.click()}>{"\u5bfc\u5165 Markdown"}</button>
          <button className="button" type="button" onClick={() => exportMarkdown(false)}>{"\u5bfc\u51fa Markdown"}</button>
          {meta.series_id && <button className="button" type="button" onClick={() => exportMarkdown(true)}>{"\u5bfc\u51fa\u7cfb\u5217"}</button>}
          {!isNew && <button className="button" type="button" onClick={loadRevisions}>{"\u5386\u53f2\u7248\u672c"}</button>}
          <button className="button primary" type="button" onClick={openPreview}>
            <Save size={17} />
            {"\u4fdd\u5b58"}
          </button>
        </div>
      </div>
      {message && <p className="success">{message}</p>}
      {isDirty && <p className="muted" role="status">{'\u6709\u672a\u4fdd\u5b58\u7684\u66f4\u6539'}</p>}
      {error && <p className="error">{error}</p>}
      <RevisionHistory revisions={revisions} onRestore={restoreRevision} isRestoring={isRestoring} />
      <div className="metaGrid">
        <input
          placeholder="标题"
          value={meta.title}
          onChange={(e) => setMeta({ ...meta, title: e.target.value })}
        />
        <input
          placeholder="slug"
          value={meta.slug}
          onChange={(e) => setMeta({ ...meta, slug: e.target.value })}
        />
        <select
          value={meta.status}
          onChange={(e) => setMeta({ ...meta, status: e.target.value })}
        >
          <option value="published">发布</option>
          <option value="draft">草稿</option>
          <option value="archived">归档</option>
        </select>
        <div className="flexRow">
          <select
            value={meta.category_id}
            onChange={(e) => setMeta({ ...meta, category_id: e.target.value })}
          >
            <option value="">无分类</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <button className="iconButton" onClick={addCategory} title="添加分类">
            <Plus size={16} />
          </button>
        </div>
        <div className="flexRow">
          <select value={meta.series_id} onChange={(e) => setMeta({ ...meta, series_id: e.target.value })}>
            <option value="">{'\u65e0\u7cfb\u5217'}</option>
            {series.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
          <button className="iconButton" type="button" onClick={addSeries} title="\u6dfb\u52a0\u7cfb\u5217"><Plus size={16} /></button>
        </div>
        <input type="number" min="0" placeholder={'\u7cfb\u5217\u6392\u5e8f'} value={meta.series_position} onChange={(e) => setMeta({ ...meta, series_position: e.target.value })} />
      </div>
      <textarea
        placeholder="摘要"
        value={meta.summary}
        onChange={(e) => setMeta({ ...meta, summary: e.target.value })}
      />
      <div className="tagPicker">
        {tags.map((tag) => (
          <label
            key={tag.id}
            className={meta.tag_ids.includes(tag.id) ? 'checked' : ''}
          >
            <input
              type="checkbox"
              checked={meta.tag_ids.includes(tag.id)}
              onChange={() => toggleTag(tag.id)}
            />
            {tag.name}
          </label>
        ))}
        <button className="tagAdd" onClick={addTag} title="添加标签">
          <Plus size={14} /> 新标签
        </button>
      </div>
      <div className="toolbar">
        {toolbarGroups.map((group, index) => (
          <div className="toolbarGroup" key={index}>
            {group.map(({ title, icon: Icon, active, action }) => (
              <button
                className={active ? 'active' : ''}
                type="button"
                title={title}
                key={title}
                onClick={action}
                disabled={!editor}
              >
                <Icon size={16} />
              </button>
            ))}
          </div>
        ))}
        <button className="toolbarTextButton" type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => insertMermaidBlock(editor)} disabled={!editor}>
          <Plus size={16} /> {'\u63d2\u5165\u56fe\u8868'}
        </button>
        {activeCodeLanguage && <button className="toolbarTextButton" type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => continueWritingAfterCode(editor)}>
          {'\u5728\u4ee3\u7801\u5757\u540e\u5199\u6b63\u6587'}
        </button>}
        <label className="codeLanguagePicker">
          {'\u5f53\u524d\u4ee3\u7801\u5757\u8bed\u8a00'}
          <select
            value={activeCodeLanguage || 'text'}
            onChange={(event) => setCodeLanguage(event.target.value)}
            disabled={!activeCodeLanguage}
          >
            <option value="text">{'\u7eaf\u6587\u672c'}</option>
            <option value="mermaid">Mermaid {'\u56fe\u8868'}</option>
          </select>
        </label>
      </div>
      <EditorContent className="editorSurface" editor={editor} />
      {activeCodeLanguage === 'mermaid' && (
        <section className="diagramPreview">
          <p className="eyebrow">Mermaid Preview</p>
          {activeCodeSource.trim()
            ? <DiagramBlock language="mermaid" source={activeCodeSource} theme={document.documentElement.dataset.theme || 'light'} />
            : <p className="muted">{'\u8f93\u5165 Mermaid \u4ee3\u7801\u540e\u5c06\u5728\u8fd9\u91cc\u9884\u89c8\u3002'}</p>}
        </section>
      )}
      {preview && <PostPreviewModal preview={preview} tags={tags.filter((tag) => preview.tag_ids.includes(tag.id))} onClose={() => setPreview(null)} onConfirm={save} isPublishing={isPublishing} />}
    </section>
  )
}

export function EditPostRoute({ user }) {
  const { id } = useParams()
  return <EditPost key={id} user={user} />
}
