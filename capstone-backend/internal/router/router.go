package router

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	gooidc "github.com/coreos/go-oidc/v3/oidc"

	"github.com/Perpasit/Capstone-KMALL/internal/config"
	"github.com/Perpasit/Capstone-KMALL/internal/auth/oidc"
	"github.com/Perpasit/Capstone-KMALL/internal/user"
)

func Attach(r *gin.Engine, db *pgxpool.Pool, cfg config.Config) {
	// user service (ใช้ใน OIDC callback)
	uRepo := user.NewRepo(db)
	uSvc  := user.NewService(uRepo)

	// OIDC routes
	issuer := "https://login.microsoftonline.com/" + cfg.TenantID + "/v2.0"
	provider, _ := gooidc.NewProvider(context.Background(), issuer)
	oidcCtl := oidc.NewController(cfg, uSvc)
	oidcCtl.Init(provider)

	r.GET("/auth/login", oidcCtl.Login)
	r.GET("/auth/callback", oidcCtl.Callback)

	// (ถ้าจะเปิด REST ของ users)
	// v1 := r.Group("/api")
	// uHdl := user.NewHandler(uSvc)
	// uHdl.Register(v1)
}
