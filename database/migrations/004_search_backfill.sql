-- Queue existing posts once after the search tables are available.
INSERT INTO search_index_jobs (post_id,job_type)
SELECT p.id,'reindex'
FROM posts p
WHERE NOT EXISTS (
    SELECT 1 FROM search_index_jobs j
    WHERE j.post_id=p.id AND j.status IN ('pending','processing','completed')
);
