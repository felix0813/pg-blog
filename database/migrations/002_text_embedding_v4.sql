-- Fix the first embedding model to Alibaba Cloud Model Studio text-embedding-v4 (1024 dimensions).
-- This migration must not run inside a transaction because it creates an HNSW index concurrently.

ALTER TABLE post_search_chunks
    ALTER COLUMN embedding TYPE vector(1024)
    USING embedding::vector(1024);

ALTER TABLE post_search_chunks
    ALTER COLUMN embedding_model SET DEFAULT 'text-embedding-v4';

ALTER TABLE post_search_documents
    ALTER COLUMN embedding_model SET DEFAULT 'text-embedding-v4';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_chunks_public_embedding
    ON post_search_chunks USING HNSW (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE status = 'published' AND embedding IS NOT NULL;
