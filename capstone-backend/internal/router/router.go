package router

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Perpasit/Capstone-KMALL/internal/cart"
	"github.com/Perpasit/Capstone-KMALL/internal/category"
	"github.com/Perpasit/Capstone-KMALL/internal/config"
	images "github.com/Perpasit/Capstone-KMALL/internal/image"
	"github.com/Perpasit/Capstone-KMALL/internal/middleware"
	"github.com/Perpasit/Capstone-KMALL/internal/product"
	"github.com/Perpasit/Capstone-KMALL/internal/respond"
	"github.com/Perpasit/Capstone-KMALL/internal/role"
	"github.com/Perpasit/Capstone-KMALL/internal/store"
	"github.com/Perpasit/Capstone-KMALL/internal/user"
)

func Attach(r *gin.Engine, db *pgxpool.Pool, cfg config.Config) {
	// global middlewares
	r.Use(
		middleware.RequestID(),
		middleware.RequestTimeout(10*time.Second),
		middleware.ErrorHandler(),
		middleware.Recovery(),
	)

	// health
	r.GET("/health", func(c *gin.Context) { c.String(200, "ok") })

	r.Static("/static", "./uploads")

	// wiring repos & services
	uRepo := user.NewRepo(db)
	rRepo := role.NewRepo(db)

	rSvc := role.NewService(rRepo)
	uSvc := user.NewService(uRepo, rSvc)

	sRepo := store.NewRepo(db)
	sSvc := store.NewService(sRepo)

	cRepo := category.NewRepo(db)
	cSvc := category.NewService(cRepo)

	pRepo := product.NewRepo(db)
	pSvc := product.NewService(pRepo)

	cartRepo := cart.NewRepo(db)
	cartSvc := cart.NewService(cartRepo)

	// API routes (protected)
	v1 := r.Group("/api",
		middleware.UpstreamAuth(),
		middleware.EnsureUser(func(ctx context.Context, oid, email, name string) (string, error) {
			u, err := uSvc.UpsertAndEnsureBuyer(ctx, oid, email, name)
			if err != nil {
				return "", err
			}
			return u.ID, nil
		}),
	)

	// users
	uHdl := user.NewHandler(uSvc, rSvc)
	uHdl.Register(v1)

	// roles
	rHdl := role.NewHandler(rSvc)
	rHdl.Register(v1)

	// stores
	sHdl := store.NewHandler(sSvc, rSvc, uSvc)
	sHdl.Register(v1)

	// categories
	cHdl := category.NewHandler(cSvc, rSvc)
	cHdl.Register(v1)

	// products
	pHdl := product.NewHandler(pSvc, sSvc, rSvc, uSvc)
	pHdl.Register(v1)

	// images
	imgRepo := images.NewRepo(db)
	imgSvc := images.NewService(imgRepo)
	imgHdl := images.NewHandler(imgSvc, sSvc, pSvc, rSvc, uSvc)
	imgHdl.Register(v1)

	// carts
	cartHdl := cart.NewHandler(cartSvc, rSvc, uSvc)
	cartHdl.Register(v1)

	// debug
	v1.GET("/debug/headers", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"Authorization":        c.GetHeader("Authorization"),
			"X-Auth-Request-Email": c.GetHeader("X-Auth-Request-Email"),
			"X-Auth-Request-User":  c.GetHeader("X-Auth-Request-User"),
			"X-Forwarded-User":     c.GetHeader("X-Forwarded-User"),
		})
	})

	// 404
	r.NoRoute(func(c *gin.Context) {
		respond.Error(c, 404, "NOT_FOUND", "route not found", nil)
	})
}
