package middleware

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
)

func RequestTimeout(d time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), d)
		defer cancel()

		c.Request = c.Request.WithContext(ctx)

		c.Next()

		if ctx.Err() != nil && !c.Writer.Written() {
			_ = c.Error(apperr.New(apperr.Timeout)) 
			c.Abort()
		}
	}
}
