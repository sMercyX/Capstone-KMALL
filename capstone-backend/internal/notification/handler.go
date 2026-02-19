package notification

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
)

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
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
}

// ============================================================================
// Handlers
// ============================================================================

// GET /notifications?before_id=123&limit=30&unread=1
func (h *Handler) list(c *gin.Context) {
	userID := strings.TrimSpace(getActorUserID(c))
	if userID == "" {
		// ถ้าโปรเจกต์คุณใช้ middleware auth ที่ใส่ user id ไว้แล้ว
		// ให้แก้ getActorUserID ด้านล่างให้ดึง key ที่ถูกต้อง
		c.Error(apperr.New(apperr.Unauthorized, "missing user context"))
		return
	}

	var (
		beforeID *int64
		limit    = 30
		unread   = false
	)

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

	if v := strings.TrimSpace(c.Query("unread")); v != "" {
		// unread=1 / true / yes
		unread = isTruthy(v)
	}

	items, err := h.svc.List(c.Request.Context(), ListInput{
		UserID:     userID,
		BeforeID:   beforeID,
		Limit:      limit,
		OnlyUnread: unread,
	})
	if err != nil {
		c.Error(err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"notifications": items,
		"count":         len(items),
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

// ============================================================================
// Helpers (adjust to your auth middleware)
// ============================================================================

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
