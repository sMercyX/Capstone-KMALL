package user

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/Perpasit/Capstone-KMALL/internal/apperr"
	"github.com/Perpasit/Capstone-KMALL/internal/middleware"
	"github.com/Perpasit/Capstone-KMALL/internal/respond"
)

type Handler struct{ svc Service }

func NewHandler(s Service) *Handler { return &Handler{svc: s} }

func (h *Handler) Register(r *gin.RouterGroup) {
	g := r.Group("/users")
	g.GET("", h.list)
	g.GET("/:id", h.get)
	// g.POST("", h.create)
	// g.PUT("/:id", h.update)
	g.DELETE("/:id", h.delete)
	g.GET("/me", h.Me)
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

// func (h *Handler) create(c *gin.Context) {
// 	var in User
// 	if err := c.ShouldBindJSON(&in); err != nil {
// 		c.Error(apperr.New(apperr.BadRequest, "bad json"))
// 		return
// 	}
// 	u, err := h.svc.Create(c.Request.Context(), in)
// 	if err != nil {
// 		c.Error(err)
// 		return
// 	}

// 	// ถ้าอยากคง 201 จริงๆ อาจเพิ่ม respond.Created() ภายหลังได้
// 	c.JSON(http.StatusCreated, gin.H{"success": true, "data": u})
// }

// func (h *Handler) update(c *gin.Context) {
// 	var in User
// 	if err := c.ShouldBindJSON(&in); err != nil {
// 		c.Error(apperr.New(apperr.BadRequest, "bad json"))
// 		return
// 	}
// 	u, err := h.svc.Update(c.Request.Context(), c.Param("id"), in)
// 	if err != nil { c.Error(err); return }
// 	respond.OK(c, u)
// }

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

	respond.OK(c, apperr.OK, u)
}
