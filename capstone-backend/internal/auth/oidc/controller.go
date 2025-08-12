package oidc

import (
	"net/http"
	"strings"

	gooidc "github.com/coreos/go-oidc/v3/oidc"
	"github.com/gin-gonic/gin"
	"golang.org/x/oauth2"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
	"github.com/Perpasit/Capstone-KMALL/internal/config"
	"github.com/Perpasit/Capstone-KMALL/internal/respond"
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
	// NOTE: ภายหลังควรใช้ state แบบสุ่มต่อคำขอ (กัน CSRF) แล้วเก็บไว้ใน cookie/session
	c.Redirect(http.StatusFound, ctl.oauth.AuthCodeURL("devstate"))
}

func (ctl *Controller) Callback(c *gin.Context) {
	if c.Query("state") != "devstate" {
		c.Error(apperr.New(apperr.BadRequest, "invalid state"))
		return
	}

	code := c.Query("code")
	if code == "" {
		c.Error(apperr.New(apperr.BadRequest, "missing code"))
		return
	}

	tok, err := ctl.oauth.Exchange(c.Request.Context(), code)
	if err != nil {
		c.Error(apperr.Wrap(apperr.BadRequest, err, "exchange auth code failed"))
		return
	}

	rawID, _ := tok.Extra("id_token").(string)
	if rawID == "" {
		c.Error(apperr.New(apperr.BadRequest, "missing id_token"))
		return
	}

	idt, err := ctl.verifier.Verify(c.Request.Context(), rawID)
	if err != nil {
		c.Error(apperr.Wrap(apperr.Unauthorized, err, "invalid id_token"))
		return
	}

	var claims struct {
		Email             string `json:"email"`
		Name              string `json:"name"`
		PreferredUsername string `json:"preferred_username"`
		TenantID          string `json:"tid"`
		ObjectID          string `json:"oid"`
	}
	if err := idt.Claims(&claims); err != nil {
		c.Error(apperr.Wrap(apperr.BadRequest, err, "claims parse failed"))
		return
	}

	if claims.TenantID != ctl.cfg.TenantID {
		c.Error(apperr.New(apperr.Unauthorized, "wrong tenant"))
		return
	}

	email := claims.Email
	if email == "" {
		email = claims.PreferredUsername
	}
	email = strings.ToLower(email)
	if !strings.HasSuffix(email, "@kmutt.ac.th") {
		c.Error(apperr.New(apperr.Forbidden, "invalid domain"))
		return
	}

	u, err := ctl.userSvc.UpsertAndEnsureBuyer(c.Request.Context(), claims.ObjectID, email, claims.Name)
	if err != nil {
		c.Error(apperr.Wrap(apperr.Internal, err, "db upsert failed"))
		return
	}

	// success → ใช้ respond.OK (รูปแบบ success กลาง)
	respond.OK(c, gin.H{
		"login":  "ok",
		"id":     u.ID,
		"ms_oid": u.MSID,
		"email":  u.Email,
		"name":   u.DisplayName,
	})
}
