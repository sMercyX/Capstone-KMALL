package router

import (
	// "context"

	"time"

	// gooidc "github.com/coreos/go-oidc/v3/oidc"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	// appjwt "github.com/Perpasit/Capstone-KMALL/internal/auth/jwt"
	// "github.com/Perpasit/Capstone-KMALL/internal/auth/oidc"

	"github.com/Perpasit/Capstone-KMALL/internal/config"
	"github.com/Perpasit/Capstone-KMALL/internal/middleware"
	"github.com/Perpasit/Capstone-KMALL/internal/respond"
	"github.com/Perpasit/Capstone-KMALL/internal/user"
)

func Attach(r *gin.Engine, db *pgxpool.Pool, cfg config.Config) {
	r.Use(
		middleware.RequestID(),
		middleware.RequestTimeout(10*time.Second),
		middleware.ErrorHandler(),
		middleware.Recovery(),
	)

	r.GET("/health", func(c *gin.Context) { c.String(200, "ok") })

	// issuer := "https://login.microsoftonline.com/" + cfg.TenantID + "/v2.0"
	// ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	// defer cancel()
	// provider, err := gooidc.NewProvider(ctx, issuer)
	// if err != nil {
	// 	panic("oidc discovery failed: " + err.Error())
	// }

	uRepo := user.NewRepo(db)
	uSvc := user.NewService(uRepo)

	// ---- JWT signer ----
	// signer := appjwt.NewSigner(
	// 	cfg.JWTIssuer,
	// 	cfg.JWTAudience,
	// 	cfg.JWTSecret,
	// 	cfg.AccessTokenTTL,
	// 	cfg.RefreshTokenTTL,
	// )

	// oidcCtl := oidc.NewController(cfg, uSvc, signer)
	// oidcCtl.Init(provider)

	// OIDC / Auth routes
	// r.GET("/auth/login", oidcCtl.Login)
	// r.GET("/auth/callback", oidcCtl.Callback)
	// r.POST("/auth/refresh", oidcCtl.Refresh)

	// API routes
	v1 := r.Group("/api", middleware.UpstreamAuth())
	uHdl := user.NewHandler(uSvc)
	uHdl.Register(v1)

	// 404 handler
	r.NoRoute(func(c *gin.Context) {
		respond.Error(c, 404, "NOT_FOUND", "route not found", nil)
	})

	v1.GET("/debug/headers", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"Authorization":        c.GetHeader("Authorization"),
			"X-Auth-Request-Email": c.GetHeader("X-Auth-Request-Email"),
			"X-Auth-Request-User":  c.GetHeader("X-Auth-Request-User"),
			"X-Forwarded-User":     c.GetHeader("X-Forwarded-User"),
		})
	})

}
