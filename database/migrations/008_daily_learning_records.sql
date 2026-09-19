CREATE TABLE IF NOT EXISTS daily_learning_records (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (btrim(content) <> ''),
    urls JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(urls) = 'array'),
    study_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_learning_records_user_date
    ON daily_learning_records(user_id, study_date DESC, created_at ASC);

DROP TRIGGER IF EXISTS daily_learning_records_set_updated_at ON daily_learning_records;
CREATE TRIGGER daily_learning_records_set_updated_at
    BEFORE UPDATE ON daily_learning_records
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
