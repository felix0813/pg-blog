package handlers

import (
	"net/http"
	"strconv"
	"time"

	"pg-blog/backend/internal/middleware"
	"pg-blog/backend/internal/models"

	"github.com/gin-gonic/gin"
)

func (h *Handler) ListLearningGoals(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	rows, err := h.db.Query(c, `SELECT post_id,last_learned_at FROM learning_goals WHERE user_id=$1`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "list learning goals failed"})
		return
	}
	defer rows.Close()
	items := []models.LearningGoal{}
	for rows.Next() {
		var item models.LearningGoal
		_ = rows.Scan(&item.PostID, &item.LastLearnedAt)
		items = append(items, item)
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (h *Handler) ListLearningPosts(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	rows, err := h.db.Query(c, `
		SELECT p.id,p.user_id,p.category_id,p.title,p.slug,p.summary,p.status,p.content_html,p.oss_json_key,p.oss_html_key,p.view_count,p.published_at,p.created_at,p.updated_at,lg.last_learned_at
		FROM learning_goals lg JOIN posts p ON p.id=lg.post_id
		WHERE lg.user_id=$1 AND (p.status='published' OR p.user_id=$1)
		ORDER BY lg.last_learned_at ASC NULLS FIRST,lg.created_at DESC`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "list learning posts failed"})
		return
	}
	defer rows.Close()
	items := []models.Post{}
	for rows.Next() {
		var item models.Post
		if err := rows.Scan(&item.ID, &item.UserID, &item.CategoryID, &item.Title, &item.Slug, &item.Summary, &item.Status, &item.ContentHTML, &item.OSSJSONKey, &item.OSSHTMLKey, &item.ViewCount, &item.PublishedAt, &item.CreatedAt, &item.UpdatedAt, &item.LastLearnedAt); err == nil {
			item.IsLearningGoal = true
			items = append(items, item)
		}
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (h *Handler) AddLearningGoal(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	postID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	post, err := h.fetchPost(c, postID)
	if err != nil || !h.canReadPost(c, post) {
		c.JSON(http.StatusNotFound, gin.H{"error": "post not found"})
		return
	}
	if _, err := h.db.Exec(c, `INSERT INTO learning_goals (user_id,post_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, userID, postID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "add learning goal failed"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"post_id": postID, "last_learned_at": nil})
}

func (h *Handler) RemoveLearningGoal(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	postID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	if _, err := h.db.Exec(c, `DELETE FROM learning_goals WHERE user_id=$1 AND post_id=$2`, userID, postID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "remove learning goal failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) MarkLearned(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	postID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	now := time.Now()
	tag, err := h.db.Exec(c, `UPDATE learning_goals SET last_learned_at=$1 WHERE user_id=$2 AND post_id=$3`, now, userID, postID)
	if err != nil || tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "learning goal not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"post_id": postID, "last_learned_at": now})
}
