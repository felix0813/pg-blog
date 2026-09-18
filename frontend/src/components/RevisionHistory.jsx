import React from 'react'
import '../revision-history.css'

export function RevisionHistory({ revisions, onRestore, isRestoring }) {
  if (!revisions) return null
  if (revisions.length === 0) return <p className="muted">尚无历史版本。</p>

  return (
    <section className="revisionHistory" aria-labelledby="revision-history-title">
      <h2 id="revision-history-title">历史版本</h2>
      <ol>
        {revisions.map((revision) => (
          <li key={revision.id}>
            <div>
              <strong>版本 {revision.revision_number}</strong>
              {revision.revision_type === 'restore' && <span className="restoreBadge">恢复版本</span>}
              <p>{revision.title} · {new Date(revision.created_at).toLocaleString()}</p>
              {revision.restored_from_revision_id && <small>恢复自版本记录 #{revision.restored_from_revision_id}</small>}
            </div>
            <button type="button" onClick={() => onRestore(revision)} disabled={isRestoring}>
              {isRestoring ? '正在恢复...' : '恢复为此版本'}
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}
