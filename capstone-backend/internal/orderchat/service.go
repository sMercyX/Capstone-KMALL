package orderchat

import (
	"context"
	"log"
	"mime/multipart"
	"strings"
	"time"

	"strconv"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
	"github.com/Perpasit/Capstone-KMALL/internal/filestore"
	notification "github.com/Perpasit/Capstone-KMALL/internal/notification"
)

func strPtr(s string) *string {
	v := strings.TrimSpace(s)
	if v == "" {
		return nil
	}
	return &v
}

// ============================================================================
// File Upload Abstraction
// ============================================================================

// type UploadedFile struct {
// 	URL      string
// 	FileName string
// 	MimeType string
// 	Size     int64
// 	SHA256   *string
// }

type FileStore interface {
	Save(ctx context.Context, keyPrefix string, fh *multipart.FileHeader) (filestore.UploadedFile, error)
}

// Notifier broadcasts messages via WebSocket
type Notifier interface {
	BroadcastToRoom(roomID string, message interface{})
	IsUserInRoom(roomID string, userID string) bool
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

type ReadStateBundle struct {
	Me    ReadState `json:"me"`
	Other ReadState `json:"other"`
}

type ListMessagesResult struct {
	ThreadID  int64                    `json:"thread_id"`
	Messages  []MessageWithAttachments `json:"messages"`
	ReadState ReadStateBundle          `json:"read_state"`
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
	ActorUserID      string
	ModerationStatus string
	ModerationReason *string
}

type MarkReadServiceInput struct {
	ThreadID          int64
	UserID            string
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

	GetOrCreateThreadByOrderID(ctx context.Context, actorUserID string, orderID int64) (GetOrCreateThreadResult, error)
}

type service struct {
	repo Repo
	fs   FileStore
	hub  Notifier
	noti notification.Service
}

func NewService(r Repo, fs FileStore, hub Notifier, noti notification.Service) Service {
	return &service{repo: r, fs: fs, hub: hub, noti: noti}
}

// ============================================================================
// Helpers / Validators
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
	allImage := true
	for _, f := range files {
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

// broadcastNewMessage sends a new message event to all WebSocket clients in the chat room
func (s *service) broadcastNewMessage(threadID int64, result CreateMessageResult) {
	if s.hub == nil {
		return
	}
	roomID := "chat_" + strconv.FormatInt(threadID, 10)
	s.hub.BroadcastToRoom(roomID, map[string]interface{}{
		"type": "NEW_MESSAGE",
		"data": result,
	})
}

func (s *service) upsertChatNotification(
	ctx context.Context,
	th Thread,
	senderID string,
	createdMsg Message,
) {
	if s.noti == nil {
		return
	}

	// recipient = อีกฝั่ง (ไม่ใช่คนส่ง)
	recipientID := th.SellerID
	if strings.EqualFold(senderID, th.SellerID) {
		recipientID = th.BuyerID
	}

	// ถ้าผู้รับอยู่ในห้องแชทอยู่แล้ว -> ไม่ต้องสร้าง noti
	if s.hub != nil {
		roomID := "chat_" + strconv.FormatInt(th.ID, 10)
		inRoom := s.hub.IsUserInRoom(roomID, recipientID)
		log.Printf("[NOTI] thread=%d recipient=%s inRoom=%v", th.ID, recipientID, inRoom)
		if inRoom {
			return
		}
	}

	// preview
	var preview *string
	if createdMsg.MessageText != nil {
		p := strings.TrimSpace(*createdMsg.MessageText)
		if p != "" {
			preview = &p
		}
	}

	// หา noti เดิม (ถ้ามี)
	existing, err := s.noti.List(ctx, notification.ListInput{
		UserID:   recipientID,
		ThreadID: &th.ID,
		Types:    []string{"CHAT_NEW_MESSAGE"},
		Limit:    1,
	})
	if err != nil {
		log.Printf("[NOTI] list failed: thread=%d recipient=%s err=%v", th.ID, recipientID, err)
		return
	}

	newData := map[string]any{
		"message_type": createdMsg.MessageType,
	}
	if preview != nil {
		newData["message_preview"] = *preview
	}

	// ถ้ามีอยู่แล้ว -> update + set unread
	if len(existing) > 0 {
		isUnread := false
		_, e := s.noti.UpdateNotification(ctx, notification.UpdateNotificationInput{
			NotificationID: existing[0].ID,
			Title:          strPtr("New message"),
			Body:           strPtr("You have a new message."),
			IsRead:         &isUnread,
			Data:           newData,
		})
		if e != nil {
			log.Printf("[NOTI] update failed: notiID=%d thread=%d recipient=%s err=%v",
				existing[0].ID, th.ID, recipientID, e)
		}
		return
	}

	// ไม่มี -> create ใหม่
	_, e := s.noti.CreateChat(ctx, notification.CreateChatNotificationInput{
		RecipientUserID: recipientID,
		ActorUserID:     senderID,
		OrderID:         th.OrderID,
		ThreadID:        th.ID,
		MessageID:       createdMsg.ID,
		MessageType:     createdMsg.MessageType,
		MessagePreview:  preview,
	})
	if e != nil {
		log.Printf("[NOTI] create failed: thread=%d recipient=%s err=%v", th.ID, recipientID, e)
	}
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

	th, err := s.repo.GetThread(ctx, in.ThreadID)
	if err != nil {
		return ListMessagesResult{}, err
	}
	if !isParticipant(th, actorUserID) {
		return ListMessagesResult{}, apperr.New(apperr.Forbidden, "not allowed")
	}

	if s.noti != nil {
		_, _ = s.noti.MarkReadByThread(ctx, actorUserID, in.ThreadID, []string{"CHAT_NEW_MESSAGE"})
	}

	otherUserID := th.SellerID
	if strings.EqualFold(actorUserID, th.SellerID) {
		otherUserID = th.BuyerID
	}

	meRS, err := s.repo.GetReadState(ctx, in.ThreadID, actorUserID)
	if err != nil {
		return ListMessagesResult{}, err
	}
	otherRS, err := s.repo.GetReadState(ctx, in.ThreadID, otherUserID)
	if err != nil {
		return ListMessagesResult{}, err
	}

	msgs, err := s.repo.ListMessages(ctx, in)
	if err != nil {
		return ListMessagesResult{}, err
	}

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
		ThreadID:  in.ThreadID,
		Messages:  out,
		ReadState: ReadStateBundle{Me: meRS, Other: otherRS},
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

	th, err := s.repo.GetThread(ctx, in.ThreadID)
	if err != nil {
		return CreateMessageResult{}, err
	}
	if !isParticipant(th, in.SenderID) {
		return CreateMessageResult{}, apperr.New(apperr.Forbidden, "not allowed")
	}

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

	s.upsertChatNotification(ctx, th, in.SenderID, createdMsg)

	if len(in.Files) == 0 {
		result := CreateMessageResult{Message: createdMsg}
		s.broadcastNewMessage(in.ThreadID, result)
		return result, nil
	}
	if s.fs == nil {
		return CreateMessageResult{}, apperr.New(apperr.Internal, "file store is not configured")
	}

	attInputs := make([]CreateAttachmentInput, 0, len(in.Files))
	for _, fh := range in.Files {
		prefix := "attachment/" + strconv.FormatInt(in.ThreadID, 10)
		up, err := s.fs.Save(ctx, prefix, fh)
		if err != nil {
			return CreateMessageResult{}, err
		}

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

	result := CreateMessageResult{
		Message:     createdMsg,
		Attachments: atts,
	}

	s.broadcastNewMessage(in.ThreadID, result)

	return result, nil
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

	if msg.SenderID == nil || !strings.EqualFold(*msg.SenderID, in.ActorUserID) {
		return Message{}, apperr.New(apperr.Forbidden, "only sender can delete message")
	}
	if msg.DeletedAt != nil {
		return msg, nil
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

	if s.hub != nil {
		roomID := "chat_" + strconv.FormatInt(in.ThreadID, 10)
		s.hub.BroadcastToRoom(roomID, map[string]interface{}{
			"type": "READ_UPDATE",
			"data": rs,
		})
	}

	return rs, nil
}

func (s *service) GetOrCreateThreadByOrderID(ctx context.Context, actorUserID string, orderID int64) (GetOrCreateThreadResult, error) {
	actorUserID = strings.TrimSpace(actorUserID)
	if actorUserID == "" {
		return GetOrCreateThreadResult{}, apperr.New(apperr.BadRequest, "invalid actor_user_id")
	}
	if orderID <= 0 {
		return GetOrCreateThreadResult{}, apperr.New(apperr.BadRequest, "invalid order_id")
	}

	th, err := s.repo.GetThreadByOrderID(ctx, orderID)
	if err == nil {
		if !isParticipant(th, actorUserID) {
			return GetOrCreateThreadResult{}, apperr.New(apperr.Forbidden, "not allowed")
		}
		return GetOrCreateThreadResult{Thread: th}, nil
	}
	if !apperr.Is(err, apperr.NotFound) {
		return GetOrCreateThreadResult{}, err
	}

	createIn, err := s.repo.GetThreadCreateInfoByOrderID(ctx, orderID)
	if err != nil {
		return GetOrCreateThreadResult{}, err
	}

	if !strings.EqualFold(createIn.BuyerID, actorUserID) &&
		!strings.EqualFold(createIn.SellerID, actorUserID) {
		return GetOrCreateThreadResult{}, apperr.New(apperr.Forbidden, "not allowed")
	}

	th, err = s.repo.CreateThread(ctx, createIn)
	if err != nil {
		return GetOrCreateThreadResult{}, err
	}

	return GetOrCreateThreadResult{Thread: th}, nil
}
