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
	"pg-blog/backend/internal/search"
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
	go search.NewWorker(pool, cfg).Run(context.Background())

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
	api.GET("/posts/:id/related", h.SemanticRelatedPosts)
	api.GET("/posts/:id/series", h.SeriesPosts)
	api.GET("/search", h.Search)
	api.GET("/categories", h.ListCategories)
	api.GET("/tags", h.ListTags)
	api.GET("/series", h.ListSeries)
	api.GET("/stats/profile", h.ProfileStats)

	private := api.Group("")
	private.Use(auth.Require())
	private.GET("/me", h.Me)
	private.GET("/me/posts", h.ListOwnPosts)
	private.POST("/search/reindex", h.ReindexSearch)
	private.POST("/admin/search/reindex", h.ReindexSearch)
	private.GET("/admin/search/jobs", h.SearchJobs)
	private.PUT("/me", h.UpdateMe)
	private.POST("/posts", h.CreatePost)
	private.PUT("/posts/:id", h.UpdatePost)
	private.GET("/posts/:id/revisions", h.ListRevisions)
	private.GET("/posts/:id/export", h.ExportPosts)
	private.GET("/learning-goals", h.ListLearningGoals)
	private.GET("/learning-goals/posts", h.ListLearningPosts)
	private.POST("/posts/:id/learning-goal", h.AddLearningGoal)
	private.DELETE("/posts/:id/learning-goal", h.RemoveLearningGoal)
	private.POST("/posts/:id/learned", h.MarkLearned)

	private.GET("/daily-learning-records", h.ListDailyLearningRecords)

	private.POST("/daily-learning-records", h.CreateDailyLearningRecord)

	private.PUT("/daily-learning-records/:id", h.UpdateDailyLearningRecord)

	private.DELETE("/daily-learning-records/:id", h.DeleteDailyLearningRecord)
	private.POST("/posts/:id/revisions/:revisionID/restore", h.RestoreRevision)
	private.DELETE("/posts/:id", h.DeletePost)
	private.POST("/categories", h.CreateCategory)
	private.PUT("/categories/:id", h.UpdateCategory)
	private.DELETE("/categories/:id", h.DeleteCategory)
	private.POST("/tags", h.CreateTag)
	private.POST("/series", h.CreateSeries)
	private.PUT("/tags/:id", h.UpdateTag)
	private.DELETE("/tags/:id", h.DeleteTag)

	log.Printf("backend listening on %s", cfg.AppAddr)
	if err := r.Run(cfg.AppAddr); err != nil {
		log.Fatal(err)
	}
}
