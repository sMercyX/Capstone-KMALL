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
	return &Handler{svc: s, storeSvc: ss, roleSvc: rl, userSvc: us, shSvc: sh}
}

func (h *Handler) Register(r *gin.RouterGroup) {
	pg := r.Group("/products")

	// ===== Public =====
	pg.GET("/public", h.listPublic)
	pg.GET("/suggest", h.suggest)
	pg.GET("/:id/public", h.getPublic)
	pg.GET("/:id/options", h.listOptions)   // buyer ดู options + values
	pg.GET("/:id/variants", h.listVariants) // buyer ดู variants + stock

	// ===== Seller / Admin =====
	auth := pg.Group("", middleware.RequireRolesAny(h.roleSvc, "Seller", "Admin"))
	{
		// Product CRUD
		auth.POST("", h.create)
		auth.GET("/:id", h.get)
		auth.PUT("/:id", h.update)
		auth.DELETE("/:id", h.delete)

		// Option keys
		auth.POST("/:id/options", h.createOptionKey)
		auth.DELETE("/:id/options/:keyId", h.deleteOptionKey)

		// Option values
		auth.POST("/:id/options/:keyId/values", h.createOptionValue)
		auth.DELETE("/:id/options/:keyId/values/:valueId", h.deleteOptionValue)

		// Variants
		auth.POST("/:id/variants", h.createVariant)
		auth.PATCH("/:id/variants/:variantId/stock", h.updateVariantStock)
		auth.DELETE("/:id/variants/:variantId", h.deleteVariant)
	}

	// /api/stores/:id/products
	sg := r.Group("/stores")
	storeAuth := sg.Group("", middleware.RequireRolesAny(h.roleSvc, "Seller", "Admin"))
	{
		storeAuth.GET("/:id/products", h.listByStore)
	}
}

// ===== DTOs =====

type createReq struct {
	Name        string                  `json:"name"         binding:"required"`
	Description *string                 `json:"description"`
	Price       float64                 `json:"price"        binding:"required"`
	ImageURL    *string                 `json:"image_url"`
	IsActive    string                  `json:"is_active"`
	ProductType string                  `json:"product_type"`
	StoreID     int                     `json:"store_id"     binding:"required"`
	CategoryID  int                     `json:"category_id"  binding:"required"`
	Options     []createOptionKeyInline `json:"options"`
}
type updateReq struct {
	Name        *string  `json:"name"`
	Description *string  `json:"description"`
	Price       *float64 `json:"price"`
	ImageURL    *string  `json:"image_url"`
	IsActive    *string  `json:"is_active"`
	CategoryID  *int     `json:"category_id"`
}

type createOptionKeyReq struct {
	KeyName   string `json:"key_name" binding:"required"`
	SortOrder int    `json:"sort_order"`
}

type createOptionValueReq struct {
	ValueLabel string `json:"value_label" binding:"required"`
	SortOrder  int    `json:"sort_order"`
}

type createVariantReq struct {
	PriceDelta   float64 `json:"price_delta"`
	StockQty     int     `json:"stock_qty"`
	OptionValues []int64 `json:"option_value_ids" binding:"required"`
}

type updateStockReq struct {
	StockQty int `json:"stock_qty"`
}

type createOptionValueInline struct {
	ValueLabel string `json:"value_label" binding:"required"`
	SortOrder  int    `json:"sort_order"`
}

type createOptionKeyInline struct {
	KeyName   string                    `json:"key_name" binding:"required"`
	SortOrder int                       `json:"sort_order"`
	Values    []createOptionValueInline `json:"values"`
}

type createVariantsReq struct {
	Variants []createVariantReq `json:"variants" binding:"required"`
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

func parseFloat64Query(c *gin.Context, key string) *float64 {
	val := strings.TrimSpace(c.Query(key))
	if val == "" {
		return nil
	}
	f, err := strconv.ParseFloat(val, 64)
	if err != nil {
		return nil
	}
	return &f
}

func parseInt64ListQuery(c *gin.Context, key string) []int64 {
	vals := c.QueryArray(key)
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
	return strings.EqualFold(st.UserID.String(), userID)
}

// resolveProductOwner ดึง product แล้วเช็ค ownership ในขั้นตอนเดียว
// คืน (product, userID, ok)
func (h *Handler) resolveProductOwner(c *gin.Context) (Product, string, bool) {
	userID, ok := h.resolveCurrentUserID(c, false)
	if !ok {
		return Product{}, "", false
	}
	id, ok := parseID(c, "id")
	if !ok {
		return Product{}, "", false
	}
	p, err := h.svc.Get(c.Request.Context(), id)
	if err != nil {
		c.Error(err)
		return Product{}, "", false
	}
	if !h.isStoreOwnerOrAdmin(c, int64(p.StoreID), userID) {
		if len(c.Errors) == 0 {
			respond.Error(c, http.StatusForbidden, "FORBIDDEN", "not authorized", nil)
		}
		return Product{}, "", false
	}
	return p, userID, true
}

// ===== Product CRUD =====

// POST /api/products
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

	if !h.isStoreOwnerOrAdmin(c, int64(in.StoreID), userID) {
		if len(c.Errors) == 0 {
			respond.Error(c, http.StatusForbidden, "FORBIDDEN", "only owner or admin can create products in this store", nil)
		}
		return
	}

	// แปลง options inline → service input
	opts := make([]CreateOptionKeyWithValuesInput, 0, len(in.Options))
	for _, o := range in.Options {
		vals := make([]string, 0, len(o.Values))
		for _, v := range o.Values {
			vals = append(vals, v.ValueLabel)
		}
		opts = append(opts, CreateOptionKeyWithValuesInput{
			KeyName:   o.KeyName,
			SortOrder: o.SortOrder,
			Values:    vals,
		})
	}

	p, err := h.svc.CreateWithOptions(c.Request.Context(), CreateInput{
		Name:        in.Name,
		Description: in.Description,
		Price:       in.Price,
		ImageURL:    in.ImageURL,
		IsActive:    in.IsActive,
		ProductType: in.ProductType,
		StoreID:     in.StoreID,
		CategoryID:  in.CategoryID,
	}, opts)
	if err != nil {
		c.Error(err)
		return
	}
	respond.Created(c, apperr.Created, p)
}

// GET /api/stores/:id/products
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

	items, total, err := h.svc.ListByStoreID(c.Request.Context(), storeID, strings.TrimSpace(c.Query("q")), limit, page)
	if err != nil {
		c.Error(err)
		return
	}
	if items == nil {
		items = []Product{}
	}

	respond.OK(c, apperr.OK, gin.H{
		"pageSize":  limit,
		"pageIndex": page,
		"total":     total,
		"items":     items,
	})
}

// GET /api/products/:id
func (h *Handler) get(c *gin.Context) {
	p, _, ok := h.resolveProductOwner(c)
	if !ok {
		return
	}
	respond.OK(c, apperr.OK, p)
}

// PUT /api/products/:id
func (h *Handler) update(c *gin.Context) {
	p, _, ok := h.resolveProductOwner(c)
	if !ok {
		return
	}

	var in updateReq
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	up, err := h.svc.Update(c.Request.Context(), int64(p.ID), UpdateInput(in))
	if err != nil {
		c.Error(err)
		return
	}
	respond.Updated(c, apperr.Updated, up)
}

// DELETE /api/products/:id
func (h *Handler) delete(c *gin.Context) {
	p, _, ok := h.resolveProductOwner(c)
	if !ok {
		return
	}
	if err := h.svc.Delete(c.Request.Context(), int64(p.ID)); err != nil {
		c.Error(err)
		return
	}
	respond.Deleted(c, apperr.Deleted, gin.H{"deleted": true})
}

// ===== Public =====

// GET /api/products/public
func (h *Handler) listPublic(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	categoryIDs := parseInt64ListQuery(c, "category_id")
	storeID := parseInt64Query(c, "store_id")
	parentCategoryID := parseInt64Query(c, "parent_category_id")
	fulfillment := strings.TrimSpace(c.Query("fulfillment"))
	minPrice := parseFloat64Query(c, "min_price")
	maxPrice := parseFloat64Query(c, "max_price")
	sortBy := strings.ToLower(strings.TrimSpace(c.Query("sort_by")))

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))

	items, total, maxPriceResult, err := h.svc.ListPublic(
		c.Request.Context(), q, categoryIDs, parentCategoryID, storeID,
		limit, page, sortBy, fulfillment, minPrice, maxPrice,
	)
	if err != nil {
		c.Error(err)
		return
	}
	if items == nil {
		items = []Product{}
	}

	if q != "" {
		if userID, ok := h.resolveCurrentUserID(c, true); ok {
			_, _ = h.shSvc.Create(c.Request.Context(), userID, q)
		}
	}

	minPriceUI := 0.0
	if minPrice != nil && *minPrice > 0 {
		minPriceUI = *minPrice
	}

	respond.OK(c, apperr.OK, gin.H{
		"pageSize":    limit,
		"pageIndex":   page,
		"total":       total,
		"minPrice":    minPriceUI,
		"maxPrice":    maxPriceResult,
		"fulfillment": fulfillment,
		"sortBy":      sortBy,
		"items":       items,
	})
}

// GET /api/products/:id/public
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

// GET /api/products/suggest
func (h *Handler) suggest(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c, true)
	if !ok {
		return
	}

	q := strings.TrimSpace(c.Query("q"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	if limit <= 0 {
		limit = 10
	}
	if limit > 20 {
		limit = 20
	}

	res, err := h.svc.SuggestSplit(c.Request.Context(), userID, q, limit)
	if err != nil {
		c.Error(err)
		return
	}
	if res.History == nil {
		res.History = []string{}
	}
	if res.Suggest == nil {
		res.Suggest = []string{}
	}
	respond.OK(c, apperr.OK, res)
}

// ===== Option Keys =====

// GET /api/products/:id/options
func (h *Handler) listOptions(c *gin.Context) {
	id, ok := parseID(c, "id")
	if !ok {
		return
	}
	keys, err := h.svc.ListOptionKeys(c.Request.Context(), id)
	if err != nil {
		c.Error(err)
		return
	}
	if keys == nil {
		keys = []OptionKey{}
	}
	respond.OK(c, apperr.OK, keys)
}

// POST /api/products/:id/options
func (h *Handler) createOptionKey(c *gin.Context) {
	p, userID, ok := h.resolveProductOwner(c)
	if !ok {
		return
	}

	var in createOptionKeyReq
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	key, err := h.svc.CreateOptionKey(c.Request.Context(), int64(p.ID), userID, in.KeyName, in.SortOrder)
	if err != nil {
		c.Error(err)
		return
	}
	respond.Created(c, apperr.Created, key)
}

// DELETE /api/products/:id/options/:keyId
func (h *Handler) deleteOptionKey(c *gin.Context) {
	p, userID, ok := h.resolveProductOwner(c)
	if !ok {
		return
	}
	keyID, ok := parseID(c, "keyId")
	if !ok {
		return
	}
	if err := h.svc.DeleteOptionKey(c.Request.Context(), keyID, int64(p.ID), userID); err != nil {
		c.Error(err)
		return
	}
	respond.Deleted(c, apperr.Deleted, gin.H{"deleted": true})
}

// ===== Option Values =====

// POST /api/products/:id/options/:keyId/values
func (h *Handler) createOptionValue(c *gin.Context) {
	p, userID, ok := h.resolveProductOwner(c)
	if !ok {
		return
	}
	keyID, ok := parseID(c, "keyId")
	if !ok {
		return
	}

	var in createOptionValueReq
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	val, err := h.svc.CreateOptionValue(c.Request.Context(), keyID, int64(p.ID), userID, in.ValueLabel, in.SortOrder)
	if err != nil {
		c.Error(err)
		return
	}
	respond.Created(c, apperr.Created, val)
}

// DELETE /api/products/:id/options/:keyId/values/:valueId
func (h *Handler) deleteOptionValue(c *gin.Context) {
	p, userID, ok := h.resolveProductOwner(c)
	if !ok {
		return
	}
	valueID, ok := parseID(c, "valueId")
	if !ok {
		return
	}
	if err := h.svc.DeleteOptionValue(c.Request.Context(), valueID, int64(p.ID), userID); err != nil {
		c.Error(err)
		return
	}
	respond.Deleted(c, apperr.Deleted, gin.H{"deleted": true})
}

// ===== Variants =====

// GET /api/products/:id/variants
func (h *Handler) listVariants(c *gin.Context) {
	id, ok := parseID(c, "id")
	if !ok {
		return
	}
	variants, err := h.svc.ListVariants(c.Request.Context(), id)
	if err != nil {
		c.Error(err)
		return
	}
	if variants == nil {
		variants = []Variant{}
	}
	respond.OK(c, apperr.OK, variants)
}

// POST /api/products/:id/variants
func (h *Handler) createVariant(c *gin.Context) {
	p, userID, ok := h.resolveProductOwner(c)
	if !ok {
		return
	}

	var in createVariantsReq
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}
	if len(in.Variants) == 0 {
		c.Error(apperr.New(apperr.BadRequest, "variants must not be empty"))
		return
	}

	svcItems := make([]CreateVariantInput, 0, len(in.Variants))
	for _, v := range in.Variants {
		svcItems = append(svcItems, CreateVariantInput{
			PriceDelta:   v.PriceDelta,
			StockQty:     v.StockQty,
			OptionValues: v.OptionValues,
		})
	}

	results, err := h.svc.CreateVariantsBulk(c.Request.Context(), int64(p.ID), userID, svcItems)
	if err != nil {
		c.Error(err)
		return
	}
	respond.Created(c, apperr.Created, results)
}

// PATCH /api/products/:id/variants/:variantId/stock
func (h *Handler) updateVariantStock(c *gin.Context) {
	p, userID, ok := h.resolveProductOwner(c)
	if !ok {
		return
	}
	variantID, ok := parseID(c, "variantId")
	if !ok {
		return
	}

	var in updateStockReq
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	v, err := h.svc.UpdateVariantStock(c.Request.Context(), variantID, int64(p.ID), userID, in.StockQty)
	if err != nil {
		c.Error(err)
		return
	}
	respond.Updated(c, apperr.Updated, v)
}

// DELETE /api/products/:id/variants/:variantId
func (h *Handler) deleteVariant(c *gin.Context) {
	p, userID, ok := h.resolveProductOwner(c)
	if !ok {
		return
	}
	variantID, ok := parseID(c, "variantId")
	if !ok {
		return
	}
	if err := h.svc.DeleteVariant(c.Request.Context(), variantID, int64(p.ID), userID); err != nil {
		c.Error(err)
		return
	}
	respond.Deleted(c, apperr.Deleted, gin.H{"deleted": true})
}
