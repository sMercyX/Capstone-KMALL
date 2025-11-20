package images

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

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
	// ----- Store images under /api/stores -----
	sg := r.Group("/stores")
	{
		// public (ต้อง login อยู่ดีตาม global middleware)
		sg.GET("/:id/images", h.listStoreImages)

		// owner/admin only
		owner := sg.Group("", middleware.RequireRolesAny(h.roleSvc, "Seller", "Admin"))
		{
			owner.POST("/:id/images", h.createStoreImage)
			owner.POST("/:id/images/upload", h.uploadStoreImage)
		}
	}

	// update/delete store images by id
	storeImgOwner := r.Group("/store-images", middleware.RequireRolesAny(h.roleSvc, "Seller", "Admin"))
	{
		storeImgOwner.PUT("/:imageID", h.updateStoreImage)
		storeImgOwner.DELETE("/:imageID", h.deleteStoreImage)
	}

	// ----- Product images under /api/products -----
	pg := r.Group("/products")
	{
		pg.GET("/:id/images", h.listProductImages)

		productOwner := pg.Group("", middleware.RequireRolesAny(h.roleSvc, "Seller", "Admin"))
		{
			productOwner.POST("/:id/images", h.createProductImage)
			productOwner.POST("/:id/images/upload", h.uploadProductImage)
		}
	}

	// update/delete product images by id
	productImgOwner := r.Group("/product-images", middleware.RequireRolesAny(h.roleSvc, "Seller", "Admin"))
	{
		productImgOwner.PUT("/:imageID", h.updateProductImage)
		productImgOwner.DELETE("/:imageID", h.deleteProductImage)
	}
}

// ===== Request DTOs =====

type storeImageCreateReq struct {
	ImageURL  string `json:"image_url"  binding:"required"`
	SortOrder int    `json:"sort_order"`
	IsPrimary bool   `json:"is_primary"`
}

type storeImageUpdateReq struct {
	ImageURL  *string `json:"image_url"`
	SortOrder *int    `json:"sort_order"`
	IsPrimary *bool   `json:"is_primary"`
}

type productImageCreateReq struct {
	ImageURL  string `json:"image_url"  binding:"required"`
	SortOrder int    `json:"sort_order"`
	IsPrimary bool   `json:"is_primary"`
}

type productImageUpdateReq struct {
	ImageURL  *string `json:"image_url"`
	SortOrder *int    `json:"sort_order"`
	IsPrimary *bool   `json:"is_primary"`
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

func (h *Handler) isProductOwnerOrAdmin(c *gin.Context, productID int64, userID string) bool {
	if h.isAdmin(c, userID) {
		return true
	}
	p, err := h.productSvc.Get(c.Request.Context(), productID)
	if err != nil {
		c.Error(err)
		return false
	}
	return h.isStoreOwnerOrAdmin(c, int64(p.StoreID), userID)
}

// ============================================================================
// Store Images Handlers
// ============================================================================

// GET /api/stores/:id/images
func (h *Handler) listStoreImages(c *gin.Context) {
	storeID, ok := parsePathID(c, "id")
	if !ok {
		return
	}

	imgs, err := h.svc.ListStoreImagesByStoreID(c.Request.Context(), storeID)
	if err != nil {
		c.Error(err)
		return
	}
	if imgs == nil {
		imgs = []StoreImage{}
	}
	respond.OK(c, apperr.OK, imgs)
}

// POST /api/stores/:id/images (Seller/Admin + owner)
func (h *Handler) createStoreImage(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c, false)
	if !ok {
		return
	}

	storeID, ok := parsePathID(c, "id")
	if !ok {
		return
	}

	if !h.isStoreOwnerOrAdmin(c, storeID, userID) {
		if len(c.Errors) == 0 {
			respond.Error(c, http.StatusForbidden, "FORBIDDEN", "only owner or admin can add images to this store", nil)
		}
		return
	}

	var in storeImageCreateReq
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	img, err := h.svc.CreateStoreImage(c.Request.Context(), StoreImageCreateInput{
		StoreID:   int(storeID),
		ImageURL:  in.ImageURL,
		SortOrder: in.SortOrder,
		IsPrimary: in.IsPrimary,
	})
	if err != nil {
		c.Error(err)
		return
	}
	respond.Created(c, apperr.Created, img)
}

// POST /api/stores/:id/images/upload  (multipart/form-data, field: file)
func (h *Handler) uploadStoreImage(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c, false)
	if !ok {
		return
	}

	storeID, ok := parsePathID(c, "id")
	if !ok {
		return
	}

	if !h.isStoreOwnerOrAdmin(c, storeID, userID) {
		if len(c.Errors) == 0 {
			respond.Error(c, http.StatusForbidden, "FORBIDDEN",
				"only owner or admin can upload images to this store", nil)
		}
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.Error(apperr.New(apperr.BadRequest, "file is required"))
		return
	}

	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	if ext == "" {
		ext = ".jpg"
	}

	filename := fmt.Sprintf("%d_%d%s", storeID, time.Now().UnixNano(), ext)
	dir := filepath.Join("uploads", "stores", strconv.FormatInt(storeID, 10))
	if err := os.MkdirAll(dir, 0o755); err != nil {
		// fmt.Printf("[upload] mkdirAll error: dir=%s err=%v\n", dir, err)
		c.Error(apperr.Wrap(apperr.Internal, err, "create upload dir failed"))
		return
	}

	dstPath := filepath.Join(dir, filename)

	if err := c.SaveUploadedFile(fileHeader, dstPath); err != nil {
		c.Error(apperr.Wrap(apperr.Internal, err, "save file failed"))
		return
	}

	relPath := filepath.ToSlash(filepath.Join("stores", strconv.FormatInt(storeID, 10), filename))
	imageURL := "/static/" + relPath

	sortOrder := 1
	isPrimary := false

	if v := c.PostForm("sort_order"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			sortOrder = n
		}
	}
	if v := c.PostForm("is_primary"); v != "" {
		isPrimary = strings.EqualFold(v, "true") || v == "1"
	}

	img, err := h.svc.CreateStoreImage(c.Request.Context(), StoreImageCreateInput{
		StoreID:   int(storeID),
		ImageURL:  imageURL,
		SortOrder: sortOrder,
		IsPrimary: isPrimary,
	})
	if err != nil {
		c.Error(err)
		return
	}

	respond.Created(c, apperr.Created, img)
}

// PUT /api/store-images/:imageID (Seller/Admin + owner)
func (h *Handler) updateStoreImage(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c, false)
	if !ok {
		return
	}

	imageID, ok := parsePathID(c, "imageID")
	if !ok {
		return
	}

	// ดึง image ก่อน เพื่อรู้ว่า store_id คืออะไร
	img, err := h.svc.GetStoreImage(c.Request.Context(), imageID)
	if err != nil {
		c.Error(err)
		return
	}

	if !h.isStoreOwnerOrAdmin(c, int64(img.StoreID), userID) {
		if len(c.Errors) == 0 {
			respond.Error(c, http.StatusForbidden, "FORBIDDEN", "only owner or admin can update this store image", nil)
		}
		return
	}

	var in storeImageUpdateReq
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	updated, err := h.svc.UpdateStoreImage(c.Request.Context(), imageID, StoreImageUpdateInput(in))
	if err != nil {
		c.Error(err)
		return
	}
	respond.Updated(c, apperr.Updated, updated)
}

// DELETE /api/store-images/:imageID (Seller/Admin + owner)
func (h *Handler) deleteStoreImage(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c, false)
	if !ok {
		return
	}

	imageID, ok := parsePathID(c, "imageID")
	if !ok {
		return
	}

	img, err := h.svc.GetStoreImage(c.Request.Context(), imageID)
	if err != nil {
		c.Error(err)
		return
	}

	if !h.isStoreOwnerOrAdmin(c, int64(img.StoreID), userID) {
		if len(c.Errors) == 0 {
			respond.Error(c, http.StatusForbidden, "FORBIDDEN", "only owner or admin can delete this store image", nil)
		}
		return
	}

	if err := h.svc.DeleteStoreImage(c.Request.Context(), imageID); err != nil {
		c.Error(err)
		return
	}
	respond.Deleted(c, apperr.Deleted, gin.H{"deleted": true})
}

// ============================================================================
// Product Images Handlers
// ============================================================================

// GET /api/products/:id/images
func (h *Handler) listProductImages(c *gin.Context) {
	productID, ok := parsePathID(c, "id")
	if !ok {
		return
	}

	imgs, err := h.svc.ListProductImagesByProductID(c.Request.Context(), productID)
	if err != nil {
		c.Error(err)
		return
	}
	if imgs == nil {
		imgs = []ProductImage{}
	}
	respond.OK(c, apperr.OK, imgs)
}

// POST /api/products/:id/images (Seller/Admin + owner)
func (h *Handler) createProductImage(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c, false)
	if !ok {
		return
	}

	productID, ok := parsePathID(c, "id")
	if !ok {
		return
	}

	if !h.isProductOwnerOrAdmin(c, productID, userID) {
		if len(c.Errors) == 0 {
			respond.Error(c, http.StatusForbidden, "FORBIDDEN", "only owner or admin can add images to this product", nil)
		}
		return
	}

	var in productImageCreateReq
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	img, err := h.svc.CreateProductImage(c.Request.Context(), ProductImageCreateInput{
		ProductID: int(productID),
		ImageURL:  in.ImageURL,
		SortOrder: in.SortOrder,
		IsPrimary: in.IsPrimary,
	})
	if err != nil {
		c.Error(err)
		return
	}
	respond.Created(c, apperr.Created, img)
}

// POST /api/products/:id/images/upload  (multipart/form-data, field: file)
func (h *Handler) uploadProductImage(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c, false)
	if !ok {
		return
	}

	productID, ok := parsePathID(c, "id")
	if !ok {
		return
	}

	if !h.isProductOwnerOrAdmin(c, productID, userID) {
		if len(c.Errors) == 0 {
			respond.Error(c, http.StatusForbidden, "FORBIDDEN",
				"only owner or admin can upload images to this product", nil)
		}
		return
	}

	// รับไฟล์จาก form-data: file
	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.Error(apperr.New(apperr.BadRequest, "file is required"))
		return
	}

	// สร้าง path เก็บไฟล์ในเครื่อง: ./uploads/products/<productID>/timestamp.ext
	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	if ext == "" {
		ext = ".jpg"
	}

	filename := fmt.Sprintf("%d_%d%s", productID, time.Now().UnixNano(), ext)
	dir := filepath.Join("uploads", "products", strconv.FormatInt(productID, 10))
	if err := os.MkdirAll(dir, 0o755); err != nil {
		c.Error(apperr.Wrap(apperr.Internal, err, "create upload dir failed"))
		return
	}

	dstPath := filepath.Join(dir, filename)

	if err := c.SaveUploadedFile(fileHeader, dstPath); err != nil {
		c.Error(apperr.Wrap(apperr.Internal, err, "save file failed"))
		return
	}

	// สร้าง URL สำหรับ FE (อิงจาก r.Static("/static", "./uploads"))
	relPath := filepath.ToSlash(filepath.Join("products", strconv.FormatInt(productID, 10), filename))
	imageURL := "/static/" + relPath

	// optional: อ่าน sort_order / is_primary จาก form ถ้าอยากให้ตั้งค่าเอง
	sortOrder := 1
	isPrimary := false

	if v := c.PostForm("sort_order"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			sortOrder = n
		}
	}
	if v := c.PostForm("is_primary"); v != "" {
		isPrimary = strings.EqualFold(v, "true") || v == "1"
	}

	img, err := h.svc.CreateProductImage(c.Request.Context(), ProductImageCreateInput{
		ProductID: int(productID),
		ImageURL:  imageURL,
		SortOrder: sortOrder,
		IsPrimary: isPrimary,
	})
	if err != nil {
		c.Error(err)
		return
	}

	respond.Created(c, apperr.Created, img)
}

// PUT /api/product-images/:imageID (Seller/Admin + owner)
func (h *Handler) updateProductImage(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c, false)
	if !ok {
		return
	}

	imageID, ok := parsePathID(c, "imageID")
	if !ok {
		return
	}

	img, err := h.svc.GetProductImage(c.Request.Context(), imageID)
	if err != nil {
		c.Error(err)
		return
	}

	if !h.isProductOwnerOrAdmin(c, int64(img.ProductID), userID) {
		if len(c.Errors) == 0 {
			respond.Error(c, http.StatusForbidden, "FORBIDDEN", "only owner or admin can update this product image", nil)
		}
		return
	}

	var in productImageUpdateReq
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	updated, err := h.svc.UpdateProductImage(c.Request.Context(), imageID, ProductImageUpdateInput(in))
	if err != nil {
		c.Error(err)
		return
	}
	respond.Updated(c, apperr.Updated, updated)
}

// DELETE /api/product-images/:imageID (Seller/Admin + owner)
func (h *Handler) deleteProductImage(c *gin.Context) {
	userID, ok := h.resolveCurrentUserID(c, false)
	if !ok {
		return
	}

	imageID, ok := parsePathID(c, "imageID")
	if !ok {
		return
	}

	img, err := h.svc.GetProductImage(c.Request.Context(), imageID)
	if err != nil {
		c.Error(err)
		return
	}

	if !h.isProductOwnerOrAdmin(c, int64(img.ProductID), userID) {
		if len(c.Errors) == 0 {
			respond.Error(c, http.StatusForbidden, "FORBIDDEN", "only owner or admin can delete this product image", nil)
		}
		return
	}

	if err := h.svc.DeleteProductImage(c.Request.Context(), imageID); err != nil {
		c.Error(err)
		return
	}
	respond.Deleted(c, apperr.Deleted, gin.H{"deleted": true})
}
