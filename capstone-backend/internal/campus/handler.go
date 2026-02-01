package campus

import (
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
	"github.com/Perpasit/Capstone-KMALL/internal/middleware"
	"github.com/Perpasit/Capstone-KMALL/internal/respond"
)

type Handler struct {
	svc     Service
	roleSvc middleware.RoleNameLister
}

func NewHandler(s Service, rl middleware.RoleNameLister) *Handler {
	return &Handler{svc: s, roleSvc: rl}
}

func parseID(c *gin.Context, name string) (int64, bool) {
	raw := strings.TrimSpace(c.Param(name))
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		c.Error(apperr.New(apperr.BadRequest, "invalid "+name))
		return 0, false
	}
	return id, true
}

func (h *Handler) Register(r *gin.RouterGroup) {
	// public for dropdown
	// - GET /campus-locations?q=...&zone=...
	// - GET /campus-locations/zones
	r.GET("/campus-locations", h.listActive)
	r.GET("/campus-locations/zones", h.listZones)

	// admin CRUD
	admin := r.Group("/admin", middleware.RequireRolesAny(h.roleSvc, "Admin"))
	{
		admin.POST("/campus-locations", h.create)
		admin.PUT("/campus-locations/:id", h.update)
		admin.DELETE("/campus-locations/:id", h.delete)
	}
}

func (h *Handler) listActive(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))

	var zonePtr *string
	if z := strings.TrimSpace(c.Query("zone")); z != "" {
		zonePtr = &z
	}

	items, err := h.svc.ListActive(c.Request.Context(), q, zonePtr)
	if err != nil {
		c.Error(err)
		return
	}

	respond.OK(c, apperr.OK, gin.H{"items": items})
}

func (h *Handler) listZones(c *gin.Context) {
	zones, err := h.svc.ListZones(c.Request.Context())
	if err != nil {
		c.Error(err)
		return
	}
	if zones == nil {
		zones = []string{}
	}
	respond.OK(c, apperr.OK, gin.H{"items": zones})
}

func (h *Handler) create(c *gin.Context) {
	var in CreateLocationInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	out, err := h.svc.Create(c.Request.Context(), in)
	if err != nil {
		c.Error(err)
		return
	}

	respond.Created(c, apperr.Created, out)
}

func (h *Handler) update(c *gin.Context) {
	id, ok := parseID(c, "id")
	if !ok {
		return
	}

	var in UpdateLocationInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	out, err := h.svc.Update(c.Request.Context(), id, in)
	if err != nil {
		c.Error(err)
		return
	}

	respond.Updated(c, apperr.Updated, out)
}

func (h *Handler) delete(c *gin.Context) {
	id, ok := parseID(c, "id")
	if !ok {
		return
	}

	if err := h.svc.Delete(c.Request.Context(), id); err != nil {
		c.Error(err)
		return
	}

	respond.OK(c, apperr.OK, gin.H{"deleted": true})
}
