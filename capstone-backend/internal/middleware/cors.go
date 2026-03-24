package middleware

import (
	"github.com/gin-gonic/gin"
	"net/http"
	"strings"
)

func CORSMiddleware(allowedOrigins string) gin.HandlerFunc {
	return func(c *gin.Context) {
		clientOrigin := c.Request.Header.Get("Origin")
		if allowedOrigins == "*" {
			c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		} else if allowedOrigins != "" {
			// Split comma-separated origins
			origins := strings.Split(allowedOrigins, ",")
			allowed := false
			for _, origin := range origins {
				if strings.TrimSpace(origin) == clientOrigin {
					allowed = true
					break
				}
			}

			if allowed {
				c.Writer.Header().Set("Access-Control-Allow-Origin", clientOrigin)
			} else if len(origins) > 0 {
				// Default to first origin if not matched, or verify functionality
				// c.Writer.Header().Set("Access-Control-Allow-Origin", strings.TrimSpace(origins[0]))
			}
		} else {
             // Fallback for local dev if empty (or keep it strict)
             c.Writer.Header().Set("Access-Control-Allow-Origin", "http://localhost:5173")
        }
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, uid, email, name, X-Dev-User")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, PATCH, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
