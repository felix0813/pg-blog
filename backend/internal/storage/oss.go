package storage

import (
	"bytes"
	"context"
	"fmt"
	"path"

	"pg-blog/backend/internal/config"

	"github.com/aliyun/aliyun-oss-go-sdk/oss"
)

type Store interface {
	Put(ctx context.Context, key string, contentType string, body []byte) error
}

type noopStore struct{}

func (noopStore) Put(context.Context, string, string, []byte) error { return nil }

type ossStore struct {
	prefix string
	bucket *oss.Bucket
}

func NewOSS(cfg config.Config) (Store, error) {
	if !cfg.OSSEnabled {
		return noopStore{}, nil
	}
	client, err := oss.New(cfg.OSSEndpoint, cfg.OSSAccessKeyID, cfg.OSSAccessKeySecret)
	if err != nil {
		return nil, err
	}
	bucket, err := client.Bucket(cfg.OSSBucket)
	if err != nil {
		return nil, err
	}
	return &ossStore{prefix: cfg.OSSPrefix, bucket: bucket}, nil
}

func (s *ossStore) Put(ctx context.Context, key string, contentType string, body []byte) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}
	objectKey := path.Join(s.prefix, key)
	return s.bucket.PutObject(objectKey, bytes.NewReader(body), oss.ContentType(contentType))
}

func ArticleKey(userID int64, postID int64, ext string) string {
	return fmt.Sprintf("users/%d/posts/%d/content.%s", userID, postID, ext)
}
