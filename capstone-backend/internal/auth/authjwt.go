// package middleware

// import (
// 	"net/http"
// 	"strings"

// 	"github.com/gin-gonic/gin"

// 	appjwt "github.com/Perpasit/Capstone-KMALL/internal/auth/jwt"
// )

// const CtxClaimsKey = "kmall_user_claims"

// func AuthJWT(signer *appjwt.Signer) gin.HandlerFunc {
// 	return func(c *gin.Context) {
// 		h := c.GetHeader("Authorization")
// 		if !strings.HasPrefix(strings.ToLower(h), "bearer ") {
// 			c.AbortWithStatus(http.StatusUnauthorized)
// 			return
// 		}
// 		raw := strings.TrimSpace(h[7:])
// 		claims, err := signer.ParseAccess(raw)
// 		if err != nil {
// 			c.AbortWithStatus(http.StatusUnauthorized)
// 			return
// 		}
// 		c.Set(CtxClaimsKey, claims)
// 		c.Next()
// 	}
// }
