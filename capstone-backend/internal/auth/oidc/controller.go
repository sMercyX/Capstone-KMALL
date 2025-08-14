package oidc

import (
	"net/http"
	"net/url"
	"strings"

	gooidc "github.com/coreos/go-oidc/v3/oidc"
	"github.com/gin-gonic/gin"
	"golang.org/x/oauth2"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
	appjwt "github.com/Perpasit/Capstone-KMALL/internal/auth/jwt"
	"github.com/Perpasit/Capstone-KMALL/internal/config"
	"github.com/Perpasit/Capstone-KMALL/internal/respond"
	"github.com/Perpasit/Capstone-KMALL/internal/user"
)

type Controller struct {
	cfg      config.Config
	verifier *gooidc.IDTokenVerifier
	oauth    *oauth2.Config
	userSvc  user.Service
	signer   *appjwt.Signer
}

func NewController(cfg config.Config, us user.Service, signer *appjwt.Signer) *Controller {
	return &Controller{cfg: cfg, userSvc: us, signer: signer}
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
		if re, ok := err.(*oauth2.RetrieveError); ok {
			c.Error(apperr.WithFields(
				apperr.Wrap(apperr.BadRequest, err, "exchange auth code failed"),
				map[string]any{
					"http_status": re.Response.StatusCode,
					"body":        string(re.Body),
				},
			))
			return
		}
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
		c.Error(err)
		return
	}

	// roles
	roles, err := ctl.userSvc.GetRoles(c.Request.Context(), u.ID)
	if err != nil {
		c.Error(apperr.Wrap(apperr.Internal, err, "get roles failed"))
		return
	}

	// issue tokens
	access, err := ctl.signer.IssueAccessToken(u.ID, u.Email, u.DisplayName, roles)
	if err != nil {
		c.Error(apperr.Wrap(apperr.Internal, err, "issue access token failed"))
		return
	}
	refresh, err := ctl.signer.IssueRefreshToken(u.ID)
	if err != nil {
		c.Error(apperr.Wrap(apperr.Internal, err, "issue refresh token failed"))
		return
	}

	// === ไม่มี popup: เก็บ refresh token เป็น HttpOnly cookie + redirect ไป FE ===
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "rt",
		Value:    refresh,
		Path:     "/",
		HttpOnly: true,
		Secure:   false,                // โปรดักชันควร true (ต้องใช้ https)
		SameSite: http.SameSiteLaxMode, // ไหลไปกับ redirect ได้
		MaxAge:   int(ctl.cfg.RefreshTokenTTL.Seconds()),
	})

	feOrigin := "http://localhost:5173"
	// ส่ง access ทาง fragment ให้ FE อ่านจาก window.location.hash ได้
	redirectURL := feOrigin + "/#access=" + url.QueryEscape(access) + "&token_type=Bearer"
	c.Redirect(http.StatusFound, redirectURL)
}

// POST /auth/refresh { "refresh_token": "..." }  (รองรับอ่านจาก cookie 'rt')
func (ctl *Controller) Refresh(c *gin.Context) {
	var in struct {
		RefreshToken string `json:"refresh_token"`
	}
	_ = c.ShouldBindJSON(&in)

	// ถ้า body ไม่ส่งมา ให้ลองอ่านจาก cookie
	if in.RefreshToken == "" {
		if ck, err := c.Request.Cookie("rt"); err == nil {
			in.RefreshToken = ck.Value
		}
	}
	if in.RefreshToken == "" {
		c.Error(apperr.New(apperr.BadRequest, "missing refresh_token"))
		return
	}

	rc, err := ctl.signer.ParseRefresh(in.RefreshToken)
	if err != nil {
		c.Error(apperr.New(apperr.Unauthorized, "invalid refresh"))
		return
	}

	uid := rc.Subject
	u, err := ctl.userSvc.FindByID(c.Request.Context(), uid)
	if err != nil {
		c.Error(apperr.Wrap(apperr.Internal, err, "user lookup failed"))
		return
	}

	roles, err := ctl.userSvc.GetRoles(c.Request.Context(), u.ID)
	if err != nil {
		c.Error(apperr.Wrap(apperr.Internal, err, "get roles failed"))
		return
	}

	access, err := ctl.signer.IssueAccessToken(u.ID, u.Email, u.DisplayName, roles)
	if err != nil {
		c.Error(apperr.Wrap(apperr.Internal, err, "issue access token failed"))
		return
	}

	respond.OK(c, gin.H{
		"access_token": access,
		"token_type":   "Bearer",
	})
}
