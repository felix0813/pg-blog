package handlers

import (
	"net/http"
	"strconv"

	"pg-blog/backend/internal/middleware"
	"pg-blog/backend/internal/models"

	"github.com/gin-gonic/gin"
)

type seriesRequest struct {
	Title       string `json:"title" binding:"required"`
	Slug        string `json:"slug" binding:"required"`
	Description string `json:"description"`
}

func (h *Handler) ListSeries(c *gin.Context) {
	rows, err := h.db.Query(c, `SELECT id,user_id,title,slug,description,created_at FROM series ORDER BY title`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "list series failed"})
		return
	}
	defer rows.Close()
	var items []models.Series
	for rows.Next() {
		var item models.Series
		_ = rows.Scan(&item.ID, &item.UserID, &item.Title, &item.Slug, &item.Description, &item.CreatedAt)
		items = append(items, item)
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (h *Handler) CreateSeries(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var req seriesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var item models.Series
	err := h.db.QueryRow(c, `INSERT INTO series (user_id,title,slug,description) VALUES ($1,$2,$3,$4) RETURNING id,user_id,title,slug,description,created_at`, userID, req.Title, req.Slug, req.Description).
		Scan(&item.ID, &item.UserID, &item.Title, &item.Slug, &item.Description, &item.CreatedAt)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "series exists"})
		return
	}
	h.afterMutation(c, userID, 0, "series.created", item)
	c.JSON(http.StatusCreated, item)
}

func (h *Handler) SeriesPosts(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	post, err := h.fetchPost(c, id)
	if err != nil || post.SeriesID == nil || !h.canReadPost(c, post) {
		c.JSON(http.StatusNotFound, gin.H{"error": "series not found"})
		return
	}
	var series models.Series
	if err := h.db.QueryRow(c, `SELECT id,user_id,title,slug,description,created_at FROM series WHERE id=$1`, *post.SeriesID).
		Scan(&series.ID, &series.UserID, &series.Title, &series.Slug, &series.Description, &series.CreatedAt); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "series not found"})
		return
	}
	rows, err := h.db.Query(c, `SELECT id,title,slug,summary,status,series_position FROM posts WHERE series_id=$1 AND status='published' ORDER BY series_position,id`, series.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "list series posts failed"})
		return
	}
	defer rows.Close()
	var items []models.SeriesPost
	for rows.Next() {
		var item models.SeriesPost
		_ = rows.Scan(&item.ID, &item.Title, &item.Slug, &item.Summary, &item.Status, &item.Position)
		items = append(items, item)
	}
	c.JSON(http.StatusOK, gin.H{"series": series, "items": items})
}
