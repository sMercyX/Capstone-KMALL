package report

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
	"github.com/Perpasit/Capstone-KMALL/internal/middleware"
	"github.com/Perpasit/Capstone-KMALL/internal/order"
	"github.com/Perpasit/Capstone-KMALL/internal/orderchat"
	"github.com/Perpasit/Capstone-KMALL/internal/respond"
	"github.com/Perpasit/Capstone-KMALL/internal/user"
)

// ============================================================================
// Handler
// ============================================================================

type Handler struct {
	svc       Service
	roleSvc   middleware.RoleNameLister
	userSvc   user.Service
	orderRepo order.Repo     // for order snapshot
	chatRepo  orderchat.Repo // for chat snapshot
}

func NewHandler(s Service, rl middleware.RoleNameLister, us user.Service, or order.Repo, cr orderchat.Repo) *Handler {
	return &Handler{svc: s, roleSvc: rl, userSvc: us, orderRepo: or, chatRepo: cr}
}

func (h *Handler) Register(r *gin.RouterGroup) {
	g := r.Group("/reports")
	{
		// Buyer / Seller — submit report on an order
		g.GET("/:report_id", h.getMyReport)
		g.POST("/orders/:order_id", h.submitReport)

		// Admin only
		admin := g.Group("", middleware.RequireRolesAny(h.roleSvc, "admin"))
		{
			admin.GET("", h.listReports)
			admin.GET("/:report_id", h.getReportDetail)
			admin.POST("/:report_id/action", h.adminTakeAction)
		}
	}

	// Ban management — admin only
	ban := r.Group("/admin/users", middleware.RequireRolesAny(h.roleSvc, "admin"))
	{
		ban.POST("/:user_id/ban", h.banUser)
		ban.PATCH("/:user_id/ban/:blacklist_id/revoke", h.revokeUserBan)
		ban.GET("/:user_id/ban-history", h.listBanHistory)
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

// ============================================================================
// Request DTOs
// ============================================================================

type submitReportReq struct {
	ReportedUserID    string  `json:"reported_user_id"`
	ReportedPartyType string  `json:"reported_party_type"` // BUYER / SELLER
	ReasonCode        string  `json:"reason_code"`
	Description       *string `json:"description,omitempty"`
}

type adminActionReq struct {
	ActionType    string  `json:"action_type"`
	Note          *string `json:"note,omitempty"`
	TargetUserID  *string `json:"target_user_id,omitempty"`
	TargetStoreID *int    `json:"target_store_id,omitempty"`
	SuspendDays   *int    `json:"suspend_days,omitempty"`
	IsPermanent   bool    `json:"is_permanent"`
	UserRole      string  `json:"user_role,omitempty"` // BUYER / SELLER — required when banning user
}

type banUserReq struct {
	UserRole    string `json:"user_role"` // BUYER / SELLER
	ReportID    *int64 `json:"report_id,omitempty"`
	Reason      string `json:"reason"`
	BanType     string `json:"ban_type"` // WARNING / TEMPORARY / PERMANENT
	SuspendDays *int   `json:"suspend_days,omitempty"`
}

type listReportsQuery struct {
	Status            *string
	ReportedPartyType *string
	ReasonCode        *string
	FromDate          *time.Time
	ToDate            *time.Time
	Limit             int
	Offset            int
}

// ============================================================================
// PBI 22 — Report Handlers
// ============================================================================

// POST /api/reports/orders/:order_id  (multipart/form-data)
// fields:
//   - reported_user_id
//   - reported_party_type
//   - reason_code
//   - description (optional)
//   - files[] (optional, 0..N)
func (h *Handler) submitReport(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c)
	if !ok {
		return
	}

	orderID, ok := parsePathID(c, "order_id")
	if !ok {
		return
	}

	// Parse multipart form
	form, err := c.MultipartForm()
	if err != nil {
		c.Error(apperr.New(apperr.BadRequest, "multipart/form-data is required"))
		return
	}

	reportedUserID := strings.TrimSpace(c.PostForm("reported_user_id"))
	reportedPartyType := strings.TrimSpace(c.PostForm("reported_party_type"))
	reasonCode := strings.TrimSpace(c.PostForm("reason_code"))
	description := strPtr(c.PostForm("description"))

	files := form.File["files"]

	// Caller (handler) is responsible for fetching order & chat snapshot
	// and passing them to service — service doesn't query orders directly
	orderSnapshot, chatSnapshots, err := h.buildSnapshots(c, int(orderID))
	if err != nil {
		c.Error(err)
		return
	}

	rep, err := h.svc.SubmitReport(c.Request.Context(), SubmitReportInput{
		OrderID:           int(orderID),
		ReporterID:        userID,
		ReportedUserID:    reportedUserID,
		ReportedPartyType: reportedPartyType,
		ReasonCode:        reasonCode,
		Description:       description,
		Files:             files,
	}, chatSnapshots, orderSnapshot)
	if err != nil {
		c.Error(err)
		return
	}

	respond.Created(c, apperr.Created, rep)
}

// GET /api/reports  (admin only)
// query: status, reported_party_type, reason_code, from_date, to_date, limit, offset
func (h *Handler) listReports(c *gin.Context) {
	q := parseListReportsQuery(c)

	orderID := c.DefaultQuery("order_id", "")
	if orderID != "" {
		orderID = orderID + "%"
	}

	reports, err := h.svc.ListReports(c.Request.Context(), ListReportsParams{
		Status:            q.Status,
		ReportedPartyType: q.ReportedPartyType,
		ReasonCode:        q.ReasonCode,
		FromDate:          q.FromDate,
		ToDate:            q.ToDate,
		Limit:             q.Limit,
		Offset:            q.Offset,
		OrderID:           orderID,
	})
	if err != nil {
		c.Error(err)
		return
	}

	respond.OK(c, apperr.OK, reports)
}

// GET /api/reports/:report_id  (admin only)
func (h *Handler) getReportDetail(c *gin.Context) {
	reportID, ok := parsePathID(c, "report_id")
	if !ok {
		return
	}

	detail, err := h.svc.GetReportDetail(c.Request.Context(), reportID)
	if err != nil {
		c.Error(err)
		return
	}

	respond.OK(c, apperr.OK, detail)
}

// POST /api/reports/:report_id/action  (admin only)
func (h *Handler) adminTakeAction(c *gin.Context) {
	adminID, ok := h.resolveCurrentUserID(c)
	if !ok {
		return
	}

	reportID, ok := parsePathID(c, "report_id")
	if !ok {
		return
	}

	var in adminActionReq
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	action, err := h.svc.AdminTakeAction(c.Request.Context(), AdminTakeActionInput{
		ReportID:      reportID,
		AdminID:       adminID,
		ActionType:    in.ActionType,
		Note:          in.Note,
		TargetUserID:  in.TargetUserID,
		TargetStoreID: in.TargetStoreID,
		SuspendDays:   in.SuspendDays,
		IsPermanent:   in.IsPermanent,
		UserRole:      in.UserRole,
	})
	if err != nil {
		c.Error(err)
		return
	}

	respond.OK(c, apperr.OK, action)
}

// ============================================================================
// PBI 23 — Blacklist Handlers
// ============================================================================

// POST /api/admin/users/:user_id/ban  (admin only)
func (h *Handler) banUser(c *gin.Context) {
	adminID, ok := h.resolveCurrentUserID(c)
	if !ok {
		return
	}

	targetUserID := strings.TrimSpace(c.Param("user_id"))
	if targetUserID == "" {
		c.Error(apperr.New(apperr.BadRequest, "missing user_id"))
		return
	}

	var in banUserReq
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	ban, err := h.svc.BanUser(c.Request.Context(), BanUserInput{
		AdminID:     adminID,
		UserID:      targetUserID,
		UserRole:    in.UserRole,
		ReportID:    in.ReportID,
		Reason:      in.Reason,
		BanType:     in.BanType,
		SuspendDays: in.SuspendDays,
		CreatedBy:   adminID,
	})
	if err != nil {
		c.Error(err)
		return
	}

	respond.Created(c, apperr.Created, ban)
}

// PATCH /api/admin/users/:user_id/ban/:blacklist_id/revoke  (admin only)
func (h *Handler) revokeUserBan(c *gin.Context) {
	blacklistID, ok := parsePathID(c, "blacklist_id")
	if !ok {
		return
	}

	ban, err := h.svc.RevokeUserBan(c.Request.Context(), blacklistID)
	if err != nil {
		c.Error(err)
		return
	}

	respond.OK(c, apperr.OK, ban)
}

// GET /api/admin/users/:user_id/ban-history  (admin only)
// query: limit, offset
func (h *Handler) listBanHistory(c *gin.Context) {
	targetUserID := strings.TrimSpace(c.Param("user_id"))
	if targetUserID == "" {
		c.Error(apperr.New(apperr.BadRequest, "missing user_id"))
		return
	}

	limit := 20
	offset := 0
	if raw := strings.TrimSpace(c.Query("limit")); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && v > 0 {
			limit = v
		}
	}
	if raw := strings.TrimSpace(c.Query("offset")); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && v >= 0 {
			offset = v
		}
	}

	history, err := h.svc.ListBanHistory(c.Request.Context(), ListBanHistoryParams{
		UserID: targetUserID,
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		c.Error(err)
		return
	}

	respond.OK(c, apperr.OK, history)
}

// ============================================================================
// Snapshot Builder
// Handler fetches order & chat data then passes to service
// ============================================================================

// buildSnapshots fetches order info and all chat messages at report submission time.
// Keeping this in handler so service layer stays DB-agnostic.
func (h *Handler) buildSnapshots(c *gin.Context, orderID int) (ReportOrderSnapshot, []ReportChatSnapshot, error) {
	ctx := c.Request.Context()

	// ── Order snapshot ──────────────────────────────────────────────
	o, err := h.orderRepo.GetOrder(ctx, int64(orderID))
	if err != nil {
		return ReportOrderSnapshot{}, nil, err
	}

	// ── Order items ──────────────────────────────────────────────────
	items, err := h.orderRepo.ListItemsByOrderID(ctx, int64(orderID))
	if err != nil {
		return ReportOrderSnapshot{}, nil, err
	}
	itemsJSON, err := json.Marshal(items)
	if err != nil {
		return ReportOrderSnapshot{}, nil, apperr.Wrap(apperr.Internal, err, "marshal items failed")
	}

	orderSnapshot := ReportOrderSnapshot{
		OrderStatus:      o.Status,
		TotalPrice:       float64(o.TotalPrice),
		OrderDate:        o.OrderDate,
		DeliveryMethod:   o.DeliveryMethod,
		CampusLocationID: o.CampusLocationID,
		CampusDetailNote: o.CampusDetailNote,
		ProposedAt:       o.ProposedAt,
		MeetingNote:      o.MeetingNote,
		CancelledAt:      o.CancelledAt,
		CancelledBy:      o.CancelledBy,
		CancelledReason:  o.CancelledReason,
		Items:            json.RawMessage(itemsJSON),
	}

	// ── Chat snapshot ────────────────────────────────────────────────
	thread, err := h.chatRepo.GetThreadByOrderID(ctx, int64(orderID))
	if err != nil {
		// ถ้ายังไม่มี thread (ไม่เคยคุย) ก็ snapshot ว่าง
		return orderSnapshot, nil, nil
	}

	msgs, err := h.chatRepo.ListMessages(ctx, orderchat.ListMessagesParams{
		ThreadID: thread.ID,
		Limit:    500, // ดึงทั้งหมด ใช้ limit สูงพอ
	})
	if err != nil {
		return orderSnapshot, nil, err
	}

	chatSnapshots := make([]ReportChatSnapshot, 0, len(msgs))
	for _, m := range msgs {
		// determine sender_role
		senderRole := "SYSTEM"
		if m.SenderID != nil {
			if strings.EqualFold(*m.SenderID, thread.BuyerID) {
				senderRole = "BUYER"
			} else if strings.EqualFold(*m.SenderID, thread.SellerID) {
				senderRole = "SELLER"
			}
		}

		// fetch attachments for this message
		atts, _ := h.chatRepo.ListAttachmentsByMessageID(ctx, m.ID)
		var attURLs any
		if len(atts) > 0 {
			urls := make([]string, 0, len(atts))
			for _, a := range atts {
				urls = append(urls, a.FileURL)
			}
			attURLs = urls
		}

		chatSnapshots = append(chatSnapshots, ReportChatSnapshot{
			SenderID:   m.SenderID,
			SenderRole: senderRole,
			MessageText: func() string {
				if m.MessageText != nil {
					return *m.MessageText
				}
				return ""
			}(),
			MessageType:      &m.MessageType,
			AttachmentURLs:   &attURLs,
			MessageCreatedAt: m.CreatedAt,
		})
	}

	return orderSnapshot, chatSnapshots, nil
}

// GET /api/reports/:report_id  (buyer/seller — เห็นเฉพาะ report ของตัวเอง)
func (h *Handler) getMyReport(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c)
	if !ok {
		return
	}

	reportID, ok := parsePathID(c, "report_id")
	if !ok {
		return
	}

	view, err := h.svc.GetMyReport(c.Request.Context(), reportID, userID)
	if err != nil {
		c.Error(err)
		return
	}

	respond.OK(c, apperr.OK, view)
}

// ============================================================================
// Query Parsers
// ============================================================================

func parseListReportsQuery(c *gin.Context) listReportsQuery {
	q := listReportsQuery{Limit: 20, Offset: 0}

	if v := strings.TrimSpace(c.Query("status")); v != "" {
		q.Status = &v
	}
	if v := strings.TrimSpace(c.Query("reported_party_type")); v != "" {
		q.ReportedPartyType = &v
	}
	if v := strings.TrimSpace(c.Query("reason_code")); v != "" {
		q.ReasonCode = &v
	}
	if v := strings.TrimSpace(c.Query("from_date")); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			q.FromDate = &t
		}
	}
	if v := strings.TrimSpace(c.Query("to_date")); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			q.ToDate = &t
		}
	}
	if v, err := strconv.Atoi(c.Query("limit")); err == nil && v > 0 {
		if v > 100 {
			v = 100
		}
		q.Limit = v
	}
	if v, err := strconv.Atoi(c.Query("offset")); err == nil && v >= 0 {
		q.Offset = v
	}

	return q
}
