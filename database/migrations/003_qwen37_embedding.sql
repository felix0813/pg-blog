-- Switch the initial embedding model while preserving the established 1024 dimensions.
ALTER TABLE post_search_chunks
    ALTER COLUMN embedding_model SET DEFAULT 'qwen3.7-text-embedding';

ALTER TABLE post_search_documents
    ALTER COLUMN embedding_model SET DEFAULT 'qwen3.7-text-embedding';
