package router

import (
	"context"
	"time"

	gooidc "github.com/coreos/go-oidc/v3/oidc"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Perpasit/Capstone-KMALL/internal/auth/oidc"
	"github.com/Perpasit/Capstone-KMALL/internal/config"
	"github.com/Perpasit/Capstone-KMALL/internal/middleware"
	"github.com/Perpasit/Capstone-KMALL/internal/respond"
	"github.com/Perpasit/Capstone-KMALL/internal/user"
)

func Attach(r *gin.Engine, db *pgxpool.Pool, cfg config.Config) {
	r.Use(
		middleware.RequestID(),
		middleware.RequestTimeout(2*time.Second),
		middleware.ErrorHandler(),
		middleware.Recovery(),
	)

	r.GET("/health", func(c *gin.Context) { c.String(200, "ok") })

	issuer := "https://login.microsoftonline.com/" + cfg.TenantID + "/v2.0"
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	provider, err := gooidc.NewProvider(ctx, issuer)
	if err != nil {
		panic("oidc discovery failed: " + err.Error())
	}

	uRepo := user.NewRepo(db)
	uSvc := user.NewService(uRepo)

	oidcCtl := oidc.NewController(cfg, uSvc)
	oidcCtl.Init(provider)

	r.GET("/auth/login", oidcCtl.Login)
	r.GET("/auth/callback", oidcCtl.Callback)

	r.NoRoute(func(c *gin.Context) {
		respond.Error(c, 404, "NOT_FOUND", "route not found", nil)
	})
}
