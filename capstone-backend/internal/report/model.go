package report

import (
	"encoding/json"
	"time"
)

// ============================================================================
// Models (DB-backed)
// ============================================================================

type Report struct {
	ID                  int64     `json:"report_id"`
	OrderID             int       `json:"order_id"`
	StoreID             int       `json:"store_id"`
	StoreName           string    `json:"store_name"`
	ReporterID          string    `json:"reporter_id"`
	ReporterDisplayName string    `json:"reporter_display_name"`
	ReportedUserID      string    `json:"reported_user_id"`
	ReportedDisplayName string    `json:"reported_display_name"`
	ReportedPartyType   string    `json:"reported_party_type"` // BUYER / SELLER
	ReasonCode          string    `json:"reason_code"`
	Description         *string   `json:"description,omitempty"`
	Status              string    `json:"status"` // PENDING / REVIEWED / RESOLVED / CLOSED
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

type ReportEvidence struct {
	ID            int64     `json:"evidence_id"`
	ReportID      int64     `json:"report_id"`
	UploadedBy    string    `json:"uploaded_by"`
	FileURL       string    `json:"file_url"`
	FileName      *string   `json:"file_name,omitempty"`
	MimeType      *string   `json:"mime_type,omitempty"`
	FileSizeBytes *int64    `json:"file_size_bytes,omitempty"`
	SHA256        *string   `json:"sha256,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
}

type ReportOrderSnapshot struct {
	ReportID       int64     `json:"report_id"`
	OrderStatus    string    `json:"order_status"`
	TotalPrice     float64   `json:"total_price"`
	OrderDate      time.Time `json:"order_date"`
	DeliveryMethod string    `json:"delivery_method"`

	DeliveryAddress *json.RawMessage `json:"delivery_address,omitempty"`

	CampusLocationID *int    `json:"campus_location_id,omitempty"`
	CampusDetailNote *string `json:"campus_detail_note,omitempty"`

	ProposedAt      *time.Time       `json:"proposed_at,omitempty"`
	MeetingLocation *json.RawMessage `json:"meeting_location,omitempty"`
	MeetingNote     *string          `json:"meeting_note,omitempty"`

	CancelledAt     *time.Time `json:"cancelled_at,omitempty"`
	CancelledBy     *string    `json:"cancelled_by,omitempty"`
	CancelledReason *string    `json:"cancelled_reason,omitempty"`

	Items json.RawMessage `json:"items"`

	CreatedAt time.Time `json:"created_at"`
}

type ReportChatSnapshot struct {
	ID               int64     `json:"snapshot_id"`
	ReportID         int64     `json:"report_id"`
	SenderID         *string   `json:"sender_id,omitempty"`
	SenderRole       string    `json:"sender_role"` // BUYER / SELLER / SYSTEM
	MessageText      string    `json:"message_text"`
	MessageType      *string   `json:"message_type,omitempty"`
	AttachmentURLs   *any      `json:"attachment_urls,omitempty"` // JSONB
	MessageCreatedAt time.Time `json:"message_created_at"`
}

type ReportAdminAction struct {
	ID            int64     `json:"action_id"`
	ReportID      int64     `json:"report_id"`
	AdminID       string    `json:"admin_id"`
	ActionType    string    `json:"action_type"` // NO_ACTION / RESOLVED / CLOSED / WARN_USER / SUSPEND_USER / BAN_USER / HIDE_STORE / SUSPEND_STORE / DELETE_STORE
	Note          *string   `json:"note,omitempty"`
	TargetUserID  *string   `json:"target_user_id,omitempty"`
	TargetStoreID *int      `json:"target_store_id,omitempty"`
	SuspendDays   *int      `json:"suspend_days,omitempty"`
	IsPermanent   bool      `json:"is_permanent"`
	CreatedAt     time.Time `json:"created_at"`
}

// ============================================================================
// Blacklist Models
// ============================================================================

type UserBlacklist struct {
	ID          int64      `json:"blacklist_id"`
	UserID      string     `json:"user_id"`
	UserRole    string     `json:"user_role"` // BUYER / SELLER
	ReportID    *int64     `json:"report_id,omitempty"`
	OrderID     *int64     `json:"order_id,omitempty"`
	Reason      string     `json:"reason"`
	BanType     string     `json:"ban_type"` // WARNING / TEMPORARY / PERMANENT
	BannedFrom  time.Time  `json:"banned_from"`
	BannedUntil *time.Time `json:"banned_until,omitempty"`
	IsActive    bool       `json:"is_active"`
	CreatedBy   string     `json:"created_by"`
	CreatedAt   time.Time  `json:"created_at"`
}

type StoreRestriction struct {
	ID              int64      `json:"restriction_id"`
	StoreID         int        `json:"store_id"`
	ReportID        *int64     `json:"report_id,omitempty"`
	Reason          string     `json:"reason"`
	RestrictionType string     `json:"restriction_type"` // HIDE / SUSPEND / DELETE
	RestrictedFrom  time.Time  `json:"restricted_from"`
	RestrictedUntil *time.Time `json:"restricted_until,omitempty"`
	IsActive        bool       `json:"is_active"`
	CreatedBy       string     `json:"created_by"`
	CreatedAt       time.Time  `json:"created_at"`
}

// ============================================================================
// Inputs
// ============================================================================

type CreateReportInput struct {
	OrderID           int
	ReporterID        string
	ReportedUserID    string
	ReportedPartyType string // BUYER / SELLER
	ReasonCode        string
	Description       *string
	Evidences         []CreateReportEvidenceInput
}

type CreateReportEvidenceInput struct {
	FileURL       string
	FileName      *string
	MimeType      *string
	FileSizeBytes *int64
	SHA256        *string
}

type ListReportsParams struct {
	Status            *string
	ReportedPartyType *string
	ReasonCode        *string
	FromDate          *time.Time
	ToDate            *time.Time
	Limit             int
	Page              int
	Q                 string
}

type AdminActionInput struct {
	ReportID      int64
	AdminID       string
	ActionType    string // NO_ACTION / RESOLVED / CLOSED / WARN_USER / SUSPEND_USER / BAN_USER / HIDE_STORE / SUSPEND_STORE / DELETE_STORE
	Note          *string
	TargetUserID  *string
	TargetStoreID *int
	SuspendDays   *int
	IsPermanent   bool
}

type CreateUserBanInput struct {
	UserID      string
	UserRole    string // BUYER / SELLER
	ReportID    *int64
	Reason      string
	BanType     string // WARNING / TEMPORARY / PERMANENT
	BannedUntil *time.Time
	CreatedBy   string
}

type ListBanHistoryParams struct {
	UserID string
	Limit  int
	Offset int
}

type MyReportView struct {
	ReportID            int64     `json:"report_id"`
	CreatedAt           time.Time `json:"created_at"`
	OrderID             int       `json:"order_id"`
	StoreName           string    `json:"store_name"`
	ReportedUserID      string    `json:"reported_user_id"`
	ReportedDisplayName string    `json:"reported_display_name"`
	ReportedPartyType   string    `json:"reported_party_type"`
	ReasonCode          string    `json:"reason_code"`
	Status              string    `json:"status"`
}

type ListMyReportsParams struct {
	ReporterID        string
	ReportedPartyType *string
	Status            *string
	Limit             int
	Page              int
	Q                 string
}

type ReportListResponse struct {
	PageSize  int      `json:"page_size"`
	PageIndex int      `json:"page_index"`
	Total     int64    `json:"total"`
	Items     []Report `json:"items"`
}

type MyReportListResponse struct {
	PageSize  int            `json:"page_size"`
	PageIndex int            `json:"page_index"`
	Total     int64          `json:"total"`
	Items     []MyReportView `json:"items"`
}

type UserBlacklistListResponse struct {
	PageSize  int             `json:"page_size"`
	PageIndex int             `json:"page_index"`
	Total     int64           `json:"total"`
	Items     []UserBlacklist `json:"items"`
}

type ListUserBlacklistsParams struct {
	IsActive *bool
	UserRole *string
	BanType  *string
	Limit    int
	Page     int
	Q        string
	FromDate *time.Time
	ToDate   *time.Time
}

type CountReportsByStatusInput struct {
	ReportedPartyType *string
}

type ReportStatusCounts struct {
	Pending  int64 `json:"pending"`
	Resolved int64 `json:"resolved"`
	Closed   int64 `json:"closed"`
	Total    int64 `json:"total"`
}
