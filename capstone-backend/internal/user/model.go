package user

import (
	"time"
	"database/sql"
)



type User struct {
	ID          string    `db:"id"`
	MSID        string    `db:"ms_id"`
	Email       string    `db:"email"`
	DisplayName string    `db:"display_name"`
	ProfileURL  sql.NullString    `db:"profile_url"`
	CreatedAt   time.Time `db:"created_at"`
	LastLogin   time.Time `db:"last_login"`
}
