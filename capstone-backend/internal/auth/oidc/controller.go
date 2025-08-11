package oidc

import (
	"net/http"
	"strings"

	gooidc "github.com/coreos/go-oidc/v3/oidc"
	"github.com/gin-gonic/gin"
	"golang.org/x/oauth2"

	"github.com/Perpasit/Capstone-KMALL/internal/config"
	"github.com/Perpasit/Capstone-KMALL/internal/user"
)

type Controller struct {
	cfg      config.Config
	verifier *gooidc.IDTokenVerifier
	oauth    *oauth2.Config
	userSvc  user.Service
}

func NewController(cfg config.Config, us user.Service) *Controller {
	return &Controller{cfg: cfg, userSvc: us}
}

func (ctl *Controller) Init(provider *gooidc.Provider) {
	ctl.verifier = provider.Verifier(&gooidc.Config{ClientID: ctl.cfg.ClientID})
	ctl.oauth = &oauth2.Config{
		ClientID:     ctl.cfg.ClientID,
		ClientSecret: ctl.cfg.ClientSecret,
		RedirectURL:  ctl.cfg.RedirectURL,
		Endpoint:     provider.Endpoint(),
		Scopes:       []string{gooidc.ScopeOpenID, "profile", "email"},
	}
}

func (ctl *Controller) Login(c *gin.Context) {
	c.Redirect(http.StatusFound, ctl.oauth.AuthCodeURL("devstate"))
}

func (ctl *Controller) Callback(c *gin.Context) {
	if c.Query("state") != "devstate" { c.JSON(400, gin.H{"error":"invalid state"}); return }
	code := c.Query("code")
	tok, err := ctl.oauth.Exchange(c.Request.Context(), code)
	if err != nil { c.JSON(400, gin.H{"error":"exchange failed", "detail": err.Error()}); return }

	rawID, _ := tok.Extra("id_token").(string)
	idt, err := ctl.verifier.Verify(c.Request.Context(), rawID)
	if err != nil { c.JSON(400, gin.H{"error":"verify failed", "detail": err.Error()}); return }

	var claims struct {
		Email             string `json:"email"`
		Name              string `json:"name"`
		PreferredUsername string `json:"preferred_username"`
		TenantID          string `json:"tid"`
		ObjectID          string `json:"oid"`
	}
	if err := idt.Claims(&claims); err != nil {
		c.JSON(400, gin.H{"error":"claims parse failed"}); return
	}
	if claims.TenantID != ctl.cfg.TenantID {
		c.JSON(401, gin.H{"error":"wrong tenant"}); return
	}
	email := claims.Email
	if email == "" { email = claims.PreferredUsername }
	if !strings.HasSuffix(strings.ToLower(email), "@kmutt.ac.th") {
		c.JSON(403, gin.H{"error":"invalid domain"}); return
	}

	// upsert + role buyer
	u, err := ctl.userSvc.UpsertAndEnsureBuyer(c.Request.Context(), claims.ObjectID, email, claims.Name)
	if err != nil { c.JSON(500, gin.H{"error":"db upsert failed", "detail": err.Error()}); return }

	// TODO: ออก JWT/Session แล้ว redirect ไปหน้า FE
	c.JSON(200, gin.H{
		"login":  "ok",
		"id":     u.ID,
		"ms_oid": u.MSID,
		"email":  u.Email,
		"name":   u.DisplayName,
	})
}
