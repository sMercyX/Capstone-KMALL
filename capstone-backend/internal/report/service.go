package report

import (
	"context"
	"log"
	"mime/multipart"
	"strings"
	"time"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
	"github.com/Perpasit/Capstone-KMALL/internal/filestore"
	"github.com/Perpasit/Capstone-KMALL/internal/notification"
	"github.com/Perpasit/Capstone-KMALL/internal/store"
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

type OrderCanceller interface {
	CancelOrdersByStore(ctx context.Context, actorUserID string, storeID int64, reason string) (int64, error)
	CancelOrdersByUserRole(ctx context.Context, actorUserID string, userID, role, reason string) (int64, error)
}

// ============================================================================
// Service Interface
// ============================================================================

type Service interface {
	// PBI 22 - Report
	SubmitReport(ctx context.Context, in SubmitReportInput, chatMessages []ReportChatSnapshot, orderSnapshot ReportOrderSnapshot) (Report, error)
	GetReportDetail(ctx context.Context, reportID int64) (ReportDetail, error)
	ListReports(ctx context.Context, in ListReportsParams) (ReportListResponse, error)
	AdminTakeAction(ctx context.Context, in AdminTakeActionInput) (ReportAdminAction, error)

	// PBI 23 - Blacklist
	BanUser(ctx context.Context, in BanUserInput) (UserBlacklist, error)
	RevokeUserBan(ctx context.Context, blacklistID int64) (UserBlacklist, error)
	GetActiveBan(ctx context.Context, userID string) (*UserBlacklist, error)
	ListActiveBans(ctx context.Context, userID string) ([]UserBlacklist, error)
	ListBanHistory(ctx context.Context, in ListBanHistoryParams) ([]UserBlacklist, error)

	GetMyReport(ctx context.Context, reportID int64, reporterID string) (MyReportView, error)
	ListMyReports(ctx context.Context, in ListMyReportsParams) (MyReportListResponse, error)

	GetUserBlacklist(ctx context.Context, blacklistID int64) (UserBlacklist, error)
	ListUserBlacklists(ctx context.Context, in ListUserBlacklistsParams) (UserBlacklistListResponse, error)

	CountReportsByStatus(ctx context.Context, in CountReportsByStatusInput) (ReportStatusCounts, error)
}

type service struct {
	repo     Repo
	fs       FileStore
	noti     notification.Service
	storeSvc store.Service
	orderSvc OrderCanceller
}

func NewService(r Repo, fs FileStore, noti notification.Service, st store.Service, ord OrderCanceller) Service {
	return &service{repo: r, fs: fs, noti: noti, storeSvc: st, orderSvc: ord}
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
	case "WARNING":
		t := time.Now().Add(7 * 24 * time.Hour)
		return &t, nil
	case "PERMANENT":
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

	// if err := s.repo.MarkReviewedIfPending(ctx, reportID); err != nil {
	// 	return ReportDetail{}, err
	// }

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

func (s *service) ListReports(ctx context.Context, in ListReportsParams) (ReportListResponse, error) {
	if in.Limit <= 0 {
		in.Limit = 20
	}
	if in.Page <= 0 {
		in.Page = 1
	}

	reports, total, err := s.repo.ListReports(ctx, in)
	if err != nil {
		return ReportListResponse{}, err
	}

	if reports == nil {
		reports = []Report{}
	}

	return ReportListResponse{
		PageSize:  in.Limit,
		PageIndex: in.Page,
		Total:     total,
		Items:     reports,
	}, nil
}

func (s *service) AdminTakeAction(ctx context.Context, in AdminTakeActionInput) (ReportAdminAction, error) {
	in.AdminID = strings.TrimSpace(in.AdminID)
	in.ActionType = strings.ToUpper(strings.TrimSpace(in.ActionType))
	in.UserRole = strings.ToUpper(strings.TrimSpace(in.UserRole))

	if in.AdminID == "" || in.ActionType == "" {
		return ReportAdminAction{}, apperr.New(apperr.BadRequest, "admin_id and action_type are required")
	}
	if in.ReportID <= 0 {
		return ReportAdminAction{}, apperr.New(apperr.BadRequest, "invalid report_id")
	}
	if in.Note == nil || strings.TrimSpace(*in.Note) == "" {
		return ReportAdminAction{}, apperr.New(apperr.BadRequest, "note is required")
	}

	switch in.ActionType {
	case "NO_ACTION", "WARN_USER", "SUSPEND_USER", "BAN_USER":
	default:
		return ReportAdminAction{}, apperr.New(apperr.BadRequest, "invalid action_type")
	}

	rep, err := s.repo.GetReport(ctx, in.ReportID)
	if err != nil {
		return ReportAdminAction{}, err
	}

	if in.ActionType == "NO_ACTION" {
		action, err := s.repo.CreateAdminAction(ctx, AdminActionInput{
			ReportID:   in.ReportID,
			AdminID:    in.AdminID,
			ActionType: "NO_ACTION",
			Note:       in.Note,
		})
		if err != nil {
			return ReportAdminAction{}, err
		}

		if _, err := s.repo.UpdateReportStatus(ctx, in.ReportID, "CLOSED"); err != nil {
			return ReportAdminAction{}, err
		}

		if s.noti != nil {
			reason := strPtr(strings.TrimSpace(*in.Note))
			reporterID := strings.TrimSpace(rep.ReporterID)
			if reporterID != "" {
				_, _ = s.noti.CreateAdminAction(ctx, notification.CreateAdminActionNotificationInput{
					RecipientUserID: reporterID,
					ActorUserID:     &in.AdminID,
					ReportID:        in.ReportID,
					OrderID:         int64(rep.OrderID),
					ActionType:      "REPORT_ACTION_TAKEN",
					Note:            in.Note,
					Reason:          reason,
				})
			}
		}

		return action, nil
	}

	if in.TargetUserID == nil || strings.TrimSpace(*in.TargetUserID) == "" {
		return ReportAdminAction{}, apperr.New(apperr.BadRequest, "target_user_id is required")
	}
	targetUserID := strings.TrimSpace(*in.TargetUserID)

	if in.UserRole != "BUYER" && in.UserRole != "SELLER" {
		return ReportAdminAction{}, apperr.New(apperr.BadRequest, "user_role must be BUYER or SELLER")
	}

	if in.UserRole == "SELLER" {
		if in.TargetStoreID == nil || *in.TargetStoreID <= 0 {
			return ReportAdminAction{}, apperr.New(apperr.BadRequest, "target_store_id is required for seller actions")
		}
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
		UserID:      targetUserID,
		UserRole:    in.UserRole,
		ReportID:    &reportID,
		Reason:      strings.TrimSpace(*in.Note),
		BanType:     banType,
		BannedUntil: bannedUntil,
		CreatedBy:   in.AdminID,
	}); err != nil {
		return ReportAdminAction{}, err
	}

	if in.UserRole == "SELLER" && banType != "WARNING" {
		storeID := int64(*in.TargetStoreID)
		reason := "AUTO_CANCELLED_DUE_TO_" + banType + "_" + in.ActionType + "_SELLER"

		if s.storeSvc != nil {
			log.Printf("[ADMIN] ForceClose store: admin=%s store=%d reason=%s", in.AdminID, storeID, reason)
			if err := s.storeSvc.ForceCloseByAdmin(ctx, in.AdminID, storeID, reason); err != nil {
				log.Printf("[ADMIN] ForceCloseByAdmin failed: admin=%s store=%d err=%v", in.AdminID, storeID, err)
				return ReportAdminAction{}, err
			}
		} else {
			log.Printf("[ADMIN] ForceClose skipped: storeSvc=nil store=%d", storeID)
		}

		if s.orderSvc != nil {
			log.Printf("[ADMIN] Cancel orders by store: admin=%s store=%d reason=%s", in.AdminID, storeID, reason)
			count, err := s.orderSvc.CancelOrdersByStore(ctx, in.AdminID, storeID, reason)
			log.Printf("[ADMIN] CancelOrdersByStore done: store=%d cancelled=%d err=%v", storeID, count, err)
		} else {
			log.Printf("[ADMIN] CancelOrdersByStore skipped: orderSvc=nil store=%d", storeID)
		}
	}

	if s.orderSvc != nil && banType != "WARNING" && in.UserRole == "BUYER" {
		cancelReason := "AUTO_CANCELLED_DUE_TO_" + banType + "_" + in.ActionType + "_BUYER"

		log.Printf("[ADMIN] Trigger cancel by buyer: admin=%s buyer=%s reason=%s",
			in.AdminID, targetUserID, cancelReason)

		count, err := s.orderSvc.CancelOrdersByUserRole(ctx, in.AdminID, targetUserID, "BUYER", cancelReason)
		log.Printf("[ADMIN] CancelOrdersByUserRole result: cancelled=%d err=%v", count, err)
	}

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

	if _, err := s.repo.UpdateReportStatus(ctx, in.ReportID, "RESOLVED"); err != nil {
		return ReportAdminAction{}, err
	}

	if s.noti != nil {
		reason := strPtr(strings.TrimSpace(*in.Note))
		reporterID := strings.TrimSpace(rep.ReporterID)

		var storeID *int64
		if in.UserRole == "SELLER" && in.TargetStoreID != nil && *in.TargetStoreID > 0 {
			sid := int64(*in.TargetStoreID)
			storeID = &sid
		}

		if targetUserID != "" {
			_, _ = s.noti.CreateAdminAction(ctx, notification.CreateAdminActionNotificationInput{
				RecipientUserID: targetUserID,
				ActorUserID:     &in.AdminID,
				ReportID:        in.ReportID,
				OrderID:         int64(rep.OrderID),
				StoreID:         storeID,
				ActionType:      in.ActionType,
				Note:            in.Note,
				BanType:         &banType,
				Reason:          reason,
			})
		}

		if reporterID != "" && reporterID != targetUserID {
			_, _ = s.noti.CreateAdminAction(ctx, notification.CreateAdminActionNotificationInput{
				RecipientUserID: reporterID,
				ActorUserID:     &in.AdminID,
				ReportID:        in.ReportID,
				OrderID:         int64(rep.OrderID),
				StoreID:         storeID,
				ActionType:      "REPORT_ACTION_TAKEN",
				Note:            in.Note,
				BanType:         &banType,
				Reason:          reason,
			})
		}
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

func (s *service) ListActiveBans(ctx context.Context, userID string) ([]UserBlacklist, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return nil, apperr.New(apperr.BadRequest, "invalid user_id")
	}
	return s.repo.ListActiveBans(ctx, userID)
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

func (s *service) ListMyReports(ctx context.Context, in ListMyReportsParams) (MyReportListResponse, error) {
	in.ReporterID = strings.TrimSpace(in.ReporterID)
	if in.ReporterID == "" {
		return MyReportListResponse{}, apperr.New(apperr.BadRequest, "invalid reporter_id")
	}
	if in.Limit <= 0 {
		in.Limit = 20
	}
	if in.Page <= 0 {
		in.Page = 1
	}

	reports, total, err := s.repo.ListMyReports(ctx, in)
	if err != nil {
		return MyReportListResponse{}, err
	}

	items := make([]MyReportView, 0, len(reports))
	for _, rep := range reports {
		items = append(items, MyReportView{
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

	return MyReportListResponse{
		PageSize:  in.Limit,
		PageIndex: in.Page,
		Total:     total,
		Items:     items,
	}, nil
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

func (s *service) resolveAdminActionRecipient(ctx context.Context, in AdminTakeActionInput) (recipient string, storeID *int64) {
	// user actions
	switch in.ActionType {
	case "WARN_USER", "SUSPEND_USER", "BAN_USER":
		if in.TargetUserID != nil {
			return strings.TrimSpace(*in.TargetUserID), nil
		}
		return "", nil
	}

	// store actions
	switch in.ActionType {
	case "HIDE_STORE", "SUSPEND_STORE", "DELETE_STORE":
		if in.TargetStoreID != nil && *in.TargetStoreID > 0 && s.storeSvc != nil {
			st, err := s.storeSvc.Get(ctx, int64(*in.TargetStoreID))
			if err != nil {
				return "", nil
			}
			sid := int64(*in.TargetStoreID)
			return st.UserID.String(), &sid
		}
		return "", nil
	}

	return "", nil
}

func (s *service) ListUserBlacklists(ctx context.Context, in ListUserBlacklistsParams) (UserBlacklistListResponse, error) {
	if in.Limit <= 0 {
		in.Limit = 20
	}
	if in.Page <= 0 {
		in.Page = 1
	}
	in.Q = strings.TrimSpace(in.Q)

	items, total, err := s.repo.ListUserBlacklists(ctx, in)
	if err != nil {
		return UserBlacklistListResponse{}, err
	}
	if items == nil {
		items = []UserBlacklist{}
	}
	return UserBlacklistListResponse{
		PageSize:  in.Limit,
		PageIndex: in.Page,
		Total:     total,
		Items:     items,
	}, nil
}

func (s *service) GetUserBlacklist(ctx context.Context, blacklistID int64) (UserBlacklist, error) {
	if blacklistID <= 0 {
		return UserBlacklist{}, apperr.New(apperr.BadRequest, "invalid blacklist_id")
	}
	return s.repo.GetUserBlacklist(ctx, blacklistID)
}

func (s *service) CountReportsByStatus(ctx context.Context, in CountReportsByStatusInput) (ReportStatusCounts, error) {
	return s.repo.CountReportsByStatus(ctx, in.ReportedPartyType)
}
