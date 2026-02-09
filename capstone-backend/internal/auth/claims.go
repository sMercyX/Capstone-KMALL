package auth

type UserClaims struct {
	Oid   string `json:"oid"`
	Email string `json:"preferred_username"`
	Name  string `json:"name"`
}
