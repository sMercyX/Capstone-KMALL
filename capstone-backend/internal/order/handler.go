package order

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
	"github.com/Perpasit/Capstone-KMALL/internal/middleware"
	"github.com/Perpasit/Capstone-KMALL/internal/product"
	"github.com/Perpasit/Capstone-KMALL/internal/respond"
	"github.com/Perpasit/Capstone-KMALL/internal/store"
	"github.com/Perpasit/Capstone-KMALL/internal/user"
)

// ===== Handler =====

type Handler struct {
	svc        Service
	storeSvc   store.Service
	productSvc product.Service
	roleSvc    middleware.RoleNameLister
	userSvc    user.Service
}

func NewHandler(
	s Service,
	ss store.Service,
	ps product.Service,
	rl middleware.RoleNameLister,
	us user.Service,
) *Handler {
	return &Handler{
		svc:        s,
		storeSvc:   ss,
		productSvc: ps,
		roleSvc:    rl,
		userSvc:    us,
	}
}

func (h *Handler) Register(r *gin.RouterGroup) {
	g := r.Group("/orders")

	buyer := g.Group("", middleware.RequireRolesAny(h.roleSvc, "Buyer"))
	{
		buyer.POST("", h.createOrder)
		buyer.POST("/:id/cancel", h.cancelOrder)
	}

	view := g.Group("", middleware.RequireRolesAny(h.roleSvc, "Buyer", "Seller", "Admin"))
	{
		view.GET("/:id", h.getOrder)
	}

	sellerAdmin := g.Group("", middleware.RequireRolesAny(h.roleSvc, "Seller", "Admin"))
	{
		sellerAdmin.PUT("/:id/status", h.updateStatus)
	}
}

// ===== Request DTOs =====

type orderItemReq struct {
	ProductID       int    `json:"product_id" binding:"required"`
	Quantity        int    `json:"quantity" binding:"required"`
	FulfillmentType string `json:"fulfillment_type"` // OPTIONAL: STANDARD / EXPRESS
}

type createOrderReq struct {
	StoreID int            `json:"store_id" binding:"required"`
	Items   []orderItemReq `json:"items" binding:"required"`
}

type updateStatusReq struct {
	Status string `json:"status" binding:"required"`
}

// ===== Helpers =====

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

func (h *Handler) canViewOrder(c *gin.Context, userID string, ord Order) bool {
	if h.isAdmin(c, userID) {
		return true
	}
	if strings.EqualFold(ord.UserID, userID) {
		return true
	}
	st, err := h.storeSvc.Get(c.Request.Context(), int64(ord.StoreID))
	if err != nil {
		c.Error(err)
		return false
	}
	if strings.EqualFold(st.UserID.String(), userID) {
		return true
	}
	return false
}

func (h *Handler) canUpdateStatus(c *gin.Context, userID string, ord Order) bool {
	if h.isAdmin(c, userID) {
		return true
	}
	st, err := h.storeSvc.Get(c.Request.Context(), int64(ord.StoreID))
	if err != nil {
		c.Error(err)
		return false
	}
	return strings.EqualFold(st.UserID.String(), userID)
}

// buyer เจ้าของ order หรือ admin → ใช้สำหรับ cancel
func (h *Handler) canCancelOrder(c *gin.Context, userID string, ord Order) bool {
	if h.isAdmin(c, userID) {
		return true
	}
	return strings.EqualFold(ord.UserID, userID)
}

// ============================================================================
// Handlers
// ============================================================================

// POST /api/orders
func (h *Handler) createOrder(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c, false)
	if !ok {
		return
	}

	var in createOrderReq
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}
	if len(in.Items) == 0 {
		c.Error(apperr.New(apperr.BadRequest, "items must not be empty"))
		return
	}

	ctx := c.Request.Context()

	orderIn := OrderCreateInput{
		StoreID: in.StoreID,
		Items:   make([]OrderItemCreateInput, 0, len(in.Items)),
	}

	for _, it := range in.Items {
		p, err := h.productSvc.Get(ctx, int64(it.ProductID))
		if err != nil {
			c.Error(err)
			return
		}
		if p.StoreID != in.StoreID {
			c.Error(apperr.New(apperr.BadRequest, "product does not belong to this store"))
			return
		}

		ft := strings.TrimSpace(it.FulfillmentType)
		if ft == "" {
			ft = "STANDARD"
		}

		orderIn.Items = append(orderIn.Items, OrderItemCreateInput{
			ProductID:        it.ProductID,
			Quantity:         it.Quantity,
			UnitPrice:        p.Price,
			FulfillmentType:  ft,
			DepositAmount:    nil,
			PromisedShipDate: nil,
		})
	}

	ow, err := h.svc.Create(ctx, userID, orderIn)
	if err != nil {
		c.Error(err)
		return
	}

	respond.Created(c, apperr.Created, ow)
}

// GET /api/orders/:id
func (h *Handler) getOrder(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c, false)
	if !ok {
		return
	}

	orderID, ok := parsePathID(c, "id")
	if !ok {
		return
	}

	ow, err := h.svc.GetWithItems(c.Request.Context(), orderID)
	if err != nil {
		c.Error(err)
		return
	}

	if !h.canViewOrder(c, userID, ow.Order) {
		if len(c.Errors) == 0 {
			respond.Error(c, http.StatusForbidden, "FORBIDDEN", "not allowed to view this order", nil)
		}
		return
	}

	respond.OK(c, apperr.OK, ow)
}

// PUT /api/orders/:id/status
func (h *Handler) updateStatus(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c, false)
	if !ok {
		return
	}

	orderID, ok := parsePathID(c, "id")
	if !ok {
		return
	}

	ow, err := h.svc.GetWithItems(c.Request.Context(), orderID)
	if err != nil {
		c.Error(err)
		return
	}

	if !h.canUpdateStatus(c, userID, ow.Order) {
		if len(c.Errors) == 0 {
			respond.Error(c, http.StatusForbidden, "FORBIDDEN", "only store owner or admin can update status", nil)
		}
		return
	}

	var in updateStatusReq
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	status := OrderStatus(strings.TrimSpace(in.Status))
	updated, err := h.svc.UpdateStatus(c.Request.Context(), orderID, status)
	if err != nil {
		c.Error(err)
		return
	}

	respond.Updated(c, apperr.Updated, updated)
}

// POST /api/orders/:id/cancel
func (h *Handler) cancelOrder(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c, false)
	if !ok {
		return
	}

	orderID, ok := parsePathID(c, "id")
	if !ok {
		return
	}

	ow, err := h.svc.GetWithItems(c.Request.Context(), orderID)
	if err != nil {
		c.Error(err)
		return
	}

	if !h.canCancelOrder(c, userID, ow.Order) {
		if len(c.Errors) == 0 {
			respond.Error(c, http.StatusForbidden, "FORBIDDEN", "only buyer or admin can cancel this order", nil)
		}
		return
	}

	updated, err := h.svc.Cancel(c.Request.Context(), orderID)
	if err != nil {
		c.Error(err)
		return
	}

	respond.Updated(c, apperr.Updated, updated)
}
