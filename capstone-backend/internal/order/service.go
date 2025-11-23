package order

import (
	"context"
	"strings"
	"time"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
)

// ============================================================================
// Domain / Input Types
// ============================================================================

type OrderStatus string

const (
	StatusPendingSellerConfirmation OrderStatus = "Pending Seller Confirmation"
	StatusAwaitingBuyerConfirmation OrderStatus = "Awaiting Buyer Confirmation"
	StatusReadyForPickup            OrderStatus = "Ready for Pickup"
	StatusReadyForDelivery          OrderStatus = "Ready for Delivery"
	StatusCompleted                 OrderStatus = "Completed"
	StatusCancelled                 OrderStatus = "Cancelled"
)

// ใช้ตอนสร้าง order (มาจาก FE หรือจาก cart ก็ได้)
type OrderItemCreateInput struct {
	ProductID        int        `json:"product_id"`
	Quantity         int        `json:"quantity"`
	UnitPrice        float64    `json:"unit_price"`
	FulfillmentType  string     `json:"fulfillment_type"` // STANDARD / EXPRESS
	DepositAmount    *float64   `json:"deposit_amount"`
	PromisedShipDate *time.Time `json:"promised_ship_date"`
}

type OrderCreateInput struct {
	StoreID int                    `json:"store_id"`
	Items   []OrderItemCreateInput `json:"items"`
}

// ============================================================================
// Service Interface
// ============================================================================

type Service interface {
	Create(ctx context.Context, userID string, in OrderCreateInput) (OrderWithItems, error)
	GetWithItems(ctx context.Context, id int64) (OrderWithItems, error)
	UpdateStatus(ctx context.Context, id int64, status OrderStatus) (Order, error)
	Cancel(ctx context.Context, id int64) (Order, error)
}

type service struct {
	repo Repo
}

func NewService(r Repo) Service {
	return &service{repo: r}
}

// ============================================================================
// Validators
// ============================================================================

func isValidStatus(s OrderStatus) bool {
	switch s {
	case StatusPendingSellerConfirmation,
		StatusAwaitingBuyerConfirmation,
		StatusReadyForPickup,
		StatusReadyForDelivery,
		StatusCompleted,
		StatusCancelled:
		return true
	default:
		return false
	}
}

func validateItemInput(it *OrderItemCreateInput) error {
	if it.ProductID <= 0 {
		return apperr.New(apperr.BadRequest, "product_id must be positive")
	}
	if it.Quantity <= 0 {
		return apperr.New(apperr.BadRequest, "quantity must be positive")
	}
	if it.UnitPrice < 0 {
		return apperr.New(apperr.BadRequest, "unit_price must be non-negative")
	}

	ft := strings.ToUpper(strings.TrimSpace(it.FulfillmentType))
	if ft == "" {
		ft = "STANDARD"
	}
	if ft != "STANDARD" && ft != "EXPRESS" {
		return apperr.New(apperr.BadRequest, "fulfillment_type must be STANDARD or EXPRESS")
	}
	it.FulfillmentType = ft

	return nil
}

func validateCreateInput(in *OrderCreateInput) error {
	if in.StoreID <= 0 {
		return apperr.New(apperr.BadRequest, "store_id must be positive")
	}
	if len(in.Items) == 0 {
		return apperr.New(apperr.BadRequest, "items must not be empty")
	}
	for i := range in.Items {
		if err := validateItemInput(&in.Items[i]); err != nil {
			return err
		}
	}
	return nil
}

// ============================================================================
// Service Methods
// ============================================================================

func (s *service) Create(ctx context.Context, userID string, in OrderCreateInput) (OrderWithItems, error) {
	if strings.TrimSpace(userID) == "" {
		return OrderWithItems{}, apperr.New(apperr.BadRequest, "invalid user_id")
	}
	if err := validateCreateInput(&in); err != nil {
		return OrderWithItems{}, err
	}

	// คำนวณ subtotal/total_price
	var total float64
	paramsItems := make([]OrderItemCreateParams, 0, len(in.Items))

	for _, it := range in.Items {
		subtotal := it.UnitPrice * float64(it.Quantity)
		total += subtotal

		var promised time.Time
		if it.PromisedShipDate != nil {
			promised = *it.PromisedShipDate
		}

		paramsItems = append(paramsItems, OrderItemCreateParams{
			Quantity:         it.Quantity,
			UnitPrice:        it.UnitPrice,
			FulfillmentType:  it.FulfillmentType,
			Subtotal:         subtotal,
			DepositAmount:    it.DepositAmount,
			PromisedShipDate: promised,
			ProductID:        it.ProductID,
		})
	}

	orderParams := OrderCreateParams{
		Status:     string(StatusPendingSellerConfirmation),
		TotalPrice: total,
		UserID:     userID,
		StoreID:    in.StoreID,
	}

	ow, err := s.repo.CreateOrderWithItems(ctx, orderParams, paramsItems)
	if err != nil {
		return OrderWithItems{}, err
	}
	return ow, nil
}

func (s *service) GetWithItems(ctx context.Context, id int64) (OrderWithItems, error) {
	if id <= 0 {
		return OrderWithItems{}, apperr.New(apperr.BadRequest, "invalid order_id")
	}

	ord, err := s.repo.GetOrder(ctx, id)
	if err != nil {
		return OrderWithItems{}, err
	}

	items, err := s.repo.ListItemsByOrderID(ctx, id)
	if err != nil {
		return OrderWithItems{}, err
	}

	return OrderWithItems{
		Order: ord,
		Items: items,
	}, nil
}

func (s *service) UpdateStatus(ctx context.Context, id int64, status OrderStatus) (Order, error) {
	if id <= 0 {
		return Order{}, apperr.New(apperr.BadRequest, "invalid order_id")
	}
	if !isValidStatus(status) {
		return Order{}, apperr.New(apperr.BadRequest, "invalid status")
	}

	ord, err := s.repo.UpdateOrderStatus(ctx, id, string(status))
	if err != nil {
		return Order{}, err
	}
	return ord, nil
}

func (s *service) Cancel(ctx context.Context, id int64) (Order, error) {
	if id <= 0 {
		return Order{}, apperr.New(apperr.BadRequest, "invalid order_id")
	}
	ord, err := s.repo.CancelOrder(ctx, id)
	if err != nil {
		return Order{}, err
	}
	return ord, nil
}
