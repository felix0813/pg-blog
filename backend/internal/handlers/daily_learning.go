package handlers

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"pg-blog/backend/internal/middleware"
	"pg-blog/backend/internal/models"

	"github.com/gin-gonic/gin"
)

type dailyLearningRequest struct {
	Content string   `json:"content"`
	URLs    []string `json:"urls"`
}

func normalizeLearningRecord(req dailyLearningRequest) (dailyLearningRequest, string) {
	req.Content = strings.TrimSpace(req.Content)
	if req.Content == "" {
		return req, "学习内容不能为空"
	}
	urls := make([]string, 0, len(req.URLs))
	for _, raw := range req.URLs {
		raw = strings.TrimSpace(raw)
		if raw == "" {
			continue
		}
		parsed, err := url.ParseRequestURI(raw)
		if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
			return req, "链接必须是有效的 http 或 https URL"
		}
		urls = append(urls, raw)
	}
	req.URLs = urls
	return req, ""
}

func scanDailyLearningRecord(scan func(...any) error) (models.DailyLearningRecord, error) {
	var item models.DailyLearningRecord
	var rawURLs []byte
	err := scan(&item.ID, &item.Content, &rawURLs, &item.StudyDate, &item.CreatedAt, &item.UpdatedAt)
	if err == nil {
		err = json.Unmarshal(rawURLs, &item.URLs)
	}
	return item, err
}

func (h *Handler) ListDailyLearningRecords(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	days := 30
	if value := c.Query("days"); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil && parsed > 0 && parsed <= 90 {
			days = parsed
		}
	}
	rows, err := h.db.Query(c, `SELECT id, content, urls, study_date, created_at, updated_at FROM daily_learning_records WHERE user_id=$1 AND study_date >= CURRENT_DATE - ($2 - 1) ORDER BY study_date DESC, created_at ASC`, userID, days)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "加载每日学习记录失败"})
		return
	}
	defer rows.Close()
	items := []models.DailyLearningRecord{}
	for rows.Next() {
		item, err := scanDailyLearningRecord(rows.Scan)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "读取每日学习记录失败"})
			return
		}
		items = append(items, item)
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (h *Handler) CreateDailyLearningRecord(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var req dailyLearningRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求数据格式不正确"})
		return
	}
	req, message := normalizeLearningRecord(req)
	if message != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": message})
		return
	}
	rawURLs, _ := json.Marshal(req.URLs)
	item, err := scanDailyLearningRecord(h.db.QueryRow(c, `INSERT INTO daily_learning_records (user_id, content, urls) VALUES ($1, $2, $3::jsonb) RETURNING id, content, urls, study_date, created_at, updated_at`, userID, req.Content, rawURLs).Scan)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "新增每日学习记录失败"})
		return
	}
	c.JSON(http.StatusCreated, item)
}

func (h *Handler) UpdateDailyLearningRecord(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "记录编号不正确"})
		return
	}
	var req dailyLearningRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求数据格式不正确"})
		return
	}
	req, message := normalizeLearningRecord(req)
	if message != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": message})
		return
	}
	rawURLs, _ := json.Marshal(req.URLs)
	item, err := scanDailyLearningRecord(h.db.QueryRow(c, `UPDATE daily_learning_records SET content=$1, urls=$2::jsonb WHERE id=$3 AND user_id=$4 AND study_date=CURRENT_DATE RETURNING id, content, urls, study_date, created_at, updated_at`, req.Content, rawURLs, id, userID).Scan)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "仅能编辑当天的学习记录"})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *Handler) DeleteDailyLearningRecord(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "记录编号不正确"})
		return
	}
	tag, err := h.db.Exec(c, `DELETE FROM daily_learning_records WHERE id=$1 AND user_id=$2 AND study_date=CURRENT_DATE`, id, userID)
	if err != nil || tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "仅能删除当天的学习记录"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
