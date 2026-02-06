package router

import (
	"context"
	"log"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Perpasit/Capstone-KMALL/internal/address"
	"github.com/Perpasit/Capstone-KMALL/internal/auth"
	"github.com/Perpasit/Capstone-KMALL/internal/campus"
	"github.com/Perpasit/Capstone-KMALL/internal/cart"
	"github.com/Perpasit/Capstone-KMALL/internal/category"
	"github.com/Perpasit/Capstone-KMALL/internal/config"
	images "github.com/Perpasit/Capstone-KMALL/internal/image"
	"github.com/Perpasit/Capstone-KMALL/internal/middleware"
	"github.com/Perpasit/Capstone-KMALL/internal/order"
	"github.com/Perpasit/Capstone-KMALL/internal/orderchat"
	"github.com/Perpasit/Capstone-KMALL/internal/product"
	"github.com/Perpasit/Capstone-KMALL/internal/respond"
	"github.com/Perpasit/Capstone-KMALL/internal/role"
	"github.com/Perpasit/Capstone-KMALL/internal/searchhistory"
	"github.com/Perpasit/Capstone-KMALL/internal/store"

	"github.com/Perpasit/Capstone-KMALL/internal/embedding"
	"github.com/Perpasit/Capstone-KMALL/internal/filestore"
	"github.com/Perpasit/Capstone-KMALL/internal/user"
	"github.com/Perpasit/Capstone-KMALL/internal/websocket"
)

func Attach(r *gin.Engine, db *pgxpool.Pool, cfg config.Config) {
	// ===== Global middlewares =====
	r.Use(
		middleware.RequestID(),
		middleware.RequestTimeout(10*time.Second),
		middleware.ErrorHandler(),
		middleware.Recovery(),
		middleware.CORSMiddleware(cfg.CORSAllowedOrigins),
	)

	// WebSocket Hub
	hub := websocket.NewHub()
	go hub.Run()

	// health (ไม่ต้อง auth)
	r.GET("/api/health", func(c *gin.Context) {
		start := time.Now()

		// logData := gin.H{
		// 	"time":    start.Format(time.RFC3339),
		// 	"client":  c.ClientIP(),
		// 	"method":  c.Request.Method,
		// 	"path":    c.Request.URL.Path,
		// 	"headers": gin.H{},
		// 	"status":  "ok",
		// }

		// for k, v := range c.Request.Header {
		// 	if len(v) > 0 {
		// 		logData["headers"].(gin.H)[k] = v[0]
		// 	}
		// }

		// if _, ok := c.Request.Header["X-Auth-Request-Email"]; !ok {
		// 	logData["status"] = "missing-auth-header"
		// 	log.Println("missing X-Auth-Request-Email in /api/health")
		// }
		// if _, ok := c.Request.Header["X-Auth-Request-User"]; !ok {
		// 	logData["status"] = "missing-auth-header"
		// 	log.Println("missing X-Auth-Request-User in /api/health")
		// }

		// log ลง stdout (docker logs)
		// log.Printf("[HEALTH DEBUG] %v\n", logData)

		c.JSON(200, start)
	})

	// static files (รูป)

	// ===== wiring repos & services =====
	uRepo := user.NewRepo(db)
	rRepo := role.NewRepo(db)

	rSvc := role.NewService(rRepo)
	uSvc := user.NewService(uRepo, rSvc)

	sRepo := store.NewRepo(db)
	sSvc := store.NewService(sRepo, uSvc, uRepo)

	cRepo := category.NewRepo(db)
	cSvc := category.NewService(cRepo)

	embedClient := embedding.NewOllama(embedding.Config{
		BaseURL: "http://ollama:11434",
		Model:   "nomic-embed-text",
		Dim:     768,
		Timeout: 8 * time.Second,
	})

	pRepo := product.NewRepo(db)
	pSvc := product.NewService(pRepo, embedClient)

	cartRepo := cart.NewRepo(db)
	cartSvc := cart.NewService(cartRepo)

	oRepo := order.NewRepo(db)
	oSvc := order.NewService(
		oRepo,
		cartSvc,
		pSvc,
		sSvc,
		hub, // Pass socket hub as notifier
	)

	shRepo := searchhistory.NewRepo(db)
	shSvc := searchhistory.NewService(shRepo)

	campusRepo := campus.NewRepo(db)
	campusSvc := campus.NewService(campusRepo)

	addrRepo := address.NewRepo(db)
	addrSvc := address.NewService(addrRepo)

	ocRepo := orderchat.NewRepo(db)
	fs := filestore.NewLocalStore("./uploads", "/uploads")
	ocSvc := orderchat.NewService(ocRepo, fs, hub)

	// v1 := r.Group("/api",
	// 	apiLogger(),
	// 	auth.AuthMiddleware(),
	// 	middleware.OIDCUser(),
	// 	middleware.EnsureUser(func(ctx context.Context, oid, email, name string) (string, error) {
	// 		u, err := uSvc.UpsertAndEnsureBuyer(ctx, oid, email, name)
	// 		if err != nil {
	// 			return "", err
	// 		}
	// 		return u.ID, nil
	// 	}),
	// )
	// log.Println("[AUTH] Using direct OIDC auth (backend verifies token)")

	var v1 *gin.RouterGroup

	if cfg.DevFakeAuth {
		v1 = r.Group("/api",
			apiLogger(),
			middleware.DevMockUser(),
			middleware.EnsureUser(func(ctx context.Context, oid, email, name string) (string, error) {
				u, err := uSvc.UpsertAndEnsureBuyer(ctx, oid, email, name)
				if err != nil {
					return "", err
				}
				return u.ID, nil
			}),
		)
		log.Println("[AUTH] DEV MODE: using DevMockUser (no token verify)")
	} else {
		v1 = r.Group("/api",
			apiLogger(),
			auth.AuthMiddleware(),
			middleware.OIDCUser(),
			middleware.EnsureUser(func(ctx context.Context, oid, email, name string) (string, error) {
				u, err := uSvc.UpsertAndEnsureBuyer(ctx, oid, email, name)
				if err != nil {
					return "", err
				}
				return u.ID, nil
			}),
		)
		log.Println("[AUTH] Using direct OIDC auth (backend verifies token)")
	}

	r.Static("/uploads", "./uploads")

	// ---- debug headers ผ่าน chain เต็ม (ต้อง login) ----
	v1.GET("/debug/headers", func(c *gin.Context) {
		h := make(map[string]string)
		for k, v := range c.Request.Header {
			if len(v) > 0 {
				h[k] = v[0]
			}
		}
		c.JSON(200, gin.H{"headers": h})
	})

	v1.GET("/auth/me-debug", func(c *gin.Context) {
		u, err := auth.CurrentUser(c)
		if err != nil {
			c.JSON(401, gin.H{"error": err.Error()})
			return
		}
		c.JSON(200, gin.H{
			"oid":   u.Oid,
			"email": u.Email,
			"name":  u.Name,
		})
	})

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
	pHdl := product.NewHandler(pSvc, sSvc, rSvc, uSvc, shSvc)
	pHdl.Register(v1)

	// images
	imgRepo := images.NewRepo(db)
	imgSvc := images.NewService(imgRepo)
	imgHdl := images.NewHandler(imgSvc, sSvc, pSvc, rSvc, uSvc)
	imgHdl.Register(v1)

	// carts
	cartHdl := cart.NewHandler(cartSvc, rSvc, uSvc)
	cartHdl.Register(v1)

	// orders
	oHdl := order.NewHandler(oSvc, rSvc, uSvc, sSvc)
	oHdl.Register(v1)

	//search history
	shHdl := searchhistory.NewHandler(shSvc, rSvc, uSvc)
	shHdl.Register(v1)

	// register
	campusHdl := campus.NewHandler(campusSvc, rSvc)
	campusHdl.Register(v1)

	// addresses (user private)
	addrHdl := address.NewHandler(addrSvc, uSvc)
	addrHdl.Register(v1)

	// order chat
	ocHdl := orderchat.NewHandler(ocSvc, ocRepo, rSvc, uSvc)
	ocHdl.Register(v1)

	// ---- debug local (ยิงตรง http://localhost:18080/debug/headers) ----
	r.GET("/debug/headers", func(c *gin.Context) {
		h := make(map[string]string)
		for k, v := range c.Request.Header {
			if len(v) > 0 {
				h[k] = v[0]
			}
		}
		c.JSON(200, gin.H{"headers": h})
	})

	// 404
	r.NoRoute(func(c *gin.Context) {
		respond.Error(c, 404, "NOT_FOUND", "route not found", nil)
	})

	// WebSocket Endpoint for Orders
	r.GET("/api/ws/orders/:orderId", func(c *gin.Context) {
		orderId := c.Param("orderId")
		if orderId == "" {
			return
		}
		// roomID pattern: order_{id}
		roomID := "order_" + orderId
		websocket.ServeWs(hub, c, roomID)
	})

	// WebSocket Endpoint for Chat
	r.GET("/api/ws/chats/:threadId", func(c *gin.Context) {
		threadId := c.Param("threadId")
		if threadId == "" {
			return
		}
		// roomID pattern: chat_{threadId}
		roomID := "chat_" + threadId
		websocket.ServeWs(hub, c, roomID)
	})
}

func apiLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		rid, _ := c.Get("request_id")

		log.Printf(
			"[API-IN ] %s %s from %s rid=%v",
			c.Request.Method,
			c.Request.URL.Path,
			c.ClientIP(),
			rid,
		)

		c.Next()

		status := c.Writer.Status()
		log.Printf(
			"[API-OUT] %s %s status=%d rid=%v took=%s",
			c.Request.Method,
			c.Request.URL.Path,
			status,
			rid,
			time.Since(start),
		)
	}
}
