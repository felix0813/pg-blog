CREATE TABLE IF NOT EXISTS learning_goals (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    last_learned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_learning_goals_user_learning_order
    ON learning_goals(user_id, last_learned_at ASC NULLS FIRST, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_goals_post ON learning_goals(post_id);
