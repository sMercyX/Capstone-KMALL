package user

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/Perpasit/Capstone-KMALL/internal/apperr"
	"github.com/Perpasit/Capstone-KMALL/internal/middleware"
	"github.com/Perpasit/Capstone-KMALL/internal/respond"
)

type ActiveBan struct {
	UserRole    string     `json:"user_role"`
	Reason      string     `json:"reason"`
	BanType     string     `json:"ban_type"`
	BannedFrom  time.Time  `json:"banned_from"`
	BannedUntil *time.Time `json:"banned_until,omitempty"`
	IsActive    bool       `json:"is_active"`
}

type ActiveBanGetter interface {
	GetActiveBan(ctx context.Context, userID string) (*ActiveBan, error)
}

type Handler struct {
	svc     Service
	roleSvc middleware.RoleNameLister
	banSvc  ActiveBanGetter
}

func NewHandler(s Service, rl middleware.RoleNameLister, banSvc ActiveBanGetter) *Handler {
	return &Handler{svc: s, roleSvc: rl, banSvc: banSvc}
}

func (h *Handler) Register(r *gin.RouterGroup) {
	g := r.Group("/users")

	// ===== admin-only =====
	admin := g.Group("", middleware.RequireRolesAny(h.roleSvc, "Admin"))
	{
		admin.GET("", h.list)
		admin.GET("/:id", h.get)
		admin.DELETE("/:id", h.delete)

		// admin role ops
		admin.POST("/:id/roles", h.adminAddRoles)
		admin.DELETE("/:id/roles", h.adminRemoveRoles)
	}

	// ===== self =====
	g.GET("/me", h.Me)
	g.DELETE("/me", h.deleteMe)
	g.POST("/me/roles", h.addMyRoles)
	g.DELETE("/me/roles", h.removeMyRoles)
}

type rolesReq struct {
	Roles []string `json:"roles"`
}

func (h *Handler) adminAddRoles(c *gin.Context) {
	targetID := strings.TrimSpace(c.Param("id"))
	if targetID == "" {
		c.Error(apperr.New(apperr.BadRequest, "missing id"))
		return
	}

	var in rolesReq
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	if err := h.svc.AddRoles(c.Request.Context(), targetID, in.Roles); err != nil {
		c.Error(err)
		return
	}
	respond.Created(c, apperr.Created, gin.H{"created": true})
}

func (h *Handler) adminRemoveRoles(c *gin.Context) {
	targetID := strings.TrimSpace(c.Param("id"))
	if targetID == "" {
		c.Error(apperr.New(apperr.BadRequest, "missing id"))
		return
	}

	var in rolesReq
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	if err := h.svc.RemoveRoles(c.Request.Context(), targetID, in.Roles); err != nil {
		c.Error(err)
		return
	}
	respond.Deleted(c, apperr.Deleted, gin.H{"deleted": true})
}

func (h *Handler) addMyRoles(c *gin.Context) {
	up, ok := c.Get(middleware.CtxUpstreamUser)
	if !ok || up == nil {
		respond.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "missing upstream user", nil)
		return
	}
	uu := up.(*middleware.UpstreamUser)

	var in rolesReq
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	for _, r := range in.Roles {
		l := strings.ToLower(strings.TrimSpace(r))
		if l != "buyer" && l != "seller" {
			respond.Error(c, http.StatusForbidden, "FORBIDDEN", "you can only add Buyer or Seller to yourself", nil)
			return
		}
	}

	u, err := h.svc.UpsertAndEnsureBuyer(c.Request.Context(), uu.UID, uu.Email, uu.Name)
	if err != nil {
		c.Error(err)
		return
	}

	if err := h.svc.AddRoles(c.Request.Context(), u.ID, in.Roles); err != nil {
		c.Error(err)
		return
	}

	names, err := h.roleSvc.ListNamesByUserID(c.Request.Context(), u.ID)
	if err != nil {
		c.Error(err)
		return
	}
	if names == nil {
		names = []string{}
	}

	respond.Created(c, apperr.Created, gin.H{
		"added": in.Roles,
		"roles": names,
	})
}

func (h *Handler) removeMyRoles(c *gin.Context) {
	up, ok := c.Get(middleware.CtxUpstreamUser)
	if !ok || up == nil {
		respond.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "missing upstream user", nil)
		return
	}
	uu := up.(*middleware.UpstreamUser)

	var in rolesReq
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	for _, r := range in.Roles {
		l := strings.ToLower(strings.TrimSpace(r))
		if l != "seller" {
			respond.Error(c, http.StatusForbidden, "FORBIDDEN", "you can only remove Seller from yourself", nil)
			return
		}
	}

	u, err := h.svc.UpsertAndEnsureBuyer(c.Request.Context(), uu.UID, uu.Email, uu.Name)
	if err != nil {
		c.Error(err)
		return
	}

	if err := h.svc.RemoveRoles(c.Request.Context(), u.ID, in.Roles); err != nil {
		c.Error(err)
		return
	}

	names, err := h.roleSvc.ListNamesByUserID(c.Request.Context(), u.ID)
	if err != nil {
		c.Error(err)
		return
	}
	if names == nil {
		names = []string{}
	}

	respond.Deleted(c, apperr.Deleted, gin.H{
		"removed": in.Roles,
		"roles":   names,
	})
}

func (h *Handler) list(c *gin.Context) {
	ctx := c.Request.Context()
	us, err := h.svc.List(ctx)
	if err != nil {
		c.Error(err)
		return
	}
	if us == nil {
		us = []User{}
	}
	respond.OK(c, apperr.OK, us)
}

func (h *Handler) get(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.Param("id")
	if id == "" {
		c.Error(apperr.New(apperr.BadRequest, "missing id"))
		return
	}
	u, err := h.svc.Get(ctx, id)
	if err != nil {
		c.Error(err)
		return
	}
	respond.OK(c, apperr.OK, u)
}

func (h *Handler) delete(c *gin.Context) {
	u, err := h.svc.Delete(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.Error(err)
		return
	}
	respond.Deleted(c, apperr.Deleted, u)
}

func (h *Handler) Me(c *gin.Context) {
	up, ok := c.Get(middleware.CtxUpstreamUser)
	if !ok || up == nil {
		respond.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "missing upstream user", nil)
		return
	}
	uu := up.(*middleware.UpstreamUser)

	u, err := h.svc.UpsertAndEnsureBuyer(c.Request.Context(), uu.UID, uu.Email, uu.Name)
	if err != nil {
		respond.Error(c, http.StatusInternalServerError, "INTERNAL", err.Error(), nil)
		return
	}

	roleNames, err := h.roleSvc.ListNamesByUserID(c.Request.Context(), u.ID)
	if err != nil {
		c.Error(err)
		return
	}
	if roleNames == nil {
		roleNames = []string{}
	}

	// NEW: check active blacklist/ban
	var ban any
	if h.banSvc != nil {
		b, err := h.banSvc.GetActiveBan(c.Request.Context(), u.ID)
		if err != nil {
			c.Error(err)
			return
		}
		if b != nil {
			ban = gin.H{
				"user_role":    b.UserRole,
				"reason":       b.Reason,
				"ban_type":     b.BanType,
				"banned_from":  b.BannedFrom,
				"banned_until": b.BannedUntil,
				"is_active":    b.IsActive,
			}
		}
	}

	respond.OK(c, apperr.OK, gin.H{
		"user":  u,
		"roles": roleNames,
		"ban":   ban,
	})
}

func (h *Handler) deleteMe(c *gin.Context) {
	up, ok := c.Get(middleware.CtxUpstreamUser)
	if !ok || up == nil {
		respond.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "missing upstream user", nil)
		return
	}
	uu := up.(*middleware.UpstreamUser)

	u, err := h.svc.FindByUpstreamID(c.Request.Context(), uu.UID)
	if err != nil {
		c.Error(err)
		return
	}

	if _, err := h.svc.Delete(c.Request.Context(), u.ID); err != nil {
		c.Error(err)
		return
	}

	respond.Deleted(c, apperr.Deleted, gin.H{
		"deleted": true,
		"user_id": u.ID,
	})
}
