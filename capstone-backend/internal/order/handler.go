package order

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
	"github.com/Perpasit/Capstone-KMALL/internal/middleware"
	"github.com/Perpasit/Capstone-KMALL/internal/notification"
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
	notiSvc  notification.Service
}

func NewHandler(
	s Service,
	rl middleware.RoleNameLister,
	us user.Service,
	ss store.Service,
	noti notification.Service,
) *Handler {
	return &Handler{
		svc:      s,
		roleSvc:  rl,
		userSvc:  us,
		storeSvc: ss,
		notiSvc:  noti,
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
			sellerAdmin.PUT("/:id/propose", h.propose)
		}

		// ยกเลิกออเดอร์ (Buyer/Admin)
		g.POST("/:id/cancel", h.cancelOrder)
		g.POST("/:id/accept", h.acceptProposed)

	}

	// ===== Seller Order Management (ตามร้าน) =====
	// /api/stores/:id/orders
	sg := r.Group("/stores/:id", middleware.RequireRolesAny(h.roleSvc, "Seller", "Admin"))
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
	FulfillmentType   string   `json:"fulfillment_type"`
	DepositAmount     *float64 `json:"deposit_amount,omitempty"`
	DeliveryMethod    string   `json:"delivery_method"`
	DeliveryAddressID *int64   `json:"delivery_address_id,omitempty"`
	CampusLocationID  *int     `json:"campus_location_id,omitempty"`
	CampusDetailNote  *string  `json:"campus_detail_note,omitempty"`
}

type statusUpdateReq struct {
	Status string `json:"status"`
}

type orderBuyerDTO struct {
	ID          string `json:"id"`
	DisplayName string `json:"display_name"`
	Email       string `json:"email"`
}

type orderDetailResp struct {
	Order           Order                  `json:"order"`
	Items           []OrderItemWithProduct `json:"items"`
	StoreName       string                 `json:"store_name"`
	StoreProfileURL *string                `json:"store_profile_url,omitempty"`
	SellerName      string                 `json:"seller_name"`
	SellerUserID    string                 `json:"seller_user_id"`
	BuyerName       string                 `json:"buyer_name"`
	Buyer           *orderBuyerDTO         `json:"buyer,omitempty"`
}

type buyerOrderDTO struct {
	Order     Order  `json:"order"`
	StoreName string `json:"store_name"`
}

type storeOrderDTO struct {
	Order            Order  `json:"order"`
	BuyerID          string `json:"buyer_id"`
	BuyerDisplayName string `json:"buyer_display_name"`
	BuyerEmail       string `json:"buyer_email"`
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
		FulfillmentType:   in.FulfillmentType,
		DepositAmount:     in.DepositAmount,
		DeliveryMethod:    in.DeliveryMethod,
		DeliveryAddressID: in.DeliveryAddressID,
		CampusLocationID:  in.CampusLocationID,
		CampusDetailNote:  in.CampusDetailNote,
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

	ctx := c.Request.Context()

	result, err := h.svc.GetOrderWithItems(ctx, id)
	if err != nil {
		c.Error(err)
		return
	}

	order := result.Order

	isBuyer := order.UserID == userID
	isAdmin := h.isAdmin(c, userID)

	isStoreOwner := false
	if !isBuyer && !isAdmin {
		isStoreOwner = h.isStoreOwnerOrAdmin(c, int64(order.StoreID), userID)
	}

	if !isBuyer && !isAdmin && !isStoreOwner {
		c.Error(apperr.New(
			apperr.Forbidden,
			"only buyer, store owner or admin can view this order",
		))
		return
	}

	if h.notiSvc != nil {
		_, _ = h.notiSvc.MarkReadByOrder(
			ctx,
			userID,
			id,
			[]string{"ORDER_STATUS_CHANGED"},
		)
	}

	st, err := h.storeSvc.Get(ctx, int64(order.StoreID))
	if err != nil {
		c.Error(err)
		return
	}

	sellerUser, err := h.userSvc.Get(ctx, st.UserID.String())
	if err != nil {
		c.Error(err)
		return
	}

	buyerUser, err := h.userSvc.Get(ctx, order.UserID)
	if err != nil {
		c.Error(err)
		return
	}

	var buyerDTO *orderBuyerDTO
	if isStoreOwner || isAdmin {
		buyerDTO = &orderBuyerDTO{
			ID:          buyerUser.ID,
			DisplayName: buyerUser.DisplayName,
			Email:       buyerUser.Email,
		}
	}

	resp := orderDetailResp{
		Order:           result.Order,
		Items:           result.Items,
		StoreName:       st.Name,
		StoreProfileURL: st.ProfileURL,
		SellerName:      sellerUser.DisplayName,
		SellerUserID:    sellerUser.ID,
		BuyerName:       buyerUser.DisplayName,
		Buyer:           buyerDTO,
	}

	respond.OK(c, apperr.OK, resp)
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

	updated, err := h.svc.UpdateStatus(c.Request.Context(), userID, id, OrderStatusUpdateInput(in))
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

	var in CancelOrderInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	cancelled, err := h.svc.Cancel(c.Request.Context(), userID, id, in.Reason)
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
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	q := strings.TrimSpace(c.Query("q"))

	orders, total, err := h.svc.ListBuyerOrders(c.Request.Context(), userID, statusGroup, q, limit, page)

	if err != nil {
		c.Error(err)
		return
	}

	ctx := c.Request.Context()
	storeNameCache := make(map[int]string)
	items := make([]buyerOrderDTO, 0, len(orders))

	for _, o := range orders {
		name, ok := storeNameCache[o.StoreID]
		if !ok {
			st, err := h.storeSvc.Get(ctx, int64(o.StoreID))
			if err != nil {
				c.Error(err)
				return
			}
			name = st.Name
			storeNameCache[o.StoreID] = name
		}
		items = append(items, buyerOrderDTO{Order: o, StoreName: name})
	}

	respond.OK(c, apperr.OK, gin.H{
		"page_size":  limit,
		"page_index": page,
		"total":      total,
		"items":      items,
	})
}

func (h *Handler) listStoreOrders(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c)
	if !ok {
		return
	}

	storeID, ok := parsePathID(c, "id")
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
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	q := strings.TrimSpace(c.Query("q"))

	orders, total, err := h.svc.ListStoreOrders(c.Request.Context(), storeID, statusGroup, q, limit, page)
	if err != nil {
		c.Error(err)
		return
	}

	ctx := c.Request.Context()
	buyerCache := make(map[string]user.User)
	items := make([]storeOrderDTO, 0, len(orders))

	for _, o := range orders {
		u, ok := buyerCache[o.UserID]
		if !ok {
			usr, err := h.userSvc.Get(ctx, o.UserID)
			if err != nil {
				c.Error(err)
				return
			}
			u = usr
			buyerCache[o.UserID] = u
		}
		items = append(items, storeOrderDTO{
			Order:            o,
			BuyerID:          u.ID,
			BuyerDisplayName: u.DisplayName,
			BuyerEmail:       u.Email,
		})
	}

	respond.OK(c, apperr.OK, gin.H{
		"page_size":  limit,
		"page_index": page,
		"total":      total,
		"items":      items,
	})
}

func (h *Handler) propose(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c)
	if !ok {
		return
	}
	id, ok := parsePathID(c, "id")
	if !ok {
		return
	}

	var in ProposeSuggestInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	updated, err := h.svc.Propose(c.Request.Context(), userID, id, in)
	if err != nil {
		c.Error(err)
		return
	}

	respond.Updated(c, apperr.Updated, updated)
}
func (h *Handler) acceptProposed(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c)
	if !ok {
		return
	}
	id, ok := parsePathID(c, "id")
	if !ok {
		return
	}

	var in AcceptProposedInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	updated, err := h.svc.AcceptProposed(c.Request.Context(), userID, id, in)
	if err != nil {
		c.Error(err)
		return
	}

	respond.Updated(c, apperr.Updated, updated)
}
