package db

import (
	"context"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func Open(ctx context.Context, url string) *pgxpool.Pool {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil { log.Fatalf("parse db: %v", err) }

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil { log.Fatalf("open db: %v", err) }

	ctxPing, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := pool.Ping(ctxPing); err != nil { log.Fatalf("ping db: %v", err) }

	return pool
}
