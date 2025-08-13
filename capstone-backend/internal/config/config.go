package config

import (
	"log"
	"os"
	"time"
)

type Config struct {
	Port        string
	DatabaseURL string

	TenantID     string
	ClientID     string
	ClientSecret string
	RedirectURL  string

	//JWT
	JWTIssuer 	 string
	JWTAudience  string
	JWTSecret 	 string // H256
	AccessTokenTTL time.Duration
	RefreshTokenTTL time.Duration
}

func must(k string) string {
	v := os.Getenv(k)
	if v == "" {
		log.Fatalf("missing env: %s", k)
	}
	return v
}

func mustDuration(k string, def time.Duration) time.Duration{
	v:= os.Getenv(k)
	if v == "" {
		return def
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		log.Fatalf("Invalid duration for %s: %v", k, err)
	}
	return d
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

		JWTIssuer: 	  os.Getenv("JWT_ISSUER"),
		JWTAudience:  os.Getenv("JWT_AUDIENCE"),
		JWTSecret: 	  must("JWT_SECRET"),
		AccessTokenTTL: mustDuration("JWT_ACCESS_TTL", 30*time.Minute),
		RefreshTokenTTL: mustDuration("JWT_REFRESH_TTL", 24*time.Hour),
	}
}
