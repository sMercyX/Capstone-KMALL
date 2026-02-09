package auth

import (
	"errors"

	"github.com/gin-gonic/gin"
)

var ErrNoUserInContext = errors.New("no authenticated user in context")

func CurrentUser(c *gin.Context) (UserClaims, error) {
	v, ok := c.Get("user")
	if !ok {
		return UserClaims{}, ErrNoUserInContext
	}
	claims, ok := v.(UserClaims)
	if !ok {
		return UserClaims{}, ErrNoUserInContext
	}
	return claims, nil
}
