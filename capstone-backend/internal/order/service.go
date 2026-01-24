package order

import (
	"context"
	"strings"
	"time"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
	"github.com/Perpasit/Capstone-KMALL/internal/cart"
	"github.com/Perpasit/Capstone-KMALL/internal/product"
)

// ============================================================================
// DTO / Input Types
// ============================================================================
type OrderStatusUpdateInput struct {
	Status string `json:"status"`
}

// ============================================================================
// Service Interface
// ============================================================================

type Service interface {
	CreateFromCart(ctx context.Context, userID string, in CheckoutConfirmInput) (OrderWithItems, error)
	GetOrderWithItems(ctx context.Context, id int64) (OrderWithItems, error)
	UpdateStatus(ctx context.Context, id int64, in OrderStatusUpdateInput) (Order, error)
	Cancel(ctx context.Context, id int64) (Order, error)

	ListBuyerOrders(ctx context.Context, userID string, statusGroup string) ([]Order, error)
	ListStoreOrders(ctx context.Context, storeID int64, statusGroup string) ([]Order, error)
}

type service struct {
	repo       Repo
	cartSvc    cart.Service
	productSvc product.Service
}

func NewService(r Repo, c cart.Service, p product.Service) Service {
	return &service{
		repo:       r,
		cartSvc:    c,
		productSvc: p,
	}
}

// ============================================================================
// Validators
// ============================================================================

var allowedStatuses = map[string]struct{}{
	"Pending":          {},
	"Proposed":         {},
	"Accepted":         {},
	"Out For Delivery": {},
	"Arrived":          {},
	"Completed":        {},
	"Cancelled":        {},
}

var statusGroups = map[string][]string{
	"active": {
		"Pending",
		"Proposed",
		"Accepted",
		"Out For Delivery",
		"Arrived",
	},
	"completed": {"Completed"},
	"cancelled": {"Cancelled"},
}

func validateStatus(status string) error {
	status = strings.TrimSpace(status)
	if status == "" {
		return apperr.New(apperr.BadRequest, "status is required")
	}
	if _, ok := allowedStatuses[status]; !ok {
		return apperr.New(apperr.BadRequest, "invalid order status")
	}
	return nil
}

func validateCheckoutInput(in *CheckoutConfirmInput) error {
	in.FulfillmentType = strings.ToUpper(strings.TrimSpace(in.FulfillmentType))
	if in.FulfillmentType == "" {
		in.FulfillmentType = "STANDARD"
	}
	if in.FulfillmentType != "STANDARD" && in.FulfillmentType != "EXPRESS" {
		return apperr.New(apperr.BadRequest, "fulfillment_type must be STANDARD or EXPRESS")
	}
	return nil
}

func mapStatusGroup(group string) ([]string, error) {
	g := strings.ToLower(strings.TrimSpace(group))
	if g == "" || g == "all" {
		return nil, nil // คือไม่ filter ตาม group
	}

	statuses, ok := statusGroups[g]
	if !ok {
		return nil, apperr.New(apperr.BadRequest, "invalid status_group")
	}
	return statuses, nil
}

func validateDelivery(in *CheckoutConfirmInput) error {
	in.DeliveryMethod = strings.ToUpper(strings.TrimSpace(in.DeliveryMethod))
	if in.DeliveryMethod == "" {
		in.DeliveryMethod = "ROUND_UNIVERSITY"
	}

	switch in.DeliveryMethod {
	case "CAMPUS":
		if in.CampusLocationID == nil || *in.CampusLocationID <= 0 {
			return apperr.New(apperr.BadRequest, "campus_location_id is required for CAMPUS")
		}
		in.DeliveryAddressID = nil

	case "ROUND_UNIVERSITY":
		if in.DeliveryAddressID == nil || *in.DeliveryAddressID <= 0 {
			return apperr.New(apperr.BadRequest, "delivery_address_id is required for ROUND_UNIVERSITY")
		}
		in.CampusLocationID = nil
		in.CampusDetailNote = nil

	default:
		return apperr.New(apperr.BadRequest, "delivery_method must be CAMPUS or ROUND_UNIVERSITY")
	}

	return nil
}

// ============================================================================
// Service Methods
// ============================================================================

// CreateFromCart แปลง cart ของ user → order + order_items
func (s *service) CreateFromCart(ctx context.Context, userID string, in CheckoutConfirmInput) (OrderWithItems, error) {
	if userID == "" {
		return OrderWithItems{}, apperr.New(apperr.BadRequest, "invalid user_id")
	}
	if err := validateCheckoutInput(&in); err != nil {
		return OrderWithItems{}, err
	}
	if err := validateDelivery(&in); err != nil {
		return OrderWithItems{}, err
	}

	cw, err := s.cartSvc.GetCart(ctx, userID)
	if err != nil {
		return OrderWithItems{}, err
	}
	if len(cw.Items) == 0 {
		return OrderWithItems{}, apperr.New(apperr.BadRequest, "cart is empty")
	}

	var (
		storeID    int
		totalPrice float64
		items      []OrderItemCreateParams
	)

	for i, ci := range cw.Items {
		if ci.Quantity <= 0 {
			return OrderWithItems{}, apperr.New(apperr.BadRequest, "cart item quantity must be positive")
		}

		p, err := s.productSvc.Get(ctx, int64(ci.ProductID))
		if err != nil {
			return OrderWithItems{}, err
		}

		if i == 0 {
			storeID = p.StoreID
		} else if p.StoreID != storeID {
			return OrderWithItems{}, apperr.New(apperr.BadRequest, "cart contains items from multiple stores")
		}

		unit := p.Price
		sub := unit * float64(ci.Quantity)
		totalPrice += sub

		items = append(items, OrderItemCreateParams{
			Quantity:         ci.Quantity,
			UnitPrice:        unit,
			FulfillmentType:  in.FulfillmentType,
			Subtotal:         sub,
			DepositAmount:    in.DepositAmount,
			PromisedShipDate: time.Time{},
			ProductID:        ci.ProductID,
		})

	}

	params := OrderCreateParams{
		Status:     "Pending",
		TotalPrice: totalPrice,
		UserID:     userID,
		StoreID:    storeID,

		DeliveryMethod:    in.DeliveryMethod,
		DeliveryAddressID: in.DeliveryAddressID,
		CampusLocationID:  in.CampusLocationID,
		CampusDetailNote:  in.CampusDetailNote,
	}

	ow, err := s.repo.CreateOrderWithItems(ctx, params, items)
	if err != nil {
		return OrderWithItems{}, err
	}

	for _, ci := range cw.Items {
		if err := s.cartSvc.DeleteItem(ctx, userID, int64(ci.ID)); err != nil {
			return ow, apperr.Wrap(apperr.Internal, err, "order created but failed to clear cart")
		}
	}

	return ow, nil
}

func (s *service) GetOrderWithItems(ctx context.Context, id int64) (OrderWithItems, error) {
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

func (s *service) UpdateStatus(ctx context.Context, id int64, in OrderStatusUpdateInput) (Order, error) {
	if id <= 0 {
		return Order{}, apperr.New(apperr.BadRequest, "invalid order_id")
	}
	if err := validateStatus(in.Status); err != nil {
		return Order{}, err
	}

	ord, err := s.repo.UpdateOrderStatus(ctx, id, in.Status)
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

func (s *service) ListBuyerOrders(ctx context.Context, userID string, statusGroup string) ([]Order, error) {
	if userID == "" {
		return nil, apperr.New(apperr.BadRequest, "invalid user_id")
	}

	statuses, err := mapStatusGroup(statusGroup)
	if err != nil {
		return nil, err
	}

	orders, err := s.repo.ListByUserID(ctx, userID, statuses)
	if err != nil {
		return nil, err
	}
	return orders, nil
}

func (s *service) ListStoreOrders(ctx context.Context, storeID int64, statusGroup string) ([]Order, error) {
	if storeID <= 0 {
		return nil, apperr.New(apperr.BadRequest, "invalid store_id")
	}

	statuses, err := mapStatusGroup(statusGroup)
	if err != nil {
		return nil, err
	}

	orders, err := s.repo.ListByStoreID(ctx, storeID, statuses)
	if err != nil {
		return nil, err
	}
	return orders, nil
}
