import React from 'react';
import DOMPurify from 'dompurify';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Code2, Heading1, Heading2, Heading3, Italic, Link as LinkIcon, List, ListOrdered, Quote, Redo2, RemoveFormatting, Save, Strikethrough, Undo2 } from 'lucide-react';
import { get, post, put } from '../lib/api.js';
import { useNavigate, useParams } from 'react-router-dom';

const emptyDoc = { type: 'doc', content: [{ type: 'paragraph' }] };

export function EditPost() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const [meta, setMeta] = React.useState({ title: '', slug: '', summary: '', status: 'published', category_id: '', tag_ids: [] });
  const [categories, setCategories] = React.useState([]);
  const [tags, setTags] = React.useState([]);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: '开始写作...' }),
    ],
    content: emptyDoc,
  });

  React.useEffect(() => {
    get('/api/categories').then((data) => setCategories(data.items || []));
    get('/api/tags').then((data) => setTags(data.items || []));
  }, []);

  React.useEffect(() => {
    if (!editor || isNew) return;
    get(`/api/posts/${id}`).then((data) => {
      setMeta({
        title: data.title,
        slug: data.slug,
        summary: data.summary,
        status: data.status,
        category_id: data.category_id || '',
        tag_ids: (data.tags || []).map((tag) => tag.id),
      });
      editor.commands.setContent(data.content_json || data.content_html || emptyDoc);
    });
  }, [editor, id, isNew]);

  async function save() {
    if (!editor) return;
    setError('');
    const body = {
      ...meta,
      category_id: meta.category_id ? Number(meta.category_id) : null,
      tag_ids: meta.tag_ids.map(Number),
      content_json: editor.getJSON(),
      content_html: DOMPurify.sanitize(editor.getHTML()),
    };
    try {
      const data = isNew ? await post('/api/posts', body) : await put(`/api/posts/${id}`, body);
      setMessage('已保存，缓存已刷新');
      navigate(`/post/${data.id}`);
    } catch (err) {
      setError(err.message);
    }
  }

  function toggleTag(tagID) {
    const exists = meta.tag_ids.includes(tagID);
    setMeta({ ...meta, tag_ids: exists ? meta.tag_ids.filter((id) => id !== tagID) : [...meta.tag_ids, tagID] });
  }

  const toolbarGroups = [
    [
      { title: '撤销', icon: Undo2, action: () => editor?.chain().focus().undo().run() },
      { title: '重做', icon: Redo2, action: () => editor?.chain().focus().redo().run() },
    ],
    [
      { title: '粗体', icon: Bold, active: editor?.isActive('bold'), action: () => editor?.chain().focus().toggleBold().run() },
      { title: '斜体', icon: Italic, active: editor?.isActive('italic'), action: () => editor?.chain().focus().toggleItalic().run() },
      { title: '删除线', icon: Strikethrough, active: editor?.isActive('strike'), action: () => editor?.chain().focus().toggleStrike().run() },
      { title: '行内代码', icon: Code2, active: editor?.isActive('code'), action: () => editor?.chain().focus().toggleCode().run() },
    ],
    [
      { title: '一级标题', icon: Heading1, active: editor?.isActive('heading', { level: 1 }), action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run() },
      { title: '二级标题', icon: Heading2, active: editor?.isActive('heading', { level: 2 }), action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run() },
      { title: '三级标题', icon: Heading3, active: editor?.isActive('heading', { level: 3 }), action: () => editor?.chain().focus().toggleHeading({ level: 3 }).run() },
    ],
    [
      { title: '无序列表', icon: List, active: editor?.isActive('bulletList'), action: () => editor?.chain().focus().toggleBulletList().run() },
      { title: '有序列表', icon: ListOrdered, active: editor?.isActive('orderedList'), action: () => editor?.chain().focus().toggleOrderedList().run() },
      { title: '引用', icon: Quote, active: editor?.isActive('blockquote'), action: () => editor?.chain().focus().toggleBlockquote().run() },
    ],
    [
      { title: '链接', icon: LinkIcon, active: editor?.isActive('link'), action: () => {
        const href = window.prompt('URL', editor?.getAttributes('link').href || 'https://');
        if (href === null) return;
        if (href === '') editor?.chain().focus().unsetLink().run();
        else editor?.chain().focus().setLink({ href }).run();
      } },
      { title: '清除格式', icon: RemoveFormatting, action: () => editor?.chain().focus().unsetAllMarks().clearNodes().run() },
    ],
  ];

  return (
    <section className="editorPage">
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Editor</p>
          <h1>{isNew ? '新建文章' : '编辑文章'}</h1>
        </div>
        <button className="button primary" onClick={save}><Save size={17} />保存</button>
      </div>
      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}
      <div className="metaGrid">
        <input placeholder="标题" value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
        <input placeholder="slug" value={meta.slug} onChange={(e) => setMeta({ ...meta, slug: e.target.value })} />
        <select value={meta.status} onChange={(e) => setMeta({ ...meta, status: e.target.value })}>
          <option value="published">发布</option>
          <option value="draft">草稿</option>
          <option value="archived">归档</option>
        </select>
        <select value={meta.category_id} onChange={(e) => setMeta({ ...meta, category_id: e.target.value })}>
          <option value="">无分类</option>
          {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>
      <textarea placeholder="摘要" value={meta.summary} onChange={(e) => setMeta({ ...meta, summary: e.target.value })} />
      <div className="tagPicker">
        {tags.map((tag) => (
          <label key={tag.id} className={meta.tag_ids.includes(tag.id) ? 'checked' : ''}>
            <input type="checkbox" checked={meta.tag_ids.includes(tag.id)} onChange={() => toggleTag(tag.id)} />
            {tag.name}
          </label>
        ))}
      </div>
      <div className="toolbar">
        {toolbarGroups.map((group, index) => (
          <div className="toolbarGroup" key={index}>
            {group.map(({ title, icon: Icon, active, action }) => (
              <button className={active ? 'active' : ''} type="button" title={title} key={title} onClick={action} disabled={!editor}>
                <Icon size={16} />
              </button>
            ))}
          </div>
        ))}
      </div>
      <EditorContent className="editorSurface" editor={editor} />
    </section>
  );
}
