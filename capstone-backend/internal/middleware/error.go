package middleware

import (
	"github.com/gin-gonic/gin"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
	respond "github.com/Perpasit/Capstone-KMALL/internal/respond"
)

func ErrorHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		if len(c.Errors) == 0 {
			return
		}
		
		last := c.Errors.Last().Err
		ae := apperr.From(last)

		if c.Writer.Written() {
			return
		}
		status := apperr.HTTPStatus(ae.Code)
		respond.Error(c, status, string(ae.Code), ae.Msg, ae.Fields)
		c.Abort()
	}
}
