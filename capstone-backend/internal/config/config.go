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
	DevFakeAuth       bool

	// Azure OIDC
	TenantID     string
	ClientID     string
	ClientSecret string
	RedirectURL  string
	OIDCIssuer   string

	// JWT in app
	JWTIssuer       string
	JWTAudience     string
	JWTSecret       string // HS256
	AccessTokenTTL  time.Duration
	RefreshTokenTTL time.Duration

	// CORS
	CORSAllowedOrigins string
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

	// แนะนำให้ default เป็น false ใน mode ใหม่ (backend verify เอง)
	// แล้วค่อยตั้ง TRUST_UPSTREAM_AUTH=true เฉพาะตอนอยากกลับไปใช้ oauth2-proxy
	trustUpstream := getBool("TRUST_UPSTREAM_AUTH", false)

	cfg := Config{
		Port:              port,
		DatabaseURL:       must("DATABASE_URL"),
		TrustUpstreamAuth: trustUpstream,
		DevFakeAuth:       getBool("DEV_FAKE_AUTH", false),

		JWTIssuer:       os.Getenv("JWT_ISSUER"),
		JWTAudience:     os.Getenv("JWT_AUDIENCE"),
		AccessTokenTTL:  mustDuration("JWT_ACCESS_TTL", 30*time.Minute),
		RefreshTokenTTL: mustDuration("JWT_REFRESH_TTL", 24*time.Hour),
		CORSAllowedOrigins: os.Getenv("CORS_ALLOWED_ORIGINS"),
	}

	tenantID := os.Getenv("AZ_TENANT_ID")
	clientID := os.Getenv("AZ_CLIENT_ID")
	clientSecret := os.Getenv("AZ_CLIENT_SECRET")
	redirectURL := os.Getenv("AZ_REDIRECT_URL")

	if !trustUpstream {
		if tenantID == "" {
			log.Fatalf("missing env: AZ_TENANT_ID")
		}
		if clientID == "" {
			log.Fatalf("missing env: AZ_CLIENT_ID")
		}
	}

	issuer := os.Getenv("OIDC_ISSUER_URL")
	if issuer == "" && tenantID != "" {
		issuer = "https://login.microsoftonline.com/" + tenantID + "/v2.0"
	}

	cfg.TenantID = tenantID
	cfg.ClientID = clientID
	cfg.ClientSecret = clientSecret
	cfg.RedirectURL = redirectURL
	cfg.OIDCIssuer = issuer
	cfg.JWTSecret = must("JWT_SECRET")

	return cfg
}
