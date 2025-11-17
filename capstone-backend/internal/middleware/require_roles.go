package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/Perpasit/Capstone-KMALL/internal/respond"
)

type RoleNameLister interface {
	ListNamesByUserID(ctx context.Context, userID string) ([]string, error)
}

func RequireRolesAny(roleSvc RoleNameLister, roles ...string) gin.HandlerFunc {
	need := make(map[string]struct{}, len(roles))
	for _, r := range roles {
		r = strings.ToLower(strings.TrimSpace(r))
		if r != "" {
			need[r] = struct{}{}
		}
	}

	return func(c *gin.Context) {
		if len(need) == 0 {
			respond.Error(c, http.StatusInternalServerError, "INTERNAL", "no roles configured for this route", nil)
			c.Abort()
			return
		}

		up, ok := c.Get(CtxUpstreamUser)
		if !ok || up == nil {
			respond.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "missing upstream user", nil)
			c.Abort()
			return
		}
		uid := up.(*UpstreamUser).UID

		names, err := roleSvc.ListNamesByUserID(c.Request.Context(), uid)
		if err != nil {
			c.Error(err)
			c.Abort()
			return
		}

		have := make(map[string]struct{}, len(names))
		for _, n := range names {
			norm := strings.ToLower(strings.TrimSpace(n))
			if norm != "" {
				have[norm] = struct{}{}
			}
		}

		for want := range need {
			if _, ok := have[want]; ok {
				c.Set("roles", names)
				c.Next()
				return
			}
		}

		respond.Error(c, http.StatusForbidden, "FORBIDDEN", "insufficient role", nil)
		c.Abort()
	}
}
