package handlers

import (
	"net/http"

	"pg-blog/backend/internal/models"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

type authRequest struct {
	Username string `json:"username" binding:"required"`
	Email    string `json:"email"`
	Password string `json:"password" binding:"required,min=8"`
}

func (h *Handler) Register(c *gin.Context) {
	var req authRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
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
		c.JSON(http.StatusConflict, gin.H{"error": "username or email already exists"})
		return
	}
	if err := h.auth.Issue(c, user.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token issue failed"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"user": user})
}

func (h *Handler) Login(c *gin.Context) {
	var req authRequest
	if err := c.ShouldBindJSON(&req); err != nil {
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
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid username or password"})
		return
	}
	if err := h.auth.Issue(c, user.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token issue failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": user})
}

func (h *Handler) Logout(c *gin.Context) {
	h.auth.Clear(c)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
