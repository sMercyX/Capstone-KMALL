package order

import "time"

type Order struct {
	ID          int       `json:"order_id"`
	Status      string    `json:"status"`
	TotalPrice  float64   `json:"total_price"`
	OrderDate   time.Time `json:"order_date"`
	UpdatedAt   time.Time `json:"updated_at"`
	CancelledAt time.Time `json:"cancelled_at"`
	UserID      string    `json:"user_id"`
	StoreID     int       `json:"store_id"`
}

type OrderItem struct {
	ID               int       `json:"order_item_id"`
	Quantity         int       `json:"quantity"`
	UnitPrice        float64   `json:"unit_price"`
	FulfillmentType  string    `json:"fulfillment_type"`
	Subtotal         float64   `json:"subtotal"`
	DepositAmount    *float64  `json:"deposit_amount,omitempty"`
	PromisedShipDate time.Time `json:"promised_ship_date"`
	OrderID          int       `json:"order_id"`
	ProductID        int       `json:"product_id"`
}

type OrderWithItems struct {
	Order Order       `json:"order"`
	Items []OrderItem `json:"items"`
}

type CreateOrderItemInput struct {
	ProductID       int      `json:"product_id"`
	Quantity        int      `json:"quantity"`
	FulfillmentType string   `json:"fulfillment_type"` // STANDARD / EXPRESS
	DepositAmount   *float64 `json:"deposit_amount,omitempty"`
}

type CreateOrderInput struct {
	StoreID int                    `json:"store_id"`
	Items   []CreateOrderItemInput `json:"items"`
}

type UpdateOrderStatusInput struct {
	Status string `json:"status"`
}

type CancelOrderInput struct {
	Reason string `json:"reason"`
}
