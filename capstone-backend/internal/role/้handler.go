package role

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/Perpasit/Capstone-KMALL/internal/apperr"
	"github.com/Perpasit/Capstone-KMALL/internal/middleware"
	"github.com/Perpasit/Capstone-KMALL/internal/respond"
)

type Handler struct {
	svc Service
}

func NewHandler(s Service) *Handler { return &Handler{svc: s} }

func (h *Handler) Register(r *gin.RouterGroup) {
	g := r.Group("/roles")

	// ===== admin-only =====
	admin := g.Group("", middleware.RequireRolesAny(h.svc, "Admin"))
	admin.GET("", h.list)
	admin.GET("/name/:name/id", h.getIDByName)
	admin.GET("/user/:userID", h.listByUserID)
	admin.GET("/user/:userID/names", h.listNamesByUserID)

	// ===== self =====
	g.GET("/me", h.listMe)
	g.GET("/me/names", h.listMeNames)
}

// GET /roles
func (h *Handler) list(c *gin.Context) {
	ctx := c.Request.Context()

	roles, err := h.svc.List(ctx)
	if err != nil {
		c.Error(err)
		return
	}
	if roles == nil {
		roles = []Role{}
	}
	respond.OK(c, apperr.OK, roles)
}

// GET /roles/name/:name/id
func (h *Handler) getIDByName(c *gin.Context) {
	ctx := c.Request.Context()
	name := strings.TrimSpace(c.Param("name"))
	if name == "" {
		c.Error(apperr.New(apperr.BadRequest, "missing role name"))
		return
	}

	id, err := h.svc.GetIDByName(ctx, name)
	if err != nil {
		c.Error(err)
		return
	}
	respond.OK(c, apperr.OK, gin.H{"id": id, "name": name})
}

// GET /roles/user/:userID
func (h *Handler) listByUserID(c *gin.Context) {
	ctx := c.Request.Context()
	userID := strings.TrimSpace(c.Param("userID"))
	if userID == "" {
		c.Error(apperr.New(apperr.BadRequest, "missing userID"))
		return
	}

	roles, err := h.svc.ListByUserID(ctx, userID)
	if err != nil {
		c.Error(err)
		return
	}
	if roles == nil {
		roles = []Role{}
	}
	respond.OK(c, apperr.OK, roles)
}

// GET /roles/user/:userID/names
func (h *Handler) listNamesByUserID(c *gin.Context) {
	ctx := c.Request.Context()
	userID := strings.TrimSpace(c.Param("userID"))
	if userID == "" {
		c.Error(apperr.New(apperr.BadRequest, "missing userID"))
		return
	}

	names, err := h.svc.ListNamesByUserID(ctx, userID)
	if err != nil {
		c.Error(err)
		return
	}
	if names == nil {
		names = []string{}
	}
	respond.OK(c, apperr.OK, names)
}

// GET /roles/me
func (h *Handler) listMe(c *gin.Context) {
	up, ok := c.Get(middleware.CtxUpstreamUser)
	if !ok || up == nil {
		respond.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "missing upstream user", nil)
		return
	}
	uu := up.(*middleware.UpstreamUser)

	roles, err := h.svc.ListByUserID(c.Request.Context(), uu.UID)
	if err != nil {
		c.Error(err)
		return
	}
	if roles == nil {
		roles = []Role{}
	}
	respond.OK(c, apperr.OK, roles)
}

// GET /roles/me/names
func (h *Handler) listMeNames(c *gin.Context) {
	up, ok := c.Get(middleware.CtxUpstreamUser)
	if !ok || up == nil {
		respond.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "missing upstream user", nil)
		return
	}
	uu := up.(*middleware.UpstreamUser)

	names, err := h.svc.ListNamesByUserID(c.Request.Context(), uu.UID)
	if err != nil {
		c.Error(err)
		return
	}
	if names == nil {
		names = []string{}
	}
	respond.OK(c, apperr.OK, names)
}
