CREATE TABLE IF NOT EXISTS series (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_series_user ON series(user_id);

ALTER TABLE posts ADD COLUMN IF NOT EXISTS series_id BIGINT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS series_position INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'posts_series_id_fkey' AND conrelid = 'posts'::regclass
    ) THEN
        ALTER TABLE posts ADD CONSTRAINT posts_series_id_fkey
            FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'posts_series_position_nonnegative' AND conrelid = 'posts'::regclass
    ) THEN
        ALTER TABLE posts ADD CONSTRAINT posts_series_position_nonnegative
            CHECK (series_position >= 0);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_posts_series_position ON posts(series_id, series_position, id);

DROP TRIGGER IF EXISTS series_set_updated_at ON series;
CREATE TRIGGER series_set_updated_at BEFORE UPDATE ON series FOR EACH ROW EXECUTE FUNCTION set_updated_at();
