package middleware

import (
	"github.com/gin-gonic/gin"
	"net/http"
)

func CORSMiddleware(allowedOrigins string) gin.HandlerFunc {
	return func(c *gin.Context) {
		clientOrigin := c.Request.Header.Get("Origin")
		if allowedOrigins == "*" {
			c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		} else if allowedOrigins != "" {
			c.Writer.Header().Set("Access-Control-Allow-Origin", allowedOrigins)
			// ถ้าจะรองรับหลาย origin ต้อง parse string แล้ว check ว่า clientOrigin อยู่ใน list ไหม
			// แต่ง่ายๆ คือถ้าตรงกับที่ config ไว้ก็ให้ผ่าน
			if clientOrigin == allowedOrigins {
				c.Writer.Header().Set("Access-Control-Allow-Origin", clientOrigin)
			}
		} else {
             // Fallback for local dev if empty (or keep it strict)
             c.Writer.Header().Set("Access-Control-Allow-Origin", "http://localhost:5173")
        }
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, uid, email, name")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
