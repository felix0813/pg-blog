package handlers

import (
	"net/http"
	"strconv"

	"pg-blog/backend/internal/middleware"
	"pg-blog/backend/internal/models"

	"github.com/gin-gonic/gin"
)

func (h *Handler) ExportPosts(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	postID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	post, err := h.fetchPost(c, postID)
	if err != nil || post.UserID != userID {
		c.JSON(http.StatusNotFound, gin.H{"error": "post not found"})
		return
	}
	items := []models.Post{post}
	if c.Query("include_series") == "true" && post.SeriesID != nil {
		rows, err := h.db.Query(c, `SELECT id FROM posts WHERE series_id=$1 AND user_id=$2 ORDER BY series_position,id`, *post.SeriesID, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "list series export posts failed"})
			return
		}
		defer rows.Close()
		items = nil
		for rows.Next() {
			var id int64
			if rows.Scan(&id) != nil {
				continue
			}
			item, fetchErr := h.fetchPost(c, id)
			if fetchErr == nil {
				items = append(items, item)
			}
		}
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}
