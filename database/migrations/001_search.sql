-- Search documents, semantic chunks, and asynchronous indexing jobs.
-- This migration is idempotent. Indexes are created concurrently.
-- Add the HNSW vector index only after selecting an embedding model and fixed dimension.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS post_search_documents (
    post_id BIGINT PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
    search_text TEXT NOT NULL DEFAULT '',
    search_tsv TSVECTOR NOT NULL DEFAULT ''::tsvector,
    content_hash TEXT NOT NULL DEFAULT '',
    embedding_model TEXT NOT NULL DEFAULT '',
    embedding_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (embedding_status IN ('pending', 'processing', 'completed', 'failed')),
    indexed_at TIMESTAMPTZ,
    last_error TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS post_search_chunks (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
    chunk_no INTEGER NOT NULL CHECK (chunk_no >= 0),
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    embedding vector,
    embedding_model TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (post_id, chunk_no)
);

CREATE TABLE IF NOT EXISTS search_index_jobs (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL CHECK (job_type IN ('upsert', 'delete', 'reindex')),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    run_after TIMESTAMPTZ NOT NULL DEFAULT now(),
    locked_at TIMESTAMPTZ,
    locked_by TEXT NOT NULL DEFAULT '',
    last_error TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_documents_public_tsv
    ON post_search_documents USING GIN (search_tsv)
    WHERE status = 'published';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_documents_user_status
    ON post_search_documents (user_id, status, updated_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_chunks_post
    ON post_search_chunks (post_id, chunk_no);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_chunks_user_status
    ON post_search_chunks (user_id, status, post_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_jobs_pending
    ON search_index_jobs (run_after, id)
    WHERE status = 'pending';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_jobs_post
    ON search_index_jobs (post_id, created_at DESC);

DROP TRIGGER IF EXISTS set_post_search_documents_updated_at ON post_search_documents;
CREATE TRIGGER set_post_search_documents_updated_at BEFORE UPDATE ON post_search_documents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_post_search_chunks_updated_at ON post_search_chunks;
CREATE TRIGGER set_post_search_chunks_updated_at BEFORE UPDATE ON post_search_chunks
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_search_index_jobs_updated_at ON search_index_jobs;
CREATE TRIGGER set_search_index_jobs_updated_at BEFORE UPDATE ON search_index_jobs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
