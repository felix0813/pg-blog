package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// SemanticRelatedPosts combines stored-vector similarity with category, tag,
// and keyword signals. It does not make an external request at read time.
func (h *Handler) SemanticRelatedPosts(c *gin.Context) {
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
	if err := h.db.QueryRow(c, `SELECT title,summary FROM posts WHERE id=$1 AND (status='published' OR user_id=$2)`, postID, viewerID).
		Scan(&title, &summary); err != nil {
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
		), semantic AS (
			SELECT candidate.post_id,max(1-(candidate.embedding <=> source_chunk.embedding))::float8 AS score
			FROM post_search_chunks source_chunk
			JOIN post_search_chunks candidate ON candidate.post_id<>source_chunk.post_id
				AND candidate.embedding_model=source_chunk.embedding_model
			WHERE source_chunk.post_id=$1 GROUP BY candidate.post_id
		)
		SELECT p.id,p.title,p.slug,p.summary,p.status,left(COALESCE(d.search_text,p.summary),240),
			COALESCE(cat.name,''),COALESCE(cat.slug,''),
			COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.id IS NOT NULL),'{}'),
			p.published_at,p.created_at,
			(CASE WHEN p.category_id=source.category_id THEN 2 ELSE 0 END+
			 COALESCE(shared_tags.score,0)+COALESCE(ts_rank_cd(d.search_tsv,source.query),0)+
			 3*COALESCE(semantic.score,0))::float8
		FROM source
		JOIN posts p ON p.id<>source.id AND (p.status='published' OR p.user_id=$2)
		LEFT JOIN post_search_documents d ON d.post_id=p.id
		LEFT JOIN shared_tags ON shared_tags.post_id=p.id
		LEFT JOIN semantic ON semantic.post_id=p.id
		LEFT JOIN categories cat ON cat.id=p.category_id
		LEFT JOIN post_tags pt ON pt.post_id=p.id
		LEFT JOIN tags t ON t.id=pt.tag_id
		GROUP BY p.id,d.search_text,d.search_tsv,source.category_id,source.query,
			shared_tags.score,semantic.score,cat.name,cat.slug
		ORDER BY (CASE WHEN p.category_id=source.category_id THEN 2 ELSE 0 END+
			COALESCE(shared_tags.score,0)+COALESCE(ts_rank_cd(d.search_tsv,source.query),0)+
			3*COALESCE(semantic.score,0)) DESC,p.published_at DESC NULLS LAST,p.id DESC
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
	var semanticEnabled bool
	_ = h.db.QueryRow(c, `SELECT EXISTS(SELECT 1 FROM post_search_chunks WHERE post_id=$1)`, postID).Scan(&semanticEnabled)
	c.Header("Cache-Control", "no-store")
	c.JSON(http.StatusOK, gin.H{"items": items, "semantic_enabled": semanticEnabled, "generated_at": time.Now()})
}
