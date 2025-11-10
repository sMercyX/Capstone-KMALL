package middleware

import (
	"context"
	"net/http"

	"github.com/Perpasit/Capstone-KMALL/internal/respond"
	"github.com/gin-gonic/gin"
)

const CtxUserID = "ctx_user_id"

type UpsertFunc func(ctx context.Context, msOID, email, name string) (string, error)

func EnsureUser(upsert UpsertFunc) gin.HandlerFunc {
	return func(c *gin.Context) {
		up, ok := c.Get(CtxUpstreamUser)
		if !ok || up == nil {
			respond.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "missing upstream user", nil)
			c.Abort()
			return
		}
		uu := up.(*UpstreamUser)

		uid, err := upsert(c.Request.Context(), uu.UID, uu.Email, uu.Name)
		if err != nil {
			respond.Error(c, http.StatusInternalServerError, "INTERNAL", err.Error(), nil)
			c.Abort()
			return
		}
		c.Set(CtxUserID, uid)
		c.Next()
	}
}
