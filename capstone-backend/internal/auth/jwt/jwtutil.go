package jwtutil

import (
	"encoding/base64"
	"encoding/json"
	"strings"
)

func DecodePayloadMap(authorizationHeader string) (map[string]any, error) {
	parts := strings.Split(strings.TrimPrefix(authorizationHeader, "Bearer "), ".")
	if len(parts) < 2 {
		return nil, nil
	}
	payload := parts[1]
	// base64url decode
	b, err := base64.RawURLEncoding.DecodeString(payload)
	if err != nil {
		return nil, err
	}
	var m map[string]any
	if err := json.Unmarshal(b, &m); err != nil {
		return nil, err
	}
	return m, nil
}
