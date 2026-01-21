package product

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
	"github.com/Perpasit/Capstone-KMALL/internal/middleware"
	"github.com/Perpasit/Capstone-KMALL/internal/respond"
	"github.com/Perpasit/Capstone-KMALL/internal/searchhistory"
	"github.com/Perpasit/Capstone-KMALL/internal/store"
	"github.com/Perpasit/Capstone-KMALL/internal/user"
)

// ===== Handler =====

type Handler struct {
	svc      Service
	storeSvc store.Service
	roleSvc  middleware.RoleNameLister
	userSvc  user.Service
	shSvc    searchhistory.Service
}

func NewHandler(s Service, ss store.Service, rl middleware.RoleNameLister, us user.Service, sh searchhistory.Service) *Handler {
	return &Handler{
		svc:      s,
		storeSvc: ss,
		roleSvc:  rl,
		userSvc:  us,
		shSvc:    sh,
	}
}

func (h *Handler) Register(r *gin.RouterGroup) {
	// /api/products
	pg := r.Group("/products")

	// ----- Public -----
	pg.GET("/public", h.listPublic)
	pg.GET("/suggest", h.suggest)
	pg.GET("/:id/public", h.getPublic)

	// ----- Seller/Admin (product-level) -----
	productOwner := pg.Group("", middleware.RequireRolesAny(h.roleSvc, "Seller", "Admin"))
	{
		productOwner.POST("", h.create)
		productOwner.GET("/:id", h.get)
		productOwner.PUT("/:id", h.update)
		productOwner.DELETE("/:id", h.delete)
	}

	// /api/stores/:id/products
	sg := r.Group("/stores")
	storeOwner := sg.Group("", middleware.RequireRolesAny(h.roleSvc, "Seller", "Admin"))
	{
		storeOwner.GET("/:id/products", h.listByStore)
	}
}

// ===== DTOs =====

type createReq struct {
	Name        string  `json:"name"        binding:"required"`
	Description *string `json:"description"`
	Price       float64 `json:"price"       binding:"required"`
	ImageURL    *string `json:"image_url"`
	IsActive    string  `json:"is_active"`
	StoreID     int     `json:"store_id"   binding:"required"`
	CategoryID  int     `json:"category_id" binding:"required"`
}

type updateReq struct {
	Name        *string  `json:"name"`
	Description *string  `json:"description"`
	Price       *float64 `json:"price"`
	ImageURL    *string  `json:"image_url"`
	IsActive    *string  `json:"is_active"`
	CategoryID  *int     `json:"category_id"`
}

// ===== Helpers =====

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

func parseInt64Query(c *gin.Context, key string) *int64 {
	val := strings.TrimSpace(c.Query(key))
	if val == "" {
		return nil
	}
	id, err := strconv.ParseInt(val, 10, 64)
	if err != nil || id <= 0 {
		return nil
	}
	return &id
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

// 2.1 POST /api/products (Seller/Admin)
func (h *Handler) create(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c, false)
	if !ok {
		return
	}

	var in createReq
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	storeID := int64(in.StoreID)
	if !h.isStoreOwnerOrAdmin(c, storeID, userID) {
		if len(c.Errors) == 0 {
			respond.Error(c, http.StatusForbidden, "FORBIDDEN", "only owner or admin can create products in this store", nil)
		}
		return
	}

	p, err := h.svc.Create(c.Request.Context(), CreateInput(in))
	if err != nil {
		c.Error(err)
		return
	}
	respond.Created(c, apperr.Created, p)
}

// 2.2 GET /api/stores/:storeID/products (Seller/Admin)
func (h *Handler) listByStore(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c, false)
	if !ok {
		return
	}

	storeID, ok := parseID(c, "id")
	if !ok {
		return
	}

	if !h.isStoreOwnerOrAdmin(c, storeID, userID) {
		if len(c.Errors) == 0 {
			respond.Error(c, http.StatusForbidden, "FORBIDDEN", "only owner or admin can list products in this store", nil)
		}
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))

	if limit <= 0 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}

	items, total, err := h.svc.ListByStoreID(
		c.Request.Context(),
		storeID,
		limit,
		page,
	)
	if err != nil {
		c.Error(err)
		return
	}
	if items == nil {
		items = []Product{}
	}

	resp := struct {
		PageSize  int       `json:"pageSize"`
		PageIndex int       `json:"pageIndex"`
		Total     int64     `json:"total"`
		Items     []Product `json:"items"`
	}{
		PageSize:  limit,
		PageIndex: page,
		Total:     total,
		Items:     items,
	}

	respond.OK(c, apperr.OK, resp)
}

// 2.3 GET /api/products/:id (Owner/Admin)
func (h *Handler) get(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c, false)
	if !ok {
		return
	}

	id, ok := parseID(c, "id")
	if !ok {
		return
	}

	p, err := h.svc.Get(c.Request.Context(), id)
	if err != nil {
		c.Error(err)
		return
	}

	if !h.isStoreOwnerOrAdmin(c, int64(p.StoreID), userID) {
		if len(c.Errors) == 0 {
			respond.Error(c, http.StatusForbidden, "FORBIDDEN", "only owner or admin can view this product", nil)
		}
		return
	}

	respond.OK(c, apperr.OK, p)
}

// 2.4 PUT /api/products/:id (Owner/Admin)
func (h *Handler) update(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c, false)
	if !ok {
		return
	}

	id, ok := parseID(c, "id")
	if !ok {
		return
	}

	p, err := h.svc.Get(c.Request.Context(), id)
	if err != nil {
		c.Error(err)
		return
	}

	if !h.isStoreOwnerOrAdmin(c, int64(p.StoreID), userID) {
		if len(c.Errors) == 0 {
			respond.Error(c, http.StatusForbidden, "FORBIDDEN", "only owner or admin can update this product", nil)
		}
		return
	}

	var in updateReq
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	up, err := h.svc.Update(c.Request.Context(), id, UpdateInput(in))
	if err != nil {
		c.Error(err)
		return
	}
	respond.Updated(c, apperr.Updated, up)
}

// 2.5 DELETE /api/products/:id (Owner/Admin) - hard delete (ใช้ repo.Delete)
func (h *Handler) delete(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c, false)
	if !ok {
		return
	}

	id, ok := parseID(c, "id")
	if !ok {
		return
	}

	p, err := h.svc.Get(c.Request.Context(), id)
	if err != nil {
		c.Error(err)
		return
	}

	if !h.isStoreOwnerOrAdmin(c, int64(p.StoreID), userID) {
		if len(c.Errors) == 0 {
			respond.Error(c, http.StatusForbidden, "FORBIDDEN", "only owner or admin can delete this product", nil)
		}
		return
	}

	if err := h.svc.Delete(c.Request.Context(), id); err != nil {
		c.Error(err)
		return
	}
	respond.Deleted(c, apperr.Deleted, gin.H{"deleted": true})
}

// 3.1 GET /api/products/public (Buyer/Public)
func (h *Handler) listPublic(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	categoryIDs := parseInt64ListQuery(c, "category_id")
	storeID := parseInt64Query(c, "store_id")
	parentCategoryID := parseInt64Query(c, "parent_category_id")

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))

	priceSort := strings.ToLower(strings.TrimSpace(c.Query("price")))

	items, total, err := h.svc.ListPublic(
		c.Request.Context(),
		q,
		categoryIDs,
		parentCategoryID,
		storeID,
		limit,
		page,
		priceSort,
	)
	if err != nil {
		c.Error(err)
		return
	}

	if items == nil {
		items = []Product{}
	}

	if q != "" {
		userID, ok := h.resolveCurrentUserID(c, true)
		if ok {
			_, _ = h.shSvc.Create(c.Request.Context(), userID, q)

		}
	}

	resp := struct {
		PageSize  int       `json:"pageSize"`
		PageIndex int       `json:"pageIndex"`
		Total     int64     `json:"total"`
		Items     []Product `json:"items"`
	}{
		PageSize:  limit,
		PageIndex: page,
		Total:     total,
		Items:     items,
	}

	respond.OK(c, apperr.OK, resp)
}

// 3.2 GET /api/products/:id/public
func (h *Handler) getPublic(c *gin.Context) {
	id, ok := parseID(c, "id")
	if !ok {
		return
	}

	p, err := h.svc.GetPublic(c.Request.Context(), id)
	if err != nil {
		c.Error(err)
		return
	}
	respond.OK(c, apperr.OK, p)
}

func parseInt64ListQuery(c *gin.Context, key string) []int64 {
	vals := c.QueryArray(key) // รองรับ ?category_id=4&category_id=5
	if len(vals) == 0 {
		return nil
	}

	res := make([]int64, 0, len(vals))
	for _, v := range vals {
		v = strings.TrimSpace(v)
		if v == "" {
			continue
		}
		id, err := strconv.ParseInt(v, 10, 64)
		if err != nil || id <= 0 {
			continue
		}
		res = append(res, id)
	}
	if len(res) == 0 {
		return nil
	}
	return res
}

// GET /api/products/suggest?q=po&limit=10
func (h *Handler) suggest(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	if limit <= 0 {
		limit = 10
	}
	if limit > 20 {
		limit = 20
	}

	items, err := h.svc.Suggest(c.Request.Context(), q, limit)
	if err != nil {
		c.Error(err)
		return
	}
	if items == nil {
		items = []string{}
	}

	respond.OK(c, apperr.OK, gin.H{"items": items})
}
