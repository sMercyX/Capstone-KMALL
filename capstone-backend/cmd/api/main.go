package main

import (
	"context"
	"log"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"github.com/Perpasit/Capstone-KMALL/internal/auth"
	"github.com/Perpasit/Capstone-KMALL/internal/config"
	"github.com/Perpasit/Capstone-KMALL/internal/db"
	"github.com/Perpasit/Capstone-KMALL/internal/router"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables from server")
	}
	cfg := config.Load()

	if !cfg.TrustUpstreamAuth {
		if err := auth.InitOIDC(cfg); err != nil {
			log.Fatalf("failed to init OIDC: %v", err)
		}
	}

	pool := db.Open(context.Background(), cfg.DatabaseURL)
	defer pool.Close()

	r := gin.New()

	router.Attach(r, pool, cfg)

	log.Printf("listening on :%s ...", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal(err)
	}
}
