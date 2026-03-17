package notification

import (
	"context"
	"log"
	"strings"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
)

// ============================================================================
// Helpers
// ============================================================================

func strPtr(s string) *string {
	v := strings.TrimSpace(s)
	if v == "" {
		return nil
	}
	return &v
}

// ============================================================================
// Inputs (Service)
// ============================================================================

type CreateChatNotificationInput struct {
	RecipientUserID string
	ActorUserID     string

	OrderID   int64
	StoreID   int64
	ThreadID  int64
	MessageID int64

	MessageType    string
	MessagePreview *string // optional
}

type CreateOrderStatusNotificationInput struct {
	RecipientUserID string
	ActorUserID     string

	OrderID   int64
	StoreID   int64
	OldStatus string
	NewStatus string
}

type ListInput struct {
	UserID   string
	BeforeID *int64
	Limit    int
	OnlyRead *bool
	Types    []string // optional filter by type(s)

	OrderID  *int64 // optional
	StoreID  *int64 // optional
	ThreadID *int64 // <-- add this line
}

type Notifier interface {
	BroadcastToRoom(roomID string, message interface{})
}

// type MarkReadInput struct {
// 	UserID         string
// 	NotificationID int64
// }

// ============================================================================
// Service Interface
// ============================================================================

type Service interface {
	// domain-specific create
	Create(ctx context.Context, in CreateNotificationInput) (Notification, error)
	CreateChat(ctx context.Context, in CreateChatNotificationInput) (Notification, error)
	CreateOrderStatus(ctx context.Context, in CreateOrderStatusNotificationInput) (Notification, error)

	// generic operations (API)
	List(ctx context.Context, in ListInput) ([]Notification, error)
	MarkRead(ctx context.Context, in MarkReadInput) (Notification, error)
	MarkReadByThread(ctx context.Context, userID string, threadID int64, types []string) (int64, error)
	MarkReadByOrder(ctx context.Context, userID string, orderID int64, types []string) (int64, error)
	Delete(ctx context.Context, userID string, notificationID int64) error
	DeleteAll(ctx context.Context, userID string) (int64, error)
	CountUnread(ctx context.Context, userID string) (int64, error)

	UpdateNotification(ctx context.Context, in UpdateNotificationInput) (Notification, error)

	CreateAdminAction(ctx context.Context, in CreateAdminActionNotificationInput) (Notification, error)

	CreateAnnouncement(ctx context.Context, in CreateAnnouncementInput) (Announcement, error)
}

type service struct {
	repo Repo
	hub  Notifier
}

func NewService(r Repo, hub Notifier) Service {
	return &service{repo: r, hub: hub}
}

func (s *service) broadcastNotification(userID string, n Notification) {
	if s.hub == nil {
		return
	}
	roomID := "notification_" + userID
	s.hub.BroadcastToRoom(roomID, map[string]interface{}{
		"type": "NOTIFICATION",
		"data": n,
	})
}

func (s *service) Create(ctx context.Context, in CreateNotificationInput) (Notification, error) {
	n, err := s.repo.Create(ctx, in)
	if err != nil {
		return Notification{}, err
	}
	s.broadcastNotification(n.UserID, n)
	return n, nil
}

// ============================================================================
// Create (Chat)
// ============================================================================

func (s *service) CreateChat(ctx context.Context, in CreateChatNotificationInput) (Notification, error) {
	in.RecipientUserID = strings.TrimSpace(in.RecipientUserID)
	in.ActorUserID = strings.TrimSpace(in.ActorUserID)

	if in.RecipientUserID == "" {
		return Notification{}, apperr.New(apperr.BadRequest, "invalid recipient_user_id")
	}
	if in.ActorUserID == "" {
		return Notification{}, apperr.New(apperr.BadRequest, "invalid actor_user_id")
	}
	if in.OrderID <= 0 || in.ThreadID <= 0 || in.MessageID <= 0 {
		return Notification{}, apperr.New(apperr.BadRequest, "invalid order_id/thread_id/message_id")
	}

	oid := in.OrderID
	sid := in.StoreID
	tid := in.ThreadID
	mid := in.MessageID
	actor := in.ActorUserID

	title := strPtr("New message")
	body := strPtr("You have a new message.")

	data := map[string]any{
		"message_type": in.MessageType,
	}
	if in.MessagePreview != nil && strings.TrimSpace(*in.MessagePreview) != "" {
		data["message_preview"] = strings.TrimSpace(*in.MessagePreview)
	}

	n, err := s.repo.Create(ctx, CreateNotificationInput{
		UserID:      in.RecipientUserID,
		Type:        "CHAT_NEW_MESSAGE",
		OrderID:     &oid,
		StoreID:     &sid,
		ThreadID:    &tid,
		MessageID:   &mid,
		ActorUserID: &actor,
		Title:       title,
		Body:        body,
		Data:        data,
	})
	if err != nil {
		return Notification{}, err
	}
	s.broadcastNotification(n.UserID, n)
	return n, nil
}

// ============================================================================
// Create (Order Status)
// ============================================================================

func (s *service) CreateOrderStatus(ctx context.Context, in CreateOrderStatusNotificationInput) (Notification, error) {
	in.RecipientUserID = strings.TrimSpace(in.RecipientUserID)
	in.ActorUserID = strings.TrimSpace(in.ActorUserID)
	in.OldStatus = strings.TrimSpace(in.OldStatus)
	in.NewStatus = strings.TrimSpace(in.NewStatus)

	if in.RecipientUserID == "" {
		return Notification{}, apperr.New(apperr.BadRequest, "invalid recipient_user_id")
	}
	if in.ActorUserID == "" {
		return Notification{}, apperr.New(apperr.BadRequest, "invalid actor_user_id")
	}
	if in.OrderID <= 0 {
		return Notification{}, apperr.New(apperr.BadRequest, "invalid order_id")
	}
	if in.StoreID <= 0 {
		return Notification{}, apperr.New(apperr.BadRequest, "invalid store_id")
	}
	if in.NewStatus == "" {
		return Notification{}, apperr.New(apperr.BadRequest, "new_status is required")
	}

	oid := in.OrderID
	sid := in.StoreID
	actor := in.ActorUserID

	title, body := BuildOrderStatusMessage(in.OldStatus, in.NewStatus)

	data := map[string]any{
		"old_status": in.OldStatus,
		"new_status": in.NewStatus,
	}

	n, err := s.repo.Create(ctx, CreateNotificationInput{
		UserID:      in.RecipientUserID,
		Type:        "ORDER_STATUS_CHANGED",
		OrderID:     &oid,
		StoreID:     &sid,
		ActorUserID: &actor,
		Title:       strPtr(title),
		Body:        strPtr(body),
		Data:        data,
	})
	if err != nil {
		return Notification{}, err
	}
	s.broadcastNotification(n.UserID, n)
	return n, nil
}

func BuildOrderStatusMessage(oldStatus, newStatus string) (title, body string) {
	switch newStatus {
	case "Pending":
		return "New order received", "You have a new order."
	case "Proposed":
		return "Seller sent a proposal", "The seller proposed a meeting time/location."
	case "Accepted":
		if oldStatus == "Proposed" {
			return "Proposal accepted", "The buyer accepted the proposal."
		}
		return "Order accepted", "Your order has been accepted."
	case "Out For Delivery":
		return "Out for delivery", "Your order is on the way."
	case "Arrived":
		return "Order arrived", "Your order has arrived. Please confirm when received."
	case "Completed":
		return "Order completed", "This order has been completed."
	case "Cancelled":
		return "Order cancelled", "This order has been cancelled."
	default:
		// fallback
		return "Order status updated", "Order status changed from " + oldStatus + " to " + newStatus + "."
	}
}

// ============================================================================
// Generic operations
// ============================================================================

func (s *service) List(ctx context.Context, in ListInput) ([]Notification, error) {
	in.UserID = strings.TrimSpace(in.UserID)
	if in.UserID == "" {
		return nil, apperr.New(apperr.BadRequest, "invalid user_id")
	}

	return s.repo.List(ctx, ListNotificationsParams{
		UserID:   in.UserID,
		BeforeID: in.BeforeID,
		Limit:    in.Limit,

		OnlyRead: in.OnlyRead,
		Types:    in.Types,

		OrderID:  in.OrderID,
		StoreID:  in.StoreID,
		ThreadID: in.ThreadID,
	})
}

func (s *service) MarkRead(ctx context.Context, in MarkReadInput) (Notification, error) {
	in.UserID = strings.TrimSpace(in.UserID)
	if in.UserID == "" {
		return Notification{}, apperr.New(apperr.BadRequest, "invalid user_id")
	}
	if in.NotificationID <= 0 {
		return Notification{}, apperr.New(apperr.BadRequest, "invalid notification_id")
	}

	return s.repo.MarkRead(ctx, in)
}

func (s *service) Delete(ctx context.Context, userID string, notificationID int64) error {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return apperr.New(apperr.BadRequest, "invalid user_id")
	}
	if notificationID <= 0 {
		return apperr.New(apperr.BadRequest, "invalid notification_id")
	}
	return s.repo.Delete(ctx, userID, notificationID)
}

func (s *service) DeleteAll(ctx context.Context, userID string) (int64, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return 0, apperr.New(apperr.BadRequest, "invalid user_id")
	}
	return s.repo.DeleteAll(ctx, userID)
}

func (s *service) CountUnread(ctx context.Context, userID string) (int64, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return 0, apperr.New(apperr.BadRequest, "invalid user_id")
	}
	return s.repo.CountUnread(ctx, userID)
}

func (s *service) UpdateNotification(ctx context.Context, in UpdateNotificationInput) (Notification, error) {
	if in.NotificationID <= 0 {
		return Notification{}, apperr.New(apperr.BadRequest, "invalid notification_id")
	}

	if in.Title == nil && in.Body == nil && in.IsRead == nil {
		return Notification{}, apperr.New(apperr.BadRequest, "nothing to update")
	}

	n, err := s.repo.UpdateNotification(ctx, in)
	if err != nil {
		return Notification{}, err
	}

	s.broadcastNotification(n.UserID, n)
	return n, nil
}

func (s *service) MarkReadByThread(
	ctx context.Context,
	userID string,
	threadID int64,
	types []string,
) (int64, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return 0, apperr.New(apperr.BadRequest, "invalid user_id")
	}
	if threadID <= 0 {
		return 0, apperr.New(apperr.BadRequest, "invalid thread_id")
	}
	return s.repo.MarkReadByThread(ctx, userID, threadID, types)
}

func (s *service) MarkReadByOrder(
	ctx context.Context,
	userID string,
	orderID int64,
	types []string,
) (int64, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return 0, apperr.New(apperr.BadRequest, "invalid user_id")
	}
	if orderID <= 0 {
		return 0, apperr.New(apperr.BadRequest, "invalid order_id")
	}
	return s.repo.MarkReadByOrder(ctx, userID, orderID, types)
}

func (s *service) CreateAdminAction(ctx context.Context, in CreateAdminActionNotificationInput) (Notification, error) {
	in.RecipientUserID = strings.TrimSpace(in.RecipientUserID)
	in.ActionType = strings.ToUpper(strings.TrimSpace(in.ActionType))

	if in.RecipientUserID == "" {
		return Notification{}, apperr.New(apperr.BadRequest, "invalid recipient_user_id")
	}
	if in.OrderID <= 0 {
		return Notification{}, apperr.New(apperr.BadRequest, "invalid order_id")
	}
	if in.ActionType == "" {
		return Notification{}, apperr.New(apperr.BadRequest, "action_type is required")
	}

	oid := in.OrderID

	// ===============================
	// Decide notification TYPE
	// ===============================
	notiType := "ADMIN_ACTION"

	if in.ActionType == "REPORT_ACTION_TAKEN" {
		notiType = "REPORT_ACTION_TAKEN"
	}

	// ===============================
	// Default
	// ===============================
	title := strPtr("Admin action update")
	body := strPtr("An admin has taken action regarding your report.")

	// ===============================
	// Customize by action_type
	// ===============================
	switch in.ActionType {

	// ====== ฝั่งคนโดน action ======
	case "WARN_USER":
		title = strPtr("Warning issued")
		body = strPtr("You have received a warning from an admin.")

	case "SUSPEND_USER":
		title = strPtr("Account temporarily suspended")
		body = strPtr("Your account has been temporarily suspended by an admin.")

	case "BAN_USER":
		title = strPtr("Account permanently banned")
		body = strPtr("Your account has been permanently banned by an admin.")

	case "REVOKE_BAN":
		title = strPtr("Restriction lifted")
		body = strPtr("Your account restriction has been lifted.")

	case "HIDE_STORE":
		title = strPtr("Store hidden")
		body = strPtr("The store has been hidden by an admin.")

	case "SUSPEND_STORE":
		title = strPtr("Store suspended")
		body = strPtr("The store has been temporarily suspended.")

	case "DELETE_STORE":
		title = strPtr("Store removed")
		body = strPtr("The store has been permanently removed by an admin.")

	// ====== ฝั่งคน report ======
	case "REPORT_ACTION_TAKEN":
		title = strPtr("Report updated")
		body = strPtr("An admin has reviewed your report and taken appropriate action.")

	case "NO_ACTION":
		title = strPtr("Report reviewed")
		body = strPtr("Your report has been reviewed. No further action was taken.")

	case "RESOLVED":
		title = strPtr("Report resolved")
		body = strPtr("The report has been resolved by an admin.")

	case "CLOSED":
		title = strPtr("Report closed")
		body = strPtr("The report has been closed.")
	}

	// ===============================
	// Data payload
	// ===============================
	data := map[string]any{
		"report_id":   in.ReportID,
		"action_type": in.ActionType,
	}

	if in.BanType != nil {
		data["ban_type"] = strings.TrimSpace(*in.BanType)
	}
	if in.Reason != nil {
		data["reason"] = strings.TrimSpace(*in.Reason)
	}
	if in.Note != nil {
		data["note"] = strings.TrimSpace(*in.Note)
	}

	n, err := s.repo.Create(ctx, CreateNotificationInput{
		UserID:      in.RecipientUserID,
		Type:        notiType,
		OrderID:     &oid,
		StoreID:     in.StoreID,
		ActorUserID: in.ActorUserID,
		Title:       title,
		Body:        body,
		Data:        data,
	})
	if err != nil {
		return Notification{}, err
	}

	s.broadcastNotification(n.UserID, n)
	return n, nil
}

func (s *service) CreateAnnouncement(ctx context.Context, in CreateAnnouncementInput) (Announcement, error) {
	in.AdminID = strings.TrimSpace(in.AdminID)
	in.Title = strings.TrimSpace(in.Title)
	in.Body = strings.TrimSpace(in.Body)

	if in.AdminID == "" {
		return Announcement{}, apperr.New(apperr.BadRequest, "invalid admin_id")
	}
	if in.Title == "" {
		return Announcement{}, apperr.New(apperr.BadRequest, "title is required")
	}
	if in.Body == "" {
		return Announcement{}, apperr.New(apperr.BadRequest, "body is required")
	}
	if len(in.TargetRoles) == 0 {
		return Announcement{}, apperr.New(apperr.BadRequest, "at least one target_role is required")
	}

	seen := make(map[string]struct{}, len(in.TargetRoles))
	clean := in.TargetRoles[:0]
	for _, r := range in.TargetRoles {
		r = strings.ToUpper(strings.TrimSpace(r))
		if r == "" {
			continue
		}
		if _, ok := seen[r]; !ok {
			seen[r] = struct{}{}
			clean = append(clean, r)
		}
	}
	in.TargetRoles = clean
	if len(in.TargetRoles) == 0 {
		return Announcement{}, apperr.New(apperr.BadRequest, "target_roles contains no valid values")
	}

	ann, err := s.repo.CreateAnnouncement(ctx, in)
	if err != nil {
		return Announcement{}, err
	}

	log.Printf("[ANNOUNCEMENT] created id=%d adminID=%s roles=%v", ann.ID, in.AdminID, in.TargetRoles)

	_, err = s.repo.FanOutAnnouncement(ctx, ann.ID, in.AdminID, in.Title, in.Body, in.TargetRoles)
	if err != nil {
		return ann, err
	}

	if s.hub != nil {
		s.hub.BroadcastToRoom("announcements", map[string]interface{}{
			"type": "ANNOUNCEMENT",
			"data": ann,
		})
	}

	return ann, nil
}
