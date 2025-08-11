package main

import (
	"context"
	"log"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	// แก้ path ให้ตรงกับ module ของคุณ เช่น github.com/<you>/Capstone-KMALL/capstone-backend
	"github.com/Perpasit/Capstone-KMALL/capstone-backend/internal/config"
	"github.com/Perpasit/Capstone-KMALL/capstone-backend/internal/db"
)

func main() {
	_ = godotenv.Load()
	cfg := config.Load()

	ctx := context.Background()
	pool := db.Open(ctx, cfg.DatabaseURL)
	defer pool.Close()

	r := gin.Default()
	// ชั่วคราว: ใช้ handler เดิมในไฟล์นี้ก่อน (ถ้ายังไม่ได้ย้าย)
	r.GET("/health", func(c *gin.Context){ c.String(200,"ok") })

	// TODO: ค่อยย้ายโค้ด /auth/login และ /auth/callback เข้ามาเป็น package ภายหลัง
	log.Printf("listening on :%s ...", cfg.Port)
	_ = r.Run(":" + cfg.Port)
}
