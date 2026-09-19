import React from 'react'
import { BookOpen, ExternalLink, Link2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { del, get, post, put } from '../lib/api.js'
import '../daily-learning.css'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function localDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateKey(value) {
  return localDateKey(new Date(value))
}

function formatDate(date) {
  return `${date.getMonth() + 1}月${date.getDate()}日 星期${WEEKDAYS[date.getDay()]}`
}

function levelFor(count) {
  if (count === 0) return 0
  if (count <= 2) return 1
  if (count <= 4) return 2
  if (count <= 6) return 3
  if (count <= 9) return 4
  return 5
}

function emptyForm() {
  return { content: '', urls: [''] }
}

export function DailyLearning() {
  const [records, setRecords] = React.useState([])
  const [form, setForm] = React.useState(emptyForm)
  const [selected, setSelected] = React.useState(null)
  const [editing, setEditing] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')
  const today = localDateKey(new Date())

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const data = await get('/api/daily-learning-records?days=30')
      setRecords(data.items || [])
    } catch (err) {
      setError(err.message || '学习记录加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { load() }, [load])

  const byDate = React.useMemo(() => records.reduce((map, record) => {
    const key = dateKey(record.study_date)
    map[key] = [...(map[key] || []), record]
    return map
  }, {}), [records])

  const days = React.useMemo(() => {
    const result = []
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    for (let offset = 29; offset >= 0; offset -= 1) {
      const item = new Date(date)
      item.setDate(date.getDate() - offset)
      result.push(item)
    }
    return result
  }, [])

  async function submit(event) {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      const body = { content: form.content, urls: form.urls }
      if (selected?.editingRecord && editing) {
        await put(`/api/daily-learning-records/${selected.editingRecord.id}`, body)
      } else {
        await post('/api/daily-learning-records', body)
      }
      setForm(emptyForm())
      setEditing(false)
      setSelected(null)
      await load()
    } catch (err) {
      setError(err.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  function openDate(date) {
    const key = localDateKey(date)
    setError('')
    setEditing(false)
    setSelected({ date, records: byDate[key] || [] })
    setForm(emptyForm())
  }

  function beginEdit(record) {
    setError('')
    setSelected({ ...selected, editingRecord: record })
    setForm({ content: record.content, urls: record.urls?.length ? [...record.urls] : [''] })
    setEditing(true)
  }

  async function remove(record) {
    if (!window.confirm('确定删除这条今天的学习记录吗？')) return
    setError('')
    try {
      await del(`/api/daily-learning-records/${record.id}`)
      setSelected(null)
      setEditing(false)
      await load()
    } catch (err) {
      setError(err.message || '删除失败')
    }
  }

  const selectedDate = selected?.date || (selected?.study_date ? new Date(selected.study_date) : null)
  const isToday = selectedDate && localDateKey(selectedDate) === today

  return <section className="dailyLearningPage">
    <div className="sectionHeader">
      <div className="flexRow">
        <BookOpen size={25} className="brandIcon" />
        <div>
          <p className="eyebrow">Daily learning</p>
          <h1>每日学习</h1>
          <p className="muted">记录今天的收获，连续 30 天一目了然。</p>
        </div>
      </div>
    </div>

    <div className="dailyLearningGrid">
      <form className="dailyEntryCard" onSubmit={submit}>
        <div className="dailyCardHeading">
          <div><p className="eyebrow">今天</p><h2>新增学习记录</h2></div>
          <span>{formatDate(new Date())}</span>
        </div>
        <label>学习内容 <em>必填</em>
          <textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="例如：理解了 PostgreSQL 索引的选择策略，并完成了实验。" required />
        </label>
        <div className="urlFields">
          <div className="urlLabel"><span>参考链接</span><button type="button" className="textButton" onClick={() => setForm({ ...form, urls: [...form.urls, ''] })}><Plus size={15} />添加链接</button></div>
          {form.urls.map((value, index) => <div className="urlRow" key={index}>
            <Link2 size={16} />
            <input type="url" value={value} onChange={(event) => setForm({ ...form, urls: form.urls.map((url, position) => position === index ? event.target.value : url) })} placeholder="https://example.com" />
            <button type="button" className="iconButton small" aria-label="移除链接" disabled={form.urls.length === 1} onClick={() => setForm({ ...form, urls: form.urls.filter((_, position) => position !== index) })}><X size={16} /></button>
          </div>)}
        </div>
        {error && <p className="error">{error}</p>}
        <button className="button primary" type="submit" disabled={saving}><Plus size={17} />{saving ? '保存中…' : '保存今天的记录'}</button>
      </form>

      <section className="learningCalendarCard">
        <div className="dailyCardHeading">
          <div><p className="eyebrow">Last 30 days</p><h2>学习日历</h2></div>
          <div className="calendarLegend"><i data-level="0" />无记录 <i data-level="1" />少 <i data-level="5" />多</div>
        </div>
        {loading ? <p className="muted">加载学习日历中…</p> : <div className="calendarWrap">
          <div className="weekdayLabels">{WEEKDAYS.map(day => <span key={day}>周{day}</span>)}</div>
          <div className="learningCalendar">
            {Array.from({ length: days[0].getDay() }, (_, index) => <span className="calendarBlank" key={`blank-${index}`} />)}
            {days.map(day => {
              const key = localDateKey(day)
              const items = byDate[key] || []
              const count = items.length
              const preview = count ? items.slice(0, 2).map(item => item.content).join('；') + (count > 2 ? '…' : '') : '当天没有学习记录'
              return <button key={key} type="button" className={`calendarDay level-${levelFor(count)} ${key === today ? 'today' : ''}`} onClick={() => openDate(day)} data-tooltip={preview} aria-label={`${formatDate(day)}，${count} 条学习记录`}>
                <time dateTime={key}>{day.getDate()}</time><small>周{WEEKDAYS[day.getDay()]}</small><strong>{count || ''}</strong>
              </button>
            })}
          </div>
        </div>}
      </section>
    </div>

    {selected && <div className="learningModalBackdrop" role="presentation" onMouseDown={() => !editing && setSelected(null)}>
      <section className="learningModal" role="dialog" aria-modal="true" aria-labelledby="learning-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="iconButton modalClose" aria-label="关闭" onClick={() => { setSelected(null); setEditing(false) }}><X size={18} /></button>
        {editing ? <form className="modalEditForm" onSubmit={submit}>
          <p className="eyebrow">编辑今天的记录</p><h2 id="learning-modal-title">修改学习内容</h2>
          <label>学习内容 <em>必填</em><textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} required /></label>
          <div className="urlFields"><div className="urlLabel"><span>参考链接</span><button type="button" className="textButton" onClick={() => setForm({ ...form, urls: [...form.urls, ''] })}><Plus size={15} />添加链接</button></div>
          {form.urls.map((value, index) => <div className="urlRow" key={index}><Link2 size={16} /><input type="url" value={value} onChange={(event) => setForm({ ...form, urls: form.urls.map((url, position) => position === index ? event.target.value : url) })} placeholder="https://example.com" /><button type="button" className="iconButton small" aria-label="移除链接" disabled={form.urls.length === 1} onClick={() => setForm({ ...form, urls: form.urls.filter((_, position) => position !== index) })}><X size={16} /></button></div>)}</div>
          {error && <p className="error">{error}</p>}
          <div className="actions"><button className="button primary" disabled={saving} type="submit">保存修改</button><button className="button" type="button" onClick={() => setEditing(false)}>取消</button></div>
        </form> : <><p className="eyebrow">学习记录</p><h2 id="learning-modal-title">{formatDate(selectedDate)}</h2>
          {selected.records?.length ? <div className="recordList">{selected.records.map(record => <article className="learningRecord" key={record.id}><p>{record.content}</p>{record.urls?.length > 0 && <ul>{record.urls.map(url => <li key={url}><a href={url} target="_blank" rel="noreferrer"><ExternalLink size={15} />{url}</a></li>)}</ul>}{isToday && <div className="recordActions"><button className="textButton" onClick={() => beginEdit(record)}><Pencil size={15} />编辑</button><button className="textButton dangerText" onClick={() => remove(record)}><Trash2 size={15} />删除</button></div>}</article>)}</div> : <p className="emptyDay">这一天还没有学习记录。{isToday ? ' 使用页面左侧表单添加今天的第一条记录吧。' : ''}</p>}</>}
      </section>
    </div>}
  </section>
}
