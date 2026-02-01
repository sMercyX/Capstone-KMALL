package orderchat

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

// ============================================================================
// Repo Interface
// ============================================================================

type Repo interface {
	// Thread
	GetThread(ctx context.Context, threadID int64) (Thread, error)

	// Messages
	CreateMessage(ctx context.Context, in CreateMessageInput) (Message, error)
	GetMessage(ctx context.Context, messageID int64) (Message, error)
	ListMessages(ctx context.Context, in ListMessagesParams) ([]Message, error)

	UpdateMessageText(ctx context.Context, messageID int64, in UpdateMessageTextInput) (Message, error)
	SoftDeleteMessage(ctx context.Context, messageID int64, in SoftDeleteMessageInput) (Message, error)
	ModerateMessage(ctx context.Context, messageID int64, in ModerateMessageInput) (Message, error)

	// Attachments
	CreateAttachments(ctx context.Context, items []CreateAttachmentInput) ([]Attachment, error)
	ListAttachmentsByMessageID(ctx context.Context, messageID int64) ([]Attachment, error)

	// Read state
	UpsertReadState(ctx context.Context, in MarkReadInput) (ReadState, error)
	GetReadState(ctx context.Context, threadID int64, userID string) (ReadState, error)

	GetThreadCreateInfoByOrderID(ctx context.Context, orderID int64) (CreateThreadInput, error)
	GetThreadByOrderID(ctx context.Context, orderID int64) (Thread, error)
	CreateThread(ctx context.Context, in CreateThreadInput) (Thread, error)
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

func scanThread(row pgx.Row, t *Thread) error {
	return row.Scan(
		&t.ID,
		&t.OrderID,
		&t.StoreID,
		&t.BuyerID,
		&t.SellerID,
		&t.CreatedAt,
		&t.UpdatedAt,
	)
}

func scanMessage(row pgx.Row, m *Message) error {
	return row.Scan(
		&m.ID,
		&m.ThreadID,
		&m.SenderID,
		&m.MessageText,
		&m.MessageType,
		&m.CreatedAt,
		&m.EditedAt,
		&m.EditedBy,
		&m.DeletedAt,
		&m.DeletedBy,
		&m.DeleteReason,
		&m.ModerationStatus,
		&m.ModeratedAt,
		&m.ModeratedBy,
		&m.ModerationReason,
	)
}

func scanAttachment(row pgx.Row, a *Attachment) error {
	return row.Scan(
		&a.ID,
		&a.MessageID,
		&a.FileURL,
		&a.FileName,
		&a.MimeType,
		&a.FileSizeBytes,
		&a.SHA256,
		&a.CreatedAt,
		&a.DeletedAt,
		&a.DeletedBy,
		&a.DeleteReason,
	)
}

func scanReadState(row pgx.Row, rs *ReadState) error {
	return row.Scan(
		&rs.ThreadID,
		&rs.UserID,
		&rs.LastReadMessageID,
		&rs.LastReadAt,
	)
}

// ============================================================================
// Thread
// ============================================================================

func (r *repo) GetThread(ctx context.Context, threadID int64) (Thread, error) {
	if threadID <= 0 {
		return Thread{}, apperr.New(apperr.BadRequest, "invalid thread_id")
	}

	var t Thread
	err := scanThread(r.db.QueryRow(ctx, `
SELECT
  thread_id, order_id, store_id, buyer_id, seller_id, created_at, updated_at
FROM order_chat_threads
WHERE thread_id = $1
`, threadID), &t)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Thread{}, apperr.New(apperr.NotFound, "thread not found")
		}
		return Thread{}, apperr.Wrap(apperr.Internal, err, "get thread failed")
	}
	return t, nil
}

// ============================================================================
// Messages
// ============================================================================

func (r *repo) CreateMessage(ctx context.Context, in CreateMessageInput) (Message, error) {
	if in.ThreadID <= 0 {
		return Message{}, apperr.New(apperr.BadRequest, "invalid thread_id")
	}
	in.SenderID = strings.TrimSpace(in.SenderID)
	if in.SenderID == "" {
		return Message{}, apperr.New(apperr.BadRequest, "invalid sender_id")
	}
	in.MessageType = strings.ToUpper(strings.TrimSpace(in.MessageType))
	if in.MessageType == "" {
		in.MessageType = "TEXT"
	}

	// ไม่ validate cross-table เรื่อง "ต้องมี text หรือไฟล์" ใน repo
	// ให้ service ทำ เพราะ attachments อยู่คนละ table
	var msg Message
	err := scanMessage(r.db.QueryRow(ctx, `
INSERT INTO order_chat_messages (
  thread_id, sender_id, message_text, message_type
) VALUES ($1,$2,$3,$4)
RETURNING
  message_id, thread_id, sender_id, message_text, message_type,
  created_at,
  edited_at, edited_by,
  deleted_at, deleted_by, delete_reason,
  moderation_status, moderated_at, moderated_by, moderation_reason
`,
		in.ThreadID,
		in.SenderID,
		in.MessageText,
		in.MessageType,
	), &msg)

	if err != nil {
		if pgErr, ok := err.(*pgconn.PgError); ok {
			if pgErr.Code == "23503" { // FK
				return Message{}, apperr.WithFields(
					apperr.Wrap(apperr.BadRequest, err, "invalid thread_id or sender_id"),
					map[string]any{"pg_code": pgErr.Code, "constraint": pgErr.ConstraintName},
				)
			}
			return Message{}, apperr.WithFields(
				apperr.Wrap(apperr.Internal, err, "insert message failed"),
				map[string]any{"pg_code": pgErr.Code, "constraint": pgErr.ConstraintName},
			)
		}
		return Message{}, apperr.Wrap(apperr.Internal, err, "insert message failed")
	}

	// touch thread.updated_at (เพื่อ list ห้องเรียงล่าสุด)
	_, _ = r.db.Exec(ctx, `UPDATE order_chat_threads SET updated_at = NOW() WHERE thread_id = $1`, in.ThreadID)

	return msg, nil
}

func (r *repo) GetMessage(ctx context.Context, messageID int64) (Message, error) {
	if messageID <= 0 {
		return Message{}, apperr.New(apperr.BadRequest, "invalid message_id")
	}
	var msg Message
	err := scanMessage(r.db.QueryRow(ctx, `
SELECT
  message_id, thread_id, sender_id, message_text, message_type,
  created_at,
  edited_at, edited_by,
  deleted_at, deleted_by, delete_reason,
  moderation_status, moderated_at, moderated_by, moderation_reason
FROM order_chat_messages
WHERE message_id = $1
`, messageID), &msg)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Message{}, apperr.New(apperr.NotFound, "message not found")
		}
		return Message{}, apperr.Wrap(apperr.Internal, err, "get message failed")
	}
	return msg, nil
}

func (r *repo) ListMessages(ctx context.Context, in ListMessagesParams) ([]Message, error) {
	if in.ThreadID <= 0 {
		return nil, apperr.New(apperr.BadRequest, "invalid thread_id")
	}
	if in.Limit <= 0 || in.Limit > 100 {
		in.Limit = 30
	}

	// pagination: message_id < before_id (ถ้ามี)
	query := `
SELECT
  message_id, thread_id, sender_id, message_text, message_type,
  created_at,
  edited_at, edited_by,
  deleted_at, deleted_by, delete_reason,
  moderation_status, moderated_at, moderated_by, moderation_reason
FROM order_chat_messages
WHERE thread_id = $1
`
	args := []any{in.ThreadID}

	if in.BeforeID != nil && *in.BeforeID > 0 {
		query += ` AND message_id < $2 `
		args = append(args, *in.BeforeID)
	}

	query += ` ORDER BY message_id DESC LIMIT $` + itoa(len(args)+1)
	args = append(args, in.Limit)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list messages failed")
	}
	defer rows.Close()

	out := make([]Message, 0, in.Limit)
	for rows.Next() {
		var m Message
		if err := scanMessage(rows, &m); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan message failed")
		}
		out = append(out, m)
	}
	if err := rows.Err(); err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "rows error")
	}

	return out, nil
}

func (r *repo) UpdateMessageText(ctx context.Context, messageID int64, in UpdateMessageTextInput) (Message, error) {
	if messageID <= 0 {
		return Message{}, apperr.New(apperr.BadRequest, "invalid message_id")
	}
	in.MessageText = strings.TrimSpace(in.MessageText)
	in.EditedBy = strings.TrimSpace(in.EditedBy)
	if in.EditedBy == "" {
		return Message{}, apperr.New(apperr.BadRequest, "invalid edited_by")
	}
	if in.MessageText == "" {
		return Message{}, apperr.New(apperr.BadRequest, "message_text is required")
	}
	if in.EditedAt.IsZero() {
		in.EditedAt = time.Now()
	}

	var msg Message
	err := scanMessage(r.db.QueryRow(ctx, `
UPDATE order_chat_messages
SET
  message_text = $2,
  edited_at = $3,
  edited_by = $4
WHERE message_id = $1
RETURNING
  message_id, thread_id, sender_id, message_text, message_type,
  created_at,
  edited_at, edited_by,
  deleted_at, deleted_by, delete_reason,
  moderation_status, moderated_at, moderated_by, moderation_reason
`, messageID, in.MessageText, in.EditedAt, in.EditedBy), &msg)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Message{}, apperr.New(apperr.NotFound, "message not found")
		}
		return Message{}, apperr.Wrap(apperr.Internal, err, "update message failed")
	}
	return msg, nil
}

func (r *repo) SoftDeleteMessage(ctx context.Context, messageID int64, in SoftDeleteMessageInput) (Message, error) {
	if messageID <= 0 {
		return Message{}, apperr.New(apperr.BadRequest, "invalid message_id")
	}
	in.DeletedBy = strings.TrimSpace(in.DeletedBy)
	if in.DeletedBy == "" {
		return Message{}, apperr.New(apperr.BadRequest, "invalid deleted_by")
	}
	if in.DeletedAt.IsZero() {
		in.DeletedAt = time.Now()
	}

	var msg Message
	err := scanMessage(r.db.QueryRow(ctx, `
UPDATE order_chat_messages
SET
  deleted_at = $2,
  deleted_by = $3,
  delete_reason = $4
WHERE message_id = $1
RETURNING
  message_id, thread_id, sender_id, message_text, message_type,
  created_at,
  edited_at, edited_by,
  deleted_at, deleted_by, delete_reason,
  moderation_status, moderated_at, moderated_by, moderation_reason
`, messageID, in.DeletedAt, in.DeletedBy, in.DeleteReason), &msg)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Message{}, apperr.New(apperr.NotFound, "message not found")
		}
		return Message{}, apperr.Wrap(apperr.Internal, err, "delete message failed")
	}
	return msg, nil
}

func (r *repo) ModerateMessage(ctx context.Context, messageID int64, in ModerateMessageInput) (Message, error) {
	if messageID <= 0 {
		return Message{}, apperr.New(apperr.BadRequest, "invalid message_id")
	}
	in.ModerationStatus = strings.ToUpper(strings.TrimSpace(in.ModerationStatus))
	in.ModeratedBy = strings.TrimSpace(in.ModeratedBy)
	if in.ModeratedBy == "" {
		return Message{}, apperr.New(apperr.BadRequest, "invalid moderated_by")
	}
	if in.ModeratedAt.IsZero() {
		in.ModeratedAt = time.Now()
	}
	if in.ModerationStatus == "" {
		return Message{}, apperr.New(apperr.BadRequest, "moderation_status is required")
	}

	var msg Message
	err := scanMessage(r.db.QueryRow(ctx, `
UPDATE order_chat_messages
SET
  moderation_status = $2,
  moderated_at = $3,
  moderated_by = $4,
  moderation_reason = $5
WHERE message_id = $1
RETURNING
  message_id, thread_id, sender_id, message_text, message_type,
  created_at,
  edited_at, edited_by,
  deleted_at, deleted_by, delete_reason,
  moderation_status, moderated_at, moderated_by, moderation_reason
`, messageID, in.ModerationStatus, in.ModeratedAt, in.ModeratedBy, in.ModerationReason), &msg)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Message{}, apperr.New(apperr.NotFound, "message not found")
		}
		return Message{}, apperr.Wrap(apperr.Internal, err, "moderate message failed")
	}
	return msg, nil
}

// ============================================================================
// Attachments
// ============================================================================

func (r *repo) CreateAttachments(ctx context.Context, items []CreateAttachmentInput) ([]Attachment, error) {
	if len(items) == 0 {
		return nil, nil
	}

	batch := &pgx.Batch{}
	for _, it := range items {
		if it.MessageID <= 0 {
			return nil, apperr.New(apperr.BadRequest, "invalid message_id")
		}
		it.FileURL = strings.TrimSpace(it.FileURL)
		if it.FileURL == "" {
			return nil, apperr.New(apperr.BadRequest, "file_url is required")
		}

		batch.Queue(`
INSERT INTO order_chat_attachments (
  message_id, file_url, file_name, mime_type, file_size_bytes, sha256
) VALUES ($1,$2,$3,$4,$5,$6)
RETURNING
  attachment_id, message_id, file_url, file_name, mime_type, file_size_bytes, sha256,
  created_at, deleted_at, deleted_by, delete_reason
`, it.MessageID, it.FileURL, it.FileName, it.MimeType, it.FileSizeBytes, it.SHA256)
	}

	br := r.db.SendBatch(ctx, batch)
	defer br.Close()

	out := make([]Attachment, 0, len(items))
	for range items {
		var a Attachment
		if err := scanAttachment(br.QueryRow(), &a); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "insert attachment failed")
		}
		out = append(out, a)
	}

	return out, nil
}

func (r *repo) ListAttachmentsByMessageID(ctx context.Context, messageID int64) ([]Attachment, error) {
	if messageID <= 0 {
		return nil, apperr.New(apperr.BadRequest, "invalid message_id")
	}

	rows, err := r.db.Query(ctx, `
SELECT
  attachment_id, message_id, file_url, file_name, mime_type, file_size_bytes, sha256,
  created_at, deleted_at, deleted_by, delete_reason
FROM order_chat_attachments
WHERE message_id = $1
ORDER BY attachment_id ASC
`, messageID)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list attachments failed")
	}
	defer rows.Close()

	var out []Attachment
	for rows.Next() {
		var a Attachment
		if err := scanAttachment(rows, &a); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan attachment failed")
		}
		out = append(out, a)
	}
	if err := rows.Err(); err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "rows error")
	}
	return out, nil
}

// ============================================================================
// Read State
// ============================================================================

func (r *repo) UpsertReadState(ctx context.Context, in MarkReadInput) (ReadState, error) {
	if in.ThreadID <= 0 {
		return ReadState{}, apperr.New(apperr.BadRequest, "invalid thread_id")
	}
	in.UserID = strings.TrimSpace(in.UserID)
	if in.UserID == "" {
		return ReadState{}, apperr.New(apperr.BadRequest, "invalid user_id")
	}
	if in.LastReadAt.IsZero() {
		in.LastReadAt = time.Now()
	}

	var rs ReadState
	err := scanReadState(r.db.QueryRow(ctx, `
INSERT INTO order_chat_read_state (
  thread_id, user_id, last_read_message_id, last_read_at
) VALUES ($1,$2,$3,$4)
ON CONFLICT (thread_id, user_id)
DO UPDATE SET
  last_read_message_id = EXCLUDED.last_read_message_id,
  last_read_at = EXCLUDED.last_read_at
RETURNING
  thread_id, user_id, last_read_message_id, last_read_at
`, in.ThreadID, in.UserID, in.LastReadMessageID, in.LastReadAt), &rs)

	if err != nil {
		if pgErr, ok := err.(*pgconn.PgError); ok {
			if pgErr.Code == "23503" {
				return ReadState{}, apperr.WithFields(
					apperr.Wrap(apperr.BadRequest, err, "invalid thread_id or user_id"),
					map[string]any{"pg_code": pgErr.Code, "constraint": pgErr.ConstraintName},
				)
			}
		}
		return ReadState{}, apperr.Wrap(apperr.Internal, err, "upsert read_state failed")
	}
	return rs, nil
}

func (r *repo) GetReadState(ctx context.Context, threadID int64, userID string) (ReadState, error) {
	if threadID <= 0 {
		return ReadState{}, apperr.New(apperr.BadRequest, "invalid thread_id")
	}
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return ReadState{}, apperr.New(apperr.BadRequest, "invalid user_id")
	}

	var rs ReadState
	err := scanReadState(r.db.QueryRow(ctx, `
SELECT thread_id, user_id, last_read_message_id, last_read_at
FROM order_chat_read_state
WHERE thread_id = $1 AND user_id = $2
`, threadID, userID), &rs)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// ยังไม่เคย mark read
			return ReadState{
				ThreadID: threadID,
				UserID:   userID,
			}, nil
		}
		return ReadState{}, apperr.Wrap(apperr.Internal, err, "get read_state failed")
	}

	return rs, nil
}

// ============================================================================
// Small helper (avoid fmt / strconv in hot path)
// ============================================================================

func itoa(n int) string {
	// n is small (args count) -> simple conversion
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

func (r *repo) GetThreadByOrderID(ctx context.Context, orderID int64) (Thread, error) {
	if orderID <= 0 {
		return Thread{}, apperr.New(apperr.BadRequest, "invalid order_id")
	}

	var t Thread
	err := scanThread(r.db.QueryRow(ctx, `
SELECT
  thread_id, order_id, store_id, buyer_id, seller_id, created_at, updated_at
FROM order_chat_threads
WHERE order_id = $1
`, orderID), &t)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Thread{}, apperr.New(apperr.NotFound, "thread not found")
		}
		return Thread{}, apperr.Wrap(apperr.Internal, err, "get thread by order_id failed")
	}
	return t, nil
}

func (r *repo) CreateThread(ctx context.Context, in CreateThreadInput) (Thread, error) {
	if in.OrderID <= 0 {
		return Thread{}, apperr.New(apperr.BadRequest, "invalid order_id")
	}
	if in.StoreID <= 0 {
		return Thread{}, apperr.New(apperr.BadRequest, "invalid store_id")
	}
	in.BuyerID = strings.TrimSpace(in.BuyerID)
	in.SellerID = strings.TrimSpace(in.SellerID)
	if in.BuyerID == "" || in.SellerID == "" {
		return Thread{}, apperr.New(apperr.BadRequest, "buyer_id and seller_id are required")
	}

	var t Thread
	err := scanThread(r.db.QueryRow(ctx, `
INSERT INTO order_chat_threads (order_id, store_id, buyer_id, seller_id)
VALUES ($1,$2,$3,$4)
ON CONFLICT (order_id) DO UPDATE
SET updated_at = NOW()
RETURNING thread_id, order_id, store_id, buyer_id, seller_id, created_at, updated_at
`, in.OrderID, in.StoreID, in.BuyerID, in.SellerID), &t)

	if err != nil {
		if pgErr, ok := err.(*pgconn.PgError); ok {
			if pgErr.Code == "23503" { // FK
				return Thread{}, apperr.WithFields(
					apperr.Wrap(apperr.BadRequest, err, "invalid order_id/store_id/buyer_id/seller_id"),
					map[string]any{"pg_code": pgErr.Code, "constraint": pgErr.ConstraintName},
				)
			}
		}
		return Thread{}, apperr.Wrap(apperr.Internal, err, "create thread failed")
	}
	return t, nil
}

func (r *repo) GetThreadCreateInfoByOrderID(ctx context.Context, orderID int64) (CreateThreadInput, error) {
	if orderID <= 0 {
		return CreateThreadInput{}, apperr.New(apperr.BadRequest, "invalid order_id")
	}

	var in CreateThreadInput
	err := r.db.QueryRow(ctx, `
SELECT
  o.order_id,
  o.store_id,
  o.user_id AS buyer_id,
  s.user_id AS seller_id
FROM orders o
JOIN stores s ON s.store_id = o.store_id
WHERE o.order_id = $1
`, orderID).Scan(&in.OrderID, &in.StoreID, &in.BuyerID, &in.SellerID)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return CreateThreadInput{}, apperr.New(apperr.NotFound, "order not found")
		}
		return CreateThreadInput{}, apperr.Wrap(apperr.Internal, err, "get thread create info failed")
	}
	return in, nil
}
