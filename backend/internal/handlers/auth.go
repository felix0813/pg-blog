/*
 * @Author: felix 1306332027@qq.com
 * @Date: 2026-05-31 12:03:12
 * @LastEditors: felix 1306332027@qq.com
 * @LastEditTime: 2026-05-31 13:11:41
 * @FilePath: \pg-blog\backend\internal\handlers\auth.go
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
package handlers

import (
	"log"
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
		log.Printf("Register bind error: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	log.Printf("Register attempt for user: %s", req.Username)

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("Password hash failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "password hash failed"})
		return
	}

	var user models.User
	err = h.db.QueryRow(c, `
		INSERT INTO users (username, email, password_hash, display_name)
		VALUES ($1::citext, $2::citext, $3, $1)
		RETURNING id, username, email, display_name, bio, avatar_url, created_at`,
		req.Username, req.Email, string(hash),
	).Scan(&user.ID, &user.Username, &user.Email, &user.DisplayName, &user.Bio, &user.AvatarURL, &user.CreatedAt)
	if err != nil {
		log.Printf("User registration failed: %v", err)
		c.JSON(http.StatusConflict, gin.H{"error": "username or email already exists"})
		return
	}

	if err := h.auth.Issue(c, user.ID); err != nil {
		log.Printf("Token issue failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token issue failed"})
		return
	}

	log.Printf("User registered successfully: %s", req.Username)
	c.JSON(http.StatusCreated, gin.H{"user": user})
}

func (h *Handler) Login(c *gin.Context) {
	var req authRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("Login bind error: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	log.Printf("Login attempt for user: %s", req.Username)

	var user models.User
	var hash string
	err := h.db.QueryRow(c, `
		SELECT id, username, email, password_hash, display_name, bio, avatar_url, created_at
		FROM users WHERE username=$1::citext`,
		req.Username,
	).Scan(&user.ID, &user.Username, &user.Email, &hash, &user.DisplayName, &user.Bio, &user.AvatarURL, &user.CreatedAt)
	if err != nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)) != nil {
		log.Printf("Invalid login credentials for user: %s", req.Username)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid username or password"})
		return
	}

	if err := h.auth.Issue(c, user.ID); err != nil {
		log.Printf("Token issue failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token issue failed"})
		return
	}

	log.Printf("User logged in successfully: %s", req.Username)
	c.JSON(http.StatusOK, gin.H{"user": user})
}

func (h *Handler) Logout(c *gin.Context) {
	log.Println("Logout initiated")
	h.auth.Clear(c)
	log.Println("User logged out successfully")
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
