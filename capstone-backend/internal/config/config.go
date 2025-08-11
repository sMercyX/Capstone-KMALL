package config

import (
	"log"
	"os"
)

type Config struct {
	Port        string
	DatabaseURL string

	TenantID     string
	ClientID     string
	ClientSecret string
	RedirectURL  string
}

func must(k string) string {
	v := os.Getenv(k)
	if v == "" {
		log.Fatalf("missing env: %s", k)
	}
	return v
}

func Load() Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	return Config{
		Port:        port,
		DatabaseURL: must("DATABASE_URL"),

		TenantID:     must("AZ_TENANT_ID"),
		ClientID:     must("AZ_CLIENT_ID"),
		ClientSecret: must("AZ_CLIENT_SECRET"),
		RedirectURL:  must("AZ_REDIRECT_URL"),
	}
}
