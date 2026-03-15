package product

import (
	"time"
)

type Product struct {
	ID          int     `db:"product_id"   json:"id"`
	Name        string  `db:"name"         json:"name"`
	Description *string `db:"product_desc" json:"description,omitempty"`
	Price       float64 `db:"price"        json:"price"`
	ImageURL    *string `db:"image_url"    json:"image_url,omitempty"`

	ProductType string `db:"product_type" json:"product_type"` // "STOCK" | "PREORDER"

	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
	IsActive  string    `db:"is_active"  json:"is_active"`

	StoreID      int    `db:"store_id"      json:"store_id"`
	CategoryID   int    `db:"category_id"   json:"category_id"`
	StoreName    string `db:"store_name"    json:"store_name"`
	CategoryName string `db:"category_name" json:"category_name"`
	SoldCount    int64  `db:"sold_count"    json:"sold_count"`

	// STOCK only — populated by GetPublic / GetVariants
	Options  []OptionKey `db:"-" json:"options,omitempty"`
	Variants []Variant   `db:"-" json:"variants,omitempty"`

	EmbeddingName     []float64 `db:"embedding_name"     json:"-"`
	EmbeddingDesc     []float64 `db:"embedding_desc"     json:"-"`
	EmbeddingCategory []float64 `db:"embedding_category" json:"-"`

	TotalStock *int64 `db:"-" json:"total_stock,omitempty"`
}

// ===== Option Keys & Values =====

type OptionKey struct {
	ID        int           `db:"option_key_id" json:"id"`
	ProductID int           `db:"product_id"    json:"product_id"`
	KeyName   string        `db:"key_name"      json:"key_name"`
	SortOrder int           `db:"sort_order"    json:"sort_order"`
	Values    []OptionValue `db:"-"           json:"values"`
}

type OptionValue struct {
	ID          int    `db:"option_value_id" json:"id"`
	OptionKeyID int    `db:"option_key_id"   json:"option_key_id"`
	ValueLabel  string `db:"value_label"     json:"value_label"`
	SortOrder   int    `db:"sort_order"      json:"sort_order"`
}

// ===== Variants =====

type Variant struct {
	ID         int     `db:"variant_id"  json:"id"`
	ProductID  int     `db:"product_id"  json:"product_id"`
	SKU        *string `db:"sku"         json:"sku,omitempty"`
	PriceDelta float64 `db:"price_delta" json:"price_delta"`
	FinalPrice float64 `db:"-"           json:"final_price"`
	StockQty   int     `db:"stock_qty"   json:"stock_qty"`
	IsActive   bool    `db:"is_active"   json:"is_active"`

	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`

	Selections []VariantSelection `db:"-" json:"selections"`
}

type VariantSelection struct {
	KeyName    string `json:"key"`
	ValueLabel string `json:"value"`
}
