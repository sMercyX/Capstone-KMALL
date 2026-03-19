package order

import (
	"context"
	"log"
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
	UpdateStatus(ctx context.Context, actorUserID string, id int64, in OrderStatusUpdateInput) (Order, error)
	Propose(ctx context.Context, actorUserID string, id int64, in ProposeSuggestInput) (Order, error)
	AcceptProposed(ctx context.Context, actorUserID string, id int64, in AcceptProposedInput) (Order, error)
	Cancel(ctx context.Context, actorUserID string, id int64, reason string) (Order, error)
	ListBuyerOrders(ctx context.Context, userID string, statusGroup string, q string, limit, page int) ([]Order, int64, error)
	ListStoreOrders(ctx context.Context, storeID int64, statusGroup string, q string, limit, page int) ([]Order, int64, error)
	CancelOrdersByUserRole(ctx context.Context, actorUserID, userID, role, reason string) ([]int64, error)
	CancelOrdersByStore(ctx context.Context, actorUserID string, storeID int64, reason string) ([]int64, error)
}

// ============================================================================
// Notifier
// ============================================================================

type Notifier interface {
	BroadcastToRoom(roomID string, message interface{})
	IsUserInRoom(roomID string, userID string) bool
}

// ============================================================================
// service struct
// ============================================================================

type service struct {
	repo       Repo
	cartSvc    cart.Service
	productSvc product.Service
	storeSvc   store.Service
	notifier   Notifier
	noti       notification.Service
	banSvc     BanProvider
}

type BanProvider interface {
	ListActiveBans(ctx context.Context, userID string) ([]UserBlacklist, error)
}

type UserBlacklist struct {
	BanType     string     `json:"ban_type"`
	BannedFrom  time.Time  `json:"banned_from"`
	BannedUntil *time.Time `json:"banned_until"`
	IsActive    bool       `json:"is_active"`
	Reason      string     `json:"reason"`
	UserRole    string     `json:"user_role"`
}

func NewService(
	r Repo,
	c cart.Service,
	p product.Service,
	st store.Service,
	n Notifier,
	noti notification.Service,
	ban BanProvider,
) Service {
	return &service{
		repo: r, cartSvc: c, productSvc: p, storeSvc: st,
		notifier: n, noti: noti, banSvc: ban,
	}
}

// ============================================================================
// Helpers
// ============================================================================

func (s *service) shouldSkipNotiForOrderRoom(orderID int64, recipientUserID string) bool {
	if s.notifier == nil {
		return false
	}
	roomID := "order_" + strconv.FormatInt(orderID, 10)
	if lg, ok := s.notifier.(interface{ LogRoomUsers(string) }); ok {
		lg.LogRoomUsers(roomID)
	}
	inRoom := s.notifier.IsUserInRoom(roomID, recipientUserID)
	log.Printf("[NOTI] check order room: room=%s recipient=%s inRoom=%v", roomID, recipientUserID, inRoom)
	return inRoom
}

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
		"Pending", "Proposed", "Accepted", "Out For Delivery", "Arrived",
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
		return nil, nil
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
			return apperr.New(apperr.BadRequest, "delivery_address_id is required for ROUND_UNIVERSITY")
		}
		in.CampusLocationID = nil
		in.CampusDetailNote = nil

	default:
		return apperr.New(apperr.BadRequest, "delivery_method must be CAMPUS or ROUND_UNIVERSITY")
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

func strPtr(s string) *string {
	v := strings.TrimSpace(s)
	if v == "" {
		return nil
	}
	return &v
}

func (s *service) notifyUpdate(ctx context.Context, orderID int64) {
	items, err := s.repo.ListItemsByOrderID(ctx, orderID)
	if err != nil {
		return
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
	roomID := "order_" + strconv.FormatInt(orderID, 10)
	s.notifier.BroadcastToRoom(roomID, payload)
}

func (s *service) getBlockingBanByRole(ctx context.Context, userID, role string) (*UserBlacklist, error) {
	if s.banSvc == nil {
		return nil, nil
	}
	bans, err := s.banSvc.ListActiveBans(ctx, userID)
	if err != nil {
		if apperr.Is(err, apperr.NotFound) {
			return nil, nil
		}
		return nil, err
	}
	for i := range bans {
		b := bans[i]
		if !b.IsActive {
			continue
		}
		if !strings.EqualFold(strings.TrimSpace(b.UserRole), strings.TrimSpace(role)) {
			continue
		}
		if strings.EqualFold(b.BanType, "WARNING") {
			continue
		}
		if strings.EqualFold(b.BanType, "TEMPORARY") || strings.EqualFold(b.BanType, "PERMANENT") {
			return &b, nil
		}
	}
	return nil, nil
}

func banCancelReason(b *UserBlacklist) string {
	return "AUTO_CANCELLED_DUE_TO_" +
		strings.ToUpper(strings.TrimSpace(b.BanType)) + "_" +
		strings.ToUpper(strings.TrimSpace(b.Reason)) + "_" +
		strings.ToUpper(strings.TrimSpace(b.UserRole))
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

func isAutoCancelDueToBan(ord Order, to string) bool {
	if to != "Cancelled" {
		return false
	}
	if ord.CancelledReason == nil {
		return false
	}
	return strings.HasPrefix(strings.ToUpper(strings.TrimSpace(*ord.CancelledReason)), "AUTO_CANCELLED_DUE_TO_")
}

// ============================================================================
// CreateFromCart
// ============================================================================

func (s *service) CreateFromCart(ctx context.Context, userID string, in CheckoutConfirmInput) (OrderWithItems, error) {
	if strings.TrimSpace(userID) == "" {
		return OrderWithItems{}, apperr.New(apperr.BadRequest, "invalid user_id")
	}
	if err := validateCheckoutInput(&in); err != nil {
		return OrderWithItems{}, err
	}
	if err := validateDelivery(&in); err != nil {
		return OrderWithItems{}, err
	}

	// Buyer ban check
	if b, err := s.getBlockingBanByRole(ctx, userID, "BUYER"); err != nil {
		return OrderWithItems{}, err
	} else if b != nil {
		_, _ = s.repo.BulkCancelActiveOrdersByBuyer(ctx, userID, banCancelReason(b))
		return OrderWithItems{}, apperr.New(apperr.Forbidden, "buyer is banned, cannot create order")
	}

	// Get cart
	cw, err := s.cartSvc.GetCart(ctx, userID)
	if err != nil {
		return OrderWithItems{}, err
	}
	if len(cw.Items) == 0 {
		return OrderWithItems{}, apperr.New(apperr.BadRequest, "cart is empty")
	}

	var (
		storeID     int
		itemsTotal  float64
		deliveryFee float64
		items       []OrderItemCreateParams
	)

	for i, ci := range cw.Items {
		if ci.Quantity <= 0 {
			return OrderWithItems{}, apperr.New(apperr.BadRequest, "cart item quantity must be positive")
		}

		p, err := s.productSvc.Get(ctx, int64(ci.ProductID))
		if err != nil {
			return OrderWithItems{}, err
		}

		// Validate single-store + compute delivery fee once
		if i == 0 {
			storeID = p.StoreID

			st, err := s.storeSvc.Get(ctx, int64(storeID))
			if err != nil {
				return OrderWithItems{}, err
			}
			if st.IsActive != "YES" {
				return OrderWithItems{}, apperr.New(apperr.BadRequest, "store is not active, cannot place order")
			}

			if strings.EqualFold(strings.TrimSpace(in.DeliveryMethod), "ROUND_UNIVERSITY") {
				if !st.DeliveryRoundUniversityEnabled {
					return OrderWithItems{}, apperr.New(apperr.BadRequest, "store does not support ROUND_UNIVERSITY delivery")
				}
				if st.RoundUniBaseFee == nil {
					return OrderWithItems{}, apperr.New(apperr.BadRequest, "store round university base fee is not set")
				}
				if *st.RoundUniBaseFee < 0 {
					return OrderWithItems{}, apperr.New(apperr.BadRequest, "store round university base fee is invalid")
				}
				deliveryFee = *st.RoundUniBaseFee
			}
		} else if p.StoreID != storeID {
			return OrderWithItems{}, apperr.New(apperr.BadRequest, "cart contains items from multiple stores")
		}

		// ===== unit price = base price + price_delta (จาก CartItemView) =====
		// CartItemView.ProductPrice คือ base + delta แล้ว (คำนวณใน ListItemViewsByCartID)
		unit := ci.ProductPrice
		sub := unit * float64(ci.Quantity)
		itemsTotal += sub

		items = append(items, OrderItemCreateParams{
			Quantity:         ci.Quantity,
			UnitPrice:        unit,
			FulfillmentType:  in.FulfillmentType,
			Subtotal:         sub,
			DepositAmount:    in.DepositAmount,
			PromisedShipDate: time.Time{},
			ProductID:        ci.ProductID,
			VariantID:        ci.VariantID, // nil = PREORDER, not nil = STOCK (repo จะ deduct stock)
			Note:             ci.Note,
		})
	}

	grandTotal := itemsTotal + deliveryFee

	params := OrderCreateParams{
		Status:      "Pending",
		TotalPrice:  grandTotal,
		DeliveryFee: deliveryFee,
		UserID:      userID,
		StoreID:     storeID,

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

	// Clear cart
	if err := s.cartSvc.ClearCart(ctx, userID); err != nil {
		return ow, apperr.Wrap(apperr.Internal, err, "order created but failed to clear cart")
	}

	return ow, nil
}

// ============================================================================
// GetOrderWithItems
// ============================================================================

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
	return OrderWithItems{Order: ord, Items: items}, nil
}

// ============================================================================
// UpdateStatus
// ============================================================================

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
		if b, err := s.getBlockingBanByRole(ctx, actorUserID, "SELLER"); err != nil {
			return Order{}, err
		} else if b != nil {
			_, _ = s.repo.BulkCancelActiveOrdersByStoreID(ctx, int64(ord.StoreID), banCancelReason(b))
			ord, _ = s.repo.GetOrder(ctx, id)
			s.notifyUpdate(ctx, id)
			return Order{}, apperr.New(apperr.Forbidden, "seller is banned, cannot update order")
		}

		if from == "Pending" && strings.ToUpper(strings.TrimSpace(ord.DeliveryMethod)) == "ROUND_UNIVERSITY" {
			if to != "Accepted" {
				return Order{}, apperr.New(apperr.BadRequest, "ROUND_UNIVERSITY seller can only move Pending -> Accepted")
			}
			ord, err = s.repo.UpdateOrderStatus(ctx, id, to)
			if err == nil {
				s.notifyUpdate(ctx, id)
				s.updateOrderStatusNotiBestEffort(ctx, ord, actorUserID, from, to)
			}
			return ord, err
		}

		if !allowedSellerTransition(from, to) {
			return Order{}, apperr.New(apperr.BadRequest, "seller cannot change status like this")
		}

	case isBuyer:
		if from == "Proposed" && to == "Accepted" {
			if b, err := s.getBlockingBanByRole(ctx, actorUserID, "BUYER"); err != nil {
				return Order{}, err
			} else if b != nil {
				_, _ = s.repo.BulkCancelActiveOrdersByBuyer(ctx, actorUserID, banCancelReason(b))
				_, _ = s.repo.CancelOrder(ctx, id, "SYSTEM", banCancelReason(b))
				s.notifyUpdate(ctx, id)
				return Order{}, apperr.New(apperr.Forbidden, "buyer is banned, cannot accept order")
			}
		}
		if !allowedBuyerTransition(from, to) {
			return Order{}, apperr.New(apperr.BadRequest, "buyer cannot change status like this")
		}
	}

	ord, err = s.repo.UpdateOrderStatus(ctx, id, to)
	if err == nil {
		s.notifyUpdate(ctx, id)
		s.updateOrderStatusNotiBestEffort(ctx, ord, actorUserID, from, to)
	}
	return ord, err
}

// ============================================================================
// Cancel
// ============================================================================

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
		s.updateOrderStatusNotiBestEffort(ctx, ord, actorUserID, from, "Cancelled")
	}
	return ord, err
}

// ============================================================================
// Propose / AcceptProposed
// ============================================================================

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

	if b, err := s.getBlockingBanByRole(ctx, actorUserID, "SELLER"); err != nil {
		return Order{}, err
	} else if b != nil {
		_, _ = s.repo.CancelOrder(ctx, id, "SYSTEM", banCancelReason(b))
		s.notifyUpdate(ctx, id)
		return Order{}, apperr.New(apperr.Forbidden, "seller is banned, cannot propose")
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

func (s *service) AcceptProposed(ctx context.Context, actorUserID string, id int64, in AcceptProposedInput) (Order, error) {
	actorUserID = strings.TrimSpace(actorUserID)
	if actorUserID == "" {
		return Order{}, apperr.New(apperr.BadRequest, "invalid actor_user_id")
	}
	if id <= 0 {
		return Order{}, apperr.New(apperr.BadRequest, "invalid order_id")
	}

	ord, err := s.repo.GetOrder(ctx, id)
	if err != nil {
		return Order{}, err
	}

	if strings.ToUpper(strings.TrimSpace(ord.DeliveryMethod)) != "CAMPUS" {
		return Order{}, apperr.New(apperr.BadRequest, "accept proposal is only available for CAMPUS orders")
	}

	if !s.isBuyer(ord, actorUserID) {
		return Order{}, apperr.New(apperr.Forbidden, "only buyer can accept/reject proposal")
	}
	if ord.Status != "Proposed" {
		return Order{}, apperr.New(apperr.BadRequest, "can accept/reject only when status is Proposed")
	}

	if b, err := s.getBlockingBanByRole(ctx, actorUserID, "BUYER"); err != nil {
		return Order{}, err
	} else if b != nil {
		_, _ = s.repo.BulkCancelActiveOrdersByStoreID(ctx, int64(ord.StoreID), banCancelReason(b))
		ord, _ = s.repo.GetOrder(ctx, id)
		s.notifyUpdate(ctx, id)
		return Order{}, apperr.New(apperr.Forbidden, "buyer is banned, cannot accept proposal")
	}

	from := ord.Status
	ord, err = s.repo.RespondProposal(ctx, id, in.Accept)
	if err != nil {
		return Order{}, err
	}

	s.notifyUpdate(ctx, id)
	s.updateOrderStatusNotiBestEffort(ctx, ord, actorUserID, from, ord.Status)
	return ord, nil
}

// ============================================================================
// List
// ============================================================================

func (s *service) ListBuyerOrders(ctx context.Context, userID, statusGroup, q string, limit, page int) ([]Order, int64, error) {
	if strings.TrimSpace(userID) == "" {
		return nil, 0, apperr.New(apperr.BadRequest, "invalid user_id")
	}
	statuses, err := mapStatusGroup(statusGroup)
	if err != nil {
		return nil, 0, err
	}
	return s.repo.ListByUserID(ctx, userID, statuses, q, limit, page)
}

func (s *service) ListStoreOrders(ctx context.Context, storeID int64, statusGroup, q string, limit, page int) ([]Order, int64, error) {
	if storeID <= 0 {
		return nil, 0, apperr.New(apperr.BadRequest, "invalid store_id")
	}
	statuses, err := mapStatusGroup(statusGroup)
	if err != nil {
		return nil, 0, err
	}
	return s.repo.ListByStoreID(ctx, storeID, statuses, q, limit, page)
}

// ============================================================================
// Bulk Cancel
// ============================================================================

func (s *service) CancelOrdersByUserRole(ctx context.Context, actorUserID, userID, role, reason string) ([]int64, error) {
	actorUserID = strings.TrimSpace(actorUserID)
	role = strings.ToUpper(strings.TrimSpace(role))
	userID = strings.TrimSpace(userID)
	reason = strings.TrimSpace(reason)

	if actorUserID == "" {
		return nil, apperr.New(apperr.BadRequest, "invalid actor_user_id")
	}
	if userID == "" {
		return nil, apperr.New(apperr.BadRequest, "invalid user_id")
	}
	if reason == "" {
		return nil, apperr.New(apperr.BadRequest, "cancel reason is required")
	}

	switch role {
	case "BUYER":
		cancelled, err := s.repo.BulkCancelActiveOrdersByBuyer(ctx, userID, reason)
		if err != nil {
			return nil, err
		}
		ids := make([]int64, 0, len(cancelled))
		for _, c := range cancelled {
			ids = append(ids, c.OrderID)
			ord, e := s.repo.GetOrder(ctx, c.OrderID)
			if e != nil {
				continue
			}
			s.notifyUpdate(ctx, c.OrderID)
			_ = s.updateOrderStatusNotiBestEffort(ctx, ord, actorUserID, c.OldStatus, "Cancelled")
			if !strings.EqualFold(actorUserID, ord.UserID) {
				_ = s.updateOrderStatusNotiBestEffort(ctx, ord, ord.UserID, c.OldStatus, "Cancelled")
			}
		}
		return ids, nil

	case "SELLER":
		return nil, apperr.New(apperr.BadRequest, "use CancelOrdersByStore for SELLER")

	default:
		return nil, apperr.New(apperr.BadRequest, "role must be BUYER or SELLER")
	}
}

func (s *service) CancelOrdersByStore(ctx context.Context, actorUserID string, storeID int64, reason string) ([]int64, error) {
	actorUserID = strings.TrimSpace(actorUserID)
	reason = strings.TrimSpace(reason)

	if actorUserID == "" {
		return nil, apperr.New(apperr.BadRequest, "invalid actor_user_id")
	}
	if storeID <= 0 {
		return nil, apperr.New(apperr.BadRequest, "invalid store_id")
	}
	if reason == "" {
		return nil, apperr.New(apperr.BadRequest, "cancel reason is required")
	}

	cancelled, err := s.repo.BulkCancelActiveOrdersByStoreID(ctx, storeID, reason)
	log.Printf("[CANCEL] store=%d cancelled_count=%d err=%v", storeID, len(cancelled), err)
	if err != nil {
		return nil, err
	}

	ids := make([]int64, 0, len(cancelled))
	for _, c := range cancelled {
		ids = append(ids, c.OrderID)
		ord, e := s.repo.GetOrder(ctx, c.OrderID)
		if e != nil {
			continue
		}
		s.notifyUpdate(ctx, c.OrderID)
		_ = s.updateOrderStatusNotiBestEffort(ctx, ord, actorUserID, c.OldStatus, "Cancelled")
	}
	return ids, nil
}

// ============================================================================
// Notification helpers
// ============================================================================

func (s *service) createOrderStatusNotiBestEffort(ctx context.Context, ord Order, actorUserID, from, to string) {
	if s.noti == nil {
		return
	}
	actorUserID = strings.TrimSpace(actorUserID)
	if actorUserID == "" {
		return
	}

	recipient := ord.UserID
	if strings.EqualFold(actorUserID, ord.UserID) {
		st, err := s.storeSvc.Get(ctx, int64(ord.StoreID))
		if err != nil {
			return
		}
		recipient = st.UserID.String()
	}
	if strings.EqualFold(recipient, actorUserID) {
		return
	}
	if s.shouldSkipNotiForOrderRoom(int64(ord.ID), recipient) {
		return
	}

	ordID := int64(ord.ID)
	title, body := notification.BuildOrderStatusMessage(from, to)
	newData := map[string]any{"old_status": from, "new_status": to}

	existing, err := s.noti.List(ctx, notification.ListInput{
		UserID:  recipient,
		OrderID: &ordID,
		Types:   []string{"ORDER_STATUS_CHANGED"},
		Limit:   1,
	})
	if err != nil {
		if apperr.Is(err, apperr.NotFound) {
			existing = nil
		} else {
			return
		}
	}

	if len(existing) > 0 {
		isUnread := false
		_, _ = s.noti.UpdateNotification(ctx, notification.UpdateNotificationInput{
			NotificationID: existing[0].ID,
			Title:          strPtr(title),
			Body:           strPtr(body),
			IsRead:         &isUnread,
			Data:           newData,
		})
		return
	}

	_, _ = s.noti.CreateOrderStatus(ctx, notification.CreateOrderStatusNotificationInput{
		RecipientUserID: recipient,
		ActorUserID:     actorUserID,
		OrderID:         ordID,
		StoreID:         int64(ord.StoreID),
		OldStatus:       from,
		NewStatus:       to,
	})
}

func (s *service) updateOrderStatusNotiBestEffort(ctx context.Context, ord Order, actorUserID, from, to string) error {
	if s.noti == nil {
		return nil
	}
	actorUserID = strings.TrimSpace(actorUserID)
	if actorUserID == "" {
		return apperr.New(apperr.BadRequest, "invalid actor_user_id")
	}

	recipient := ord.UserID
	if strings.EqualFold(actorUserID, ord.UserID) {
		st, err := s.storeSvc.Get(ctx, int64(ord.StoreID))
		if err != nil {
			return apperr.Wrap(apperr.Internal, err, "failed to fetch store for notification")
		}
		recipient = st.UserID.String()
	}
	if strings.EqualFold(recipient, actorUserID) {
		return nil
	}
	if !isAutoCancelDueToBan(ord, to) {
		if s.shouldSkipNotiForOrderRoom(int64(ord.ID), recipient) {
			return nil
		}
	}

	ordID := int64(ord.ID)
	title, body := notification.BuildOrderStatusMessage(from, to)
	newData := map[string]any{"old_status": from, "new_status": to}
	if to == "Cancelled" && ord.CancelledReason != nil {
		newData["cancel_reason"] = strings.TrimSpace(*ord.CancelledReason)
	}

	existing, err := s.noti.List(ctx, notification.ListInput{
		UserID:  recipient,
		OrderID: &ordID,
		Types:   []string{"ORDER_STATUS_CHANGED"},
		Limit:   1,
	})
	if err != nil {
		if apperr.Is(err, apperr.NotFound) {
			existing = nil
		} else {
			log.Printf("[NOTI] list failed: recipient=%s order=%d err=%v", recipient, ordID, err)
			return nil
		}
	}

	if len(existing) > 0 {
		isUnread := false
		_, _ = s.noti.UpdateNotification(ctx, notification.UpdateNotificationInput{
			NotificationID: existing[0].ID,
			Title:          strPtr(title),
			Body:           strPtr(body),
			IsRead:         &isUnread,
			Data:           newData,
		})
		return nil
	}

	_, _ = s.noti.CreateOrderStatus(ctx, notification.CreateOrderStatusNotificationInput{
		RecipientUserID: recipient,
		ActorUserID:     actorUserID,
		OrderID:         ordID,
		StoreID:         int64(ord.StoreID),
		OldStatus:       from,
		NewStatus:       to,
	})
	return nil
}
