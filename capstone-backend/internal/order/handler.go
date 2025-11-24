package order

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
	"github.com/Perpasit/Capstone-KMALL/internal/middleware"
	"github.com/Perpasit/Capstone-KMALL/internal/respond"
	"github.com/Perpasit/Capstone-KMALL/internal/store"
	"github.com/Perpasit/Capstone-KMALL/internal/user"
)

// ============================================================================
// Handler
// ============================================================================

type Handler struct {
	svc      Service
	roleSvc  middleware.RoleNameLister
	userSvc  user.Service
	storeSvc store.Service
}

func NewHandler(
	s Service,
	rl middleware.RoleNameLister,
	us user.Service,
	ss store.Service,
) *Handler {
	return &Handler{
		svc:      s,
		roleSvc:  rl,
		userSvc:  us,
		storeSvc: ss,
	}
}

func (h *Handler) Register(r *gin.RouterGroup) {
	// ===== Buyer Order (History + Detail + Cancel) =====
	// /api/orders
	g := r.Group("/orders")
	{
		// Buyer history
		g.GET("", h.listBuyerOrders) // GET /api/orders?status_group=active|completed|cancelled

		// ดูรายละเอียด order
		g.GET("/:id", h.getOrder)

		// เปลี่ยนสถานะ (Seller/Admin)
		sellerAdmin := g.Group("", middleware.RequireRolesAny(h.roleSvc, "Seller", "Admin"))
		{
			sellerAdmin.PUT("/:id/status", h.updateStatus)
		}

		// ยกเลิกออเดอร์ (Buyer/Admin)
		g.POST("/:id/cancel", h.cancelOrder)
	}

	// ===== Seller Order Management (ตามร้าน) =====
	// /api/stores/:storeID/orders
	sg := r.Group("/stores/:storeID", middleware.RequireRolesAny(h.roleSvc, "Seller", "Admin"))
	{
		sg.GET("/orders", h.listStoreOrders)
	}

	// ===== Checkout =====
	cg := r.Group("/checkout")
	{
		cg.POST("/confirm", h.createFromCart)
	}
}

// ============================================================================
// Request DTOs
// ============================================================================

type checkoutConfirmReq struct {
	FulfillmentType  string   `json:"fulfillment_type"`
	PromisedShipDate *string  `json:"promised_ship_date,omitempty"`
	DepositAmount    *float64 `json:"deposit_amount,omitempty"`
}

type statusUpdateReq struct {
	Status string `json:"status"`
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
		respond.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "missing upstream user", nil)
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

func (h *Handler) isStoreOwnerOrAdmin(c *gin.Context, storeID int64, userID string) bool {
	if h.isAdmin(c, userID) {
		return true
	}
	st, err := h.storeSvc.Get(c.Request.Context(), storeID)
	if err != nil {
		c.Error(err)
		return false
	}
	if strings.EqualFold(st.UserID.String(), userID) {
		return true
	}
	return false
}

func canBuyerCancel(status string) bool {
	switch status {
	case "Pending Seller Confirmation",
		"Awaiting Buyer Confirmation":
		return true
	default:
		return false
	}
}

func canSellerCancel(status string) bool {
	switch status {
	case "Pending Seller Confirmation",
		"Awaiting Buyer Confirmation",
		"Ready for Pickup",
		"Ready for Delivery":
		return true
	default:
		return false
	}
}

// ============================================================================
// Handlers
// ============================================================================

func (h *Handler) createFromCart(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c)
	if !ok {
		return
	}

	var in checkoutConfirmReq
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	svcIn := CheckoutConfirmInput{
		FulfillmentType: in.FulfillmentType,
		DepositAmount:   in.DepositAmount,
	}

	result, err := h.svc.CreateFromCart(c.Request.Context(), userID, svcIn)
	if err != nil {
		c.Error(err)
		return
	}

	respond.Created(c, apperr.Created, result)
}

func (h *Handler) getOrder(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c)
	if !ok {
		return
	}

	id, ok := parsePathID(c, "id")
	if !ok {
		return
	}

	result, err := h.svc.GetOrderWithItems(c.Request.Context(), id)
	if err != nil {
		c.Error(err)
		return
	}

	if result.Order.UserID != userID && !h.isAdmin(c, userID) {
		if len(c.Errors) == 0 {
			respond.Error(c, http.StatusForbidden, "FORBIDDEN", "not allowed to view this order", nil)
		}
		return
	}

	respond.OK(c, apperr.OK, result)
}

func (h *Handler) updateStatus(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c)
	if !ok {
		return
	}

	id, ok := parsePathID(c, "id")
	if !ok {
		return
	}

	ordWithItems, err := h.svc.GetOrderWithItems(c.Request.Context(), id)
	if err != nil {
		c.Error(err)
		return
	}

	if !h.isStoreOwnerOrAdmin(c, int64(ordWithItems.Order.StoreID), userID) {
		if len(c.Errors) == 0 {
			respond.Error(c, http.StatusForbidden, "FORBIDDEN", "only store owner or admin can update order status", nil)
		}
		return
	}

	var in statusUpdateReq
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	updated, err := h.svc.UpdateStatus(c.Request.Context(), id, OrderStatusUpdateInput(in))
	if err != nil {
		c.Error(err)
		return
	}

	respond.Updated(c, apperr.Updated, updated)
}

func (h *Handler) cancelOrder(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c)
	if !ok {
		return
	}

	id, ok := parsePathID(c, "id")
	if !ok {
		return
	}

	ordWithItems, err := h.svc.GetOrderWithItems(c.Request.Context(), id)
	if err != nil {
		c.Error(err)
		return
	}

	order := ordWithItems.Order

	isBuyer := order.UserID == userID
	isSeller := h.isStoreOwnerOrAdmin(c, int64(order.StoreID), userID)
	isAdmin := h.isAdmin(c, userID)

	// ----- สิทธิ์ว่าใครยกเลิกได้บ้าง -----
	if !isBuyer && !isSeller && !isAdmin {
		if len(c.Errors) == 0 {
			respond.Error(c, http.StatusForbidden, "FORBIDDEN", "only buyer, store owner or admin can cancel this order", nil)
		}
		return
	}

	status := order.Status

	// ----- เช็คตามบทบาทแต่ละฝั่ง -----
	switch {
	case isAdmin:
		// admin ห้ามยกเลิกถ้า complete หรือ cancel แล้ว
		if status == "Completed" || status == "Cancelled" {
			if len(c.Errors) == 0 {
				respond.Error(c, http.StatusBadRequest, "INVALID_STATUS", "cannot cancel completed or already cancelled order", nil)
			}
			return
		}

	case isBuyer:
		if !canBuyerCancel(status) {
			if len(c.Errors) == 0 {
				respond.Error(c, http.StatusBadRequest, "INVALID_STATUS", "buyer cannot cancel at this stage", nil)
			}
			return
		}

	case isSeller:
		if !canSellerCancel(status) {
			if len(c.Errors) == 0 {
				respond.Error(c, http.StatusBadRequest, "INVALID_STATUS", "seller cannot cancel at this stage", nil)
			}
			return
		}
	}

	// ----- cancel จริง -----
	cancelled, err := h.svc.Cancel(c.Request.Context(), id)
	if err != nil {
		c.Error(err)
		return
	}

	respond.OK(c, apperr.OK, cancelled)
}

func (h *Handler) listBuyerOrders(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c)
	if !ok {
		return
	}

	statusGroup := strings.ToLower(strings.TrimSpace(c.Query("status_group")))
	orders, err := h.svc.ListBuyerOrders(c.Request.Context(), userID, statusGroup)
	if err != nil {
		c.Error(err)
		return
	}

	respond.OK(c, apperr.OK, orders)
}

func (h *Handler) listStoreOrders(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c)
	if !ok {
		return
	}

	storeID, ok := parsePathID(c, "storeID")
	if !ok {
		return
	}

	if !h.isStoreOwnerOrAdmin(c, storeID, userID) {
		if len(c.Errors) == 0 {
			respond.Error(c, http.StatusForbidden, "FORBIDDEN", "only store owner or admin can view store orders", nil)
		}
		return
	}

	statusGroup := strings.ToLower(strings.TrimSpace(c.Query("status_group")))

	orders, err := h.svc.ListStoreOrders(c.Request.Context(), storeID, statusGroup)
	if err != nil {
		c.Error(err)
		return
	}

	respond.OK(c, apperr.OK, orders)
}
