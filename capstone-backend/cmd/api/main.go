package main

import (
	"context"
	"log"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"github.com/Perpasit/Capstone-KMALL/internal/config"
	"github.com/Perpasit/Capstone-KMALL/internal/db"
	"github.com/Perpasit/Capstone-KMALL/internal/router"
)

func main() {
	_ = godotenv.Load()
	cfg := config.Load()

	pool := db.Open(context.Background(), cfg.DatabaseURL)
	defer pool.Close()

	r := gin.Default()
	r.GET("/health", func(c *gin.Context) { c.String(200, "ok") })

	router.Attach(r, pool, cfg)

	log.Printf("listening on :%s ...", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal(err)
	}
}
