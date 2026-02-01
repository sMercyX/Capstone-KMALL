package address

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
	userSvc user.Service
}

func NewHandler(
	s Service,
	us user.Service,
) *Handler {
	return &Handler{
		svc:     s,
		userSvc: us,
	}
}

// ============================================================================
// Register
// ============================================================================

func (h *Handler) Register(r *gin.RouterGroup) {
	// /api/addresses
	g := r.Group("/addresses")
	{
		g.GET("", h.listMyAddresses)
		g.GET("/:id", h.getMyAddress)
		g.POST("", h.createAddress)
		g.PUT("/:id", h.updateAddress)
		g.DELETE("/:id", h.deleteAddress)
	}
}

// ============================================================================
// Helper
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
		respond.Error(
			c,
			http.StatusUnauthorized,
			"UNAUTHORIZED",
			"missing upstream user",
			nil,
		)
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
// Handlers
// ============================================================================

// GET /api/addresses
func (h *Handler) listMyAddresses(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c)
	if !ok {
		return
	}

	items, err := h.svc.ListMy(c.Request.Context(), userID)
	if err != nil {
		c.Error(err)
		return
	}

	respond.OK(c, apperr.OK, gin.H{
		"items": items,
	})
}

// GET /api/addresses/:id
func (h *Handler) getMyAddress(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c)
	if !ok {
		return
	}

	id, ok := parsePathID(c, "id")
	if !ok {
		return
	}

	addr, err := h.svc.GetMyByID(c.Request.Context(), userID, id)
	if err != nil {
		c.Error(err)
		return
	}

	respond.OK(c, apperr.OK, addr)
}

// POST /api/addresses
func (h *Handler) createAddress(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c)
	if !ok {
		return
	}

	var in CreateAddressInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	out, err := h.svc.Create(c.Request.Context(), userID, in)
	if err != nil {
		c.Error(err)
		return
	}

	respond.Created(c, apperr.Created, out)
}

// PUT /api/addresses/:id
func (h *Handler) updateAddress(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c)
	if !ok {
		return
	}

	id, ok := parsePathID(c, "id")
	if !ok {
		return
	}

	var in UpdateAddressInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	out, err := h.svc.Update(c.Request.Context(), userID, id, in)
	if err != nil {
		c.Error(err)
		return
	}

	respond.Updated(c, apperr.Updated, out)
}

// DELETE /api/addresses/:id
func (h *Handler) deleteAddress(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c)
	if !ok {
		return
	}

	id, ok := parsePathID(c, "id")
	if !ok {
		return
	}

	if err := h.svc.Delete(c.Request.Context(), userID, id); err != nil {
		c.Error(err)
		return
	}

	respond.OK(c, apperr.OK, gin.H{
		"deleted": true,
	})
}
