package store

import (
	"time"

	"github.com/google/uuid"
)

type Store struct {
	ID          int       `db:"store_id" json:"id"`
	Name        string    `db:"store_name" json:"name"`
	Description *string   `db:"store_desc" json:"description,omitempty"`
	ProfileURL  *string   `db:"profile_url" json:"profile_url,omitempty"`
	IsActive    string    `db:"is_active" json:"is_active"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
	UserID      uuid.UUID `db:"user_id" json:"user_id"`
}
