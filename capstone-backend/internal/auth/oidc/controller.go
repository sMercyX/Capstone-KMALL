package oidc

import (
	"encoding/base64"
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

// ----- helpers -----

// allow เฉพาะโฮสต์/พอร์ต ที่เรายอมรับเท่านั้น (กัน open redirect)
// เพิ่มโดเมนโปรดักชันของจริงเข้ามาตรงนี้ได้เลย
func (ctl *Controller) allowedReturnHosts() map[string]struct{} {
	// ถ้ามี config ฝั่งคุณ เก็บไว้ใน cfg ก็เอามาเติมตรงนี้ได้
	// เช่น ctl.cfg.AllowedReturnHosts ([]string)
	allowed := map[string]struct{}{
		"localhost:5173": {}, // FE dev
	}
	// ตัวอย่าง: ดึงจาก env/config อื่น ๆ (ถ้ามี)
	// for _, h := range ctl.cfg.AllowedReturnHosts {
	// 	allowed[strings.ToLower(h)] = struct{}{}
	// }
	return allowed
}

func (ctl *Controller) isAllowedRedirectURI(raw string) bool {
	u, err := url.Parse(raw)
	if err != nil {
		return false
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return false
	}
	host := strings.ToLower(u.Host)
	_, ok := ctl.allowedReturnHosts()[host]
	return ok
}

func (ctl *Controller) buildStateWithRedirect(redirectURI string) string {
	// state = "devstate.<base64url(redirect_uri)>"
	if redirectURI == "" || !ctl.isAllowedRedirectURI(redirectURI) {
		return "devstate"
	}
	b64 := base64.RawURLEncoding.EncodeToString([]byte(redirectURI))
	return "devstate." + b64
}

func (ctl *Controller) extractRedirectFromState(state string) (string, bool) {
	// รับเฉพาะรูปแบบที่เรากำหนด: devstate or devstate.<b64>
	if state == "" {
		return "", false
	}
	parts := strings.SplitN(state, ".", 2)
	if parts[0] != "devstate" {
		return "", false
	}
	if len(parts) == 1 {
		return "", false
	}
	b, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return "", false
	}
	ru := string(b)
	if !ctl.isAllowedRedirectURI(ru) {
		return "", false
	}
	return ru, true
}

// ----- handlers -----

// GET /auth/login?redirect_uri=<FE callback URL>
// ตัวอย่าง FE:  window.location.assign(`${API_BASE}/auth/login?redirect_uri=${encodeURIComponent(FE_BASE + "/auth/callback")}`)
func (ctl *Controller) Login(c *gin.Context) {
	redirectURI := c.Query("redirect_uri")
	state := ctl.buildStateWithRedirect(redirectURI)
	c.Redirect(http.StatusFound, ctl.oauth.AuthCodeURL(state))
}

func (ctl *Controller) Callback(c *gin.Context) {
	state := c.Query("state")
	if !strings.HasPrefix(state, "devstate") {
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
	refresh, err := ctl.signer.IssueRefreshToken(u.ID)
	if err != nil {
		c.Error(apperr.Wrap(apperr.Internal, err, "issue refresh token failed"))
		return
	}

	// refresh token -> HttpOnly cookie
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "rt",
		Value:    refresh,
		Path:     "/",
		HttpOnly: true,
		Secure:   false,                // โปรดักชันควร true (https)
		SameSite: http.SameSiteLaxMode, // ให้ cookie ไหลมากับ redirect ข้ามไซต์ได้กรณี user action
		MaxAge:   int(ctl.cfg.RefreshTokenTTL.Seconds()),
	})

	// เลือก FE ปลายทางจาก state; ถ้าไม่มี/ไม่ผ่าน allow‑list -> fallback
	feDefault := "http://localhost:5173/#"
	if feFromState, ok := ctl.extractRedirectFromState(state); ok {
		// ส่งกลับไปยัง redirect_uri ตรง ๆ พร้อมแนบ access token ทาง hash
		// เช่น http://localhost:5173/auth/callback#access=...&token_type=Bearer
		c.Redirect(http.StatusFound, feFromState+"#access="+url.QueryEscape(access)+"&token_type=Bearer")
		return
	}

	// fallback ไป root ของ FE dev
	c.Redirect(http.StatusFound, feDefault+"access="+url.QueryEscape(access)+"&token_type=Bearer")
}

// POST /auth/refresh { "refresh_token": "..." }  (รองรับอ่านจาก cookie 'rt')
func (ctl *Controller) Refresh(c *gin.Context) {
	var in struct {
		RefreshToken string `json:"refresh_token"`
	}
	_ = c.ShouldBindJSON(&in)

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

	respond.OK(c, apperr.OK, gin.H{
		"access_token": access,
		"token_type":   "Bearer",
	})
}
