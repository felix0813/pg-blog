package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"pg-blog/backend/internal/config"

	"github.com/redis/go-redis/v9"
)

func NewRedis(cfg config.Config) *redis.Client {
	return redis.NewClient(&redis.Options{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
		DB:       cfg.RedisDB,
	})
}

type Stats struct {
	rdb *redis.Client
}

func NewStats(rdb *redis.Client) *Stats {
	return &Stats{rdb: rdb}
}

func (s *Stats) RebuildUser(ctx context.Context, userID int64, counts map[string]int64, hotTags map[string]int64) error {
	pipe := s.rdb.Pipeline()
	pipe.Set(ctx, fmt.Sprintf("user:%d:post_count", userID), counts["posts"], 0)
	pipe.Set(ctx, fmt.Sprintf("user:%d:category_count", userID), counts["categories"], 0)
	pipe.Set(ctx, fmt.Sprintf("user:%d:tag_count", userID), counts["tags"], 0)
	tagKey := fmt.Sprintf("user:%d:hot_tags", userID)
	pipe.Del(ctx, tagKey)
	for tag, count := range hotTags {
		pipe.ZAdd(ctx, tagKey, redis.Z{Member: tag, Score: float64(count)})
	}
	_, err := pipe.Exec(ctx)
	return err
}

func (s *Stats) TouchActivity(ctx context.Context, userID int64, event string, payload any) {
	body, _ := json.Marshal(map[string]any{
		"event": event,
		"data":  payload,
		"at":    time.Now().Format(time.RFC3339),
	})
	key := fmt.Sprintf("user:%d:activity", userID)
	pipe := s.rdb.Pipeline()
	pipe.LPush(ctx, key, body)
	pipe.LTrim(ctx, key, 0, 19)
	pipe.Publish(ctx, "events:blog", body)
	_, _ = pipe.Exec(ctx)
}

func (s *Stats) IncrView(ctx context.Context, postID int64) {
	_ = s.rdb.Incr(ctx, fmt.Sprintf("post:%d:view_count", postID)).Err()
}

func (s *Stats) CacheSetJSON(ctx context.Context, key string, value any) {
	body, err := json.Marshal(value)
	if err == nil {
		_ = s.rdb.Set(ctx, key, body, 0).Err()
	}
}

func (s *Stats) CacheGetJSON(ctx context.Context, key string, value any) bool {
	body, err := s.rdb.Get(ctx, key).Bytes()
	if err != nil {
		return false
	}
	return json.Unmarshal(body, value) == nil
}

func (s *Stats) InvalidatePosts(ctx context.Context, postID int64) error {
	iter := s.rdb.Scan(ctx, 0, "cache:posts:*", 100).Iterator()
	for iter.Next(ctx) {
		if err := s.rdb.Del(ctx, iter.Val()).Err(); err != nil {
			return err
		}
	}
	if err := iter.Err(); err != nil {
		return err
	}
	if postID > 0 {
		if err := s.rdb.Del(ctx, fmt.Sprintf("cache:post:%d", postID)).Err(); err != nil {
			return err
		}
		return nil
	}
	detailIter := s.rdb.Scan(ctx, 0, "cache:post:*", 100).Iterator()
	for detailIter.Next(ctx) {
		if err := s.rdb.Del(ctx, detailIter.Val()).Err(); err != nil {
			return err
		}
	}
	if err := detailIter.Err(); err != nil {
		return err
	}
	return nil
}

func (s *Stats) Profile(ctx context.Context, userID int64) map[string]any {
	postCount, _ := s.rdb.Get(ctx, fmt.Sprintf("user:%d:post_count", userID)).Int64()
	categoryCount, _ := s.rdb.Get(ctx, fmt.Sprintf("user:%d:category_count", userID)).Int64()
	tagCount, _ := s.rdb.Get(ctx, fmt.Sprintf("user:%d:tag_count", userID)).Int64()
	hotTags, _ := s.rdb.ZRevRangeWithScores(ctx, fmt.Sprintf("user:%d:hot_tags", userID), 0, 9).Result()
	activity, _ := s.rdb.LRange(ctx, fmt.Sprintf("user:%d:activity", userID), 0, 9).Result()
	return map[string]any{
		"post_count":      postCount,
		"category_count":  categoryCount,
		"tag_count":       tagCount,
		"hot_tags":        hotTags,
		"recent_activity": activity,
	}
}
