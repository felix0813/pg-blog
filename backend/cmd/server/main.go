package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"pg-blog/backend/internal/cache"
	"pg-blog/backend/internal/config"
	"pg-blog/backend/internal/db"
	"pg-blog/backend/internal/handlers"
	"pg-blog/backend/internal/middleware"
	"pg-blog/backend/internal/storage"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()
	ctx := context.Background()

	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()

	redisClient := cache.NewRedis(cfg)
	ossStore, err := storage.NewOSS(cfg)
	if err != nil {
		log.Fatal(err)
	}

	stats := cache.NewStats(redisClient)
	auth := middleware.NewAuth(cfg)
	h := handlers.New(pool, stats, ossStore, auth)

	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{cfg.FrontendOrigin},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	r.GET("/healthz", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"ok": true}) })
	r.POST("/register", h.Register)
	r.POST("/login", h.Login)
	r.POST("/logout", h.Logout)

	api := r.Group("/api")
	api.GET("/posts", h.ListPosts)
	api.GET("/posts/:id", h.GetPost)
	api.GET("/categories", h.ListCategories)
	api.GET("/tags", h.ListTags)
	api.GET("/stats/profile", h.ProfileStats)

	private := api.Group("")
	private.Use(auth.Require())
	private.POST("/posts", h.CreatePost)
	private.PUT("/posts/:id", h.UpdatePost)
	private.DELETE("/posts/:id", h.DeletePost)
	private.POST("/categories", h.CreateCategory)
	private.PUT("/categories/:id", h.UpdateCategory)
	private.DELETE("/categories/:id", h.DeleteCategory)
	private.POST("/tags", h.CreateTag)
	private.PUT("/tags/:id", h.UpdateTag)
	private.DELETE("/tags/:id", h.DeleteTag)

	log.Printf("backend listening on %s", cfg.AppAddr)
	if err := r.Run(cfg.AppAddr); err != nil {
		log.Fatal(err)
	}
}
