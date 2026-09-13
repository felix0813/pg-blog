package handlers

import (
	"net/http"

	"pg-blog/backend/internal/middleware"

	"github.com/gin-gonic/gin"
)

func (h *Handler) ListOwnPosts(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	rows, err := h.db.Query(c, `
		SELECT p.id, p.user_id, p.category_id, p.title, p.slug, p.summary, p.status,
		       p.content_html, p.oss_json_key, p.oss_html_key, p.view_count,
		       p.published_at, p.created_at, p.updated_at
		FROM posts p
		WHERE p.user_id=$1
		ORDER BY p.created_at DESC`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "list own posts failed"})
		return
	}
	defer rows.Close()
	c.Header("Cache-Control", "no-store")
	c.JSON(http.StatusOK, gin.H{"items": scanPosts(rows)})
}
