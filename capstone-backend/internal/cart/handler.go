package cart

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
	g := r.Group("/cart", middleware.RequireRolesAny(h.roleSvc, "Buyer", "Admin"))
	{
		g.GET("", h.getCart)
		g.POST("/items", h.addItem)
		g.PUT("/items/:itemID", h.updateItem)
		g.DELETE("/items/:itemID", h.deleteItem)

		g.DELETE("", h.clearCart)
	}
}

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

// ensure user exists + ensure role Buyer
func (h *Handler) currentUserID(c *gin.Context) (string, bool) {
	up, ok := c.Get(middleware.CtxUpstreamUser)
	if !ok {
		respond.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "missing upstream user", nil)
		return "", false
	}
	uu := up.(*middleware.UpstreamUser)

	// Upsert user + ensure role Buyer
	u, err := h.userSvc.UpsertAndEnsureBuyer(c.Request.Context(), uu.UID, uu.Email, uu.Name)
	if err != nil {
		c.Error(err)
		return "", false
	}

	return u.ID, true
}

// ============================================================================
// GET /api/cart
// ============================================================================
func (h *Handler) getCart(c *gin.Context) {
	userID, ok := h.currentUserID(c)
	if !ok {
		return
	}

	cw, err := h.svc.GetCart(c.Request.Context(), userID)
	if err != nil {
		c.Error(err)
		return
	}

	// ===== อ่าน query สำหรับ pagination =====
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))

	if limit <= 0 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}

	total := len(cw.Items)
	offset := (page - 1) * limit
	if offset > total {
		offset = total
	}
	end := offset + limit
	if end > total {
		end = total
	}

	itemsPage := cw.Items[offset:end]

	// ===== รูปแบบ response ให้เหมือน listPublic =====
	resp := struct {
		Cart      Cart       `json:"cart"`
		PageSize  int        `json:"pageSize"`
		PageIndex int        `json:"pageIndex"`
		Total     int64      `json:"total"`
		Items     []CartItem `json:"items"`
	}{
		Cart:      cw.Cart,
		PageSize:  limit,
		PageIndex: page,
		Total:     int64(total),
		Items:     itemsPage,
	}

	respond.OK(c, apperr.OK, resp)
}

// ============================================================================
// POST /api/cart/items
// ============================================================================
type addItemReq struct {
	ProductID int `json:"product_id" binding:"required"`
	Quantity  int `json:"quantity" binding:"required"`
}

func (h *Handler) addItem(c *gin.Context) {
	userID, ok := h.currentUserID(c)
	if !ok {
		return
	}

	var in addItemReq
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	item, err := h.svc.AddItem(c.Request.Context(), userID, CartItemCreateInput(in))

	if err != nil {
		c.Error(err)
		return
	}

	respond.Created(c, apperr.Created, item)
}

// ============================================================================
// PUT /api/cart/items/:itemID
// ============================================================================
type updateItemReq struct {
	Quantity int `json:"quantity" binding:"required"`
}

func (h *Handler) updateItem(c *gin.Context) {
	userID, ok := h.currentUserID(c)
	if !ok {
		return
	}

	itemID, ok := parsePathID(c, "itemID")
	if !ok {
		return
	}

	var in updateItemReq
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	updated, err := h.svc.UpdateItem(c.Request.Context(), userID, itemID,
		CartItemUpdateInput{Quantity: &in.Quantity},
	)
	if err != nil {
		c.Error(err)
		return
	}

	respond.Updated(c, apperr.Updated, updated)
}

// ============================================================================
// DELETE /api/cart/items/:itemID
// ============================================================================
func (h *Handler) deleteItem(c *gin.Context) {
	userID, ok := h.currentUserID(c)
	if !ok {
		return
	}

	itemID, ok := parsePathID(c, "itemID")
	if !ok {
		return
	}

	if err := h.svc.DeleteItem(c.Request.Context(), userID, itemID); err != nil {
		c.Error(err)
		return
	}

	respond.Deleted(c, apperr.Deleted, gin.H{"deleted": true})
}

// ============================================================================
// DELETE /api/cart   → clear cart
// ============================================================================
func (h *Handler) clearCart(c *gin.Context) {
	userID, ok := h.currentUserID(c)
	if !ok {
		return
	}

	cart, err := h.svc.GetCart(c.Request.Context(), userID)
	if err != nil {
		c.Error(err)
		return
	}

	for _, it := range cart.Items {
		_ = h.svc.DeleteItem(c.Request.Context(), userID, int64(it.ID))
	}

	respond.Deleted(c, apperr.Deleted, gin.H{"cleared": true})
}
