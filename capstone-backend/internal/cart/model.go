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
	ProductPrice    float64 `json:"product_price"` // base price + price_delta (ถ้ามี variant)
	StoreID         int     `json:"store_id"`
	StoreName       string  `json:"store_name"`
	Quantity        int     `json:"quantity"`
	Subtotal        float64 `json:"subtotal"`

	// variant info (แสดงให้ user เห็นว่าเลือกอะไร เช่น "สี: แดง, ขนาด: M")
	VariantLabel string `json:"variant_label,omitempty"` // computed จาก selections
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
