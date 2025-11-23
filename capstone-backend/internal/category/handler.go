package category

import (
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
	"github.com/Perpasit/Capstone-KMALL/internal/middleware"
	"github.com/Perpasit/Capstone-KMALL/internal/respond"
)

// ===== Handler =====

type Handler struct {
	svc     Service
	roleSvc middleware.RoleNameLister
}

func NewHandler(s Service, rl middleware.RoleNameLister) *Handler {
	return &Handler{svc: s, roleSvc: rl}
}

func (h *Handler) Register(r *gin.RouterGroup) {
	g := r.Group("/categories")

	// ----- Public -----
	g.GET("", h.listPublic)           // ?q=&parent_id=&page=&limit=
	g.GET("/:id/public", h.getPublic) // เฉพาะ is_active = YES

	// ----- Admin-only -----
	admin := g.Group("", middleware.RequireRolesAny(h.roleSvc, "Admin"))
	{
		admin.POST("", h.create)
		admin.GET("/:id", h.get)
		admin.PUT("/:id", h.update)
		admin.DELETE("/:id", h.delete)
	}
}

// ===== Request DTOs =====

type createReq struct {
	Name      string  `json:"name"       binding:"required"`
	Slug      *string `json:"slug"`                // optional, ไม่ส่ง -> gen จาก name
	ParentID  *int    `json:"parent_id"`           // optional
	SortOrder *int    `json:"sort_order"`          // optional, default 0
	IsActive  string  `json:"is_active,omitempty"` // YES/NO, ว่าง -> YES
}

type updateReq struct {
	Name      *string `json:"name"`
	Slug      *string `json:"slug"`
	ParentID  *int    `json:"parent_id"`
	SortOrder *int    `json:"sort_order"`
	IsActive  *string `json:"is_active"`
}

// ===== Helpers =====

func parseID(c *gin.Context) (int64, bool) {
	idStr := strings.TrimSpace(c.Param("id"))
	if idStr == "" {
		c.Error(apperr.New(apperr.BadRequest, "missing id"))
		return 0, false
	}
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil || id <= 0 {
		c.Error(apperr.New(apperr.BadRequest, "invalid id"))
		return 0, false
	}
	return id, true
}

// func parseParentIDQuery(c *gin.Context) *int64 {
// 	v := strings.TrimSpace(c.Query("parent_id"))
// 	if v == "" {
// 		return nil
// 	}
// 	id, err := strconv.ParseInt(v, 10, 64)
// 	if err != nil || id <= 0 {
// 		// ถ้า parse ไม่ได้ จะถือว่าไม่ใช้ filter parent (ไม่ error ทั้ง request)
// 		return nil
// 	}
// 	return &id
// }

func parseBoolQuery(value string, def bool) bool {
	if value == "" {
		return def
	}
	v := strings.ToLower(strings.TrimSpace(value))
	switch v {
	case "1", "true", "yes", "y":
		return true
	case "0", "false", "no", "n":
		return false
	default:
		return def
	}
}

func parseParentIDQuery(c *gin.Context) *int64 {
	val := strings.TrimSpace(c.Query("parent_id"))
	if val == "" {
		return nil
	}
	if val == "null" {
		x := int64(0)
		return &x
	}
	id, err := strconv.ParseInt(val, 10, 64)
	if err != nil {
		return nil
	}
	return &id
}

// ===== Handlers =====

// POST /api/categories (Admin)
func (h *Handler) create(c *gin.Context) {
	var in createReq
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	cat, err := h.svc.Create(c.Request.Context(), CreateInput(in))
	if err != nil {
		c.Error(err)
		return
	}
	respond.Created(c, apperr.Created, cat)
}

// GET /api/categories/:id (Admin)
func (h *Handler) get(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	cat, err := h.svc.Get(c.Request.Context(), id)
	if err != nil {
		c.Error(err)
		return
	}
	respond.OK(c, apperr.OK, cat)
}

// PUT /api/categories/:id (Admin)
func (h *Handler) update(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}

	var in updateReq
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	cat, err := h.svc.Update(c.Request.Context(), id, UpdateInput(in))
	if err != nil {
		c.Error(err)
		return
	}
	respond.Updated(c, apperr.Updated, cat)
}

// DELETE /api/categories/:id (Admin)
func (h *Handler) delete(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}

	if err := h.svc.Delete(c.Request.Context(), id); err != nil {
		c.Error(err)
		return
	}
	respond.Deleted(c, apperr.Deleted, gin.H{"deleted": true})
}

// GET /api/categories (Public)
// ตัวอย่าง filter:
//   - ?q=food
//   - ?parent_id=1
//   - ?active_only=true (default = true ใน public)
func (h *Handler) listPublic(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	parentID := parseParentIDQuery(c)

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))

	// public: activeOnly = true เป็น default
	activeOnly := parseBoolQuery(c.Query("active_only"), true)

	cats, err := h.svc.List(c.Request.Context(), q, parentID, activeOnly, limit, page)
	if err != nil {
		c.Error(err)
		return
	}
	if cats == nil {
		cats = []Category{}
	}
	respond.OK(c, apperr.OK, cats)
}

// GET /api/categories/:id/public (Public)
// ใช้ดู category เดี่ยวที่ต้อง "เปิดใช้งาน" เท่านั้น
func (h *Handler) getPublic(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	cat, err := h.svc.Get(c.Request.Context(), id)
	if err != nil {
		c.Error(err)
		return
	}
	if !strings.EqualFold(cat.IsActive, "YES") {
		c.Error(apperr.New(apperr.NotFound, "category not found"))
		return
	}
	respond.OK(c, apperr.OK, cat)
}
