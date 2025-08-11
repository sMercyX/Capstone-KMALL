package user

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Handler struct{ svc Service }

func NewHandler(s Service) *Handler { return &Handler{svc: s} }

func (h *Handler) Register(r *gin.RouterGroup) {
	g := r.Group("/users")
	g.GET("", h.list)
	g.GET("/:id", h.get)
	g.POST("", h.create)
	g.PUT("/:id", h.update)
	g.DELETE("/:id", h.delete)
}

func (h *Handler) list(c *gin.Context) {
	us, err := h.svc.List(c.Request.Context())
	if err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }
	c.JSON(200, us)
}

func (h *Handler) get(c *gin.Context) {
	u, err := h.svc.Get(c.Request.Context(), c.Param("id"))
	if err != nil { c.JSON(404, gin.H{"error": err.Error()}); return }
	c.JSON(200, u)
}

func (h *Handler) create(c *gin.Context) {
	var in User
	if err := c.BindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error":"bad json"}); return
	}
	u, err := h.svc.Create(c.Request.Context(), in)
	if err != nil { c.JSON(400, gin.H{"error": err.Error()}); return }
	c.JSON(201, u)
}

func (h *Handler) update(c *gin.Context) {
	var in User
	if err := c.BindJSON(&in); err != nil {
		c.JSON(400, gin.H{"error":"bad json"}); return
	}
	u, err := h.svc.Update(c.Request.Context(), c.Param("id"), in)
	if err != nil { c.JSON(400, gin.H{"error": err.Error()}); return }
	c.JSON(200, u)
}

func (h *Handler) delete(c *gin.Context) {
	if err := h.svc.Delete(c.Request.Context(), c.Param("id")); err != nil {
		c.JSON(400, gin.H{"error": err.Error()}); return
	}
	c.Status(204)
}
