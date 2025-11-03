package user

import (
	"time"
)

type User struct {
	ID          string    `db:"user_id"`
	MSID        string    `db:"kms_id"`
	Email       string    `db:"email"`
	DisplayName string    `db:"display_name"`
	CreatedAt   time.Time `db:"created_at"`
	UpdatedAt   time.Time `db:"updated_at"`
	LastLogin   time.Time `db:"last_login"`
}
