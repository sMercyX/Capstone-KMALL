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
	ID        int `json:"id"`
	CartID    int `json:"cart_id"`
	ProductID int `json:"product_id"`
	Quantity  int `json:"quantity"`
}

type CartItemView struct {
	ID              int     `json:"id"`
	CartID          int     `json:"cart_id"`
	ProductID       int     `json:"product_id"`
	ProductName     string  `json:"product_name"`
	ProductImageURL string  `json:"product_image_url"`
	ProductPrice    float64 `json:"product_price"`
	StoreID         int     `json:"store_id"`
	StoreName       string  `json:"store_name"`
	Quantity        int     `json:"quantity"`
	Subtotal        float64 `json:"subtotal"`
}

// ===== Params struct สำหรับ repo =====

type CartItemCreateParams struct {
	CartID    int
	ProductID int
	Quantity  int
}

type CartItemUpdateQtyParams struct {
	Quantity int
}
