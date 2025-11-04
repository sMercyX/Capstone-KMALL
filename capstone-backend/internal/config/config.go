package config

import (
	"log"
	"os"
	"strings"
	"time"
)

type Config struct {
	Port        string
	DatabaseURL string

	// Auth mode switch
	TrustUpstreamAuth bool

	// Azure OIDC
	TenantID     string
	ClientID     string
	ClientSecret string
	RedirectURL  string

	// JWT in app
	JWTIssuer       string
	JWTAudience     string
	JWTSecret       string // HS256
	AccessTokenTTL  time.Duration
	RefreshTokenTTL time.Duration
}

func must(k string) string {
	v := os.Getenv(k)
	if v == "" {
		log.Fatalf("missing env: %s", k)
	}
	return v
}

func mustDuration(k string, def time.Duration) time.Duration {
	v := os.Getenv(k)
	if v == "" {
		return def
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		log.Fatalf("invalid duration for %s: %v", k, err)
	}
	return d
}

func getBool(k string, def bool) bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv(k)))
	if v == "" {
		return def
	}
	return v == "1" || v == "true" || v == "yes" || v == "on"
}

func Load() Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	trustUpstream := getBool("TRUST_UPSTREAM_AUTH", true) // true = prod, false = dev

	cfg := Config{
		Port:              port,
		DatabaseURL:       must("DATABASE_URL"),
		TrustUpstreamAuth: trustUpstream,

		JWTIssuer:       os.Getenv("JWT_ISSUER"),
		JWTAudience:     os.Getenv("JWT_AUDIENCE"),
		AccessTokenTTL:  mustDuration("JWT_ACCESS_TTL", 30*time.Minute),
		RefreshTokenTTL: mustDuration("JWT_REFRESH_TTL", 24*time.Hour),
	}

	if trustUpstream {
		cfg.TenantID = os.Getenv("AZ_TENANT_ID")
		cfg.ClientID = os.Getenv("AZ_CLIENT_ID")
		cfg.ClientSecret = os.Getenv("AZ_CLIENT_SECRET")
		cfg.RedirectURL = os.Getenv("AZ_REDIRECT_URL")
		cfg.JWTSecret = os.Getenv("JWT_SECRET")
	} else {
		cfg.TenantID = must("AZ_TENANT_ID")
		cfg.ClientID = must("AZ_CLIENT_ID")
		cfg.ClientSecret = must("AZ_CLIENT_SECRET")
		cfg.RedirectURL = must("AZ_REDIRECT_URL")
		cfg.JWTSecret = must("JWT_SECRET")
	}

	return cfg
}
