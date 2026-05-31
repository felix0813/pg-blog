package config

import (
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	AppAddr            string
	FrontendOrigin     string
	DatabaseURL        string
	RedisAddr          string
	RedisPassword      string
	RedisDB            int
	JWTSecret          string
	CookieName         string
	CookieDomain       string
	CookieSecure       bool
	CookieSameSite     string
	OSSEnabled         bool
	OSSEndpoint        string
	OSSBucket          string
	OSSAccessKeyID     string
	OSSAccessKeySecret string
	OSSPrefix          string
}

func Load() Config {
	_ = godotenv.Load("../.env", ".env")
	return Config{
		AppAddr:            env("APP_ADDR", ":8080"),
		FrontendOrigin:     env("FRONTEND_ORIGIN", "http://localhost:5173"),
		DatabaseURL:        env("DATABASE_URL", "postgres://blog:blog_password@localhost:5432/pg_blog?sslmode=disable"),
		RedisAddr:          env("REDIS_ADDR", "localhost:6379"),
		RedisPassword:      env("REDIS_PASSWORD", ""),
		RedisDB:            envInt("REDIS_DB", 0),
		JWTSecret:          env("JWT_SECRET", "dev-secret-change-me"),
		CookieName:         env("COOKIE_NAME", "pg_blog_token"),
		CookieDomain:       env("COOKIE_DOMAIN", ""),
		CookieSecure:       envBool("COOKIE_SECURE", false),
		CookieSameSite:     env("COOKIE_SAME_SITE", "Lax"),
		OSSEnabled:         envBool("OSS_ENABLED", false),
		OSSEndpoint:        env("OSS_ENDPOINT", ""),
		OSSBucket:          env("OSS_BUCKET", ""),
		OSSAccessKeyID:     env("OSS_ACCESS_KEY_ID", ""),
		OSSAccessKeySecret: env("OSS_ACCESS_KEY_SECRET", ""),
		OSSPrefix:          env("OSS_PREFIX", "pg-blog"),
	}
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func envInt(key string, fallback int) int {
	value, err := strconv.Atoi(env(key, ""))
	if err != nil {
		return fallback
	}
	return value
}

func envBool(key string, fallback bool) bool {
	value := env(key, "")
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}
	return parsed
}
