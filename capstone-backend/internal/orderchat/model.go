package orderchat

import "time"

// ============================================================================
// Models (DB-backed)
// ============================================================================

type Thread struct {
	ID        int64     `json:"thread_id"`
	OrderID   int64     `json:"order_id"`
	StoreID   int64     `json:"store_id"`
	BuyerID   string    `json:"buyer_id"`
	SellerID  string    `json:"seller_id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Message struct {
	ID       int64 `json:"message_id"`
	ThreadID int64 `json:"thread_id"`

	// sender_id อาจเป็น NULL (system message / หรือ user ถูกลบแล้ว)
	SenderID *string `json:"sender_id,omitempty"`

	MessageText *string `json:"message_text,omitempty"`
	MessageType string  `json:"message_type"`

	CreatedAt time.Time `json:"created_at"`

	EditedAt *time.Time `json:"edited_at,omitempty"`
	EditedBy *string    `json:"edited_by,omitempty"`

	DeletedAt    *time.Time `json:"deleted_at,omitempty"`
	DeletedBy    *string    `json:"deleted_by,omitempty"`
	DeleteReason *string    `json:"delete_reason,omitempty"`

	ModerationStatus string     `json:"moderation_status"`
	ModeratedAt      *time.Time `json:"moderated_at,omitempty"`
	ModeratedBy      *string    `json:"moderated_by,omitempty"`
	ModerationReason *string    `json:"moderation_reason,omitempty"`
}

type Attachment struct {
	ID        int64 `json:"attachment_id"`
	MessageID int64 `json:"message_id"`

	FileURL       string  `json:"file_url"`
	FileName      *string `json:"file_name,omitempty"`
	MimeType      *string `json:"mime_type,omitempty"`
	FileSizeBytes *int64  `json:"file_size_bytes,omitempty"`
	SHA256        *string `json:"sha256,omitempty"`

	CreatedAt    time.Time  `json:"created_at"`
	DeletedAt    *time.Time `json:"deleted_at,omitempty"`
	DeletedBy    *string    `json:"deleted_by,omitempty"`
	DeleteReason *string    `json:"delete_reason,omitempty"`
}

type ReadState struct {
	ThreadID int64  `json:"thread_id"`
	UserID   string `json:"user_id"`

	LastReadMessageID *int64     `json:"last_read_message_id,omitempty"`
	LastReadAt        *time.Time `json:"last_read_at,omitempty"`
}

// ============================================================================
// Inputs (for service/handler)
// ============================================================================

type CreateMessageInput struct {
	ThreadID    int64
	SenderID    string // required (ถ้าจะสร้าง SYSTEM ค่อยแยก method)
	MessageText *string
	MessageType string // TEXT/IMAGE/FILE (SYSTEM ควรให้ service คุม)
}

type CreateAttachmentInput struct {
	MessageID     int64
	FileURL       string
	FileName      *string
	MimeType      *string
	FileSizeBytes *int64
	SHA256        *string
}

type ListMessagesParams struct {
	ThreadID int64

	// pagination แบบ cursor (ง่ายและเร็ว)
	// - ถ้า nil = หน้าแรก
	// - ดึง message_id < before_id (เรียง DESC แล้วค่อย reverse ตอนตอบ)
	BeforeID *int64

	Limit int
}

type UpdateMessageTextInput struct {
	MessageText string
	EditedBy    string
	EditedAt    time.Time
}

type SoftDeleteMessageInput struct {
	DeletedBy    string
	DeletedAt    time.Time
	DeleteReason *string
}

type ModerateMessageInput struct {
	ModerationStatus string // VISIBLE/HIDDEN/REMOVED
	ModeratedBy      string
	ModeratedAt      time.Time
	ModerationReason *string
}

type MarkReadInput struct {
	ThreadID int64
	UserID   string

	LastReadMessageID *int64
	LastReadAt        time.Time
}

type CreateThreadInput struct {
	OrderID  int64
	StoreID  int64
	BuyerID  string
	SellerID string
}

type GetOrCreateThreadResult struct {
	Thread Thread `json:"thread"`
}
