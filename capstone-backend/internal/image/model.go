package images

import (
	"time"
)

// ===== Store Images =====
type StoreImage struct {
	ID        int       `db:"store_image_id" json:"id"`
	StoreID   int       `db:"store_id" json:"store_id"`
	ImageURL  string    `db:"image_url" json:"image_url"`
	SortOrder int       `db:"sort_order" json:"sort_order"`
	IsPrimary bool      `db:"is_primary" json:"is_primary"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

// insert
type StoreImageCreateInput struct {
	StoreID   int    `json:"store_id"`
	ImageURL  string `json:"image_url"`
	SortOrder int    `json:"sort_order"`
	IsPrimary bool   `json:"is_primary"`
}

// update partial
type StoreImageUpdateInput struct {
	ImageURL  *string `json:"image_url,omitempty"`
	SortOrder *int    `json:"sort_order,omitempty"`
	IsPrimary *bool   `json:"is_primary,omitempty"`
}

// ===== Product Images =====
type ProductImage struct {
	ID        int       `db:"product_image_id" json:"id"`
	ProductID int       `db:"product_id" json:"product_id"`
	ImageURL  string    `db:"image_url" json:"image_url"`
	SortOrder int       `db:"sort_order" json:"sort_order"`
	IsPrimary bool      `db:"is_primary" json:"is_primary"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

type ProductImageCreateInput struct {
	ProductID int    `json:"product_id"`
	ImageURL  string `json:"image_url"`
	SortOrder int    `json:"sort_order"`
	IsPrimary bool   `json:"is_primary"`
}

type ProductImageUpdateInput struct {
	ImageURL  *string `json:"image_url,omitempty"`
	SortOrder *int    `json:"sort_order,omitempty"`
	IsPrimary *bool   `json:"is_primary,omitempty"`
}
