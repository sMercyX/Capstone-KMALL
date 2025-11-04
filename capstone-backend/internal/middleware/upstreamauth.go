package middleware

import (
	"net/http"
	"strings"

	jwtutil "github.com/Perpasit/Capstone-KMALL/internal/auth/jwt"
	"github.com/gin-gonic/gin"
)

type UpstreamUser struct {
	UID   string
	Email string
	Name  string
}

const CtxUpstreamUser = "kmall_upstream_user"

func UpstreamAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		email := lowerTrimOneOf(
			c.GetHeader("X-Auth-Request-Email"),
			c.GetHeader("X-Auth-Request-Preferred-Username"),
			c.GetHeader("X-Forwarded-Email"),
		)

		uid := strings.TrimSpace(c.GetHeader("X-Auth-Request-Oid"))
		if uid == "" {
			uid = strings.TrimSpace(c.GetHeader("X-Forwarded-User"))
		}
		if uid == "" {
			uid = email
		}

		name := strings.TrimSpace(c.GetHeader("X-Auth-Request-Name"))
		if name == "" {
			given := strings.TrimSpace(c.GetHeader("X-Auth-Request-Given-Name"))
			family := strings.TrimSpace(c.GetHeader("X-Auth-Request-Family-Name"))
			switch {
			case given != "" && family != "":
				name = given + " " + family
			case given != "":
				name = given
			case family != "":
				name = family
			}
		}

		if name == "" {
			if claims, err := jwtutil.DecodePayloadMap(c.GetHeader("Authorization")); err == nil && claims != nil {
				if v, ok := claims["name"].(string); ok && v != "" {
					name = v
				}

				if uid == "" {
					if v, ok := claims["oid"].(string); ok && v != "" {
						uid = v
					}
				}
			}
		}

		if name == "" {
			name = uid
		}

		if email == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error": gin.H{
					"status":  "error",
					"code":    http.StatusUnauthorized,
					"message": "Unauthorized access.",
				},
			})
			return
		}

		c.Set(CtxUpstreamUser, &UpstreamUser{
			UID:   uid,
			Email: email,
			Name:  name,
		})
		c.Next()
	}
}

func lowerTrimOneOf(values ...string) string {
	for _, v := range values {
		if s := strings.ToLower(strings.TrimSpace(v)); s != "" {
			return s
		}
	}
	return ""
}
