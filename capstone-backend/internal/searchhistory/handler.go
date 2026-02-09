package searchhistory

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

// ===== Handler =====

type Handler struct {
	svc     Service
	roleSvc middleware.RoleNameLister
	userSvc user.Service
}

func NewHandler(s Service, rl middleware.RoleNameLister, us user.Service) *Handler {
	return &Handler{
		svc:     s,
		roleSvc: rl,
		userSvc: us,
	}
}

func (h *Handler) Register(r *gin.RouterGroup) {
	sg := r.Group("/search-history")
	authed := sg.Group("", middleware.RequireRolesAny(h.roleSvc, "Buyer", "Admin"))
	{
		authed.GET("", h.listMy) // GET /api/search-history?limit=10
		// authed.POST("", h.create)       // POST /api/search-history { "query": "..." }
		authed.DELETE("/:id", h.delete) // DELETE /api/search-history/:id
		authed.DELETE("", h.deleteAll)  // DELETE /api/search-history
	}
}

// ===== DTOs =====

// type createReq struct {
// 	Query string `json:"query" binding:"required"`
// }

// ===== Helpers =====

func parseID(c *gin.Context, name string) (int64, bool) {
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

func (h *Handler) resolveCurrentUserID(c *gin.Context, ensure bool) (string, bool) {
	up, ok := c.Get(middleware.CtxUpstreamUser)
	if !ok || up == nil {
		respond.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "missing upstream user", nil)
		return "", false
	}
	uu := up.(*middleware.UpstreamUser)

	if ensure {
		u, err := h.userSvc.UpsertAndEnsureBuyer(c.Request.Context(), uu.UID, uu.Email, uu.Name)
		if err != nil {
			c.Error(err)
			return "", false
		}
		return u.ID, true
	}

	u, err := h.userSvc.FindByUpstreamID(c.Request.Context(), uu.UID)
	if err != nil {
		c.Error(err)
		return "", false
	}
	return u.ID, true
}

// ==============================
// 1) GET /api/search-history
// ==============================
func (h *Handler) listMy(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c, false)
	if !ok {
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	if limit <= 0 {
		limit = 10
	}
	if limit > 50 {
		limit = 50
	}

	items, err := h.svc.ListByUser(c.Request.Context(), userID, limit)
	if err != nil {
		c.Error(err)
		return
	}
	if items == nil {
		items = []SearchHistory{}
	}

	respond.OK(c, apperr.OK, gin.H{"items": items})
}

// ==============================
// 2) POST /api/search-history
// body: {"query":"..."}
// ==============================
// func (h *Handler) create(c *gin.Context) {
// 	// ensure=true: เวลา buyer เพิ่งเข้าระบบครั้งแรก จะมี user row แน่ ๆ
// 	userID, ok := h.resolveCurrentUserID(c, true)
// 	if !ok {
// 		return
// 	}

// 	var in createReq
// 	if err := c.ShouldBindJSON(&in); err != nil {
// 		c.Error(apperr.New(apperr.BadRequest, "bad json"))
// 		return
// 	}

// 	q := strings.TrimSpace(in.Query)
// 	if q == "" {
// 		c.Error(apperr.New(apperr.BadRequest, "query is required"))
// 		return
// 	}

// 	item, err := h.svc.Create(c.Request.Context(), userID, q)
// 	if err != nil {
// 		c.Error(err)
// 		return
// 	}

// 	respond.Created(c, apperr.Created, item)
// }

// ==============================
// 3) DELETE /api/search-history/:id
// ==============================
func (h *Handler) delete(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c, false)
	if !ok {
		return
	}

	id, ok := parseID(c, "id")
	if !ok {
		return
	}

	if err := h.svc.Delete(c.Request.Context(), userID, id); err != nil {
		c.Error(err)
		return
	}

	respond.Deleted(c, apperr.Deleted, gin.H{"deleted": true})
}

// ==============================
// 4) DELETE /api/search-history  (delete all)
// ==============================
func (h *Handler) deleteAll(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c, false)
	if !ok {
		return
	}

	deletedCount, err := h.svc.DeleteAll(c.Request.Context(), userID)
	if err != nil {
		c.Error(err)
		return
	}

	respond.Deleted(c, apperr.Deleted, gin.H{
		"deleted":       true,
		"deleted_count": deletedCount,
	})
}
