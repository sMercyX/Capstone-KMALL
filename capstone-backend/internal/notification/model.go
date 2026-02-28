package notification

import "time"

type Notification struct {
	ID int64 `json:"notification_id"`

	UserID string `json:"user_id"`

	Type string `json:"type"`

	OrderID   *int64 `json:"order_id,omitempty"`
	ThreadID  *int64 `json:"thread_id,omitempty"`
	MessageID *int64 `json:"message_id,omitempty"`

	StoreID   *int64  `json:"store_id,omitempty"`
	StoreName *string `json:"store_name,omitempty"`

	ActorUserID      *string `json:"actor_user_id,omitempty"`
	ActorDisplayName *string `json:"actor_display_name,omitempty"`

	Title *string `json:"title,omitempty"`
	Body  *string `json:"body,omitempty"`

	Data any `json:"data,omitempty"`

	IsRead bool       `json:"is_read"`
	ReadAt *time.Time `json:"read_at,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ============================================================================
// Inputs / Params
// ============================================================================

type CreateNotificationInput struct {
	UserID string

	Type string

	OrderID   *int64
	ThreadID  *int64
	MessageID *int64

	StoreID     *int64
	ActorUserID *string

	Title *string
	Body  *string

	Data any
}

type ListNotificationsParams struct {
	UserID          string
	BeforeID        *int64
	BeforeUpdatedAt *time.Time
	Limit           int

	OnlyRead *bool
	Types    []string

	OrderID  *int64
	StoreID  *int64
	ThreadID *int64
}

type MarkReadInput struct {
	UserID         string
	NotificationID int64
}

type UpdateNotificationInput struct {
	NotificationID int64   `json:"notification_id"`
	Title          *string `json:"title,omitempty"`
	Body           *string `json:"body,omitempty"`
	IsRead         *bool   `json:"is_read,omitempty"`
	OrderID        *int64  `json:"order_id,omitempty"`
	StoreID        *int64  `json:"store_id,omitempty"`
	ActorUserID    *string `json:"actor_user_id,omitempty"`
	Type           *string `json:"type,omitempty"`
	Data           any     `json:"data,omitempty"`
}
