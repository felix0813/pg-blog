package handlers

import (
	"encoding/base64"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"pg-blog/backend/internal/middleware"
	searchindex "pg-blog/backend/internal/search"

	"github.com/gin-gonic/gin"
)

type searchResult struct {
	ID           int64      `json:"id"`
	Title        string     `json:"title"`
	Slug         string     `json:"slug"`
	Summary      string     `json:"summary"`
	Status       string     `json:"status"`
	Snippet      string     `json:"snippet"`
	Category     string     `json:"category,omitempty"`
	CategorySlug string     `json:"category_slug,omitempty"`
	Tags         []string   `json:"tags"`
	PublishedAt  *time.Time `json:"published_at,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	Score        float64    `json:"score,omitempty"`
	MatchType    string     `json:"match_type"`
}

func (h *Handler) Search(c *gin.Context) {
	query := strings.TrimSpace(c.Query("q"))
	if len([]rune(query)) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "search query must contain at least 2 characters"})
		return
	}
	pageSize := intParam(c, "page_size", 10)
	offset, err := decodeSearchCursor(c.Query("cursor"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid search cursor"})
		return
	}
	viewerID, ok := h.auth.UserID(c)
	if !ok {
		viewerID = 0
	}

	rows, err := h.db.Query(c, `
		WITH q AS (SELECT websearch_to_tsquery('simple',$1) AS value)
		SELECT p.id,p.title,p.slug,p.summary,p.status,left(d.search_text,240),
			COALESCE(cat.name,''),COALESCE(cat.slug,''),
			COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.id IS NOT NULL),'{}'),
			p.published_at,p.created_at,
			(ts_rank_cd(d.search_tsv,q.value)+CASE WHEN lower(p.title)=lower($2) THEN 1 ELSE 0 END)::float8
		FROM post_search_documents d
		JOIN posts p ON p.id=d.post_id
		CROSS JOIN q
		LEFT JOIN categories cat ON cat.id=p.category_id
		LEFT JOIN post_tags pt ON pt.post_id=p.id
		LEFT JOIN tags t ON t.id=pt.tag_id
		WHERE d.search_tsv @@ q.value
			AND (p.status='published' OR p.user_id=$3)
			AND ($4='' OR cat.slug=$4)
			AND ($5='' OR EXISTS (
				SELECT 1 FROM post_tags fpt JOIN tags ft ON ft.id=fpt.tag_id
				WHERE fpt.post_id=p.id AND ft.slug=$5
			))
		GROUP BY p.id,d.search_text,d.search_tsv,q.value,cat.name,cat.slug
		ORDER BY (ts_rank_cd(d.search_tsv,q.value)+CASE WHEN lower(p.title)=lower($2) THEN 1 ELSE 0 END) DESC,p.id DESC
		LIMIT $6 OFFSET $7`, websearchQuery(query), query, viewerID, c.Query("category"), c.Query("tag"), pageSize+1, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "search failed"})
		return
	}
	defer rows.Close()

	items := make([]searchResult, 0, pageSize+1)
	for rows.Next() {
		var item searchResult
		if err := rows.Scan(&item.ID, &item.Title, &item.Slug, &item.Summary, &item.Status, &item.Snippet,
			&item.Category, &item.CategorySlug, &item.Tags, &item.PublishedAt, &item.CreatedAt, &item.Score); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "search failed"})
			return
		}
		item.MatchType = "keyword"
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "search failed"})
		return
	}

	nextCursor := ""
	if len(items) > pageSize {
		items = items[:pageSize]
		nextCursor = encodeSearchCursor(offset + pageSize)
	}
	c.Header("Cache-Control", "no-store")
	c.JSON(http.StatusOK, gin.H{"items": items, "next_cursor": nextCursor, "semantic_enabled": false})
}

func (h *Handler) RelatedPosts(c *gin.Context) {
	postID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || postID < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid post id"})
		return
	}
	limit := intParam(c, "limit", 6)
	if limit > 12 {
		limit = 12
	}
	viewerID, ok := h.auth.UserID(c)
	if !ok {
		viewerID = 0
	}
	var title, summary string
	if err := h.db.QueryRow(c, `
		SELECT title,summary FROM posts
		WHERE id=$1 AND (status='published' OR user_id=$2)`, postID, viewerID).Scan(&title, &summary); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "post not found"})
		return
	}

	rows, err := h.db.Query(c, `
		WITH source AS (
			SELECT p.id,p.category_id,websearch_to_tsquery('simple',$3) AS query
			FROM posts p WHERE p.id=$1
		), shared_tags AS (
			SELECT pt2.post_id,count(*)::float8 AS score
			FROM post_tags pt1 JOIN post_tags pt2 ON pt2.tag_id=pt1.tag_id
			WHERE pt1.post_id=$1 AND pt2.post_id<>$1 GROUP BY pt2.post_id
		)
		SELECT p.id,p.title,p.slug,p.summary,p.status,left(COALESCE(d.search_text,p.summary),240),
			COALESCE(cat.name,''),COALESCE(cat.slug,''),
			COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.id IS NOT NULL),'{}'),
			p.published_at,p.created_at,
			(CASE WHEN p.category_id=source.category_id THEN 2 ELSE 0 END+
			 COALESCE(shared_tags.score,0)+COALESCE(ts_rank_cd(d.search_tsv,source.query),0))::float8
		FROM source
		JOIN posts p ON p.id<>source.id AND (p.status='published' OR p.user_id=$2)
		LEFT JOIN post_search_documents d ON d.post_id=p.id
		LEFT JOIN shared_tags ON shared_tags.post_id=p.id
		LEFT JOIN categories cat ON cat.id=p.category_id
		LEFT JOIN post_tags pt ON pt.post_id=p.id
		LEFT JOIN tags t ON t.id=pt.tag_id
		GROUP BY p.id,d.search_text,d.search_tsv,source.category_id,source.query,shared_tags.score,cat.name,cat.slug
		ORDER BY (CASE WHEN p.category_id=source.category_id THEN 2 ELSE 0 END+
			COALESCE(shared_tags.score,0)+COALESCE(ts_rank_cd(d.search_tsv,source.query),0)) DESC,
			p.published_at DESC NULLS LAST,p.id DESC
		LIMIT $4`, postID, viewerID, websearchQuery(title+" "+summary), limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "related posts failed"})
		return
	}
	defer rows.Close()
	items := make([]searchResult, 0, limit)
	for rows.Next() {
		var item searchResult
		if err := rows.Scan(&item.ID, &item.Title, &item.Slug, &item.Summary, &item.Status, &item.Snippet,
			&item.Category, &item.CategorySlug, &item.Tags, &item.PublishedAt, &item.CreatedAt, &item.Score); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "related posts failed"})
			return
		}
		item.MatchType = "related"
		items = append(items, item)
	}
	c.Header("Cache-Control", "no-store")
	c.JSON(http.StatusOK, gin.H{"items": items, "semantic_enabled": false})
}

func (h *Handler) ReindexSearch(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	tag, err := h.db.Exec(c, `
		INSERT INTO search_index_jobs (post_id,job_type)
		SELECT p.id,'reindex' FROM posts p
		WHERE p.user_id=$1 AND NOT EXISTS (
			SELECT 1 FROM search_index_jobs j
			WHERE j.post_id=p.id AND j.status IN ('pending','processing')
		)`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "queue reindex failed"})
		return
	}
	c.JSON(http.StatusAccepted, gin.H{"queued": tag.RowsAffected()})
}

func (h *Handler) SearchJobs(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	rows, err := h.db.Query(c, `
		SELECT j.id,j.post_id,j.job_type,j.status,j.attempts,j.run_after,j.last_error,j.created_at,j.updated_at
		FROM search_index_jobs j JOIN posts p ON p.id=j.post_id
		WHERE p.user_id=$1 ORDER BY j.created_at DESC LIMIT 100`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "list search jobs failed"})
		return
	}
	defer rows.Close()
	items := make([]gin.H, 0)
	for rows.Next() {
		var id, postID int64
		var jobType, status, lastError string
		var attempts int
		var runAfter, createdAt, updatedAt time.Time
		if err := rows.Scan(&id, &postID, &jobType, &status, &attempts, &runAfter, &lastError, &createdAt, &updatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "list search jobs failed"})
			return
		}
		items = append(items, gin.H{"id": id, "post_id": postID, "job_type": jobType, "status": status,
			"attempts": attempts, "run_after": runAfter, "last_error": lastError, "created_at": createdAt, "updated_at": updatedAt})
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func websearchQuery(query string) string {
	tokens := strings.Fields(searchindex.Tokenize(query))
	parts := make([]string, 0, len(tokens))
	for _, token := range tokens {
		parts = append(parts, `"`+strings.ReplaceAll(token, `"`, "")+`"`)
	}
	return strings.Join(parts, " OR ")
}

func encodeSearchCursor(offset int) string {
	return base64.RawURLEncoding.EncodeToString([]byte(strconv.Itoa(offset)))
}

func decodeSearchCursor(value string) (int, error) {
	if value == "" {
		return 0, nil
	}
	raw, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		return 0, err
	}
	offset, err := strconv.Atoi(string(raw))
	if err != nil || offset < 0 {
		return 0, fmt.Errorf("invalid cursor")
	}
	return offset, nil
}
