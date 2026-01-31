package orderchat

import (
	"context"
	"mime/multipart"
	"strings"
	"time"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
)

// ============================================================================
// File Upload Abstraction
// ============================================================================

// UploadedFile is result returned by FileStore.
type UploadedFile struct {
	URL      string
	FileName string
	MimeType string
	Size     int64
	SHA256   *string
}

// FileStore uploads files and returns accessible URLs.
// Implement this with local /uploads, S3, etc.
type FileStore interface {
	Save(ctx context.Context, fh *multipart.FileHeader) (UploadedFile, error)
}

// ============================================================================
// DTOs
// ============================================================================

type MessageWithAttachments struct {
	Message     Message      `json:"message"`
	Attachments []Attachment `json:"attachments"`
}

type CreateMessageResult struct {
	Message     Message      `json:"message"`
	Attachments []Attachment `json:"attachments,omitempty"`
}

type ListMessagesResult struct {
	ThreadID int64                    `json:"thread_id"`
	Messages []MessageWithAttachments `json:"messages"`
}

type CreateMessageServiceInput struct {
	ThreadID    int64
	SenderID    string
	MessageText *string
	Files       []*multipart.FileHeader
}

type EditMessageServiceInput struct {
	MessageID   int64
	ActorUserID string
	NewText     string
}

type DeleteMessageServiceInput struct {
	MessageID    int64
	ActorUserID  string
	DeleteReason *string
}

type ModerateMessageServiceInput struct {
	MessageID        int64
	ActorUserID      string // admin
	ModerationStatus string // VISIBLE/HIDDEN/REMOVED
	ModerationReason *string
}

type MarkReadServiceInput struct {
	ThreadID int64
	UserID   string
	// optional; if nil -> mark by latest visible message in thread would require extra query (ทำใน v2 ได้)
	LastReadMessageID *int64
}

// ============================================================================
// Service Interface
// ============================================================================

type Service interface {
	ListMessages(ctx context.Context, actorUserID string, in ListMessagesParams) (ListMessagesResult, error)
	CreateMessage(ctx context.Context, in CreateMessageServiceInput) (CreateMessageResult, error)

	EditMessageText(ctx context.Context, in EditMessageServiceInput) (Message, error)
	SoftDeleteMessage(ctx context.Context, in DeleteMessageServiceInput) (Message, error)
	ModerateMessage(ctx context.Context, in ModerateMessageServiceInput) (Message, error)

	MarkRead(ctx context.Context, in MarkReadServiceInput) (ReadState, error)
}

type service struct {
	repo Repo
	fs   FileStore
}

func NewService(r Repo, fs FileStore) Service {
	return &service{repo: r, fs: fs}
}

// ============================================================================
// Helpers / Auth
// ============================================================================

func isParticipant(t Thread, userID string) bool {
	return strings.EqualFold(t.BuyerID, userID) || strings.EqualFold(t.SellerID, userID)
}

func normalizeTextPtr(s *string) *string {
	if s == nil {
		return nil
	}
	v := strings.TrimSpace(*s)
	if v == "" {
		return nil
	}
	return &v
}

func detectMessageType(files []*multipart.FileHeader) string {
	if len(files) == 0 {
		return "TEXT"
	}
	// ถ้ามีไฟล์อย่างน้อย 1 ชิ้น: ถ้าทุกไฟล์เป็น image/* ให้ IMAGE ไม่งั้น FILE
	allImage := true
	for _, f := range files {
		// Content-Type ใน multipart ไม่ชัวร์ 100% แต่พอใช้ heuristic ได้
		// ถ้าคุณเช็ค mime จาก bytes จริง ให้ทำใน FileStore.Save
		ct := strings.ToLower(strings.TrimSpace(f.Header.Get("Content-Type")))
		if !strings.HasPrefix(ct, "image/") {
			allImage = false
			break
		}
	}
	if allImage {
		return "IMAGE"
	}
	return "FILE"
}

// ============================================================================
// Service Methods
// ============================================================================

func (s *service) ListMessages(ctx context.Context, actorUserID string, in ListMessagesParams) (ListMessagesResult, error) {
	actorUserID = strings.TrimSpace(actorUserID)
	if actorUserID == "" {
		return ListMessagesResult{}, apperr.New(apperr.BadRequest, "invalid actor_user_id")
	}
	if in.ThreadID <= 0 {
		return ListMessagesResult{}, apperr.New(apperr.BadRequest, "invalid thread_id")
	}

	// auth: ต้องเป็น participant (admin จะเช็คใน handler ด้วย role) — ที่นี่เช็ค participant อย่างเดียวก่อน
	th, err := s.repo.GetThread(ctx, in.ThreadID)
	if err != nil {
		return ListMessagesResult{}, err
	}
	if !isParticipant(th, actorUserID) {
		return ListMessagesResult{}, apperr.New(apperr.Forbidden, "not allowed")
	}

	msgs, err := s.repo.ListMessages(ctx, in)
	if err != nil {
		return ListMessagesResult{}, err
	}

	// load attachments per message (N queries) — จำนวน message ต่อหน้าไม่เยอะ (default 30)
	out := make([]MessageWithAttachments, 0, len(msgs))
	for _, m := range msgs {
		atts, err := s.repo.ListAttachmentsByMessageID(ctx, m.ID)
		if err != nil {
			return ListMessagesResult{}, err
		}
		out = append(out, MessageWithAttachments{
			Message:     m,
			Attachments: atts,
		})
	}

	return ListMessagesResult{
		ThreadID: in.ThreadID,
		Messages: out,
	}, nil
}

func (s *service) CreateMessage(ctx context.Context, in CreateMessageServiceInput) (CreateMessageResult, error) {
	in.SenderID = strings.TrimSpace(in.SenderID)
	if in.ThreadID <= 0 {
		return CreateMessageResult{}, apperr.New(apperr.BadRequest, "invalid thread_id")
	}
	if in.SenderID == "" {
		return CreateMessageResult{}, apperr.New(apperr.BadRequest, "invalid sender_id")
	}
	in.MessageText = normalizeTextPtr(in.MessageText)

	// auth
	th, err := s.repo.GetThread(ctx, in.ThreadID)
	if err != nil {
		return CreateMessageResult{}, err
	}
	if !isParticipant(th, in.SenderID) {
		return CreateMessageResult{}, apperr.New(apperr.Forbidden, "not allowed")
	}

	// validate: ต้องมีอย่างน้อย text หรือไฟล์
	if in.MessageText == nil && len(in.Files) == 0 {
		return CreateMessageResult{}, apperr.New(apperr.BadRequest, "message_text or files is required")
	}

	msgType := detectMessageType(in.Files)

	createdMsg, err := s.repo.CreateMessage(ctx, CreateMessageInput{
		ThreadID:    in.ThreadID,
		SenderID:    in.SenderID,
		MessageText: in.MessageText,
		MessageType: msgType,
	})
	if err != nil {
		return CreateMessageResult{}, err
	}

	// ถ้าไม่มีไฟล์ก็จบ
	if len(in.Files) == 0 {
		return CreateMessageResult{Message: createdMsg}, nil
	}

	if s.fs == nil {
		// กัน config พลาด
		return CreateMessageResult{}, apperr.New(apperr.Internal, "file store is not configured")
	}

	// upload → insert attachments
	attInputs := make([]CreateAttachmentInput, 0, len(in.Files))
	for _, fh := range in.Files {
		up, err := s.fs.Save(ctx, fh)
		if err != nil {
			// v1: ถ้า upload fail ให้คืน error (และข้อความจะถูกสร้างไปแล้ว)
			// v2: ทำ tx + cleanup ได้ (soft delete message หรือ delete uploaded files)
			return CreateMessageResult{}, err
		}
		// สร้าง attachment row
		fileURL := strings.TrimSpace(up.URL)
		if fileURL == "" {
			return CreateMessageResult{}, apperr.New(apperr.Internal, "uploaded file url is empty")
		}

		fn := up.FileName
		ct := up.MimeType
		sz := up.Size

		attInputs = append(attInputs, CreateAttachmentInput{
			MessageID:     createdMsg.ID,
			FileURL:       fileURL,
			FileName:      &fn,
			MimeType:      &ct,
			FileSizeBytes: &sz,
			SHA256:        up.SHA256,
		})
	}

	atts, err := s.repo.CreateAttachments(ctx, attInputs)
	if err != nil {
		return CreateMessageResult{}, err
	}

	return CreateMessageResult{
		Message:     createdMsg,
		Attachments: atts,
	}, nil
}

func (s *service) EditMessageText(ctx context.Context, in EditMessageServiceInput) (Message, error) {
	if in.MessageID <= 0 {
		return Message{}, apperr.New(apperr.BadRequest, "invalid message_id")
	}
	in.ActorUserID = strings.TrimSpace(in.ActorUserID)
	in.NewText = strings.TrimSpace(in.NewText)

	if in.ActorUserID == "" {
		return Message{}, apperr.New(apperr.BadRequest, "invalid actor_user_id")
	}
	if in.NewText == "" {
		return Message{}, apperr.New(apperr.BadRequest, "message_text is required")
	}

	// auth: ต้องเป็น sender (admin ให้ทำ moderation ไม่ใช่ edit)
	msg, err := s.repo.GetMessage(ctx, in.MessageID)
	if err != nil {
		return Message{}, err
	}
	if msg.SenderID == nil || !strings.EqualFold(*msg.SenderID, in.ActorUserID) {
		return Message{}, apperr.New(apperr.Forbidden, "only sender can edit message")
	}
	if msg.DeletedAt != nil {
		return Message{}, apperr.New(apperr.BadRequest, "cannot edit deleted message")
	}
	if strings.EqualFold(msg.ModerationStatus, "REMOVED") {
		return Message{}, apperr.New(apperr.BadRequest, "cannot edit removed message")
	}

	now := time.Now()
	updated, err := s.repo.UpdateMessageText(ctx, in.MessageID, UpdateMessageTextInput{
		MessageText: in.NewText,
		EditedBy:    in.ActorUserID,
		EditedAt:    now,
	})
	if err != nil {
		return Message{}, err
	}
	return updated, nil
}

func (s *service) SoftDeleteMessage(ctx context.Context, in DeleteMessageServiceInput) (Message, error) {
	if in.MessageID <= 0 {
		return Message{}, apperr.New(apperr.BadRequest, "invalid message_id")
	}
	in.ActorUserID = strings.TrimSpace(in.ActorUserID)
	if in.ActorUserID == "" {
		return Message{}, apperr.New(apperr.BadRequest, "invalid actor_user_id")
	}

	msg, err := s.repo.GetMessage(ctx, in.MessageID)
	if err != nil {
		return Message{}, err
	}

	// auth: sender เท่านั้น (admin จะใช้ moderation)
	if msg.SenderID == nil || !strings.EqualFold(*msg.SenderID, in.ActorUserID) {
		return Message{}, apperr.New(apperr.Forbidden, "only sender can delete message")
	}
	if msg.DeletedAt != nil {
		return msg, nil // idempotent
	}

	now := time.Now()
	deleted, err := s.repo.SoftDeleteMessage(ctx, in.MessageID, SoftDeleteMessageInput{
		DeletedBy:    in.ActorUserID,
		DeletedAt:    now,
		DeleteReason: in.DeleteReason,
	})
	if err != nil {
		return Message{}, err
	}
	return deleted, nil
}

func (s *service) ModerateMessage(ctx context.Context, in ModerateMessageServiceInput) (Message, error) {
	if in.MessageID <= 0 {
		return Message{}, apperr.New(apperr.BadRequest, "invalid message_id")
	}
	in.ActorUserID = strings.TrimSpace(in.ActorUserID)
	if in.ActorUserID == "" {
		return Message{}, apperr.New(apperr.BadRequest, "invalid actor_user_id")
	}

	st := strings.ToUpper(strings.TrimSpace(in.ModerationStatus))
	if st == "" {
		return Message{}, apperr.New(apperr.BadRequest, "moderation_status is required")
	}
	switch st {
	case "VISIBLE", "HIDDEN", "REMOVED":
	default:
		return Message{}, apperr.New(apperr.BadRequest, "invalid moderation_status")
	}

	now := time.Now()
	updated, err := s.repo.ModerateMessage(ctx, in.MessageID, ModerateMessageInput{
		ModerationStatus: st,
		ModeratedBy:      in.ActorUserID,
		ModeratedAt:      now,
		ModerationReason: in.ModerationReason,
	})
	if err != nil {
		return Message{}, err
	}
	return updated, nil
}

func (s *service) MarkRead(ctx context.Context, in MarkReadServiceInput) (ReadState, error) {
	if in.ThreadID <= 0 {
		return ReadState{}, apperr.New(apperr.BadRequest, "invalid thread_id")
	}
	in.UserID = strings.TrimSpace(in.UserID)
	if in.UserID == "" {
		return ReadState{}, apperr.New(apperr.BadRequest, "invalid user_id")
	}

	th, err := s.repo.GetThread(ctx, in.ThreadID)
	if err != nil {
		return ReadState{}, err
	}
	if !isParticipant(th, in.UserID) {
		return ReadState{}, apperr.New(apperr.Forbidden, "not allowed")
	}

	now := time.Now()
	rs, err := s.repo.UpsertReadState(ctx, MarkReadInput{
		ThreadID:          in.ThreadID,
		UserID:            in.UserID,
		LastReadMessageID: in.LastReadMessageID,
		LastReadAt:        now,
	})
	if err != nil {
		return ReadState{}, err
	}
	return rs, nil
}
