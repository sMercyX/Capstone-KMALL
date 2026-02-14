package order

import "time"

type Order struct {
	ID          int        `json:"id"`
	Status      string     `json:"status"`
	TotalPrice  float64    `json:"total_price"`
	OrderDate   time.Time  `json:"order_date"`
	UpdatedAt   time.Time  `json:"updated_at"`
	CancelledAt *time.Time `json:"cancelled_at,omitempty"`

	CancelledBy     *string `json:"cancelled_by,omitempty"`
	CancelledReason *string `json:"cancelled_reason,omitempty"`

	UserID  string `json:"user_id"`
	StoreID int    `json:"store_id"`

	DeliveryMethod    string  `json:"delivery_method"`
	DeliveryAddressID *int64  `json:"delivery_address_id,omitempty"`
	CampusLocationID  *int    `json:"campus_location_id,omitempty"`
	CampusDetailNote  *string `json:"campus_detail_note,omitempty"`

	ProposedAt        *time.Time `json:"proposed_at,omitempty"`
	MeetingLocationID *int       `json:"meeting_location_id,omitempty"`
	MeetingNote       *string    `json:"meeting_note,omitempty"`
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

type OrderItemWithProduct struct {
	OrderItem
	ProductName     string  `json:"product_name"`
	ProductImageURL *string `json:"product_image_url,omitempty"`
}

type OrderWithItems struct {
	Order           Order                  `json:"order"`
	Items           []OrderItemWithProduct `json:"items"`
	StoreProfileURL *string                `json:"store_profile_url,omitempty"`
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

type CheckoutConfirmInput struct {
	FulfillmentType string   `json:"fulfillment_type"`
	DepositAmount   *float64 `json:"deposit_amount"`

	DeliveryMethod    string `json:"delivery_method"`
	DeliveryAddressID *int64 `json:"delivery_address_id,omitempty"`

	CampusLocationID *int    `json:"campus_location_id,omitempty"`
	CampusDetailNote *string `json:"campus_detail_note,omitempty"`
}
