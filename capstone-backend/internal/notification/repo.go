package notification

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgconn"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
)

// ============================================================================
// Repo Interface
// ============================================================================

type Repo interface {
	Create(ctx context.Context, in CreateNotificationInput) (Notification, error)
	Get(ctx context.Context, userID string, notificationID int64) (Notification, error)
	List(ctx context.Context, in ListNotificationsParams) ([]Notification, error)

	MarkRead(ctx context.Context, in MarkReadInput) (Notification, error)

	Delete(ctx context.Context, userID string, notificationID int64) error
	DeleteAll(ctx context.Context, userID string) (int64, error)

	CountUnread(ctx context.Context, userID string) (int64, error)
}

type repo struct {
	db *pgxpool.Pool
}

func NewRepo(db *pgxpool.Pool) Repo {
	return &repo{db: db}
}

// ============================================================================
// Scanners
// ============================================================================

func scanNotification(row pgx.Row, n *Notification) error {
	var raw json.RawMessage
	err := row.Scan(
		&n.ID,
		&n.UserID,
		&n.Type,
		&n.OrderID,
		&n.ThreadID,
		&n.MessageID,
		&n.StoreID,
		&n.StoreName,
		&n.ActorUserID,
		&n.ActorDisplayName,
		&n.Title,
		&n.Body,
		&raw,
		&n.IsRead,
		&n.ReadAt,
		&n.CreatedAt,
	)
	if err != nil {
		return err
	}

	if len(raw) > 0 && string(raw) != "null" {
		// แปลงเป็น map เพื่อใช้งานง่าย (จะ marshal ออก JSON ได้)
		var m map[string]any
		if e := json.Unmarshal(raw, &m); e == nil {
			n.Data = m
		} else {
			// fallback เก็บ raw ไว้
			n.Data = raw
		}
	}
	return nil
}

// ============================================================================
// Create
// ============================================================================

func (r *repo) Create(ctx context.Context, in CreateNotificationInput) (Notification, error) {
	in.UserID = strings.TrimSpace(in.UserID)
	in.Type = strings.TrimSpace(in.Type)

	if in.UserID == "" {
		return Notification{}, apperr.New(apperr.BadRequest, "invalid user_id")
	}
	if in.Type == "" {
		return Notification{}, apperr.New(apperr.BadRequest, "invalid type")
	}
	// ต้องมี reference อย่างน้อย 1 อย่าง (ให้ตรงกับ constraint)
	if (in.OrderID == nil || *in.OrderID <= 0) && (in.ThreadID == nil || *in.ThreadID <= 0) {
		return Notification{}, apperr.New(apperr.BadRequest, "order_id or thread_id is required")
	}

	// jsonb
	var dataJSON any = nil
	if in.Data != nil {
		b, err := json.Marshal(in.Data)
		if err != nil {
			return Notification{}, apperr.Wrap(apperr.BadRequest, err, "invalid data payload")
		}
		dataJSON = b
	}

	var n Notification
	err := scanNotification(r.db.QueryRow(ctx, `
WITH ins AS (
  INSERT INTO notifications (
    user_id, type,
    order_id, thread_id, message_id,
    store_id, actor_user_id,
    title, body,
    data
  ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
  RETURNING
    notification_id,
    user_id,
    type,
    order_id, thread_id, message_id,
    store_id,
    actor_user_id,
    title, body,
    data,
    is_read, read_at,
    created_at
)
SELECT
  ins.notification_id,
  ins.user_id,
  ins.type,
  ins.order_id, ins.thread_id, ins.message_id,
  ins.store_id,
  s.store_name,
  ins.actor_user_id,
  u.display_name,
  ins.title, ins.body,
  ins.data,
  ins.is_read, ins.read_at,
  ins.created_at
FROM ins
LEFT JOIN stores s ON s.store_id = ins.store_id
LEFT JOIN users  u ON u.user_id = ins.actor_user_id
`,
		in.UserID,
		in.Type,
		in.OrderID,
		in.ThreadID,
		in.MessageID,
		in.StoreID,
		in.ActorUserID,
		in.Title,
		in.Body,
		dataJSON,
	), &n)

	if err != nil {
		if pgErr, ok := err.(*pgconn.PgError); ok {
			if pgErr.Code == "23503" { // FK
				return Notification{}, apperr.WithFields(
					apperr.Wrap(apperr.BadRequest, err, "invalid reference (fk)"),
					map[string]any{"pg_code": pgErr.Code, "constraint": pgErr.ConstraintName},
				)
			}
			if pgErr.Code == "23514" { // CHECK constraint
				return Notification{}, apperr.WithFields(
					apperr.Wrap(apperr.BadRequest, err, "invalid notification payload"),
					map[string]any{"pg_code": pgErr.Code, "constraint": pgErr.ConstraintName},
				)
			}
			return Notification{}, apperr.WithFields(
				apperr.Wrap(apperr.Internal, err, "create notification failed"),
				map[string]any{"pg_code": pgErr.Code, "constraint": pgErr.ConstraintName},
			)
		}
		return Notification{}, apperr.Wrap(apperr.Internal, err, "create notification failed")
	}

	return n, nil
}

// ============================================================================
// Get / List
// ============================================================================

func (r *repo) Get(ctx context.Context, userID string, notificationID int64) (Notification, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return Notification{}, apperr.New(apperr.BadRequest, "invalid user_id")
	}
	if notificationID <= 0 {
		return Notification{}, apperr.New(apperr.BadRequest, "invalid notification_id")
	}

	var n Notification
	err := scanNotification(r.db.QueryRow(ctx, `
SELECT
  n.notification_id,
  n.user_id,
  n.type,
  n.order_id, n.thread_id, n.message_id,
  n.store_id,
  s.store_name,
  n.actor_user_id,
  u.display_name,          
  n.title, n.body,
  n.data,
  n.is_read, n.read_at,
  n.created_at
FROM notifications n
LEFT JOIN stores s ON s.store_id = n.store_id
LEFT JOIN users  u ON u.user_id = n.actor_user_id
WHERE n.notification_id = $1 AND n.user_id = $2
`, notificationID, userID), &n)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Notification{}, apperr.New(apperr.NotFound, "notification not found")
		}
		return Notification{}, apperr.Wrap(apperr.Internal, err, "get notification failed")
	}
	return n, nil
}

func (r *repo) List(ctx context.Context, in ListNotificationsParams) ([]Notification, error) {
	in.UserID = strings.TrimSpace(in.UserID)
	if in.UserID == "" {
		return nil, apperr.New(apperr.BadRequest, "invalid user_id")
	}
	if in.Limit <= 0 || in.Limit > 100 {
		in.Limit = 30
	}

	q := `
SELECT
  n.notification_id,
  n.user_id,
  n.type,
  n.order_id, n.thread_id, n.message_id,
  n.store_id,
  s.store_name,
  n.actor_user_id,
  u.display_name,
  n.title, n.body,
  n.data,
  n.is_read, n.read_at,
  n.created_at
FROM notifications n
LEFT JOIN stores s ON s.store_id = n.store_id
LEFT JOIN users  u ON u.user_id = n.actor_user_id
WHERE n.user_id = $1
`
	args := []any{in.UserID}
	argPos := 2

	// read/unread filter
	if in.OnlyRead != nil {
		q += " AND n.is_read = $" + itoa(argPos) + " "
		args = append(args, *in.OnlyRead)
		argPos++
	}

	// type(s) filter
	if len(in.Types) > 0 {
		// ใช้ = ANY($x) โดยส่งเป็น []string
		q += " AND n.type = ANY($" + itoa(argPos) + ") "
		args = append(args, in.Types)
		argPos++
	}

	// order_id filter
	if in.OrderID != nil && *in.OrderID > 0 {
		q += " AND n.order_id = $" + itoa(argPos) + " "
		args = append(args, *in.OrderID)
		argPos++
	}

	// store_id filter
	if in.StoreID != nil && *in.StoreID > 0 {
		q += " AND n.store_id = $" + itoa(argPos) + " "
		args = append(args, *in.StoreID)
		argPos++
	}

	// pagination
	if in.BeforeID != nil && *in.BeforeID > 0 {
		q += " AND n.notification_id < $" + itoa(argPos) + " "
		args = append(args, *in.BeforeID)
		argPos++
	}

	q += " ORDER BY n.notification_id DESC LIMIT $" + itoa(argPos)
	args = append(args, in.Limit)

	rows, err := r.db.Query(ctx, q, args...)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list notifications failed")
	}
	defer rows.Close()

	out := make([]Notification, 0, in.Limit)
	for rows.Next() {
		var n Notification
		if err := scanNotification(rows, &n); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan notification failed")
		}
		out = append(out, n)
	}
	if err := rows.Err(); err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "rows error")
	}
	return out, nil
}

// ============================================================================
// MarkRead
// ============================================================================

func (r *repo) MarkRead(ctx context.Context, in MarkReadInput) (Notification, error) {
	in.UserID = strings.TrimSpace(in.UserID)
	if in.UserID == "" {
		return Notification{}, apperr.New(apperr.BadRequest, "invalid user_id")
	}
	if in.NotificationID <= 0 {
		return Notification{}, apperr.New(apperr.BadRequest, "invalid notification_id")
	}

	now := time.Now()

	var n Notification
	err := scanNotification(r.db.QueryRow(ctx, `
WITH upd AS (
  UPDATE notifications
  SET
    is_read = TRUE,
    read_at = COALESCE(read_at, $3)
  WHERE notification_id = $1 AND user_id = $2
  RETURNING
    notification_id,
    user_id,
    type,
    order_id, thread_id, message_id,
    store_id,
    actor_user_id,
    title, body,
    data,
    is_read, read_at,
    created_at
)
SELECT
  upd.notification_id,
  upd.user_id,
  upd.type,
  upd.order_id, upd.thread_id, upd.message_id,
  upd.store_id,
  s.store_name,
  upd.actor_user_id,
  u.display_name,
  upd.title, upd.body,
  upd.data,
  upd.is_read, upd.read_at,
  upd.created_at
FROM upd
LEFT JOIN stores s ON s.store_id = upd.store_id
LEFT JOIN users  u ON u.user_id = upd.actor_user_id
`, in.NotificationID, in.UserID, now), &n)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Notification{}, apperr.New(apperr.NotFound, "notification not found")
		}
		return Notification{}, apperr.Wrap(apperr.Internal, err, "mark read failed")
	}
	return n, nil
}

// ============================================================================
// Delete / DeleteAll
// ============================================================================

func (r *repo) Delete(ctx context.Context, userID string, notificationID int64) error {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return apperr.New(apperr.BadRequest, "invalid user_id")
	}
	if notificationID <= 0 {
		return apperr.New(apperr.BadRequest, "invalid notification_id")
	}

	tag, err := r.db.Exec(ctx, `
DELETE FROM notifications
WHERE notification_id = $1 AND user_id = $2
`, notificationID, userID)
	if err != nil {
		return apperr.Wrap(apperr.Internal, err, "delete notification failed")
	}
	if tag.RowsAffected() == 0 {
		return apperr.New(apperr.NotFound, "notification not found")
	}
	return nil
}

func (r *repo) DeleteAll(ctx context.Context, userID string) (int64, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return 0, apperr.New(apperr.BadRequest, "invalid user_id")
	}

	tag, err := r.db.Exec(ctx, `
DELETE FROM notifications
WHERE user_id = $1
`, userID)
	if err != nil {
		return 0, apperr.Wrap(apperr.Internal, err, "delete all notifications failed")
	}
	return tag.RowsAffected(), nil
}

func (r *repo) CountUnread(ctx context.Context, userID string) (int64, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return 0, apperr.New(apperr.BadRequest, "invalid user_id")
	}

	var c int64
	err := r.db.QueryRow(ctx, `
SELECT COUNT(*)
FROM notifications
WHERE user_id = $1 AND is_read = FALSE
`, userID).Scan(&c)

	if err != nil {
		return 0, apperr.Wrap(apperr.Internal, err, "count unread failed")
	}
	return c, nil
}

// ============================================================================
// Small helper (avoid fmt / strconv in hot path)
// ============================================================================

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
