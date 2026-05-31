package middleware

import (
	"net/http"
	"strconv"
	"time"

	"pg-blog/backend/internal/config"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type Auth struct {
	cfg config.Config
}

type Claims struct {
	UserID int64 `json:"user_id"`
	jwt.RegisteredClaims
}

func NewAuth(cfg config.Config) *Auth {
	return &Auth{cfg: cfg}
}

func (a *Auth) Issue(c *gin.Context, userID int64) error {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, Claims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   strconv.FormatInt(userID, 10),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	})
	signed, err := token.SignedString([]byte(a.cfg.JWTSecret))
	if err != nil {
		return err
	}
	c.SetSameSite(sameSite(a.cfg.CookieSameSite))
	c.SetCookie(a.cfg.CookieName, signed, 30*24*3600, "/", a.cfg.CookieDomain, a.cfg.CookieSecure, true)
	return nil
}

func (a *Auth) Clear(c *gin.Context) {
	c.SetSameSite(sameSite(a.cfg.CookieSameSite))
	c.SetCookie(a.cfg.CookieName, "", -1, "/", a.cfg.CookieDomain, a.cfg.CookieSecure, true)
}

func (a *Auth) Require() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := a.UserID(c)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		c.Set("user_id", userID)
		c.Next()
	}
}

func (a *Auth) UserID(c *gin.Context) (int64, bool) {
	raw, err := c.Cookie(a.cfg.CookieName)
	if err != nil || raw == "" {
		return 0, false
	}
	token, err := jwt.ParseWithClaims(raw, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(a.cfg.JWTSecret), nil
	})
	if err != nil || !token.Valid {
		return 0, false
	}
	claims, ok := token.Claims.(*Claims)
	return claims.UserID, ok && claims.UserID > 0
}

func CurrentUserID(c *gin.Context) int64 {
	value, _ := c.Get("user_id")
	userID, _ := value.(int64)
	return userID
}

func sameSite(value string) http.SameSite {
	switch value {
	case "Strict":
		return http.SameSiteStrictMode
	case "None":
		return http.SameSiteNoneMode
	default:
		return http.SameSiteLaxMode
	}
}
