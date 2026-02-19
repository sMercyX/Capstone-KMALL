package order

import (
	"context"
	"strconv"
	"strings"
	"time"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
	"github.com/Perpasit/Capstone-KMALL/internal/cart"
	notification "github.com/Perpasit/Capstone-KMALL/internal/notification"
	"github.com/Perpasit/Capstone-KMALL/internal/product"
	"github.com/Perpasit/Capstone-KMALL/internal/store"
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
	UpdateStatus(
		ctx context.Context,
		actorUserID string,
		id int64,
		in OrderStatusUpdateInput,
	) (Order, error)
	Propose(
		ctx context.Context,
		actorUserID string,
		id int64,
		in ProposeSuggestInput,
	) (Order, error)
	AcceptProposed(
		ctx context.Context,
		actorUserID string,
		id int64,
		in AcceptProposedInput,
	) (Order, error)
	Cancel(ctx context.Context,
		actorUserID string,
		id int64,
		reason string,
	) (Order, error)
	ListBuyerOrders(
		ctx context.Context,
		userID string,
		statusGroup string,
	) ([]Order, error)
	ListStoreOrders(
		ctx context.Context,
		storeID int64,
		statusGroup string,
	) ([]Order, error)
}

// Notifier is an interface for sending notifications
type Notifier interface {
	BroadcastToRoom(roomID string, message interface{})
}

type service struct {
	repo       Repo
	cartSvc    cart.Service
	productSvc product.Service
	storeSvc   store.Service
	notifier   Notifier
	noti       notification.Service
}

func NewService(r Repo, c cart.Service, p product.Service, st store.Service, n Notifier, noti notification.Service) Service {
	return &service{
		repo: r, cartSvc: c, productSvc: p, storeSvc: st,
		notifier: n,
		noti:     noti,
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
		in.DeliveryAddressID = nil
		in.CampusLocationID = nil
		in.CampusDetailNote = nil

	case "ROUND_UNIVERSITY":
		if in.DeliveryAddressID == nil || *in.DeliveryAddressID <= 0 {
			return apperr.New(
				apperr.BadRequest,
				"delivery_address_id is required for ROUND_UNIVERSITY",
			)
		}
		in.CampusLocationID = nil
		in.CampusDetailNote = nil

	default:
		return apperr.New(
			apperr.BadRequest,
			"delivery_method must be CAMPUS or ROUND_UNIVERSITY",
		)
	}

	return nil
}

func validateProposeInput(in ProposeSuggestInput) error {
	if in.ProposedAt.IsZero() {
		return apperr.New(apperr.BadRequest, "proposed_at is required")
	}
	if in.MeetingLocationID == nil || *in.MeetingLocationID <= 0 {
		return apperr.New(apperr.BadRequest, "meeting_location_id is required")
	}
	return nil
}

func (s *service) isBuyer(ord Order, actorUserID string) bool {
	return ord.UserID == actorUserID
}

func (s *service) isStoreOwner(ctx context.Context, ord Order, actorUserID string) (bool, error) {
	st, err := s.storeSvc.Get(ctx, int64(ord.StoreID))
	if err != nil {
		return false, err
	}
	return strings.EqualFold(st.UserID.String(), actorUserID), nil
}

// notifyUpdate broadcasts the latest order state to the room
func (s *service) notifyUpdate(ctx context.Context, orderID int64) {
	// Re-fetch the full order with items to send the latest state
	// We use a background context or the existing context, but simpler to use existing
	// If context is cancelled (e.g. request timeout), we might fail to fetch.
	// But usually notification is best-effort.

	// We need a way to get *full* order details similar to GetOrderWithItems or GetOrderDetail
	// reusing GetOrderWithItems logic:
	items, err := s.repo.ListItemsByOrderID(ctx, orderID)
	if err != nil {
		return // log error?
	}
	ord, err := s.repo.GetOrder(ctx, orderID)
	if err != nil {
		return
	}

	payload := map[string]interface{}{
		"type": "ORDER_UPDATE",
		"data": map[string]interface{}{
			"order": ord,
			"items": items,
		},
	}

	// Room ID: order_{id}
	roomID := "order_" + strconv.FormatInt(orderID, 10)
	s.notifier.BroadcastToRoom(roomID, payload)
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
	s.createOrderStatusNotiBestEffort(ctx, ow.Order, userID, "", "Pending")

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

func (s *service) UpdateStatus(ctx context.Context, actorUserID string, id int64, in OrderStatusUpdateInput) (Order, error) {
	actorUserID = strings.TrimSpace(actorUserID)
	if actorUserID == "" {
		return Order{}, apperr.New(apperr.BadRequest, "invalid actor_user_id")
	}

	if id <= 0 {
		return Order{}, apperr.New(apperr.BadRequest, "invalid order_id")
	}
	if err := validateStatus(in.Status); err != nil {
		return Order{}, err
	}

	ord, err := s.repo.GetOrder(ctx, id)
	if err != nil {
		return Order{}, err
	}

	isBuyer := s.isBuyer(ord, actorUserID)
	isSeller, err := s.isStoreOwner(ctx, ord, actorUserID)
	if err != nil {
		return Order{}, err
	}

	if !isBuyer && !isSeller {
		return Order{}, apperr.New(apperr.Forbidden, "not allowed")
	}

	from := ord.Status
	to := in.Status

	if from == "Completed" || from == "Cancelled" {
		return Order{}, apperr.New(apperr.BadRequest, "cannot change status from completed/cancelled")
	}

	switch {
	case isSeller:
		// allow Pending->Accepted สำหรับ ROUND_UNIVERSITY
		if from == "Pending" && strings.ToUpper(strings.TrimSpace(ord.DeliveryMethod)) == "ROUND_UNIVERSITY" {
			if to != "Accepted" {
				return Order{}, apperr.New(apperr.BadRequest, "ROUND_UNIVERSITY seller can only move Pending -> Accepted")
			}

			ord, err = s.repo.UpdateOrderStatus(ctx, id, to)
			if err == nil {
				s.notifyUpdate(ctx, id)
				s.createOrderStatusNotiBestEffort(ctx, ord, actorUserID, from, to)
			}
			return ord, err
		}

		if !allowedSellerTransition(from, to) {
			return Order{}, apperr.New(apperr.BadRequest, "seller cannot change status like this")
		}

	case isBuyer:
		if !allowedBuyerTransition(from, to) {
			return Order{}, apperr.New(apperr.BadRequest, "buyer cannot change status like this")
		}
	}

	ord, err = s.repo.UpdateOrderStatus(ctx, id, to)
	if err == nil {
		s.notifyUpdate(ctx, id)
		s.createOrderStatusNotiBestEffort(ctx, ord, actorUserID, from, to)
	}
	return ord, err
}

func allowedSellerTransition(from, to string) bool {
	switch from {
	case "Pending":
		return to == "Proposed"
	case "Accepted":
		return to == "Out For Delivery"
	case "Out For Delivery":
		return to == "Arrived"
	case "Arrived":
		return to == "Completed"
	default:
		return false
	}
}

func allowedBuyerTransition(from, to string) bool {
	switch from {
	case "Proposed":
		return to == "Accepted"
	default:
		return false
	}
}

func (s *service) Cancel(ctx context.Context, actorUserID string, id int64, reason string) (Order, error) {
	actorUserID = strings.TrimSpace(actorUserID)
	reason = strings.TrimSpace(reason)

	if actorUserID == "" {
		return Order{}, apperr.New(apperr.BadRequest, "invalid actor_user_id")
	}
	if id <= 0 {
		return Order{}, apperr.New(apperr.BadRequest, "invalid order_id")
	}
	if reason == "" {
		return Order{}, apperr.New(apperr.BadRequest, "cancel reason is required")
	}

	ord, err := s.repo.GetOrder(ctx, id)
	if err != nil {
		return Order{}, err
	}

	if ord.Status == "Completed" || ord.Status == "Cancelled" {
		return Order{}, apperr.New(apperr.BadRequest, "cannot cancel completed or cancelled order")
	}

	isBuyer := s.isBuyer(ord, actorUserID)
	isSeller, err := s.isStoreOwner(ctx, ord, actorUserID)
	if err != nil {
		return Order{}, err
	}
	if !isBuyer && !isSeller {
		return Order{}, apperr.New(apperr.Forbidden, "not allowed to cancel")
	}

	// rules by delivery method
	switch ord.DeliveryMethod {
	case "CAMPUS":
		switch ord.Status {
		case "Pending", "Proposed":
		case "Accepted", "Out For Delivery", "Arrived":
			if !isSeller {
				return Order{}, apperr.New(apperr.Forbidden, "buyer cannot cancel after accepted (campus)")
			}
		default:
			return Order{}, apperr.New(apperr.BadRequest, "cannot cancel in current status (campus)")
		}

	case "ROUND_UNIVERSITY":
		// keep rule as-is for now

	default:
		return Order{}, apperr.New(apperr.BadRequest, "invalid delivery_method")
	}

	cancelledBy := "SYSTEM"
	if isSeller {
		cancelledBy = "SELLER"
	} else if isBuyer {
		cancelledBy = "BUYER"
	}

	from := ord.Status
	ord, err = s.repo.CancelOrder(ctx, id, cancelledBy, reason)
	if err == nil {
		s.notifyUpdate(ctx, id)
		s.createOrderStatusNotiBestEffort(ctx, ord, actorUserID, from, "Cancelled")
	}
	return ord, err
}

func (s *service) Propose(ctx context.Context, actorUserID string, id int64, in ProposeSuggestInput) (Order, error) {
	actorUserID = strings.TrimSpace(actorUserID)
	if actorUserID == "" {
		return Order{}, apperr.New(apperr.BadRequest, "invalid actor_user_id")
	}
	if id <= 0 {
		return Order{}, apperr.New(apperr.BadRequest, "invalid order_id")
	}
	if err := validateProposeInput(in); err != nil {
		return Order{}, err
	}

	ord, err := s.repo.GetOrder(ctx, id)
	if err != nil {
		return Order{}, err
	}

	if strings.ToUpper(strings.TrimSpace(ord.DeliveryMethod)) != "CAMPUS" {
		return Order{}, apperr.New(apperr.BadRequest, "propose is only available for CAMPUS orders")
	}

	isSeller, err := s.isStoreOwner(ctx, ord, actorUserID)
	if err != nil {
		return Order{}, err
	}
	if !isSeller {
		return Order{}, apperr.New(apperr.Forbidden, "only store owner can propose")
	}

	switch ord.Status {
	case "Pending", "Proposed":
	case "Accepted":
		return Order{}, apperr.New(apperr.BadRequest, "cannot propose after accepted")
	default:
		return Order{}, apperr.New(apperr.BadRequest, "cannot propose in this status")
	}

	from := ord.Status

	ord, err = s.repo.Propose(ctx, id, in.ProposedAt, in.MeetingLocationID, in.MeetingNote)
	if err == nil {
		s.notifyUpdate(ctx, id)
		s.createOrderStatusNotiBestEffort(ctx, ord, actorUserID, from, "Proposed")
	}
	return ord, err
}

func (s *service) AcceptProposed(
	ctx context.Context,
	actorUserID string,
	id int64,
	in AcceptProposedInput,
) (Order, error) {

	actorUserID = strings.TrimSpace(actorUserID)
	if actorUserID == "" {
		return Order{}, apperr.New(apperr.BadRequest, "invalid actor_user_id")
	}
	if id <= 0 {
		return Order{}, apperr.New(apperr.BadRequest, "invalid order_id")
	}

	// 1️⃣ โหลด order เดิม
	ord, err := s.repo.GetOrder(ctx, id)
	if err != nil {
		return Order{}, err
	}

	// 2️⃣ ต้องเป็น CAMPUS เท่านั้น
	if strings.ToUpper(strings.TrimSpace(ord.DeliveryMethod)) != "CAMPUS" {
		return Order{}, apperr.New(apperr.BadRequest,
			"accept proposal is only available for CAMPUS orders")
	}

	isBuyer := s.isBuyer(ord, actorUserID)
	if !isBuyer {
		return Order{}, apperr.New(apperr.Forbidden,
			"only buyer can accept/reject proposal")
	}

	if ord.Status != "Proposed" {
		return Order{}, apperr.New(apperr.BadRequest,
			"can accept/reject only when status is Proposed")
	}

	from := ord.Status

	ord, err = s.repo.RespondProposal(ctx, id, in.Accept)
	if err != nil {
		return Order{}, err
	}

	s.notifyUpdate(ctx, id)

	newStatus := ord.Status
	s.createOrderStatusNotiBestEffort(
		ctx,
		ord,
		actorUserID,
		from,
		newStatus,
	)

	return ord, nil
}

func (s *service) createOrderStatusNotiBestEffort(
	ctx context.Context,
	ord Order,
	actorUserID, from, to string,
) {
	if s.noti == nil {
		return
	}

	actorUserID = strings.TrimSpace(actorUserID)
	if actorUserID == "" {
		return
	}

	recipient := ord.UserID // default: notify buyer

	// ถ้า actor เป็น buyer → notify seller(owner)
	if strings.EqualFold(actorUserID, ord.UserID) {
		st, err := s.storeSvc.Get(ctx, int64(ord.StoreID))
		if err != nil {
			return
		}
		recipient = st.UserID.String()
	}

	// กันแจ้งเตือนให้ตัวเอง
	if strings.EqualFold(recipient, actorUserID) {
		return
	}

	_, _ = s.noti.CreateOrderStatus(ctx, notification.CreateOrderStatusNotificationInput{
		RecipientUserID: recipient,
		ActorUserID:     actorUserID,
		OrderID:         int64(ord.ID),
		StoreID:         int64(ord.StoreID),
		OldStatus:       from,
		NewStatus:       to,
	})
}

func (s *service) ListBuyerOrders(ctx context.Context, userID string, statusGroup string) ([]Order, error) {
	if strings.TrimSpace(userID) == "" {
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
