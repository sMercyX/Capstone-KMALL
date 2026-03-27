package store

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
	return &Handler{svc: s, roleSvc: rl, userSvc: us}
}

func (h *Handler) Register(r *gin.RouterGroup) {
	g := r.Group("/stores")

	// ----- Public -----
	g.GET("", h.listPublic)           // ?q=&page=&limit=
	g.GET("/:id/public", h.getPublic) // is_active = true
	g.POST("", h.create)

	// ----- Seller-only -----
	seller := g.Group("", middleware.RequireRolesAny(h.roleSvc, "Seller"))
	{
		seller.GET("/me", h.me)
	}

	// ----- Admin-only -----
	admin := g.Group("", middleware.RequireRolesAny(h.roleSvc, "Admin"))
	{
		admin.GET("/:id", h.get)
	}

	// ----- Owner or Admin -----
	owner := g.Group("", middleware.RequireRolesAny(h.roleSvc, "Seller", "Admin"))
	{
		owner.PUT("/:id", h.update)
		owner.DELETE("/:id", h.delete)
	}
}

// ===== Request DTOs =====

type createReq struct {
	Name        string  `json:"name"        binding:"required"`
	Description *string `json:"description"`
	ProfileURL  *string `json:"profile_url"`
	IsActive    string  `json:"is_active"`

	DeliveryRoundUniversityEnabled *bool    `json:"delivery_round_university_enabled"`
	RoundUniBaseFee                *float64 `json:"round_uni_base_fee"`
}

type updateReq struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	ProfileURL  *string `json:"profile_url"`
	IsActive    *string `json:"is_active"`

	DeliveryRoundUniversityEnabled *bool    `json:"delivery_round_university_enabled"`
	RoundUniBaseFee                *float64 `json:"round_uni_base_fee"`
}

// ===== Helpers =====

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

// ===== Handlers =====

// POST /api/stores (Seller)
func (h *Handler) create(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c, true)
	if !ok {
		return
	}

	var in createReq
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	st, err := h.svc.Create(c.Request.Context(), userID, CreateInput(in))

	if err != nil {
		c.Error(err)
		return
	}

	respond.Created(c, apperr.Created, st)
}

// GET /api/stores/me (Seller)
func (h *Handler) me(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c, false)
	if !ok {
		return
	}

	st, err := h.svc.Me(c.Request.Context(), userID)
	if err != nil {
		c.Error(err)
		return
	}
	respond.OK(c, apperr.OK, st)
}

// GET /api/stores/:id (Admin)
func (h *Handler) get(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	st, err := h.svc.Get(c.Request.Context(), id)
	if err != nil {
		c.Error(err)
		return
	}
	respond.OK(c, apperr.OK, st)
}

// PUT /api/stores/:id (Owner/Admin)
func (h *Handler) update(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}

	st, err := h.svc.Get(c.Request.Context(), id)
	if err != nil {
		c.Error(err)
		return
	}

	userID, ok := h.resolveCurrentUserID(c, false)
	if !ok {
		return
	}

	if !h.isAdmin(c, userID) && !strings.EqualFold(st.UserID.String(), userID) {
		respond.Error(c, http.StatusForbidden, "FORBIDDEN", "only owner or admin can update this store", nil)
		return
	}

	var in updateReq
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	ust, err := h.svc.Update(c.Request.Context(), id, UpdateInput(in))

	if err != nil {
		c.Error(err)
		return
	}
	respond.Updated(c, apperr.Updated, ust)
}

// DELETE /api/stores/:id (Owner/Admin)
func (h *Handler) delete(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}

	st, err := h.svc.Get(c.Request.Context(), id)
	if err != nil {
		c.Error(err)
		return
	}

	userID, ok := h.resolveCurrentUserID(c, false)
	if !ok {
		return
	}

	if !h.isAdmin(c, userID) && !strings.EqualFold(st.UserID.String(), userID) {
		respond.Error(c, http.StatusForbidden, "FORBIDDEN", "only owner or admin can delete this store", nil)
		return
	}

	if err := h.svc.Delete(c.Request.Context(), id); err != nil {
		c.Error(err)
		return
	}
	respond.Deleted(c, apperr.Deleted, gin.H{"deleted": true})
}

// GET /api/stores (Public)
func (h *Handler) listPublic(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))

	stores, err := h.svc.List(c.Request.Context(), q, limit, page)
	if err != nil {
		c.Error(err)
		return
	}

	out := make([]Store, 0, len(stores))
	for _, s := range stores {
		if strings.EqualFold(s.IsActive, "YES") {
			out = append(out, s)
		}
	}
	respond.OK(c, apperr.OK, out)
}

// GET /api/stores/:id/public (Public/Buyer)
func (h *Handler) getPublic(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	st, err := h.svc.Get(c.Request.Context(), id)
	if err != nil {
		c.Error(err)
		return
	}
	if !strings.EqualFold(st.IsActive, "YES") {
		c.Error(apperr.New(apperr.NotFound, "store not found"))
		return
	}
	respond.OK(c, apperr.OK, st)
}
