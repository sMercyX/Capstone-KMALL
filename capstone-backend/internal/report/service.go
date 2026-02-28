package report

import (
	"context"
	"mime/multipart"
	"strings"
	"time"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
	"github.com/Perpasit/Capstone-KMALL/internal/filestore"
)

// ============================================================================
// File Store Interface
// ============================================================================

type FileStore interface {
	Save(ctx context.Context, keyPrefix string, fh *multipart.FileHeader) (filestore.UploadedFile, error)
}

// ============================================================================
// DTOs
// ============================================================================

type ReportDetail struct {
	Report        Report               `json:"report"`
	OrderSnapshot ReportOrderSnapshot  `json:"order_snapshot"`
	ChatSnapshots []ReportChatSnapshot `json:"chat_snapshots"`
	Evidences     []ReportEvidence     `json:"evidences"`
	AdminActions  []ReportAdminAction  `json:"admin_actions"`
}

type SubmitReportInput struct {
	OrderID           int
	ReporterID        string
	ReportedUserID    string
	ReportedPartyType string // BUYER / SELLER
	ReasonCode        string
	Description       *string
	Files             []*multipart.FileHeader
}

type AdminTakeActionInput struct {
	ReportID      int64
	AdminID       string
	ActionType    string // NO_ACTION / RESOLVED / CLOSED / WARN_USER / SUSPEND_USER / BAN_USER / HIDE_STORE / SUSPEND_STORE / DELETE_STORE
	Note          *string
	TargetUserID  *string
	TargetStoreID *int
	SuspendDays   *int   // for TEMPORARY ban
	IsPermanent   bool   // for PERMANENT ban
	UserRole      string // BUYER / SELLER — required if action involves user ban
}

type BanUserInput struct {
	AdminID     string
	UserID      string
	UserRole    string // BUYER / SELLER
	ReportID    *int64
	Reason      string
	BanType     string // WARNING / TEMPORARY / PERMANENT
	SuspendDays *int   // required for TEMPORARY
	CreatedBy   string
}

// ============================================================================
// Service Interface
// ============================================================================

type Service interface {
	// PBI 22 - Report
	SubmitReport(ctx context.Context, in SubmitReportInput, chatMessages []ReportChatSnapshot, orderSnapshot ReportOrderSnapshot) (Report, error)
	GetReportDetail(ctx context.Context, reportID int64) (ReportDetail, error)
	ListReports(ctx context.Context, in ListReportsParams) ([]Report, error)
	AdminTakeAction(ctx context.Context, in AdminTakeActionInput) (ReportAdminAction, error)

	// PBI 23 - Blacklist
	BanUser(ctx context.Context, in BanUserInput) (UserBlacklist, error)
	RevokeUserBan(ctx context.Context, blacklistID int64) (UserBlacklist, error)
	GetActiveBan(ctx context.Context, userID string) (*UserBlacklist, error)
	ListBanHistory(ctx context.Context, in ListBanHistoryParams) ([]UserBlacklist, error)

	GetMyReport(ctx context.Context, reportID int64, reporterID string) (MyReportView, error)
	ListMyReports(ctx context.Context, in ListMyReportsParams) ([]MyReportView, error)
}

type service struct {
	repo Repo
	fs   FileStore
}

func NewService(r Repo, fs FileStore) Service {
	return &service{repo: r, fs: fs}
}

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

// computeBannedUntil calculates banned_until from suspend_days
func computeBannedUntil(banType string, suspendDays *int) (*time.Time, error) {
	switch banType {
	case "WARNING", "PERMANENT":
		return nil, nil
	case "TEMPORARY":
		if suspendDays == nil || *suspendDays <= 0 {
			return nil, apperr.New(apperr.BadRequest, "suspend_days is required for TEMPORARY ban")
		}
		t := time.Now().Add(time.Duration(*suspendDays) * 24 * time.Hour)
		return &t, nil
	default:
		return nil, apperr.New(apperr.BadRequest, "invalid ban_type")
	}
}

// ============================================================================
// PBI 22 — Report
// ============================================================================

func (s *service) SubmitReport(
	ctx context.Context,
	in SubmitReportInput,
	chatMessages []ReportChatSnapshot,
	orderSnapshot ReportOrderSnapshot,
) (Report, error) {
	// Validate
	in.ReporterID = strings.TrimSpace(in.ReporterID)
	in.ReportedUserID = strings.TrimSpace(in.ReportedUserID)
	in.ReasonCode = strings.TrimSpace(in.ReasonCode)
	in.ReportedPartyType = strings.ToUpper(strings.TrimSpace(in.ReportedPartyType))

	if in.ReporterID == "" || in.ReportedUserID == "" || in.ReasonCode == "" {
		return Report{}, apperr.New(apperr.BadRequest, "reporter_id, reported_user_id, and reason_code are required")
	}
	if in.ReportedPartyType != "BUYER" && in.ReportedPartyType != "SELLER" {
		return Report{}, apperr.New(apperr.BadRequest, "reported_party_type must be BUYER or SELLER")
	}
	if in.OrderID <= 0 {
		return Report{}, apperr.New(apperr.BadRequest, "invalid order_id")
	}

	// Create report record
	rep, err := s.repo.CreateReport(ctx, CreateReportInput{
		OrderID:           in.OrderID,
		ReporterID:        in.ReporterID,
		ReportedUserID:    in.ReportedUserID,
		ReportedPartyType: in.ReportedPartyType,
		ReasonCode:        in.ReasonCode,
		Description:       in.Description,
	})
	if err != nil {
		return Report{}, err
	}

	// Snapshot order
	orderSnapshot.ReportID = rep.ID
	if err := s.repo.CreateOrderSnapshot(ctx, orderSnapshot); err != nil {
		return Report{}, err
	}

	// Snapshot chat messages
	for i := range chatMessages {
		chatMessages[i].ReportID = rep.ID
	}
	if err := s.repo.CreateChatSnapshots(ctx, chatMessages); err != nil {
		return Report{}, err
	}

	// Upload evidence files if any
	if len(in.Files) > 0 {
		if s.fs == nil {
			return Report{}, apperr.New(apperr.Internal, "file store is not configured")
		}

		evidenceInputs := make([]CreateReportEvidenceInput, 0, len(in.Files))
		for _, fh := range in.Files {
			prefix := "report-evidence/" + itoa(int(rep.ID))
			up, err := s.fs.Save(ctx, prefix, fh)
			if err != nil {
				return Report{}, err
			}

			fileURL := strings.TrimSpace(up.URL)
			if fileURL == "" {
				return Report{}, apperr.New(apperr.Internal, "uploaded file url is empty")
			}

			fn := up.FileName
			ct := up.MimeType
			sz := up.Size

			evidenceInputs = append(evidenceInputs, CreateReportEvidenceInput{
				FileURL:       fileURL,
				FileName:      &fn,
				MimeType:      &ct,
				FileSizeBytes: &sz,
				SHA256:        up.SHA256,
			})
		}

		if _, err := s.repo.CreateReportEvidences(ctx, rep.ID, in.ReporterID, evidenceInputs); err != nil {
			return Report{}, err
		}
	}

	return rep, nil
}

func (s *service) GetReportDetail(ctx context.Context, reportID int64) (ReportDetail, error) {
	if reportID <= 0 {
		return ReportDetail{}, apperr.New(apperr.BadRequest, "invalid report_id")
	}

	rep, err := s.repo.GetReport(ctx, reportID)
	if err != nil {
		return ReportDetail{}, err
	}

	orderSnapshot, err := s.repo.GetOrderSnapshot(ctx, reportID)
	if err != nil {
		return ReportDetail{}, err
	}

	chatSnapshots, err := s.repo.ListChatSnapshotsByReportID(ctx, reportID)
	if err != nil {
		return ReportDetail{}, err
	}

	evidences, err := s.repo.ListEvidencesByReportID(ctx, reportID)
	if err != nil {
		return ReportDetail{}, err
	}

	adminActions, err := s.repo.ListAdminActionsByReportID(ctx, reportID)
	if err != nil {
		return ReportDetail{}, err
	}

	return ReportDetail{
		Report:        rep,
		OrderSnapshot: orderSnapshot,
		ChatSnapshots: chatSnapshots,
		Evidences:     evidences,
		AdminActions:  adminActions,
	}, nil
}

func (s *service) ListReports(ctx context.Context, in ListReportsParams) ([]Report, error) {
	return s.repo.ListReports(ctx, in)
}

func (s *service) AdminTakeAction(ctx context.Context, in AdminTakeActionInput) (ReportAdminAction, error) {
	in.AdminID = strings.TrimSpace(in.AdminID)
	in.ActionType = strings.ToUpper(strings.TrimSpace(in.ActionType))

	if in.AdminID == "" || in.ActionType == "" {
		return ReportAdminAction{}, apperr.New(apperr.BadRequest, "admin_id and action_type are required")
	}
	if in.ReportID <= 0 {
		return ReportAdminAction{}, apperr.New(apperr.BadRequest, "invalid report_id")
	}

	// Determine new report status based on action
	var newStatus string
	switch in.ActionType {
	case "NO_ACTION", "CLOSED":
		newStatus = "CLOSED"
	case "RESOLVED", "WARN_USER", "SUSPEND_USER", "BAN_USER", "HIDE_STORE", "SUSPEND_STORE", "DELETE_STORE":
		newStatus = "RESOLVED"
	default:
		return ReportAdminAction{}, apperr.New(apperr.BadRequest, "invalid action_type")
	}

	// If action involves banning a user — create ban record automatically
	switch in.ActionType {
	case "WARN_USER", "SUSPEND_USER", "BAN_USER":
		if in.TargetUserID == nil {
			return ReportAdminAction{}, apperr.New(apperr.BadRequest, "target_user_id is required for user actions")
		}
		banType := map[string]string{
			"WARN_USER":    "WARNING",
			"SUSPEND_USER": "TEMPORARY",
			"BAN_USER":     "PERMANENT",
		}[in.ActionType]

		bannedUntil, err := computeBannedUntil(banType, in.SuspendDays)
		if err != nil {
			return ReportAdminAction{}, err
		}

		reportID := in.ReportID
		if _, err := s.repo.CreateUserBan(ctx, CreateUserBanInput{
			UserID:      *in.TargetUserID,
			UserRole:    in.UserRole,
			ReportID:    &reportID,
			Reason:      noteOrDefault(in.Note, in.ActionType),
			BanType:     banType,
			BannedUntil: bannedUntil,
			CreatedBy:   in.AdminID,
		}); err != nil {
			return ReportAdminAction{}, err
		}
	}

	// Log admin action
	action, err := s.repo.CreateAdminAction(ctx, AdminActionInput{
		ReportID:      in.ReportID,
		AdminID:       in.AdminID,
		ActionType:    in.ActionType,
		Note:          in.Note,
		TargetUserID:  in.TargetUserID,
		TargetStoreID: in.TargetStoreID,
		SuspendDays:   in.SuspendDays,
		IsPermanent:   in.IsPermanent,
	})
	if err != nil {
		return ReportAdminAction{}, err
	}

	// Update report status
	if _, err := s.repo.UpdateReportStatus(ctx, in.ReportID, newStatus); err != nil {
		return ReportAdminAction{}, err
	}

	return action, nil
}

// ============================================================================
// PBI 23 — Blacklist
// ============================================================================

func (s *service) BanUser(ctx context.Context, in BanUserInput) (UserBlacklist, error) {
	in.UserID = strings.TrimSpace(in.UserID)
	in.AdminID = strings.TrimSpace(in.AdminID)
	in.Reason = strings.TrimSpace(in.Reason)
	in.BanType = strings.ToUpper(strings.TrimSpace(in.BanType))
	in.UserRole = strings.ToUpper(strings.TrimSpace(in.UserRole))

	if in.UserID == "" || in.Reason == "" || in.BanType == "" {
		return UserBlacklist{}, apperr.New(apperr.BadRequest, "user_id, reason, and ban_type are required")
	}

	bannedUntil, err := computeBannedUntil(in.BanType, in.SuspendDays)
	if err != nil {
		return UserBlacklist{}, err
	}

	return s.repo.CreateUserBan(ctx, CreateUserBanInput{
		UserID:      in.UserID,
		UserRole:    in.UserRole,
		ReportID:    in.ReportID,
		Reason:      in.Reason,
		BanType:     in.BanType,
		BannedUntil: bannedUntil,
		CreatedBy:   in.CreatedBy,
	})
}

func (s *service) RevokeUserBan(ctx context.Context, blacklistID int64) (UserBlacklist, error) {
	if blacklistID <= 0 {
		return UserBlacklist{}, apperr.New(apperr.BadRequest, "invalid blacklist_id")
	}
	return s.repo.RevokeUserBan(ctx, blacklistID)
}

func (s *service) GetActiveBan(ctx context.Context, userID string) (*UserBlacklist, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return nil, apperr.New(apperr.BadRequest, "invalid user_id")
	}
	return s.repo.GetActiveBan(ctx, userID)
}

func (s *service) ListBanHistory(ctx context.Context, in ListBanHistoryParams) ([]UserBlacklist, error) {
	return s.repo.ListBanHistory(ctx, in)
}

func (s *service) GetMyReport(ctx context.Context, reportID int64, reporterID string) (MyReportView, error) {
	if reportID <= 0 {
		return MyReportView{}, apperr.New(apperr.BadRequest, "invalid report_id")
	}
	reporterID = strings.TrimSpace(reporterID)
	if reporterID == "" {
		return MyReportView{}, apperr.New(apperr.BadRequest, "invalid reporter_id")
	}

	rep, err := s.repo.GetMyReport(ctx, reportID, reporterID)
	if err != nil {
		return MyReportView{}, err
	}

	return MyReportView{
		ReportID:            rep.ID,
		CreatedAt:           rep.CreatedAt,
		OrderID:             rep.OrderID,
		StoreName:           rep.StoreName,
		ReportedUserID:      rep.ReportedUserID,
		ReportedDisplayName: rep.ReportedDisplayName,
		ReasonCode:          rep.ReasonCode,
		Status:              rep.Status,
	}, nil
}

func (s *service) ListMyReports(ctx context.Context, in ListMyReportsParams) ([]MyReportView, error) {
	in.ReporterID = strings.TrimSpace(in.ReporterID)
	if in.ReporterID == "" {
		return nil, apperr.New(apperr.BadRequest, "invalid reporter_id")
	}

	reports, err := s.repo.ListMyReports(ctx, in)
	if err != nil {
		return nil, err
	}

	out := make([]MyReportView, 0, len(reports))
	for _, rep := range reports {
		out = append(out, MyReportView{
			ReportID:            rep.ID,
			CreatedAt:           rep.CreatedAt,
			OrderID:             rep.OrderID,
			StoreName:           rep.StoreName,
			ReportedUserID:      rep.ReportedUserID,
			ReportedDisplayName: rep.ReportedDisplayName,
			ReportedPartyType:   rep.ReportedPartyType,
			ReasonCode:          rep.ReasonCode,
			Status:              rep.Status,
		})
	}
	return out, nil
}

// ============================================================================
// Helper
// ============================================================================

func noteOrDefault(note *string, fallback string) string {
	if note != nil && strings.TrimSpace(*note) != "" {
		return strings.TrimSpace(*note)
	}
	return fallback
}
