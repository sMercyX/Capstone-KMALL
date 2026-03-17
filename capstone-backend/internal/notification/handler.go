package notification

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
	"github.com/Perpasit/Capstone-KMALL/internal/middleware"
)

type Handler struct {
	svc     Service
	roleSvc middleware.RoleNameLister
}

type createAnnouncementRequest struct {
	Title       string   `json:"title"`
	Body        string   `json:"body"`
	TargetRoles []string `json:"target_roles"`
}

func NewHandler(svc Service, roleSvc middleware.RoleNameLister) *Handler {
	return &Handler{svc: svc, roleSvc: roleSvc}
}

func (h *Handler) Register(rg *gin.RouterGroup) {
	g := rg.Group("/notifications")
	{
		g.GET("", h.list)
		g.GET("/unread-count", h.countUnread)

		g.POST("/:id/read", h.markRead)

		g.DELETE("/:id", h.deleteOne)
		g.DELETE("", h.deleteAll)
	}

	admin := rg.Group("/admin/notifications",
		middleware.RequireRolesAny(h.roleSvc, "Admin"),
	)
	{
		admin.POST("/announcements", h.createAnnouncement)
		admin.GET("/announcements", h.listAnnouncements)
		admin.DELETE("/announcements/:id", h.deleteAnnouncement)
	}
}

// ============================================================================
// Handlers
// ============================================================================

// GET /notifications?before_id=123&limit=30&unread=1
// GET /notifications?before_id=123&limit=30&read=0&type=ORDER_STATUS_CHANGED
func (h *Handler) list(c *gin.Context) {
	userID := strings.TrimSpace(getActorUserID(c))
	if userID == "" {
		c.Error(apperr.New(apperr.Unauthorized, "missing user context"))
		return
	}

	var (
		beforeID *int64
		limit    = 30
		onlyRead *bool // nil = ไม่ filter
		types    []string
		orderID  *int64
		storeID  *int64
	)

	// before_id
	if v := strings.TrimSpace(c.Query("before_id")); v != "" {
		id, err := parseInt64(v)
		if err != nil || id <= 0 {
			c.Error(apperr.New(apperr.BadRequest, "invalid before_id"))
			return
		}
		beforeID = &id
	}

	// limit
	if v := strings.TrimSpace(c.Query("limit")); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 || n > 100 {
			c.Error(apperr.New(apperr.BadRequest, "invalid limit"))
			return
		}
		limit = n
	}

	// read / unread (แนะนำใช้ read เป็นหลัก)
	// read=1/0/true/false
	if v := strings.TrimSpace(c.Query("read")); v != "" {
		b := isTruthy(v)
		onlyRead = &b
	} else if v := strings.TrimSpace(c.Query("unread")); v != "" {
		// backward compatible: unread=1 => read=false
		b := !isTruthy(v) // ถ้า unread=1 -> onlyRead=false
		onlyRead = &b
	}

	// type (single)
	// if v := strings.TrimSpace(c.Query("type")); v != "" {
	// 	types = append(types, strings.TrimSpace(v))
	// }

	for _, t := range c.QueryArray("type") {
		t = strings.TrimSpace(t)
		if t != "" {
			types = append(types, t)
		}
	}

	// types (csv)
	if v := strings.TrimSpace(c.Query("types")); v != "" {
		for _, t := range strings.Split(v, ",") {
			t = strings.TrimSpace(t)
			if t != "" {
				types = append(types, t)
			}
		}
	}

	// order_id
	if v := strings.TrimSpace(c.Query("order_id")); v != "" {
		id, err := parseInt64(v)
		if err != nil || id <= 0 {
			c.Error(apperr.New(apperr.BadRequest, "invalid order_id"))
			return
		}
		orderID = &id
	}

	// store_id
	if v := strings.TrimSpace(c.Query("store_id")); v != "" {
		id, err := parseInt64(v)
		if err != nil || id <= 0 {
			c.Error(apperr.New(apperr.BadRequest, "invalid store_id"))
			return
		}
		storeID = &id
	}

	items, err := h.svc.List(c.Request.Context(), ListInput{
		UserID:   userID,
		BeforeID: beforeID,
		Limit:    limit,
		OnlyRead: onlyRead,
		Types:    types,
		OrderID:  orderID,
		StoreID:  storeID,
	})
	if err != nil {
		c.Error(err)
		return
	}
	unreadCount, err := h.svc.CountUnread(c.Request.Context(), userID)
	if err != nil {
		c.Error(err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"notifications": items,
		"count":         unreadCount,
		"before_id":     beforeID,
	})
}

// GET /notifications/unread-count
func (h *Handler) countUnread(c *gin.Context) {
	userID := strings.TrimSpace(getActorUserID(c))
	if userID == "" {
		c.Error(apperr.New(apperr.Unauthorized, "missing user context"))
		return
	}

	n, err := h.svc.CountUnread(c.Request.Context(), userID)
	if err != nil {
		c.Error(err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"unread_count": n,
	})
}

// POST /notifications/:id/read
func (h *Handler) markRead(c *gin.Context) {
	userID := strings.TrimSpace(getActorUserID(c))
	if userID == "" {
		c.Error(apperr.New(apperr.Unauthorized, "missing user context"))
		return
	}

	idStr := strings.TrimSpace(c.Param("id"))
	id, err := parseInt64(idStr)
	if err != nil || id <= 0 {
		c.Error(apperr.New(apperr.BadRequest, "invalid notification_id"))
		return
	}

	n, err := h.svc.MarkRead(c.Request.Context(), MarkReadInput{
		UserID:         userID,
		NotificationID: id,
	})
	if err != nil {
		c.Error(err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"notification": n,
	})
}

// DELETE /notifications/:id
func (h *Handler) deleteOne(c *gin.Context) {
	userID := strings.TrimSpace(getActorUserID(c))
	if userID == "" {
		c.Error(apperr.New(apperr.Unauthorized, "missing user context"))
		return
	}

	idStr := strings.TrimSpace(c.Param("id"))
	id, err := parseInt64(idStr)
	if err != nil || id <= 0 {
		c.Error(apperr.New(apperr.BadRequest, "invalid notification_id"))
		return
	}

	if err := h.svc.Delete(c.Request.Context(), userID, id); err != nil {
		c.Error(err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"deleted": true,
	})
}

// DELETE /notifications
func (h *Handler) deleteAll(c *gin.Context) {
	userID := strings.TrimSpace(getActorUserID(c))
	if userID == "" {
		c.Error(apperr.New(apperr.Unauthorized, "missing user context"))
		return
	}

	n, err := h.svc.DeleteAll(c.Request.Context(), userID)
	if err != nil {
		c.Error(err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"deleted":      true,
		"deleted_rows": n,
	})
}

func (h *Handler) createAnnouncement(c *gin.Context) {
	adminID := strings.TrimSpace(getActorUserID(c))
	if adminID == "" {
		c.Error(apperr.New(apperr.Unauthorized, "missing user context"))
		return
	}

	var req createAnnouncementRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "invalid request body"))
		return
	}

	ann, err := h.svc.CreateAnnouncement(c.Request.Context(), CreateAnnouncementInput{
		AdminID:     adminID,
		Title:       req.Title,
		Body:        req.Body,
		TargetRoles: req.TargetRoles,
	})
	if err != nil {
		c.Error(err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"announcement": ann,
	})
}

func (h *Handler) listAnnouncements(c *gin.Context) {
	var beforeID *int64
	limit := 30

	if v := strings.TrimSpace(c.Query("before_id")); v != "" {
		id, err := parseInt64(v)
		if err != nil || id <= 0 {
			c.Error(apperr.New(apperr.BadRequest, "invalid before_id"))
			return
		}
		beforeID = &id
	}

	if v := strings.TrimSpace(c.Query("limit")); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 || n > 100 {
			c.Error(apperr.New(apperr.BadRequest, "invalid limit"))
			return
		}
		limit = n
	}

	items, err := h.svc.ListAnnouncements(c.Request.Context(), ListAnnouncementsParams{
		BeforeID: beforeID,
		Limit:    limit,
	})
	if err != nil {
		c.Error(err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"announcements": items,
		"before_id":     beforeID,
	})
}

func (h *Handler) deleteAnnouncement(c *gin.Context) {
	idStr := strings.TrimSpace(c.Param("id"))
	id, err := parseInt64(idStr)
	if err != nil || id <= 0 {
		c.Error(apperr.New(apperr.BadRequest, "invalid announcement_id"))
		return
	}

	if err := h.svc.DeleteAnnouncement(c.Request.Context(), id); err != nil {
		c.Error(err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"deleted": true,
	})
}

// getActorUserID tries to read user id from gin context.
// Adjust key names to match your project.
// Common patterns: "user_id", "uid", "actor_user_id"
func getActorUserID(c *gin.Context) string {
	if v, ok := c.Get("user_id"); ok {
		if s, ok2 := v.(string); ok2 {
			return s
		}
	}
	if v, ok := c.Get("actor_user_id"); ok {
		if s, ok2 := v.(string); ok2 {
			return s
		}
	}
	// fallback: header (ถ้าคุณมี dev header)
	if v := strings.TrimSpace(c.GetHeader("X-User-Id")); v != "" {
		return v
	}
	return ""
}

func parseInt64(s string) (int64, error) {
	return strconv.ParseInt(strings.TrimSpace(s), 10, 64)
}

func isTruthy(s string) bool {
	s = strings.ToLower(strings.TrimSpace(s))
	switch s {
	case "1", "true", "yes", "y", "on":
		return true
	default:
		return false
	}
}
