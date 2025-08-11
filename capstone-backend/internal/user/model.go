package user

type User struct {
	ID          string  `json:"id"`
	MSID        string  `json:"ms_id"`
	Email       string  `json:"email"`
	DisplayName string  `json:"display_name"`
	ProfileURL  *string `json:"profile_url,omitempty"`
}
