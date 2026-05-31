package handlers

import (
	"net/http"
	"strconv"

	"pg-blog/backend/internal/middleware"
	"pg-blog/backend/internal/models"

	"github.com/gin-gonic/gin"
)

type taxonomyRequest struct {
	Name        string `json:"name" binding:"required"`
	Slug        string `json:"slug" binding:"required"`
	Description string `json:"description"`
}

func (h *Handler) ListCategories(c *gin.Context) {
	rows, err := h.db.Query(c, `SELECT id, user_id, name, slug, description, created_at FROM categories ORDER BY name`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "list categories failed"})
		return
	}
	defer rows.Close()
	var items []models.Category
	for rows.Next() {
		var item models.Category
		_ = rows.Scan(&item.ID, &item.UserID, &item.Name, &item.Slug, &item.Description, &item.CreatedAt)
		items = append(items, item)
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (h *Handler) CreateCategory(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var req taxonomyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var item models.Category
	err := h.db.QueryRow(c, `INSERT INTO categories (user_id, name, slug, description) VALUES ($1,$2,$3,$4) RETURNING id,user_id,name,slug,description,created_at`, userID, req.Name, req.Slug, req.Description).
		Scan(&item.ID, &item.UserID, &item.Name, &item.Slug, &item.Description, &item.CreatedAt)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "category exists"})
		return
	}
	h.afterMutation(c, userID, 0, "category.created", item)
	c.JSON(http.StatusCreated, item)
}

func (h *Handler) UpdateCategory(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req taxonomyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	tag, err := h.db.Exec(c, `UPDATE categories SET name=$1, slug=$2, description=$3 WHERE id=$4 AND user_id=$5`, req.Name, req.Slug, req.Description, id, userID)
	if err != nil || tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "category not found"})
		return
	}
	h.afterMutation(c, userID, 0, "category.updated", gin.H{"id": id})
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) DeleteCategory(c *gin.Context) {
	h.deleteTaxonomy(c, "categories", "category.deleted")
}

func (h *Handler) ListTags(c *gin.Context) {
	rows, err := h.db.Query(c, `
		SELECT t.id, t.user_id, t.name, t.slug, count(pt.post_id)::bigint AS post_count, t.created_at
		FROM tags t LEFT JOIN post_tags pt ON pt.tag_id=t.id
		GROUP BY t.id ORDER BY t.name`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "list tags failed"})
		return
	}
	defer rows.Close()
	var items []models.Tag
	for rows.Next() {
		var item models.Tag
		_ = rows.Scan(&item.ID, &item.UserID, &item.Name, &item.Slug, &item.PostCount, &item.CreatedAt)
		items = append(items, item)
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (h *Handler) CreateTag(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var req taxonomyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var item models.Tag
	err := h.db.QueryRow(c, `INSERT INTO tags (user_id, name, slug) VALUES ($1,$2,$3) RETURNING id,user_id,name,slug,created_at`, userID, req.Name, req.Slug).
		Scan(&item.ID, &item.UserID, &item.Name, &item.Slug, &item.CreatedAt)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "tag exists"})
		return
	}
	h.afterMutation(c, userID, 0, "tag.created", item)
	c.JSON(http.StatusCreated, item)
}

func (h *Handler) UpdateTag(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req taxonomyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	tag, err := h.db.Exec(c, `UPDATE tags SET name=$1, slug=$2 WHERE id=$3 AND user_id=$4`, req.Name, req.Slug, id, userID)
	if err != nil || tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "tag not found"})
		return
	}
	h.afterMutation(c, userID, 0, "tag.updated", gin.H{"id": id})
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) DeleteTag(c *gin.Context) {
	h.deleteTaxonomy(c, "tags", "tag.deleted")
}

func (h *Handler) deleteTaxonomy(c *gin.Context, table string, event string) {
	userID := middleware.CurrentUserID(c)
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	sql := "DELETE FROM " + table + " WHERE id=$1 AND user_id=$2"
	tag, err := h.db.Exec(c, sql, id, userID)
	if err != nil || tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "item not found"})
		return
	}
	h.afterMutation(c, userID, 0, event, gin.H{"id": id})
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
