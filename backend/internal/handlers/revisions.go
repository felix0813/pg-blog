package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"pg-blog/backend/internal/middleware"
	"pg-blog/backend/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

func (h *Handler) recordRevision(c *gin.Context, tx pgx.Tx, postID int64, req postRequest, cleanHTML string, restoredFrom *int64) error {
	var tagIDs json.RawMessage
	if err := tx.QueryRow(c, `SELECT COALESCE(jsonb_agg(tag_id ORDER BY tag_id), '[]'::jsonb) FROM post_tags WHERE post_id=$1`, postID).Scan(&tagIDs); err != nil {
		return err
	}
	var revisionNumber int
	if err := tx.QueryRow(c, `SELECT COALESCE(MAX(revision_number), 0) + 1 FROM post_revisions WHERE post_id=$1`, postID).Scan(&revisionNumber); err != nil {
		return err
	}
	revisionType := "save"
	if restoredFrom != nil {
		revisionType = "restore"
	}
	_, err := tx.Exec(c, `
		INSERT INTO post_revisions (post_id,revision_number,title,slug,summary,status,category_id,series_id,series_position,tag_ids,content_json,content_html,revision_type,restored_from_revision_id)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
		postID, revisionNumber, req.Title, req.Slug, req.Summary, req.Status, req.CategoryID, req.SeriesID, req.SeriesPosition, tagIDs, req.ContentJSON, cleanHTML, revisionType, restoredFrom)
	return err
}

func (h *Handler) ListRevisions(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	postID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	rows, err := h.db.Query(c, `
		SELECT r.id,r.revision_number,r.title,r.status,r.revision_type,r.restored_from_revision_id,r.created_at
		FROM post_revisions r JOIN posts p ON p.id=r.post_id
		WHERE r.post_id=$1 AND p.user_id=$2 ORDER BY r.revision_number DESC`, postID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "list revisions failed"})
		return
	}
	defer rows.Close()
	var items []models.PostRevision
	for rows.Next() {
		var item models.PostRevision
		_ = rows.Scan(&item.ID, &item.RevisionNumber, &item.Title, &item.Status, &item.RevisionType, &item.RestoredFromRevisionID, &item.CreatedAt)
		items = append(items, item)
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (h *Handler) RestoreRevision(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	postID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	revisionID, _ := strconv.ParseInt(c.Param("revisionID"), 10, 64)
	var req postRequest
	var tagJSON json.RawMessage
	var tagIDs []int64
	err := h.db.QueryRow(c, `
		SELECT r.title,r.slug,r.summary,r.status,r.category_id,r.series_id,r.series_position,r.tag_ids,r.content_json,r.content_html
		FROM post_revisions r JOIN posts p ON p.id=r.post_id
		WHERE r.id=$1 AND r.post_id=$2 AND p.user_id=$3`, revisionID, postID, userID).
		Scan(&req.Title, &req.Slug, &req.Summary, &req.Status, &req.CategoryID, &req.SeriesID, &req.SeriesPosition, &tagJSON, &req.ContentJSON, &req.ContentHTML)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "revision not found"})
		return
	}
	if err := json.Unmarshal(tagJSON, &tagIDs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "decode revision tags failed"})
		return
	}
	req.TagIDs = tagIDs
	post, err := h.savePost(c, userID, postID, req, &revisionID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("restore revision failed: %v", err)})
		return
	}
	h.afterMutation(c, userID, post.ID, "post.restored", gin.H{"id": post.ID, "revision_id": revisionID})
	c.JSON(http.StatusOK, post)
}
