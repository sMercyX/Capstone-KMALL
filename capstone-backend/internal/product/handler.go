package product

import (
	"net/http"
	"os"
	"path/filepath"
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
	pg.GET("/:id/options", h.listOptions)
	pg.GET("/:id/variants", h.listVariants)

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
		auth.POST("/:id/variants", h.createVariants)
		auth.PUT("/:id/variants-config", h.replaceVariantsConfig)
		auth.PATCH("/:id/variants/bulk", h.updateVariantsBulk)
		auth.PATCH("/:id/variants/:variantId/stock", h.updateVariantStock)
		auth.DELETE("/:id/variants/:variantId", h.deleteVariant)

		auth.PATCH("/:id/options/:keyId/image-key", h.setOptionKeyImageKey)
		auth.PUT("/:id/options/:keyId/values/:valueId/image", h.setOptionValueImage)
		auth.DELETE("/:id/options/:keyId/values/:valueId/image", h.deleteOptionValueImage)
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

	Variants []replaceVariantReq `json:"variants"`
}

type updateReq struct {
	Name        *string  `json:"name"`
	Description *string  `json:"description"`
	Price       *float64 `json:"price"`
	ImageURL    *string  `json:"image_url"`
	IsActive    *string  `json:"is_active"`
	CategoryID  *int     `json:"category_id"`
	ProductType *string  `json:"product_type"`

	VariantsConfig *replaceVariantsConfigReq `json:"variants_config"`
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
	KeyName    string                    `json:"key_name" binding:"required"`
	SortOrder  int                       `json:"sort_order"`
	IsImageKey bool                      `json:"is_image_key"`
	Values     []createOptionValueInline `json:"values"`
}

type createVariantsReq struct {
	Variants []createVariantReq `json:"variants" binding:"required"`
	IsActive *string            `json:"is_active"`
}

// replaceVariantsConfigReq — body สำหรับ PUT /:id/variants-config
type replaceVariantsConfigReq struct {
	Options  []replaceOptionKeyReq `json:"options"  binding:"required"`
	Variants []replaceVariantReq   `json:"variants"`
}

type replaceOptionKeyReq struct {
	KeyName    string   `json:"key_name"   binding:"required"`
	SortOrder  int      `json:"sort_order"`
	Values     []string `json:"values"     binding:"required"`
	IsImageKey bool     `json:"is_image_key"`
}

type replaceVariantReq struct {
	OptionValueLabels []string `json:"option_value_labels" binding:"required"`
	PriceDelta        float64  `json:"price_delta"`
	StockQty          int      `json:"stock_qty"`
	IsActive          *bool    `json:"is_active"`
}

type UpdateWithVariantsInput struct {
	Name        *string  `json:"name,omitempty"`
	Description *string  `json:"description,omitempty"`
	Price       *float64 `json:"price,omitempty"`
	ImageURL    *string  `json:"image_url,omitempty"`
	IsActive    *string  `json:"is_active,omitempty"`
	CategoryID  *int     `json:"category_id,omitempty"`

	// nil = ไม่แตะ variants config
	// non-nil = replace ทั้งชุด
	VariantsConfig *ReplaceVariantsConfigInput `json:"variants_config,omitempty"`
}

type setImageKeyReq struct {
	IsImageKey bool `json:"is_image_key"`
}

type setOptionValueImageReq struct {
	ImageURL string `json:"image_url" binding:"required"`
}

type updateVariantBulkItemReq struct {
	ID         int64    `json:"id"          binding:"required"`
	PriceDelta *float64 `json:"price_delta"`
	StockQty   *int     `json:"stock_qty"`
	IsActive   *bool    `json:"is_active"`
}

type updateVariantsBulkReq struct {
	Variants []updateVariantBulkItemReq `json:"variants" binding:"required"`
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

	if strings.ToUpper(strings.TrimSpace(in.IsActive)) == "YES" &&
		strings.ToUpper(strings.TrimSpace(in.ProductType)) == "STOCK" &&
		len(in.Variants) == 0 {
		c.Error(apperr.New(apperr.BadRequest,
			"STOCK product cannot be activated at creation without variants"))
		return
	}

	opts := make([]CreateOptionKeyWithValuesInput, 0, len(in.Options))
	for _, o := range in.Options {
		vals := make([]string, 0, len(o.Values))
		for _, v := range o.Values {
			vals = append(vals, v.ValueLabel)
		}
		opts = append(opts, CreateOptionKeyWithValuesInput{
			KeyName:    o.KeyName,
			SortOrder:  o.SortOrder,
			IsImageKey: o.IsImageKey,
			Values:     vals,
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

	// ถ้าส่ง variants มาด้วย → replace config เลย
	if len(in.Variants) > 0 && p.ProductType == "STOCK" {
		keys, err := h.svc.ListOptionKeys(c.Request.Context(), int64(p.ID))
		if err != nil {
			c.Error(err)
			return
		}

		optInputs := make([]ReplaceOptionKeyInput, 0, len(keys))
		for _, k := range keys {
			vals := make([]string, 0, len(k.Values))
			for _, v := range k.Values {
				vals = append(vals, v.ValueLabel)
			}
			optInputs = append(optInputs, ReplaceOptionKeyInput{
				KeyName:    k.KeyName,
				SortOrder:  k.SortOrder,
				IsImageKey: k.IsImageKey,
				Values:     vals,
			})
		}

		varInputs := make([]ReplaceVariantInput, 0, len(in.Variants))
		for _, v := range in.Variants {
			varInputs = append(varInputs, ReplaceVariantInput{
				OptionValueLabels: v.OptionValueLabels,
				PriceDelta:        v.PriceDelta,
				StockQty:          v.StockQty,
				IsActive:          v.IsActive,
			})
		}

		p, err = h.svc.ReplaceVariantsConfig(c.Request.Context(), int64(p.ID), userID, ReplaceVariantsConfigInput{
			Options:  optInputs,
			Variants: varInputs,
		})
		if err != nil {
			c.Error(err)
			return
		}

		// set is_active = YES ถ้าต้องการ — service.Update เช็ค active variant เองอยู่แล้ว
		if strings.ToUpper(strings.TrimSpace(in.IsActive)) == "YES" {
			isActiveYes := "YES"
			p, err = h.svc.Update(c.Request.Context(), int64(p.ID), UpdateInput{
				IsActive: &isActiveYes,
			})
			if err != nil {
				c.Error(err)
				return
			}
		}
	}

	respond.Created(c, apperr.Created, p)
}

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

	categoryID := parseInt64Query(c, "category_id")
	parentCategoryID := parseInt64Query(c, "parent_category_id")

	items, total, err := h.svc.ListByStoreID(
		c.Request.Context(), storeID,
		strings.TrimSpace(c.Query("q")),
		categoryID, parentCategoryID,
		limit, page,
	)
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

func (h *Handler) get(c *gin.Context) {
	p, _, ok := h.resolveProductOwner(c)
	if !ok {
		return
	}
	respond.OK(c, apperr.OK, p)
}

func (h *Handler) update(c *gin.Context) {
	p, userID, ok := h.resolveProductOwner(c)
	if !ok {
		return
	}

	var in updateReq
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	if in.ProductType != nil {
		c.Error(apperr.New(apperr.BadRequest, "product_type cannot be changed after creation"))
		return
	}

	var variantsConfig *ReplaceVariantsConfigInput
	if in.VariantsConfig != nil {
		vc := &ReplaceVariantsConfigInput{
			Options:  make([]ReplaceOptionKeyInput, 0, len(in.VariantsConfig.Options)),
			Variants: make([]ReplaceVariantInput, 0, len(in.VariantsConfig.Variants)),
		}
		for _, o := range in.VariantsConfig.Options {
			vc.Options = append(vc.Options, ReplaceOptionKeyInput{
				KeyName:    o.KeyName,
				SortOrder:  o.SortOrder,
				Values:     o.Values,
				IsImageKey: o.IsImageKey,
			})
		}
		for _, v := range in.VariantsConfig.Variants {
			vc.Variants = append(vc.Variants, ReplaceVariantInput{
				OptionValueLabels: v.OptionValueLabels,
				PriceDelta:        v.PriceDelta,
				StockQty:          v.StockQty,
			})
		}
		variantsConfig = vc
	}

	up, err := h.svc.UpdateWithVariantsConfig(c.Request.Context(), int64(p.ID), userID, UpdateWithVariantsInput{
		Name:           in.Name,
		Description:    in.Description,
		Price:          in.Price,
		ImageURL:       in.ImageURL,
		IsActive:       in.IsActive,
		CategoryID:     in.CategoryID,
		VariantsConfig: variantsConfig,
	})
	if err != nil {
		c.Error(err)
		return
	}

	respond.Updated(c, apperr.Updated, up)
}

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

// POST /api/products/:id/variants — สร้าง variants โดยใช้ option_value_ids ที่มีอยู่แล้ว
func (h *Handler) createVariants(c *gin.Context) {
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

	out := make([]Variant, 0, len(in.Variants))
	for _, v := range in.Variants {
		created, err := h.svc.CreateVariant(c.Request.Context(), int64(p.ID), userID, CreateVariantInput{
			PriceDelta:   v.PriceDelta,
			StockQty:     v.StockQty,
			OptionValues: v.OptionValues,
		})
		if err != nil {
			c.Error(err)
			return
		}
		out = append(out, created)
	}

	// ===== เพิ่ม: set is_active ถ้าส่งมา =====
	if in.IsActive != nil {
		_, err := h.svc.Update(c.Request.Context(), int64(p.ID), UpdateInput{
			IsActive: in.IsActive,
		})
		if err != nil {
			c.Error(err)
			return
		}
	}

	respond.Created(c, apperr.Created, out)
}

// PUT /api/products/:id/variants-config — replace options + variants ทั้งหมด (Shopee/Lazada style)
func (h *Handler) replaceVariantsConfig(c *gin.Context) {
	p, userID, ok := h.resolveProductOwner(c)
	if !ok {
		return
	}

	var in replaceVariantsConfigReq
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	svcIn := ReplaceVariantsConfigInput{
		Options:  make([]ReplaceOptionKeyInput, 0, len(in.Options)),
		Variants: make([]ReplaceVariantInput, 0, len(in.Variants)),
	}
	for _, o := range in.Options {
		svcIn.Options = append(svcIn.Options, ReplaceOptionKeyInput{
			KeyName:    o.KeyName,
			SortOrder:  o.SortOrder,
			Values:     o.Values,
			IsImageKey: o.IsImageKey,
		})
	}
	for _, v := range in.Variants {
		svcIn.Variants = append(svcIn.Variants, ReplaceVariantInput{
			OptionValueLabels: v.OptionValueLabels,
			PriceDelta:        v.PriceDelta,
			StockQty:          v.StockQty,
			IsActive:          v.IsActive,
		})
	}

	result, err := h.svc.ReplaceVariantsConfig(c.Request.Context(), int64(p.ID), userID, svcIn)
	if err != nil {
		c.Error(err)
		return
	}

	respond.Updated(c, apperr.Updated, result)
}

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

// PATCH /api/products/:id/options/:keyId/image-key
func (h *Handler) setOptionKeyImageKey(c *gin.Context) {
	p, userID, ok := h.resolveProductOwner(c)
	if !ok {
		return
	}
	keyID, ok := parseID(c, "keyId")
	if !ok {
		return
	}

	var in setImageKeyReq
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	key, err := h.svc.SetOptionKeyImageKey(c.Request.Context(), keyID, int64(p.ID), userID, in.IsImageKey)
	if err != nil {
		c.Error(err)
		return
	}
	respond.Updated(c, apperr.Updated, key)
}

// PUT /api/products/:id/options/:keyId/values/:valueId/image
func (h *Handler) setOptionValueImage(c *gin.Context) {
	p, userID, ok := h.resolveProductOwner(c)
	if !ok {
		return
	}
	valueID, ok := parseID(c, "valueId")
	if !ok {
		return
	}

	var in setOptionValueImageReq
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	val, err := h.svc.SetOptionValueImage(c.Request.Context(), valueID, int64(p.ID), userID, &in.ImageURL)
	if err != nil {
		c.Error(err)
		return
	}
	respond.Updated(c, apperr.Updated, val)
}

// DELETE /api/products/:id/options/:keyId/values/:valueId/image
func (h *Handler) deleteOptionValueImage(c *gin.Context) {
	p, userID, ok := h.resolveProductOwner(c)
	if !ok {
		return
	}
	valueID, ok := parseID(c, "valueId")
	if !ok {
		return
	}

	// ดึง image_url เดิมก่อน เพื่อจะได้ลบไฟล์
	keys, err := h.svc.ListOptionKeys(c.Request.Context(), int64(p.ID))
	if err != nil {
		c.Error(err)
		return
	}
	var oldImageURL string
	for _, k := range keys {
		for _, v := range k.Values {
			if int64(v.ID) == valueID {
				if v.ImageURL != nil {
					oldImageURL = *v.ImageURL
				}
			}
		}
	}

	// clear image_url ใน DB
	val, err := h.svc.SetOptionValueImage(c.Request.Context(), valueID, int64(p.ID), userID, nil)
	if err != nil {
		c.Error(err)
		return
	}

	// ลบไฟล์บน disk
	if oldImageURL != "" {
		relPath := strings.TrimPrefix(oldImageURL, "/uploads/")
		if relPath != "" {
			fsPath := filepath.Join("uploads", relPath)
			_ = os.Remove(fsPath)
		}
	}

	respond.Deleted(c, apperr.Deleted, val)
}

func (h *Handler) updateVariantsBulk(c *gin.Context) {
	p, userID, ok := h.resolveProductOwner(c)
	if !ok {
		return
	}

	var in updateVariantsBulkReq
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}
	if len(in.Variants) == 0 {
		c.Error(apperr.New(apperr.BadRequest, "variants must not be empty"))
		return
	}

	out := make([]Variant, 0, len(in.Variants))
	for _, v := range in.Variants {
		updated, err := h.svc.UpdateVariant(c.Request.Context(), v.ID, int64(p.ID), userID, UpdateVariantInput{
			PriceDelta: v.PriceDelta,
			StockQty:   v.StockQty,
			IsActive:   v.IsActive,
		})
		if err != nil {
			c.Error(err)
			return
		}
		out = append(out, updated)
	}

	respond.Updated(c, apperr.Updated, out)
}
