package recommendation

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

type Handler struct {
	svc     Service
	userSvc user.Service
}

func NewHandler(s Service, us user.Service) *Handler {
	return &Handler{
		svc:     s,
		userSvc: us,
	}
}

func (h *Handler) Register(r *gin.RouterGroup) {
	// /api/recommendation/*
	g := r.Group("/recommendation")
	g.GET("/home", h.getHome)
	g.GET("/orders/:orderId", h.getOrder)
}

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

func parseIntQuery(c *gin.Context, key string, def, max int) int {
	raw := strings.TrimSpace(c.Query(key))
	if raw == "" {
		return def
	}
	v, err := strconv.Atoi(raw)
	if err != nil || v <= 0 {
		return def
	}
	if v > max {
		return max
	}
	return v
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

// GET /api/recommendation/home?per_section=12
func (h *Handler) getHome(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c, false)
	if !ok {
		return
	}

	perSection := parseIntQuery(c, "per_section", 12, 30)

	resp, err := h.svc.GetHomeRecommendations(c.Request.Context(), userID, perSection)
	if err != nil {
		c.Error(err)
		return
	}

	if resp.Sections == nil {
		resp.Sections = []HomeSection{}
	}

	respond.OK(c, apperr.OK, resp)
}

// GET /api/recommendation/orders/:orderId?context=cancellation&limit=12
func (h *Handler) getOrder(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c, false)
	if !ok {
		return
	}

	orderID, ok := parseID(c, "orderId")
	if !ok {
		return
	}

	limit := parseIntQuery(c, "limit", 12, 30)

	ctxVal := strings.ToLower(strings.TrimSpace(c.Query("context")))
	if ctxVal == "" {
		ctxVal = string(ContextCancellation)
	}

	resp, err := h.svc.GetOrderRecommendations(c.Request.Context(), userID, orderID, ctxVal, limit)
	if err != nil {
		c.Error(err)
		return
	}

	if resp.Items == nil {
		resp.Items = []Item{}
	}

	respond.OK(c, apperr.OK, resp)
}
