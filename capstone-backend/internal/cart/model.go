package cart

import (
	"time"

	"github.com/google/uuid"
)

type Cart struct {
	ID        int       `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type CartItem struct {
	ID        int  `json:"id"`
	CartID    int  `json:"cart_id"`
	ProductID int  `json:"product_id"`
	VariantID *int `json:"variant_id,omitempty"` // NULL = PREORDER, NOT NULL = STOCK
	Quantity  int  `json:"quantity"`
}

type CartItemView struct {
	ID              int     `json:"id"`
	CartID          int     `json:"cart_id"`
	ProductID       int     `json:"product_id"`
	VariantID       *int    `json:"variant_id,omitempty"`
	ProductName     string  `json:"product_name"`
	ProductImageURL string  `json:"product_image_url"`
	ProductPrice    float64 `json:"product_price"`
	StoreID         int     `json:"store_id"`
	StoreName       string  `json:"store_name"`
	Quantity        int     `json:"quantity"`
	Subtotal        float64 `json:"subtotal"`
	VariantLabel    string  `json:"variant_label,omitempty"`

	// เพิ่ม
	StockQty    int  `json:"stock_qty"`    // stock ปัจจุบัน
	IsAvailable bool `json:"is_available"` // stock >= quantity ณ ตอนนี้
}

// ===== Params =====

type CartItemCreateParams struct {
	CartID    int
	ProductID int
	VariantID *int // nil = PREORDER
	Quantity  int
}

type CartItemUpdateParams struct {
	Quantity *int
}
