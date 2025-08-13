package jwt

import (
	"errors"
	"time"

	jwtlib "github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID      string   `json:"uuid"`
	Email       string   `json:"email"`
	DisplayName string   `json:"display_name"`
	Roles       []string `json:"roles"`
	jwtlib.RegisteredClaims
}

type Signer struct {
	issuer     string
	aud        string
	secret     []byte
	accessTTL  time.Duration
	refreshTTL time.Duration
}

func NewSigner(issuer, aud, secret string, accessTTL, refreshTTL time.Duration) *Signer {
	return &Signer{
		issuer:    issuer,
		aud:       aud,
		secret:    []byte(secret),
		accessTTL: accessTTL, refreshTTL: refreshTTL,
	}
}

func (s *Signer) IssueAccessToken(uid, email, displayName string, roles []string) (string, error) {
	now := time.Now()
	c := Claims{
		UserID:      uid,
		Email:       email,
		DisplayName: displayName,
		Roles:       roles,
		RegisteredClaims: jwtlib.RegisteredClaims{
			Issuer:    s.issuer,
			Audience:  jwtlib.ClaimStrings{s.aud},
			IssuedAt:  jwtlib.NewNumericDate(now),
			ExpiresAt: jwtlib.NewNumericDate(now.Add(s.accessTTL)),
		},
	}
	t := jwtlib.NewWithClaims(jwtlib.SigningMethodHS256, c)
	return t.SignedString(s.secret)
}

func (s *Signer) IssueRefreshToken(uid string) (string, error) {
	now := time.Now()
	rc := jwtlib.RegisteredClaims{
		Issuer:    s.issuer,
		Audience:  jwtlib.ClaimStrings{s.aud},
		Subject:   uid,
		IssuedAt:  jwtlib.NewNumericDate(now),
		ExpiresAt: jwtlib.NewNumericDate(now.Add(s.refreshTTL)),
	}
	t := jwtlib.NewWithClaims(jwtlib.SigningMethodHS256, rc)
	return t.SignedString(s.secret)
}

func (s *Signer) ParseAccess(token string) (*Claims, error) {
	t, err := jwtlib.ParseWithClaims(
		token,
		&Claims{},
		func(t *jwtlib.Token) (any, error) { return s.secret, nil },
		jwtlib.WithAudience(s.aud),
		jwtlib.WithIssuer(s.issuer),
		jwtlib.WithValidMethods([]string{jwtlib.SigningMethodHS256.Alg()}),
		jwtlib.WithLeeway(30*time.Second),
	)
	if err != nil || !t.Valid {
		return nil, errors.New("invalid token")
	}
	c, ok := t.Claims.(*Claims)
	if !ok {
		return nil, errors.New("invalid claims")
	}
	return c, nil
}

func (s *Signer) ParseRefresh(token string) (*jwtlib.RegisteredClaims, error) {
	t, err := jwtlib.ParseWithClaims(
		token,
		&jwtlib.RegisteredClaims{},
		func(t *jwtlib.Token) (any, error) { return s.secret, nil },
		jwtlib.WithAudience(s.aud),
		jwtlib.WithIssuer(s.issuer),
		jwtlib.WithValidMethods([]string{jwtlib.SigningMethodHS256.Alg()}),
		jwtlib.WithLeeway(30*time.Second),
	)
	if err != nil || !t.Valid {
		return nil, errors.New("invalid token")
	}
	rc, ok := t.Claims.(*jwtlib.RegisteredClaims)
	if !ok {
		return nil, errors.New("invalid claims")
	}
	return rc, nil
}
