package category

import "time"

type Category struct {
	ID        int       `db:"category_id" json:"id"`
	Name      string    `db:"name"        json:"name"`
	Slug      string    `db:"slug"        json:"slug"`
	ParentID  *int      `db:"parent_id"   json:"parent_id,omitempty"`
	SortOrder int       `db:"sort_order"  json:"sort_order"`
	IsActive  string    `db:"is_active"   json:"is_active"`
	CreatedAt time.Time `db:"created_at"  json:"created_at"`
	UpdatedAt time.Time `db:"updated_at"  json:"updated_at"`
}
