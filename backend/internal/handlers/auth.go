package handlers

import (
	"log"
	"net/http"
	"strings"

	"pg-blog/backend/internal/middleware"
	"pg-blog/backend/internal/models"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

type authRequest struct {
	Username string `json:"username" binding:"required"`
	Email    string `json:"email"`
	Password string `json:"password" binding:"required,min=8"`
}

type profileRequest struct {
	DisplayName string `json:"display_name"`
	Bio         string `json:"bio"`
	AvatarURL   string `json:"avatar_url"`
}

func (h *Handler) Register(c *gin.Context) {
	var req authRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("register bind failed: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("register password hash failed for username=%q: %v", req.Username, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "password hash failed"})
		return
	}
	var user models.User
	err = h.db.QueryRow(c, `
		INSERT INTO users (username, email, password_hash, display_name)
		VALUES ($1, $2, $3, $1)
		RETURNING id, username, email, display_name, bio, avatar_url, created_at`,
		req.Username, req.Email, string(hash),
	).Scan(&user.ID, &user.Username, &user.Email, &user.DisplayName, &user.Bio, &user.AvatarURL, &user.CreatedAt)
	if err != nil {
		log.Printf("register insert failed for username=%q email=%q: %v", req.Username, req.Email, err)
		c.JSON(http.StatusConflict, gin.H{"error": "username or email already exists"})
		return
	}
	if err := h.auth.Issue(c, user.ID); err != nil {
		log.Printf("register issue token failed for user_id=%d: %v", user.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token issue failed"})
		return
	}
	log.Printf("user registered user_id=%d username=%q", user.ID, user.Username)
	c.JSON(http.StatusCreated, gin.H{"user": user})
}

func (h *Handler) Login(c *gin.Context) {
	var req authRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("login bind failed: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var user models.User
	var hash string
	err := h.db.QueryRow(c, `
		SELECT id, username, email, password_hash, display_name, bio, avatar_url, created_at
		FROM users WHERE username=$1`,
		req.Username,
	).Scan(&user.ID, &user.Username, &user.Email, &hash, &user.DisplayName, &user.Bio, &user.AvatarURL, &user.CreatedAt)
	if err != nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)) != nil {
		log.Printf("login rejected for username=%q", req.Username)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid username or password"})
		return
	}
	if err := h.auth.Issue(c, user.ID); err != nil {
		log.Printf("login issue token failed for user_id=%d: %v", user.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token issue failed"})
		return
	}
	log.Printf("user logged in user_id=%d username=%q", user.ID, user.Username)
	c.JSON(http.StatusOK, gin.H{"user": user})
}

func (h *Handler) Logout(c *gin.Context) {
	h.auth.Clear(c)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) Me(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	user, err := h.fetchUser(c, userID)
	if err != nil {
		log.Printf("fetch current user failed user_id=%d: %v", userID, err)
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.Header("Cache-Control", "no-store")
	c.JSON(http.StatusOK, gin.H{"user": user})
}

func (h *Handler) UpdateMe(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var req profileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("update profile bind failed user_id=%d: %v", userID, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	displayName := strings.TrimSpace(req.DisplayName)
	bio := strings.TrimSpace(req.Bio)
	avatarURL := strings.TrimSpace(req.AvatarURL)
	var user models.User
	err := h.db.QueryRow(c, `
		UPDATE users SET display_name=$1, bio=$2, avatar_url=$3
		WHERE id=$4
		RETURNING id, username, email, display_name, bio, avatar_url, created_at`, displayName, bio, avatarURL, userID).
		Scan(&user.ID, &user.Username, &user.Email, &user.DisplayName, &user.Bio, &user.AvatarURL, &user.CreatedAt)
	if err != nil {
		log.Printf("update profile failed user_id=%d: %v", userID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "update profile failed"})
		return
	}
	h.stats.TouchActivity(c, userID, "profile.updated", gin.H{"id": userID})
	log.Printf("profile updated user_id=%d", userID)
	c.Header("Cache-Control", "no-store")
	c.JSON(http.StatusOK, gin.H{"user": user})
}

func (h *Handler) fetchUser(c *gin.Context, userID int64) (models.User, error) {
	var user models.User
	err := h.db.QueryRow(c, `
		SELECT id, username, email, display_name, bio, avatar_url, created_at
		FROM users WHERE id=$1`, userID).
		Scan(&user.ID, &user.Username, &user.Email, &user.DisplayName, &user.Bio, &user.AvatarURL, &user.CreatedAt)
	return user, err
}
