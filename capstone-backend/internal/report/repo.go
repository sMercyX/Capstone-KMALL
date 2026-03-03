package report

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgconn"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
)

type Repo interface {
	CreateReport(ctx context.Context, in CreateReportInput) (Report, error)
	GetReport(ctx context.Context, reportID int64) (Report, error)
	ListReports(ctx context.Context, in ListReportsParams) ([]Report, int64, error)
	UpdateReportStatus(ctx context.Context, reportID int64, status string) (Report, error)
	CreateReportEvidences(ctx context.Context, reportID int64, uploadedBy string, items []CreateReportEvidenceInput) ([]ReportEvidence, error)
	ListEvidencesByReportID(ctx context.Context, reportID int64) ([]ReportEvidence, error)
	CreateOrderSnapshot(ctx context.Context, in ReportOrderSnapshot) error
	CreateChatSnapshots(ctx context.Context, items []ReportChatSnapshot) error
	ListChatSnapshotsByReportID(ctx context.Context, reportID int64) ([]ReportChatSnapshot, error)
	GetOrderSnapshot(ctx context.Context, reportID int64) (ReportOrderSnapshot, error)
	CreateAdminAction(ctx context.Context, in AdminActionInput) (ReportAdminAction, error)
	ListAdminActionsByReportID(ctx context.Context, reportID int64) ([]ReportAdminAction, error)
	CreateUserBan(ctx context.Context, in CreateUserBanInput) (UserBlacklist, error)
	RevokeUserBan(ctx context.Context, blacklistID int64) (UserBlacklist, error)
	GetActiveBan(ctx context.Context, userID string) (*UserBlacklist, error)
	ListActiveBans(ctx context.Context, userID string) ([]UserBlacklist, error)
	ListBanHistory(ctx context.Context, in ListBanHistoryParams) ([]UserBlacklist, error)
	GetMyReport(ctx context.Context, reportID int64, reporterID string) (Report, error)
	ListMyReports(ctx context.Context, in ListMyReportsParams) ([]Report, int64, error)
	ExpireBansByRole(ctx context.Context, userID, userRole string) error
	MarkReviewedIfPending(ctx context.Context, reportID int64) error

	ListUserBlacklists(ctx context.Context, in ListUserBlacklistsParams) ([]UserBlacklist, int64, error)
	GetUserBlacklist(ctx context.Context, blacklistID int64) (UserBlacklist, error)
}

type repo struct{ db *pgxpool.Pool }

func NewRepo(db *pgxpool.Pool) Repo { return &repo{db: db} }

func scanReport(row pgx.Row, r *Report) error {
	return row.Scan(
		&r.ID, &r.OrderID, &r.ReporterID, &r.ReportedUserID,
		&r.ReportedPartyType, &r.ReasonCode, &r.Description, &r.Status,
		&r.CreatedAt, &r.UpdatedAt,
		&r.ReporterDisplayName, &r.ReportedDisplayName,
		&r.StoreName,
		&r.StoreID,
	)
}
func scanEvidence(row pgx.Row, e *ReportEvidence) error {
	return row.Scan(&e.ID, &e.ReportID, &e.UploadedBy, &e.FileURL, &e.FileName,
		&e.MimeType, &e.FileSizeBytes, &e.SHA256, &e.CreatedAt)
}
func scanChatSnapshot(row pgx.Row, s *ReportChatSnapshot) error {
	return row.Scan(&s.ID, &s.ReportID, &s.SenderID, &s.SenderRole, &s.MessageText,
		&s.MessageType, &s.AttachmentURLs, &s.MessageCreatedAt)
}
func scanAdminAction(row pgx.Row, a *ReportAdminAction) error {
	return row.Scan(&a.ID, &a.ReportID, &a.AdminID, &a.ActionType, &a.Note,
		&a.TargetUserID, &a.TargetStoreID, &a.SuspendDays, &a.IsPermanent, &a.CreatedAt)
}
func scanUserBlacklist(row pgx.Row, b *UserBlacklist) error {
	return row.Scan(&b.ID, &b.UserID, &b.UserRole, &b.ReportID, &b.OrderID, &b.Reason,
		&b.BanType, &b.BannedFrom, &b.BannedUntil, &b.IsActive, &b.CreatedBy, &b.CreatedAt)
}

// pgErr extracts *pgconn.PgError using errors.As (works correctly with pgx/v5)
func pgErr(err error) (*pgconn.PgError, bool) {
	var e *pgconn.PgError
	return e, errors.As(err, &e)
}

// ── Report ───────────────────────────────────────────────────────────────────

func (r *repo) CreateReport(ctx context.Context, in CreateReportInput) (Report, error) {
	in.ReporterID = strings.TrimSpace(in.ReporterID)
	in.ReportedUserID = strings.TrimSpace(in.ReportedUserID)
	in.ReasonCode = strings.TrimSpace(in.ReasonCode)
	if in.ReporterID == "" || in.ReportedUserID == "" || in.ReasonCode == "" {
		return Report{}, apperr.New(apperr.BadRequest, "reporter_id, reported_user_id, and reason_code are required")
	}

	if in.ReporterID == in.ReportedUserID {
		return Report{}, apperr.New(apperr.BadRequest, "reporter_id cannot be the same as reported_user_id")
	}

	if in.OrderID <= 0 {
		return Report{}, apperr.New(apperr.BadRequest, "invalid order_id")
	}

	var existsID int64
	err := r.db.QueryRow(ctx, `
    	SELECT report_id
    	FROM reports
    	WHERE order_id = $1
      	AND reporter_id = $2
    	LIMIT 1;
	`, in.OrderID, in.ReporterID).Scan(&existsID)

	if err == nil {
		return Report{}, apperr.New(apperr.Conflict, "report already exists for this order")
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return Report{}, apperr.Wrap(apperr.Internal, err, "check existing report failed")
	}

	var newID int64
	err = r.db.QueryRow(ctx, `
    INSERT INTO reports (order_id, reporter_id, reported_user_id, reported_party_type, reason_code, description)
    VALUES ($1,$2,$3,$4,$5,$6)
    RETURNING report_id
`, in.OrderID, in.ReporterID, in.ReportedUserID, in.ReportedPartyType, in.ReasonCode, in.Description).Scan(&newID)
	if err != nil {
		if pe, ok := pgErr(err); ok {
			switch pe.Code {
			case "23505":
				return Report{}, apperr.New(apperr.Conflict, "report already exists for this order")
			case "23503":
				return Report{}, apperr.WithFields(
					apperr.Wrap(apperr.BadRequest, err, "invalid order_id or user_id"),
					map[string]any{"pg_code": pe.Code, "constraint": pe.ConstraintName},
				)
			case "23514":
				return Report{}, apperr.New(apperr.BadRequest, "cannot report yourself")
			}
			return Report{}, apperr.WithFields(
				apperr.Wrap(apperr.Internal, err, "insert report failed"),
				map[string]any{"pg_code": pe.Code},
			)
		}
		return Report{}, apperr.Wrap(apperr.Internal, err, "insert report failed")
	}

	return r.GetReport(ctx, newID)
}

func (r *repo) GetReport(ctx context.Context, reportID int64) (Report, error) {
	if reportID <= 0 {
		return Report{}, apperr.New(apperr.BadRequest, "invalid report_id")
	}
	var rep Report
	err := scanReport(r.db.QueryRow(ctx, `
SELECT r.report_id, r.order_id, r.reporter_id, r.reported_user_id,
       r.reported_party_type, r.reason_code, r.description, r.status,
       r.created_at, r.updated_at,
       u1.display_name AS reporter_display_name,
       u2.display_name AS reported_display_name,
       s.store_name,
	   o.store_id
FROM reports r
JOIN users u1 ON u1.user_id = r.reporter_id
JOIN users u2 ON u2.user_id = r.reported_user_id
JOIN orders o ON o.order_id = r.order_id
JOIN stores s ON s.store_id = o.store_id
WHERE r.report_id = $1`, reportID), &rep)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Report{}, apperr.New(apperr.NotFound, "report not found")
		}
		return Report{}, apperr.Wrap(apperr.Internal, err, "get report failed")
	}
	return rep, nil
}

func (r *repo) ListReports(ctx context.Context, in ListReportsParams) ([]Report, int64, error) {
	if in.Limit <= 0 || in.Limit > 100 {
		in.Limit = 20
	}
	if in.Page <= 0 {
		in.Page = 1
	}
	offset := (in.Page - 1) * in.Limit

	base := `FROM reports r
JOIN users u1 ON u1.user_id = r.reporter_id
JOIN users u2 ON u2.user_id = r.reported_user_id
JOIN orders o ON o.order_id = r.order_id
JOIN stores s ON s.store_id = o.store_id
WHERE 1=1`

	args := []any{}
	i := 1

	if in.Q != "" {
		base += ` AND (r.report_id::text LIKE $` + itoa(i) + ` OR r.order_id::text LIKE $` + itoa(i) + `)`
		args = append(args, "%"+in.Q+"%")
		i++
	}
	if in.Status != nil {
		base += ` AND r.status = $` + itoa(i)
		args = append(args, *in.Status)
		i++
	}
	if in.ReportedPartyType != nil {
		base += ` AND r.reported_party_type = $` + itoa(i)
		args = append(args, *in.ReportedPartyType)
		i++
	}
	if in.ReasonCode != nil {
		base += ` AND r.reason_code = $` + itoa(i)
		args = append(args, *in.ReasonCode)
		i++
	}
	if in.FromDate != nil {
		base += ` AND r.created_at >= $` + itoa(i)
		args = append(args, *in.FromDate)
		i++
	}
	if in.ToDate != nil {
		base += ` AND r.created_at <= $` + itoa(i)
		args = append(args, *in.ToDate)
		i++
	}

	// count
	var total int64
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) `+base, args...).Scan(&total); err != nil {
		return nil, 0, apperr.Wrap(apperr.Internal, err, "count reports failed")
	}

	// data
	selectQuery := `SELECT r.report_id, r.order_id, r.reporter_id, r.reported_user_id, r.reported_party_type,
       r.reason_code, r.description, r.status, r.created_at, r.updated_at,
       u1.display_name AS reporter_display_name,
       u2.display_name AS reported_display_name,
       s.store_name,
       o.store_id ` + base +
		` ORDER BY r.created_at DESC LIMIT $` + itoa(i) + ` OFFSET $` + itoa(i+1)
	args = append(args, in.Limit, offset)

	rows, err := r.db.Query(ctx, selectQuery, args...)
	if err != nil {
		return nil, 0, apperr.Wrap(apperr.Internal, err, "list reports failed")
	}
	defer rows.Close()
	out := make([]Report, 0, in.Limit)
	for rows.Next() {
		var rep Report
		if err := scanReport(rows, &rep); err != nil {
			return nil, 0, apperr.Wrap(apperr.Internal, err, "scan report failed")
		}
		out = append(out, rep)
	}
	return out, total, rows.Err()
}

func (r *repo) UpdateReportStatus(ctx context.Context, reportID int64, status string) (Report, error) {
	if reportID <= 0 {
		return Report{}, apperr.New(apperr.BadRequest, "invalid report_id")
	}
	status = strings.ToUpper(strings.TrimSpace(status))
	if status == "" {
		return Report{}, apperr.New(apperr.BadRequest, "status is required")
	}
	var updatedID int64
	err := r.db.QueryRow(ctx, `
    UPDATE reports SET status = $2, updated_at = NOW()
    WHERE report_id = $1
    RETURNING report_id`, reportID, status).Scan(&updatedID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Report{}, apperr.New(apperr.NotFound, "report not found")
		}
		if pe, ok := pgErr(err); ok && pe.Code == "23514" {
			return Report{}, apperr.New(apperr.BadRequest, "invalid status value")
		}
		return Report{}, apperr.Wrap(apperr.Internal, err, "update report status failed")
	}
	return r.GetReport(ctx, updatedID)
}

// ── Evidences ────────────────────────────────────────────────────────────────

func (r *repo) CreateReportEvidences(ctx context.Context, reportID int64, uploadedBy string, items []CreateReportEvidenceInput) ([]ReportEvidence, error) {
	if len(items) == 0 {
		return nil, nil
	}
	if reportID <= 0 {
		return nil, apperr.New(apperr.BadRequest, "invalid report_id")
	}
	uploadedBy = strings.TrimSpace(uploadedBy)
	if uploadedBy == "" {
		return nil, apperr.New(apperr.BadRequest, "invalid uploaded_by")
	}
	batch := &pgx.Batch{}
	for _, it := range items {
		it.FileURL = strings.TrimSpace(it.FileURL)
		if it.FileURL == "" {
			return nil, apperr.New(apperr.BadRequest, "file_url is required")
		}
		batch.Queue(`
INSERT INTO report_evidences (report_id, uploaded_by, file_url, file_name, mime_type, file_size_bytes, sha256)
VALUES ($1,$2,$3,$4,$5,$6,$7)
RETURNING evidence_id, report_id, uploaded_by, file_url, file_name, mime_type, file_size_bytes, sha256, created_at`,
			reportID, uploadedBy, it.FileURL, it.FileName, it.MimeType, it.FileSizeBytes, it.SHA256)
	}
	br := r.db.SendBatch(ctx, batch)
	defer br.Close()
	out := make([]ReportEvidence, 0, len(items))
	for range items {
		var e ReportEvidence
		if err := scanEvidence(br.QueryRow(), &e); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "insert evidence failed")
		}
		out = append(out, e)
	}
	return out, nil
}

func (r *repo) ListEvidencesByReportID(ctx context.Context, reportID int64) ([]ReportEvidence, error) {
	if reportID <= 0 {
		return nil, apperr.New(apperr.BadRequest, "invalid report_id")
	}
	rows, err := r.db.Query(ctx, `
SELECT evidence_id, report_id, uploaded_by, file_url, file_name, mime_type, file_size_bytes, sha256, created_at
FROM report_evidences WHERE report_id = $1 ORDER BY evidence_id ASC`, reportID)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list evidences failed")
	}
	defer rows.Close()
	var out []ReportEvidence
	for rows.Next() {
		var e ReportEvidence
		if err := scanEvidence(rows, &e); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan evidence failed")
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// ── Snapshots ────────────────────────────────────────────────────────────────

func (r *repo) CreateOrderSnapshot(ctx context.Context, in ReportOrderSnapshot) error {
	if in.ReportID <= 0 {
		return apperr.New(apperr.BadRequest, "invalid report_id")
	}
	_, err := r.db.Exec(ctx, `
INSERT INTO report_order_snapshots (
    report_id, order_status, total_price, order_date, delivery_method,
    delivery_address, campus_location_id, campus_detail_note,
    proposed_at, meeting_location, meeting_note,
    cancelled_at, cancelled_by, cancelled_reason, items
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
		in.ReportID, in.OrderStatus, in.TotalPrice, in.OrderDate, in.DeliveryMethod,
		in.DeliveryAddress, in.CampusLocationID, in.CampusDetailNote,
		in.ProposedAt, in.MeetingLocation, in.MeetingNote,
		in.CancelledAt, in.CancelledBy, in.CancelledReason, in.Items)
	if err != nil {
		return apperr.Wrap(apperr.Internal, err, "insert order snapshot failed")
	}
	return nil
}

func (r *repo) GetOrderSnapshot(ctx context.Context, reportID int64) (ReportOrderSnapshot, error) {
	if reportID <= 0 {
		return ReportOrderSnapshot{}, apperr.New(apperr.BadRequest, "invalid report_id")
	}
	var s ReportOrderSnapshot
	err := r.db.QueryRow(ctx, `
SELECT report_id, order_status, total_price, order_date, delivery_method,
       delivery_address, campus_location_id, campus_detail_note,
       proposed_at, meeting_location, meeting_note,
       cancelled_at, cancelled_by, cancelled_reason, items, created_at
FROM report_order_snapshots WHERE report_id = $1`, reportID).Scan(
		&s.ReportID, &s.OrderStatus, &s.TotalPrice, &s.OrderDate, &s.DeliveryMethod,
		&s.DeliveryAddress, &s.CampusLocationID, &s.CampusDetailNote,
		&s.ProposedAt, &s.MeetingLocation, &s.MeetingNote,
		&s.CancelledAt, &s.CancelledBy, &s.CancelledReason, &s.Items, &s.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ReportOrderSnapshot{}, apperr.New(apperr.NotFound, "order snapshot not found")
		}
		return ReportOrderSnapshot{}, apperr.Wrap(apperr.Internal, err, "get order snapshot failed")
	}
	return s, nil
}

func (r *repo) CreateChatSnapshots(ctx context.Context, items []ReportChatSnapshot) error {
	if len(items) == 0 {
		return nil
	}
	batch := &pgx.Batch{}
	for _, it := range items {
		batch.Queue(`
INSERT INTO report_chat_snapshots (report_id, sender_id, sender_role, message_text, message_type,
  attachment_urls, message_created_at)
VALUES ($1,$2,$3,$4,$5,$6,$7)`,
			it.ReportID, it.SenderID, it.SenderRole, it.MessageText,
			it.MessageType, it.AttachmentURLs, it.MessageCreatedAt)
	}
	br := r.db.SendBatch(ctx, batch)
	defer br.Close()
	for range items {
		if _, err := br.Exec(); err != nil {
			return apperr.Wrap(apperr.Internal, err, "insert chat snapshot failed")
		}
	}
	return nil
}

func (r *repo) ListChatSnapshotsByReportID(ctx context.Context, reportID int64) ([]ReportChatSnapshot, error) {
	if reportID <= 0 {
		return nil, apperr.New(apperr.BadRequest, "invalid report_id")
	}
	rows, err := r.db.Query(ctx, `
SELECT snapshot_id, report_id, sender_id, sender_role, message_text,
       message_type, attachment_urls, message_created_at
FROM report_chat_snapshots WHERE report_id = $1 ORDER BY message_created_at ASC`, reportID)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list chat snapshots failed")
	}
	defer rows.Close()
	var out []ReportChatSnapshot
	for rows.Next() {
		var s ReportChatSnapshot
		if err := scanChatSnapshot(rows, &s); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan chat snapshot failed")
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// ── Admin Actions ─────────────────────────────────────────────────────────────

func (r *repo) CreateAdminAction(ctx context.Context, in AdminActionInput) (ReportAdminAction, error) {
	if in.ReportID <= 0 {
		return ReportAdminAction{}, apperr.New(apperr.BadRequest, "invalid report_id")
	}
	in.AdminID = strings.TrimSpace(in.AdminID)
	in.ActionType = strings.ToUpper(strings.TrimSpace(in.ActionType))
	if in.AdminID == "" || in.ActionType == "" {
		return ReportAdminAction{}, apperr.New(apperr.BadRequest, "admin_id and action_type are required")
	}
	var a ReportAdminAction
	err := scanAdminAction(r.db.QueryRow(ctx, `
INSERT INTO report_admin_actions (report_id, admin_id, action_type, note,
  target_user_id, target_store_id, suspend_days, is_permanent)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
RETURNING action_id, report_id, admin_id, action_type, note,
          target_user_id, target_store_id, suspend_days, is_permanent, created_at`,
		in.ReportID, in.AdminID, in.ActionType, in.Note,
		in.TargetUserID, in.TargetStoreID, in.SuspendDays, in.IsPermanent), &a)
	if err != nil {
		if pe, ok := pgErr(err); ok {
			if pe.Code == "23514" {
				return ReportAdminAction{}, apperr.WithFields(
					apperr.Wrap(apperr.BadRequest, err, "constraint violation: check target fields for this action_type"),
					map[string]any{"constraint": pe.ConstraintName})
			}
			return ReportAdminAction{}, apperr.WithFields(
				apperr.Wrap(apperr.Internal, err, "insert admin action failed"),
				map[string]any{"pg_code": pe.Code})
		}
		return ReportAdminAction{}, apperr.Wrap(apperr.Internal, err, "insert admin action failed")
	}
	return a, nil
}

func (r *repo) ListAdminActionsByReportID(ctx context.Context, reportID int64) ([]ReportAdminAction, error) {
	if reportID <= 0 {
		return nil, apperr.New(apperr.BadRequest, "invalid report_id")
	}
	rows, err := r.db.Query(ctx, `
SELECT action_id, report_id, admin_id, action_type, note,
       target_user_id, target_store_id, suspend_days, is_permanent, created_at
FROM report_admin_actions WHERE report_id = $1 ORDER BY created_at ASC`, reportID)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list admin actions failed")
	}
	defer rows.Close()
	var out []ReportAdminAction
	for rows.Next() {
		var a ReportAdminAction
		if err := scanAdminAction(rows, &a); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan admin action failed")
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (r *repo) ExpireBansByRole(ctx context.Context, userID, userRole string) error {
	userID = strings.TrimSpace(userID)
	userRole = strings.ToUpper(strings.TrimSpace(userRole))

	if userID == "" {
		return apperr.New(apperr.BadRequest, "invalid user_id")
	}
	if userRole != "BUYER" && userRole != "SELLER" {
		return apperr.New(apperr.BadRequest, "invalid user_role")
	}

	_, err := r.db.Exec(ctx, `
UPDATE user_blacklists
SET is_active = FALSE
WHERE user_id = $1
  AND user_role = $2
  AND is_active = TRUE
  AND ban_type IN ('TEMPORARY','WARNING')
  AND banned_until IS NOT NULL
  AND banned_until <= NOW()
`, userID, userRole)
	if err != nil {
		return apperr.Wrap(apperr.Internal, err, "expire bans failed")
	}
	return nil
}

func (r *repo) CreateUserBan(ctx context.Context, in CreateUserBanInput) (UserBlacklist, error) {
	in.UserID = strings.TrimSpace(in.UserID)
	in.UserRole = strings.ToUpper(strings.TrimSpace(in.UserRole))
	if in.UserRole != "BUYER" && in.UserRole != "SELLER" {
		return UserBlacklist{}, apperr.New(apperr.BadRequest, "invalid user_role")
	}
	in.CreatedBy = strings.TrimSpace(in.CreatedBy)
	in.Reason = strings.TrimSpace(in.Reason)
	in.BanType = strings.ToUpper(strings.TrimSpace(in.BanType))
	if in.UserID == "" || in.CreatedBy == "" || in.Reason == "" || in.BanType == "" {
		return UserBlacklist{}, apperr.New(apperr.BadRequest, "user_id, reason, ban_type, and created_by are required")
	}

	if err := r.ExpireBansByRole(ctx, in.UserID, in.UserRole); err != nil {
		return UserBlacklist{}, err
	}

	if in.BanType == "WARNING" {
		t := time.Now().Add(7 * 24 * time.Hour)
		in.BannedUntil = &t
	}

	if in.BanType == "TEMPORARY" && in.BannedUntil == nil {
		return UserBlacklist{}, apperr.New(apperr.BadRequest, "banned_until is required for TEMPORARY")
	}

	if in.BanType == "PERMANENT" {
		in.BannedUntil = nil
	}

	var existsID int64
	err := r.db.QueryRow(ctx, `
    SELECT blacklist_id
    FROM user_blacklists
    WHERE user_id = $1
      AND user_role = $2
      AND is_active = TRUE
      AND (
        ban_type = 'PERMANENT'
        OR (ban_type IN ('TEMPORARY','WARNING') AND banned_until > NOW())
      )
    ORDER BY created_at DESC
    LIMIT 1;
`, in.UserID, in.UserRole).Scan(&existsID)

	if err == nil {
		return UserBlacklist{}, apperr.New(apperr.Conflict, "user already has an active ban")
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return UserBlacklist{}, apperr.Wrap(apperr.Internal, err, "check active ban failed")
	}

	var b UserBlacklist
	err = scanUserBlacklist(r.db.QueryRow(ctx, `
INSERT INTO user_blacklists (user_id, user_role, report_id, reason, ban_type, banned_until, created_by)
VALUES ($1,$2,$3,$4,$5,$6,$7)
RETURNING
  blacklist_id, user_id, user_role, report_id,
  (SELECT r.order_id FROM reports r WHERE r.report_id = user_blacklists.report_id) AS order_id,
  reason, ban_type, banned_from, banned_until, is_active, created_by, created_at
`, in.UserID, in.UserRole, in.ReportID, in.Reason, in.BanType, in.BannedUntil, in.CreatedBy), &b)

	if err != nil {
		if pe, ok := pgErr(err); ok {
			switch pe.Code {
			case "23505":
				return UserBlacklist{}, apperr.New(apperr.Conflict, "user already has an active ban for this role")
			case "23514":
				return UserBlacklist{}, apperr.WithFields(
					apperr.Wrap(apperr.BadRequest, err, "constraint violation: check ban_type and banned_until"),
					map[string]any{"constraint": pe.ConstraintName},
				)
			}
			return UserBlacklist{}, apperr.WithFields(
				apperr.Wrap(apperr.Internal, err, "insert user ban failed"),
				map[string]any{"pg_code": pe.Code},
			)
		}
		return UserBlacklist{}, apperr.Wrap(apperr.Internal, err, "insert user ban failed")
	}
	return b, nil
}

func (r *repo) RevokeUserBan(ctx context.Context, blacklistID int64) (UserBlacklist, error) {
	if blacklistID <= 0 {
		return UserBlacklist{}, apperr.New(apperr.BadRequest, "invalid blacklist_id")
	}
	var b UserBlacklist
	err := scanUserBlacklist(r.db.QueryRow(ctx, `
UPDATE user_blacklists
SET is_active = FALSE
WHERE blacklist_id = $1
RETURNING
  blacklist_id, user_id, user_role, report_id,
  (SELECT r.order_id FROM reports r WHERE r.report_id = user_blacklists.report_id) AS order_id,
  reason, ban_type, banned_from, banned_until, is_active, created_by, created_at
`, blacklistID), &b)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return UserBlacklist{}, apperr.New(apperr.NotFound, "ban record not found")
		}
		return UserBlacklist{}, apperr.Wrap(apperr.Internal, err, "revoke ban failed")
	}
	return b, nil
}

func (r *repo) GetActiveBan(ctx context.Context, userID string) (*UserBlacklist, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return nil, apperr.New(apperr.BadRequest, "invalid user_id")
	}
	var b UserBlacklist
	err := scanUserBlacklist(r.db.QueryRow(ctx, `
SELECT
  ub.blacklist_id, ub.user_id, ub.user_role, ub.report_id,
  r.order_id,
  ub.reason, ub.ban_type, ub.banned_from, ub.banned_until,
  ub.is_active, ub.created_by, ub.created_at
FROM user_blacklists ub
LEFT JOIN reports r ON r.report_id = ub.report_id
WHERE ub.user_id = $1
  AND ub.is_active = TRUE
  AND (
    ub.ban_type = 'PERMANENT'
    OR (ub.ban_type IN ('TEMPORARY','WARNING') AND ub.banned_until > NOW())
  )
ORDER BY ub.created_at DESC
LIMIT 1
`, userID), &b)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, apperr.Wrap(apperr.Internal, err, "get active ban failed")
	}
	return &b, nil
}

func (r *repo) ListBanHistory(ctx context.Context, in ListBanHistoryParams) ([]UserBlacklist, error) {
	in.UserID = strings.TrimSpace(in.UserID)
	if in.UserID == "" {
		return nil, apperr.New(apperr.BadRequest, "invalid user_id")
	}
	if in.Limit <= 0 || in.Limit > 100 {
		in.Limit = 20
	}
	rows, err := r.db.Query(ctx, `
SELECT
  ub.blacklist_id, ub.user_id, ub.user_role, ub.report_id,
  r.order_id,
  ub.reason, ub.ban_type, ub.banned_from, ub.banned_until,
  ub.is_active, ub.created_by, ub.created_at
FROM user_blacklists ub
LEFT JOIN reports r ON r.report_id = ub.report_id
WHERE ub.user_id = $1
ORDER BY ub.created_at DESC
LIMIT $2 OFFSET $3
`, in.UserID, in.Limit, in.Offset)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list ban history failed")
	}
	defer rows.Close()
	var out []UserBlacklist
	for rows.Next() {
		var b UserBlacklist
		if err := scanUserBlacklist(rows, &b); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan ban failed")
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// ── Helper ────────────────────────────────────────────────────────────────────

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var buf [16]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[i:])
}

func (r *repo) GetMyReport(ctx context.Context, reportID int64, reporterID string) (Report, error) {
	if reportID <= 0 {
		return Report{}, apperr.New(apperr.BadRequest, "invalid report_id")
	}
	var rep Report
	err := r.db.QueryRow(ctx, `
SELECT r.report_id, r.order_id, r.reporter_id, r.reported_user_id,
       r.reported_party_type, r.reason_code, r.description, r.status,
       r.created_at, r.updated_at,
       u1.display_name AS reporter_display_name,
       u2.display_name AS reported_display_name,
       s.store_name
FROM reports r
JOIN users u1 ON u1.user_id = r.reporter_id
JOIN users u2 ON u2.user_id = r.reported_user_id
JOIN orders o ON o.order_id = r.order_id
JOIN stores s ON s.store_id = o.store_id
WHERE r.report_id = $1 AND r.reporter_id = $2`, reportID, reporterID).Scan(
		&rep.ID, &rep.OrderID, &rep.ReporterID, &rep.ReportedUserID,
		&rep.ReportedPartyType, &rep.ReasonCode, &rep.Description, &rep.Status,
		&rep.CreatedAt, &rep.UpdatedAt,
		&rep.ReporterDisplayName, &rep.ReportedDisplayName,
		&rep.StoreName,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Report{}, apperr.New(apperr.NotFound, "report not found")
		}
		return Report{}, apperr.Wrap(apperr.Internal, err, "get my report failed")
	}
	return rep, nil
}

func (r *repo) ListMyReports(ctx context.Context, in ListMyReportsParams) ([]Report, int64, error) {
	if in.Limit <= 0 || in.Limit > 100 {
		in.Limit = 20
	}
	if in.Page <= 0 {
		in.Page = 1
	}
	offset := (in.Page - 1) * in.Limit

	base := `FROM reports r
JOIN users u1 ON u1.user_id = r.reporter_id
JOIN users u2 ON u2.user_id = r.reported_user_id
JOIN orders o ON o.order_id = r.order_id
JOIN stores s ON s.store_id = o.store_id
WHERE r.reporter_id = $1`

	args := []any{in.ReporterID}
	i := 2

	if in.Q != "" {
		base += ` AND (r.report_id::text LIKE $` + itoa(i) + ` OR r.order_id::text LIKE $` + itoa(i) + `)`
		args = append(args, in.Q)
		i++
	}

	if in.ReportedPartyType != nil {
		base += ` AND r.reported_party_type = $` + itoa(i)
		args = append(args, *in.ReportedPartyType)
		i++
	}
	if in.Status != nil {
		base += ` AND r.status = $` + itoa(i)
		args = append(args, *in.Status)
		i++
	}

	// count
	var total int64
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) `+base, args...).Scan(&total); err != nil {
		return nil, 0, apperr.Wrap(apperr.Internal, err, "count my reports failed")
	}

	// data
	selectQuery := `
SELECT 
r.report_id, r.order_id, r.reporter_id, r.reported_user_id,
r.reported_party_type, r.reason_code, r.description, r.status,
r.created_at, r.updated_at,
u1.display_name AS reporter_display_name,
u2.display_name AS reported_display_name,
s.store_name,
s.store_id
` + base + `
ORDER BY r.created_at DESC
LIMIT $` + itoa(i) + ` OFFSET $` + itoa(i+1)
	args = append(args, in.Limit, offset)

	rows, err := r.db.Query(ctx, selectQuery, args...)
	if err != nil {
		return nil, 0, apperr.Wrap(apperr.Internal, err, "list my reports failed")
	}
	defer rows.Close()
	out := make([]Report, 0, in.Limit)
	for rows.Next() {
		var rep Report
		if err := scanReport(rows, &rep); err != nil {
			return nil, 0, apperr.Wrap(apperr.Internal, err, "scan report failed")
		}
		out = append(out, rep)
	}
	return out, total, rows.Err()
}

func (r *repo) ListActiveBans(ctx context.Context, userID string) ([]UserBlacklist, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return nil, apperr.New(apperr.BadRequest, "invalid user_id")
	}
	_ = r.ExpireBansByRole(ctx, userID, "BUYER")
	_ = r.ExpireBansByRole(ctx, userID, "SELLER")

	rows, err := r.db.Query(ctx, `
SELECT
  ub.blacklist_id, ub.user_id, ub.user_role, ub.report_id,
  r.order_id,
  ub.reason, ub.ban_type, ub.banned_from, ub.banned_until,
  ub.is_active, ub.created_by, ub.created_at
FROM user_blacklists ub
LEFT JOIN reports r ON r.report_id = ub.report_id
WHERE ub.user_id = $1
  AND ub.is_active = TRUE
  AND (
    ub.ban_type = 'PERMANENT'
    OR (ub.ban_type IN ('TEMPORARY','WARNING') AND ub.banned_until > NOW())
  )
ORDER BY ub.created_at DESC
`, userID)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list active bans failed")
	}
	defer rows.Close()

	out := []UserBlacklist{}
	for rows.Next() {
		var b UserBlacklist
		if err := scanUserBlacklist(rows, &b); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan active ban failed")
		}
		out = append(out, b)
	}
	if err := rows.Err(); err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list active bans failed")
	}
	return out, nil
}

func (r *repo) MarkReviewedIfPending(ctx context.Context, reportID int64) error {
	if reportID <= 0 {
		return apperr.New(apperr.BadRequest, "invalid report_id")
	}

	_, err := r.db.Exec(ctx, `
UPDATE reports
SET status = 'REVIEWED', updated_at = NOW()
WHERE report_id = $1
  AND status = 'PENDING'
`, reportID)
	if err != nil {
		return apperr.Wrap(apperr.Internal, err, "mark reviewed failed")
	}
	return nil
}
func (r *repo) ListUserBlacklists(ctx context.Context, in ListUserBlacklistsParams) ([]UserBlacklist, int64, error) {
	if in.Limit <= 0 || in.Limit > 100 {
		in.Limit = 20
	}
	if in.Page <= 0 {
		in.Page = 1
	}
	offset := (in.Page - 1) * in.Limit

	base := `
FROM user_blacklists ub
LEFT JOIN reports r ON r.report_id = ub.report_id
LEFT JOIN orders  o ON o.order_id = r.order_id
WHERE 1=1`
	args := []any{}
	i := 1

	if in.IsActive != nil {
		base += ` AND ub.is_active = $` + itoa(i)
		args = append(args, *in.IsActive)
		i++
	}
	if in.UserRole != nil {
		v := strings.ToUpper(strings.TrimSpace(*in.UserRole))
		base += ` AND ub.user_role = $` + itoa(i)
		args = append(args, v)
		i++
	}
	if in.BanType != nil {
		v := strings.ToUpper(strings.TrimSpace(*in.BanType))
		base += ` AND ub.ban_type = $` + itoa(i)
		args = append(args, v)
		i++
	}
	if in.FromDate != nil {
		base += ` AND ub.created_at >= $` + itoa(i)
		args = append(args, *in.FromDate)
		i++
	}
	if in.ToDate != nil {
		base += ` AND ub.created_at <= $` + itoa(i)
		args = append(args, *in.ToDate)
		i++
	}
	if q := strings.TrimSpace(in.Q); q != "" {
		base += ` AND (
		ub.user_id::text ILIKE $` + itoa(i) + `
		OR ub.blacklist_id::text ILIKE $` + itoa(i) + `
		OR ub.report_id::text ILIKE $` + itoa(i) + `
		OR o.order_id::text ILIKE $` + itoa(i) + `
		OR ub.reason ILIKE $` + itoa(i) + `
	)`
		args = append(args, q+"%")
		i++
	}

	var total int64
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) `+base, args...).Scan(&total); err != nil {
		return nil, 0, apperr.Wrap(apperr.Internal, err, "count user_blacklists failed")
	}

	selectQuery := `SELECT
  		ub.blacklist_id, ub.user_id, ub.user_role, ub.report_id,
  		o.order_id,
  		ub.reason, ub.ban_type, ub.banned_from, ub.banned_until,
  		ub.is_active, ub.created_by, ub.created_at
		` + base + `
		ORDER BY ub.created_at DESC
		LIMIT $` + itoa(i) + ` OFFSET $` + itoa(i+1)

	args = append(args, in.Limit, offset)

	rows, err := r.db.Query(ctx, selectQuery, args...)
	if err != nil {
		return nil, 0, apperr.Wrap(apperr.Internal, err, "list user_blacklists failed")
	}
	defer rows.Close()

	out := make([]UserBlacklist, 0, in.Limit)
	for rows.Next() {
		var b UserBlacklist
		if err := scanUserBlacklist(rows, &b); err != nil {
			return nil, 0, apperr.Wrap(apperr.Internal, err, "scan user_blacklist failed")
		}
		out = append(out, b)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, apperr.Wrap(apperr.Internal, err, "list user_blacklists failed")
	}

	return out, total, nil
}

func (r *repo) GetUserBlacklist(ctx context.Context, blacklistID int64) (UserBlacklist, error) {
	if blacklistID <= 0 {
		return UserBlacklist{}, apperr.New(apperr.BadRequest, "invalid blacklist_id")
	}
	var b UserBlacklist
	err := scanUserBlacklist(r.db.QueryRow(ctx, `
SELECT
  ub.blacklist_id, ub.user_id, ub.user_role, ub.report_id,
  r.order_id,
  ub.reason, ub.ban_type, ub.banned_from, ub.banned_until,
  ub.is_active, ub.created_by, ub.created_at
FROM user_blacklists ub
LEFT JOIN reports r ON r.report_id = ub.report_id
WHERE ub.blacklist_id = $1
`, blacklistID), &b)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return UserBlacklist{}, apperr.New(apperr.NotFound, "blacklist not found")
		}
		return UserBlacklist{}, apperr.Wrap(apperr.Internal, err, "get user_blacklist failed")
	}
	return b, nil
}

var _ = time.Now
