package config

import (
	"log"
	"os"
)

type Config struct {
	Port        string
	DatabaseURL string
}

func must(k string) string {
	v := os.Getenv(k)
	if v == "" { log.Fatalf("missing env: %s", k) }
	return v
}

func Load() Config {
	port := os.Getenv("PORT")
	if port == "" { port = "8080" }
	return Config{
		Port:        port,
		DatabaseURL: must("DATABASE_URL"),
	}
}
