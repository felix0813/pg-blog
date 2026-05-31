package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"pg-blog/backend/internal/middleware"
	"pg-blog/backend/internal/models"
	"pg-blog/backend/internal/storage"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

type postRequest struct {
	Title       string          `json:"title" binding:"required"`
	Slug        string          `json:"slug" binding:"required"`
	Summary     string          `json:"summary"`
	Status      string          `json:"status"`
	CategoryID  *int64          `json:"category_id"`
	TagIDs      []int64         `json:"tag_ids"`
	ContentJSON json.RawMessage `json:"content_json" binding:"required"`
	ContentHTML string          `json:"content_html" binding:"required"`
}

func (h *Handler) ListPosts(c *gin.Context) {
	page := intParam(c, "page", 1)
	pageSize := intParam(c, "page_size", 10)
	category := c.Query("category")
	tag := c.Query("tag")
	status := c.Query("status")
	if status != "" && !isValidPostStatus(status) {
		log.Printf("list posts invalid status=%q", status)
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid post status"})
		return
	}
	viewerID, authenticated := h.auth.UserID(c)
	if !authenticated {
		viewerID = 0
	}
	cacheKey := fmt.Sprintf("cache:posts:v%d:p%d:s%d:c%s:t%s:st%s", viewerID, page, pageSize, category, tag, status)
	var cachedResponse gin.H
	if h.stats.CacheGetJSON(c, cacheKey, &cachedResponse) {
		c.Header("Cache-Control", "no-store")
		c.JSON(http.StatusOK, cachedResponse)
		return
	}

	var totalCount int64
	err := h.db.QueryRow(c, `
		SELECT count(DISTINCT p.id)
		FROM posts p
		LEFT JOIN categories c ON c.id=p.category_id
		LEFT JOIN post_tags pt ON pt.post_id=p.id
		LEFT JOIN tags t ON t.id=pt.tag_id
		WHERE (p.status='published' OR p.user_id=$1)
		  AND ($2='' OR c.slug=$2)
		  AND ($3='' OR t.slug=$3)
		  AND ($4='' OR p.status=$4)`, viewerID, category, tag, status).Scan(&totalCount)
	if err != nil {
		log.Printf("count posts failed viewer_id=%d category=%q tag=%q status=%q: %v", viewerID, category, tag, status, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "list posts failed"})
		return
	}

	rows, err := h.db.Query(c, `
		SELECT DISTINCT p.id, p.user_id, p.category_id, p.title, p.slug, p.summary, p.status, p.content_html, p.oss_json_key, p.oss_html_key, p.view_count, p.published_at, p.created_at, p.updated_at
		FROM posts p
		LEFT JOIN categories c ON c.id=p.category_id
		LEFT JOIN post_tags pt ON pt.post_id=p.id
		LEFT JOIN tags t ON t.id=pt.tag_id
		WHERE (p.status='published' OR p.user_id=$1)
		  AND ($2='' OR c.slug=$2)
		  AND ($3='' OR t.slug=$3)
		  AND ($4='' OR p.status=$4)
		ORDER BY p.created_at DESC
		LIMIT $5 OFFSET $6`, viewerID, category, tag, status, pageSize, (page-1)*pageSize)
	if err != nil {
		log.Printf("list posts failed viewer_id=%d page=%d page_size=%d category=%q tag=%q status=%q: %v", viewerID, page, pageSize, category, tag, status, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "list posts failed"})
		return
	}
	defer rows.Close()
	posts := scanPosts(rows)

	response := gin.H{
		"items":       posts,
		"total_count": totalCount,
		"has_more":    totalCount > int64(page*pageSize),
	}
	h.stats.CacheSetJSON(c, cacheKey, response)
	c.Header("Cache-Control", "no-store")
	c.JSON(http.StatusOK, response)
}

func (h *Handler) GetPost(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	cacheKey := fmt.Sprintf("cache:post:%d", id)
	var cached models.Post
	if h.stats.CacheGetJSON(c, cacheKey, &cached) {
		c.Header("Cache-Control", "no-store")
		if !h.canReadPost(c, cached) {
			c.JSON(http.StatusNotFound, gin.H{"error": "post not found"})
			return
		}
		h.stats.IncrView(c, id)
		c.JSON(http.StatusOK, cached)
		return
	}
	post, err := h.fetchPost(c, id)
	if err != nil {
		log.Printf("fetch post failed id=%d: %v", id, err)
		c.JSON(http.StatusNotFound, gin.H{"error": "post not found"})
		return
	}
	if !h.canReadPost(c, post) {
		c.JSON(http.StatusNotFound, gin.H{"error": "post not found"})
		return
	}
	h.stats.IncrView(c, id)
	if post.Status == "published" {
		h.stats.CacheSetJSON(c, cacheKey, post)
	}
	c.Header("Cache-Control", "no-store")
	c.JSON(http.StatusOK, post)
}

func (h *Handler) CreatePost(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var req postRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("create post bind failed user_id=%d: %v", userID, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	post, err := h.savePost(c, userID, 0, req)
	if err != nil {
		log.Printf("create post failed user_id=%d title=%q slug=%q: %v", userID, req.Title, req.Slug, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.afterMutation(c, userID, post.ID, "post.created", gin.H{"id": post.ID})
	log.Printf("post created user_id=%d post_id=%d status=%q", userID, post.ID, post.Status)
	c.JSON(http.StatusCreated, post)
}

func (h *Handler) UpdatePost(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req postRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("update post bind failed user_id=%d post_id=%d: %v", userID, id, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	post, err := h.savePost(c, userID, id, req)
	if err != nil {
		log.Printf("update post failed user_id=%d post_id=%d title=%q slug=%q: %v", userID, id, req.Title, req.Slug, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.afterMutation(c, userID, post.ID, "post.updated", gin.H{"id": post.ID})
	log.Printf("post updated user_id=%d post_id=%d status=%q", userID, post.ID, post.Status)
	c.JSON(http.StatusOK, post)
}

func (h *Handler) DeletePost(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	tag, err := h.db.Exec(c, `DELETE FROM posts WHERE id=$1 AND user_id=$2`, id, userID)
	if err != nil || tag.RowsAffected() == 0 {
		log.Printf("delete post failed user_id=%d post_id=%d rows=%d err=%v", userID, id, tag.RowsAffected(), err)
		c.JSON(http.StatusNotFound, gin.H{"error": "post not found"})
		return
	}
	h.afterMutation(c, userID, id, "post.deleted", gin.H{"id": id})
	log.Printf("post deleted user_id=%d post_id=%d", userID, id)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) savePost(c *gin.Context, userID int64, postID int64, req postRequest) (models.Post, error) {
	status := req.Status
	if status == "" {
		status = "published"
	}
	if !isValidPostStatus(status) {
		return models.Post{}, fmt.Errorf("invalid post status")
	}
	cleanHTML := h.policy.Sanitize(req.ContentHTML)
	if !json.Valid(req.ContentJSON) {
		return models.Post{}, fmt.Errorf("content_json must be valid JSON")
	}
	var publishedAt *time.Time
	if status == "published" {
		now := time.Now()
		publishedAt = &now
	}
	tx, err := h.db.BeginTx(c, pgx.TxOptions{})
	if err != nil {
		return models.Post{}, err
	}
	defer tx.Rollback(c)

	var id int64
	if postID == 0 {
		err = tx.QueryRow(c, `
			INSERT INTO posts (user_id, category_id, title, slug, summary, status, content_json, content_html, published_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
			RETURNING id`, userID, req.CategoryID, req.Title, req.Slug, req.Summary, status, req.ContentJSON, cleanHTML, publishedAt).Scan(&id)
	} else {
		id = postID
		tag, execErr := tx.Exec(c, `
			UPDATE posts SET category_id=$1,title=$2,slug=$3,summary=$4,status=$5,content_json=$6,content_html=$7,published_at=COALESCE(published_at,$8)
			WHERE id=$9 AND user_id=$10`, req.CategoryID, req.Title, req.Slug, req.Summary, status, req.ContentJSON, cleanHTML, publishedAt, postID, userID)
		if execErr != nil {
			err = execErr
		} else if tag.RowsAffected() == 0 {
			err = fmt.Errorf("post not found")
		}
	}
	if err != nil {
		return models.Post{}, err
	}
	if _, err := tx.Exec(c, `DELETE FROM post_tags WHERE post_id=$1`, id); err != nil {
		return models.Post{}, err
	}
	for _, tagID := range req.TagIDs {
		if _, err := tx.Exec(c, `INSERT INTO post_tags (post_id, tag_id) SELECT $1, id FROM tags WHERE id=$2 AND user_id=$3 ON CONFLICT DO NOTHING`, id, tagID, userID); err != nil {
			return models.Post{}, err
		}
	}
	jsonKey := storage.ArticleKey(userID, id, "json")
	htmlKey := storage.ArticleKey(userID, id, "html")
	if _, err := tx.Exec(c, `UPDATE posts SET oss_json_key=$1, oss_html_key=$2 WHERE id=$3`, jsonKey, htmlKey, id); err != nil {
		return models.Post{}, err
	}
	if err := h.store.Put(c, jsonKey, "application/json", req.ContentJSON); err != nil {
		return models.Post{}, err
	}
	if err := h.store.Put(c, htmlKey, "text/html; charset=utf-8", []byte(cleanHTML)); err != nil {
		return models.Post{}, err
	}
	if err := tx.Commit(c); err != nil {
		return models.Post{}, err
	}
	return h.fetchPost(c, id)
}

func (h *Handler) fetchPost(c *gin.Context, id int64) (models.Post, error) {
	var post models.Post
	err := h.db.QueryRow(c, `
		SELECT id, user_id, category_id, title, slug, summary, status, content_json, content_html, oss_json_key, oss_html_key, view_count, published_at, created_at, updated_at
		FROM posts WHERE id=$1`, id).
		Scan(&post.ID, &post.UserID, &post.CategoryID, &post.Title, &post.Slug, &post.Summary, &post.Status, &post.ContentJSON, &post.ContentHTML, &post.OSSJSONKey, &post.OSSHTMLKey, &post.ViewCount, &post.PublishedAt, &post.CreatedAt, &post.UpdatedAt)
	if err != nil {
		return post, err
	}
	rows, err := h.db.Query(c, `SELECT t.id,t.user_id,t.name,t.slug,t.created_at FROM tags t JOIN post_tags pt ON pt.tag_id=t.id WHERE pt.post_id=$1 ORDER BY t.name`, id)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var tag models.Tag
			_ = rows.Scan(&tag.ID, &tag.UserID, &tag.Name, &tag.Slug, &tag.CreatedAt)
			post.Tags = append(post.Tags, tag)
		}
	}
	return post, nil
}

func isValidPostStatus(status string) bool {
	switch status {
	case "draft", "published", "archived":
		return true
	default:
		return false
	}
}

func scanPosts(rows pgx.Rows) []models.Post {
	var posts []models.Post
	for rows.Next() {
		var p models.Post
		_ = rows.Scan(&p.ID, &p.UserID, &p.CategoryID, &p.Title, &p.Slug, &p.Summary, &p.Status, &p.ContentHTML, &p.OSSJSONKey, &p.OSSHTMLKey, &p.ViewCount, &p.PublishedAt, &p.CreatedAt, &p.UpdatedAt)
		posts = append(posts, p)
	}
	return posts
}

func intParam(c *gin.Context, name string, fallback int) int {
	value, err := strconv.Atoi(c.DefaultQuery(name, strconv.Itoa(fallback)))
	if err != nil || value < 1 {
		return fallback
	}
	if name == "page_size" && value > 50 {
		return 50
	}
	return value
}

func (h *Handler) canReadPost(c *gin.Context, post models.Post) bool {
	if post.Status == "published" {
		return true
	}
	userID, ok := h.auth.UserID(c)
	return ok && userID == post.UserID
}

func (h *Handler) afterMutation(c *gin.Context, userID int64, postID int64, event string, payload any) {
	if err := h.stats.InvalidatePosts(c, postID); err != nil {
		log.Printf("cache invalidation failed user_id=%d post_id=%d event=%s: %v", userID, postID, event, err)
	}
	h.stats.TouchActivity(c, userID, event, payload)
	h.rebuildStats(c, userID)
}

func (h *Handler) rebuildStats(c *gin.Context, userID int64) {
	counts := map[string]int64{}
	var postCount, categoryCount, tagCount int64
	_ = h.db.QueryRow(c, `SELECT count(*) FROM posts WHERE user_id=$1`, userID).Scan(&postCount)
	_ = h.db.QueryRow(c, `SELECT count(*) FROM categories WHERE user_id=$1`, userID).Scan(&categoryCount)
	_ = h.db.QueryRow(c, `SELECT count(*) FROM tags WHERE user_id=$1`, userID).Scan(&tagCount)
	counts["posts"] = postCount
	counts["categories"] = categoryCount
	counts["tags"] = tagCount
	rows, err := h.db.Query(c, `
		SELECT t.name, count(pt.post_id)::bigint
		FROM tags t LEFT JOIN post_tags pt ON pt.tag_id=t.id
		WHERE t.user_id=$1
		GROUP BY t.name`, userID)
	hotTags := map[string]int64{}
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var name string
			var count int64
			_ = rows.Scan(&name, &count)
			hotTags[strings.TrimSpace(name)] = count
		}
	}
	if err := h.stats.RebuildUser(c, userID, counts, hotTags); err != nil {
		log.Printf("rebuild stats failed user_id=%d: %v", userID, err)
	}
}

func (h *Handler) ProfileStats(c *gin.Context) {
	userID := int64(1)
	if current, ok := h.auth.UserID(c); ok {
		userID = current
	}
	c.Header("Cache-Control", "no-store")
	c.JSON(http.StatusOK, h.stats.Profile(c, userID))
}
