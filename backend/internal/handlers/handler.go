package handlers

import (
	"pg-blog/backend/internal/cache"
	"pg-blog/backend/internal/middleware"
	"pg-blog/backend/internal/storage"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/microcosm-cc/bluemonday"
)

type Handler struct {
	db     *pgxpool.Pool
	stats  *cache.Stats
	store  storage.Store
	auth   *middleware.Auth
	policy *bluemonday.Policy
}

func New(db *pgxpool.Pool, stats *cache.Stats, store storage.Store, auth *middleware.Auth) *Handler {
	policy := bluemonday.UGCPolicy()
	policy.AllowAttrs("class").Matching(bluemonday.SpaceSeparatedTokens).OnElements("pre", "code")
	return &Handler{db: db, stats: stats, store: store, auth: auth, policy: policy}
}
