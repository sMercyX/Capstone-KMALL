// internal/auth/oidc.go
package auth

import (
	"context"
	"log"
	"net/http"
	"strings"

	"github.com/Perpasit/Capstone-KMALL/internal/config"
	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/gin-gonic/gin"
)

var verifier *oidc.IDTokenVerifier

// เก็บ claims หลัก ๆ ที่เราจะใช้
type OIDCClaims struct {
	Sub               string   `json:"sub"`
	OID               string   `json:"oid"`
	Name              string   `json:"name"`
	PreferredUsername string   `json:"preferred_username"`
	Email             string   `json:"email"`
	Emails            []string `json:"emails"`
}

const ctxOIDCClaims = "kmall_oidc_claims"

func InitOIDC(cfg config.Config) error {
	provider, err := oidc.NewProvider(context.Background(), cfg.OIDCIssuer)
	if err != nil {
		return err
	}

	verifier = provider.Verifier(&oidc.Config{
		ClientID: cfg.ClientID,
	})

	log.Println("[AUTH] OIDC verifier initialized")
	return nil
}

// ดึง claims จาก context (เผื่อ middleware อื่นอยากใช้)
func GetOIDCClaims(c *gin.Context) *OIDCClaims {
	v, ok := c.Get(ctxOIDCClaims)
	if !ok {
		return nil
	}
	claims, _ := v.(*OIDCClaims)
	return claims
}

// AuthMiddleware: verify Bearer token ด้วย OIDC แล้วเก็บ claims ไว้ใน context
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if verifier == nil {
			log.Println("[AUTH] verifier is nil, did you call InitOIDC ?")
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}

		authz := c.GetHeader("Authorization")
		if authz == "" {
			log.Println("[AUTH] no Authorization header")
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}

		parts := strings.SplitN(authz, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			log.Println("[AUTH] invalid Authorization header:", authz)
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}

		rawToken := parts[1]

		idToken, err := verifier.Verify(c.Request.Context(), rawToken)
		if err != nil {
			log.Println("[AUTH] token verify failed:", err)
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}

		var claims OIDCClaims
		if err := idToken.Claims(&claims); err != nil {
			log.Println("[AUTH] parse OIDC claims failed:", err)
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}

		// debug ไว้ก่อน
		log.Printf("[AUTH] token ok: sub=%s oid=%s upn=%s",
			claims.Sub, claims.OID, claims.PreferredUsername)

		c.Set(ctxOIDCClaims, &claims)
		c.Next()
	}
}
