import React from 'react';
import DOMPurify from 'dompurify';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Heading2, Italic, Link as LinkIcon, List, Save } from 'lucide-react';
import { get, post, put } from '../lib/api.js';
import { useNavigate, useParams } from 'react-router-dom';

const emptyDoc = { type: 'doc', content: [{ type: 'paragraph' }] };

export function EditPost() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const [meta, setMeta] = React.useState({ title: '', slug: '', summary: '', status: 'draft', category_id: '', tag_ids: [] });
  const [categories, setCategories] = React.useState([]);
  const [tags, setTags] = React.useState([]);
  const [message, setMessage] = React.useState('');

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
    const body = {
      ...meta,
      category_id: meta.category_id ? Number(meta.category_id) : null,
      tag_ids: meta.tag_ids.map(Number),
      content_json: editor.getJSON(),
      content_html: DOMPurify.sanitize(editor.getHTML()),
    };
    const data = isNew ? await post('/api/posts', body) : await put(`/api/posts/${id}`, body);
    setMessage('已保存');
    navigate(`/post/${data.id}`);
  }

  function toggleTag(tagID) {
    const exists = meta.tag_ids.includes(tagID);
    setMeta({ ...meta, tag_ids: exists ? meta.tag_ids.filter((id) => id !== tagID) : [...meta.tag_ids, tagID] });
  }

  return (
    <section className="editorPage">
      <div className="sectionHeader">
        <h1>{isNew ? '新建文章' : '编辑文章'}</h1>
        <button className="button primary" onClick={save}><Save size={17} />保存</button>
      </div>
      {message && <p className="success">{message}</p>}
      <div className="metaGrid">
        <input placeholder="标题" value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
        <input placeholder="slug" value={meta.slug} onChange={(e) => setMeta({ ...meta, slug: e.target.value })} />
        <select value={meta.status} onChange={(e) => setMeta({ ...meta, status: e.target.value })}>
          <option value="draft">草稿</option>
          <option value="published">发布</option>
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
          <label key={tag.id}>
            <input type="checkbox" checked={meta.tag_ids.includes(tag.id)} onChange={() => toggleTag(tag.id)} />
            {tag.name}
          </label>
        ))}
      </div>
      <div className="toolbar">
        <button title="粗体" onClick={() => editor?.chain().focus().toggleBold().run()}><Bold size={16} /></button>
        <button title="斜体" onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic size={16} /></button>
        <button title="二级标题" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={16} /></button>
        <button title="列表" onClick={() => editor?.chain().focus().toggleBulletList().run()}><List size={16} /></button>
        <button title="链接" onClick={() => {
          const href = window.prompt('URL');
          if (href) editor?.chain().focus().setLink({ href }).run();
        }}><LinkIcon size={16} /></button>
      </div>
      <EditorContent className="editorSurface" editor={editor} />
    </section>
  );
}
