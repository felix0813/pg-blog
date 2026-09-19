package models

import (
	"encoding/json"
	"time"
)

type User struct {
	ID          int64     `json:"id"`
	Username    string    `json:"username"`
	Email       string    `json:"email"`
	DisplayName string    `json:"display_name"`
	Bio         string    `json:"bio"`
	AvatarURL   string    `json:"avatar_url"`
	CreatedAt   time.Time `json:"created_at"`
}

type Category struct {
	ID          int64     `json:"id"`
	UserID      int64     `json:"user_id"`
	Name        string    `json:"name"`
	Slug        string    `json:"slug"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}

type Tag struct {
	ID        int64     `json:"id"`
	UserID    int64     `json:"user_id"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"`
	PostCount int64     `json:"post_count,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

type Series struct {
	ID          int64     `json:"id"`
	UserID      int64     `json:"user_id"`
	Title       string    `json:"title"`
	Slug        string    `json:"slug"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}

type SeriesPost struct {
	ID       int64  `json:"id"`
	Title    string `json:"title"`
	Slug     string `json:"slug"`
	Summary  string `json:"summary"`
	Status   string `json:"status"`
	Position int    `json:"position"`
}

type PostRevision struct {
	ID                     int64     `json:"id"`
	RevisionNumber         int       `json:"revision_number"`
	Title                  string    `json:"title"`
	Status                 string    `json:"status"`
	RevisionType           string    `json:"revision_type"`
	RestoredFromRevisionID *int64    `json:"restored_from_revision_id"`
	CreatedAt              time.Time `json:"created_at"`
}

type LearningGoal struct {
	PostID        int64      `json:"post_id"`
	LastLearnedAt *time.Time `json:"last_learned_at"`
}

type Post struct {
	ID             int64           `json:"id"`
	UserID         int64           `json:"user_id"`
	CategoryID     *int64          `json:"category_id"`
	SeriesID       *int64          `json:"series_id"`
	SeriesPosition int             `json:"series_position"`
	Title          string          `json:"title"`
	Slug           string          `json:"slug"`
	Summary        string          `json:"summary"`
	Status         string          `json:"status"`
	ContentJSON    json.RawMessage `json:"content_json,omitempty"`
	ContentHTML    string          `json:"content_html"`
	OSSJSONKey     string          `json:"oss_json_key"`
	OSSHTMLKey     string          `json:"oss_html_key"`
	ViewCount      int64           `json:"view_count"`
	PublishedAt    *time.Time      `json:"published_at"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
	Category       *Category       `json:"category,omitempty"`
	Series         *Series         `json:"series,omitempty"`
	Tags           []Tag           `json:"tags"`
	IsLearningGoal bool            `json:"is_learning_goal,omitempty"`
	LastLearnedAt  *time.Time      `json:"last_learned_at,omitempty"`
}
