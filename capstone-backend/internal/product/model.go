package product

import (
	"time"
)

type Product struct {
	ID          int       `db:"product_id"  json:"id"`
	Name        string    `db:"name"        json:"name"`
	Description *string   `db:"product_desc" json:"description,omitempty"`
	Price       float64   `db:"price"       json:"price"`
	ImageURL    *string   `db:"image_url"   json:"image_url,omitempty"`
	CreatedAt   time.Time `db:"created_at"  json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at"  json:"updated_at"`
	IsActive    string    `db:"is_active"   json:"is_active"`
	StoreID     int       `db:"store_id"    json:"store_id"`
	CategoryID  int       `db:"category_id" json:"category_id"`
}
