// internal/middleware/oidc_user.go
package middleware

import (
	"net/http"
	"strings"

	"github.com/Perpasit/Capstone-KMALL/internal/auth"
	"github.com/gin-gonic/gin"
)

type UpstreamUser struct {
	UID   string
	Email string
	Name  string
}

const CtxUpstreamUser = "kmall_upstream_user"

func OIDCUser() gin.HandlerFunc {
	return func(c *gin.Context) {
		claims := auth.GetOIDCClaims(c)
		if claims == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error": gin.H{
					"status":  "error",
					"code":    http.StatusUnauthorized,
					"message": "Unauthorized (no OIDC claims).",
				},
			})
			return
		}

		// email: ไล่จาก preferred_username -> email -> emails[0]
		email := strings.ToLower(strings.TrimSpace(firstNonEmpty(
			claims.PreferredUsername,
			claims.Email,
			firstEmail(claims.Emails),
		)))

		uid := strings.TrimSpace(firstNonEmpty(
			claims.OID,
			claims.Sub,
			email,
		))

		name := strings.TrimSpace(firstNonEmpty(
			claims.Name,
			email,
			uid,
		))

		if email == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error": gin.H{
					"status":  "error",
					"code":    http.StatusUnauthorized,
					"message": "Unauthorized (no email in token).",
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

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if s := strings.TrimSpace(v); s != "" {
			return s
		}
	}
	return ""
}

func firstEmail(list []string) string {
	if len(list) == 0 {
		return ""
	}
	return list[0]
}

func DevMockUser() gin.HandlerFunc {
	return func(c *gin.Context) {
		// header มาก่อน
		mode := strings.ToLower(strings.TrimSpace(c.GetHeader("X-Dev-User")))

		if mode == "" {
			mode = strings.ToLower(strings.TrimSpace(c.Query("dev_user")))
		}
		if mode == "" {
			mode = strings.ToLower(strings.TrimSpace(c.Query("devUser")))
		}

		if mode == "" {
			mode = "seller" // default
		}

		var u *UpstreamUser
		switch mode {
		case "buyer":
			u = &UpstreamUser{UID: "dev-buyer-1", Email: "buyer1@example.com", Name: "Dev Buyer 1"}
		case "admin":
			u = &UpstreamUser{UID: "dev-admin-1", Email: "admin1@example.com", Name: "Dev Admin 1"}
		default:
			u = &UpstreamUser{UID: "dev-seller-1", Email: "seller1@example.com", Name: "Dev Seller 1"}
		}

		c.Set(CtxUpstreamUser, u)
		c.Next()
	}
}
