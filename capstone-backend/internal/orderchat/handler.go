package orderchat

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
	"github.com/Perpasit/Capstone-KMALL/internal/middleware"
	"github.com/Perpasit/Capstone-KMALL/internal/respond"
	"github.com/Perpasit/Capstone-KMALL/internal/user"
)

// ============================================================================
// Handler
// ============================================================================

type Handler struct {
	svc     Service
	repo    Repo // ใช้ตรวจ thread (auth) แบบเร็ว ๆ
	roleSvc middleware.RoleNameLister
	userSvc user.Service
}

func NewHandler(s Service, r Repo, rl middleware.RoleNameLister, us user.Service) *Handler {
	return &Handler{
		svc:     s,
		repo:    r,
		roleSvc: rl,
		userSvc: us,
	}
}

func (h *Handler) Register(r *gin.RouterGroup) {
	// /api/order-chats
	g := r.Group("/order-chats")
	{
		// list messages
		g.GET("/:thread_id/messages", h.listMessages)

		// send message + files (multipart)
		g.POST("/:thread_id/messages", h.createMessage)

		// mark read
		g.POST("/:thread_id/read", h.markRead)

		// edit / delete
		g.PUT("/messages/:message_id", h.editMessage)
		g.DELETE("/messages/:message_id", h.deleteMessage)

		// moderation (Admin)
		admin := g.Group("", middleware.RequireRolesAny(h.roleSvc, "Admin"))
		{
			admin.POST("/messages/:message_id/moderate", h.moderateMessage)
		}
	}
}

// ============================================================================
// Helpers
// ============================================================================

func parsePathID(c *gin.Context, name string) (int64, bool) {
	raw := strings.TrimSpace(c.Param(name))
	if raw == "" {
		c.Error(apperr.New(apperr.BadRequest, "missing "+name))
		return 0, false
	}
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		c.Error(apperr.New(apperr.BadRequest, "invalid "+name))
		return 0, false
	}
	return id, true
}

func (h *Handler) resolveCurrentUserID(c *gin.Context) (string, bool) {
	up, ok := c.Get(middleware.CtxUpstreamUser)
	if !ok || up == nil {
		respond.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "missing upstream user", nil)
		return "", false
	}
	uu := up.(*middleware.UpstreamUser)

	u, err := h.userSvc.FindByUpstreamID(c.Request.Context(), uu.UID)
	if err != nil {
		c.Error(err)
		return "", false
	}
	return u.ID, true
}

func (h *Handler) isAdmin(c *gin.Context, userID string) bool {
	roles, err := h.roleSvc.ListNamesByUserID(c.Request.Context(), userID)
	if err != nil {
		return false
	}
	for _, r := range roles {
		if strings.EqualFold(r, "admin") {
			return true
		}
	}
	return false
}

// allow buyer/seller in thread OR admin
func (h *Handler) canAccessThread(c *gin.Context, threadID int64, userID string) bool {
	if h.isAdmin(c, userID) {
		return true
	}
	th, err := h.repo.GetThread(c.Request.Context(), threadID)
	if err != nil {
		c.Error(err)
		return false
	}
	if strings.EqualFold(th.BuyerID, userID) || strings.EqualFold(th.SellerID, userID) {
		return true
	}
	return false
}

// ============================================================================
// Request DTOs
// ============================================================================

type editMessageReq struct {
	MessageText string `json:"message_text"`
}

type deleteMessageReq struct {
	Reason *string `json:"reason,omitempty"`
}

type moderateMessageReq struct {
	Status string  `json:"status"` // VISIBLE/HIDDEN/REMOVED
	Reason *string `json:"reason,omitempty"`
}

type markReadReq struct {
	LastReadMessageID *int64 `json:"last_read_message_id,omitempty"`
}

// ============================================================================
// Handlers
// ============================================================================

func (h *Handler) listMessages(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c)
	if !ok {
		return
	}

	threadID, ok := parsePathID(c, "thread_id")
	if !ok {
		return
	}

	// auth
	if !h.canAccessThread(c, threadID, userID) {
		if len(c.Errors) == 0 {
			respond.Error(c, http.StatusForbidden, "FORBIDDEN", "not allowed", nil)
		}
		return
	}

	// query params
	var beforeID *int64
	if raw := strings.TrimSpace(c.Query("before_id")); raw != "" {
		v, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || v <= 0 {
			c.Error(apperr.New(apperr.BadRequest, "invalid before_id"))
			return
		}
		beforeID = &v
	}

	limit := 30
	if raw := strings.TrimSpace(c.Query("limit")); raw != "" {
		v, err := strconv.Atoi(raw)
		if err != nil || v <= 0 {
			c.Error(apperr.New(apperr.BadRequest, "invalid limit"))
			return
		}
		if v > 100 {
			v = 100
		}
		limit = v
	}

	result, err := h.svc.ListMessages(c.Request.Context(), userID, ListMessagesParams{
		ThreadID: threadID,
		BeforeID: beforeID,
		Limit:    limit,
	})
	if err != nil {
		c.Error(err)
		return
	}

	respond.OK(c, apperr.OK, result)
}

// POST /api/order-chats/:thread_id/messages (multipart/form-data)
// fields:
// - message_text (optional)
// - files[] (0..N) (key = "files")
func (h *Handler) createMessage(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c)
	if !ok {
		return
	}

	threadID, ok := parsePathID(c, "thread_id")
	if !ok {
		return
	}

	// auth
	if !h.canAccessThread(c, threadID, userID) {
		if len(c.Errors) == 0 {
			respond.Error(c, http.StatusForbidden, "FORBIDDEN", "not allowed", nil)
		}
		return
	}

	// multipart
	// message_text เป็น form field
	msgText := strings.TrimSpace(c.PostForm("message_text"))
	var textPtr *string
	if msgText != "" {
		textPtr = &msgText
	}

	form, err := c.MultipartForm()
	if err != nil {
		// ถ้าไม่มี multipart จริง ๆ
		c.Error(apperr.New(apperr.BadRequest, "multipart/form-data is required"))
		return
	}

	files := form.File["files"]
	// NOTE: ถ้าจะรองรับ "file" ชื่อเดียวด้วย:
	// if len(files) == 0 { files = form.File["file"] }

	result, err := h.svc.CreateMessage(c.Request.Context(), CreateMessageServiceInput{
		ThreadID:    threadID,
		SenderID:    userID,
		MessageText: textPtr,
		Files:       files,
	})
	if err != nil {
		c.Error(err)
		return
	}

	respond.Created(c, apperr.Created, result)
}

func (h *Handler) editMessage(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c)
	if !ok {
		return
	}

	messageID, ok := parsePathID(c, "message_id")
	if !ok {
		return
	}

	var in editMessageReq
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	updated, err := h.svc.EditMessageText(c.Request.Context(), EditMessageServiceInput{
		MessageID:   messageID,
		ActorUserID: userID,
		NewText:     in.MessageText,
	})
	if err != nil {
		c.Error(err)
		return
	}

	respond.Updated(c, apperr.Updated, updated)
}

func (h *Handler) deleteMessage(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c)
	if !ok {
		return
	}

	messageID, ok := parsePathID(c, "message_id")
	if !ok {
		return
	}

	// optional body (บาง client ส่ง DELETE body ไม่สะดวก) -> จะอ่านได้ก็อ่าน ไม่ได้ก็ปล่อย nil
	var in deleteMessageReq
	_ = c.ShouldBindJSON(&in)

	deleted, err := h.svc.SoftDeleteMessage(c.Request.Context(), DeleteMessageServiceInput{
		MessageID:    messageID,
		ActorUserID:  userID,
		DeleteReason: in.Reason,
	})
	if err != nil {
		c.Error(err)
		return
	}

	respond.OK(c, apperr.OK, deleted)
}

func (h *Handler) moderateMessage(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c)
	if !ok {
		return
	}

	messageID, ok := parsePathID(c, "message_id")
	if !ok {
		return
	}

	var in moderateMessageReq
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	updated, err := h.svc.ModerateMessage(c.Request.Context(), ModerateMessageServiceInput{
		MessageID:        messageID,
		ActorUserID:      userID,
		ModerationStatus: in.Status,
		ModerationReason: in.Reason,
	})
	if err != nil {
		c.Error(err)
		return
	}

	respond.Updated(c, apperr.Updated, updated)
}

func (h *Handler) markRead(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c)
	if !ok {
		return
	}

	threadID, ok := parsePathID(c, "thread_id")
	if !ok {
		return
	}

	// auth
	if !h.canAccessThread(c, threadID, userID) {
		if len(c.Errors) == 0 {
			respond.Error(c, http.StatusForbidden, "FORBIDDEN", "not allowed", nil)
		}
		return
	}

	var in markReadReq
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	rs, err := h.svc.MarkRead(c.Request.Context(), MarkReadServiceInput{
		ThreadID:          threadID,
		UserID:            userID,
		LastReadMessageID: in.LastReadMessageID,
	})
	if err != nil {
		c.Error(err)
		return
	}

	respond.OK(c, apperr.OK, rs)
}
