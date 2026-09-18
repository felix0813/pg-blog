CREATE TABLE IF NOT EXISTS post_revisions (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    revision_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
    category_id BIGINT,
    series_id BIGINT,
    series_position INTEGER NOT NULL DEFAULT 0 CHECK (series_position >= 0),
    tag_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    content_json JSONB NOT NULL,
    content_html TEXT NOT NULL,
    revision_type TEXT NOT NULL DEFAULT 'save' CHECK (revision_type IN ('save', 'restore')),
    restored_from_revision_id BIGINT REFERENCES post_revisions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (post_id, revision_number)
);

CREATE INDEX IF NOT EXISTS idx_post_revisions_post_number ON post_revisions(post_id, revision_number DESC);
CREATE INDEX IF NOT EXISTS idx_post_revisions_restored_from ON post_revisions(restored_from_revision_id);

INSERT INTO post_revisions (post_id,revision_number,title,slug,summary,status,category_id,series_id,series_position,tag_ids,content_json,content_html)
SELECT p.id,1,p.title,p.slug,p.summary,p.status,p.category_id,p.series_id,p.series_position,
       COALESCE(tags.tag_ids, '[]'::jsonb),p.content_json,p.content_html
FROM posts p
LEFT JOIN LATERAL (
    SELECT jsonb_agg(pt.tag_id ORDER BY pt.tag_id) AS tag_ids
    FROM post_tags pt WHERE pt.post_id=p.id
) tags ON true
ON CONFLICT (post_id, revision_number) DO NOTHING;
