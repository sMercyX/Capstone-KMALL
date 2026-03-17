package category

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
	"github.com/Perpasit/Capstone-KMALL/internal/filestore"
	"github.com/Perpasit/Capstone-KMALL/internal/middleware"
	"github.com/Perpasit/Capstone-KMALL/internal/respond"
)

// ===== Handler =====

type Handler struct {
	svc     Service
	roleSvc middleware.RoleNameLister
	fs      filestore.Store
}

func NewHandler(s Service, rl middleware.RoleNameLister, fs filestore.Store) *Handler {
	return &Handler{svc: s, roleSvc: rl, fs: fs}
}

func (h *Handler) Register(r *gin.RouterGroup) {
	// public
	pub := r.Group("/categories")
	pub.GET("", h.listPublic)
	pub.GET("/:id/public", h.getPublic)

	// admin
	admin := r.Group("/admin/categories", middleware.RequireRolesAny(h.roleSvc, "Admin"))
	admin.GET("", h.listAdmin)
	admin.POST("", h.create)
	admin.POST("/upload-icon", h.uploadIcon)
	admin.GET("/:id", h.get)
	admin.PUT("/:id", h.update)
	admin.DELETE("/:id", h.delete)
	admin.PATCH("/:id/deactivate", h.deactivate)
}

// ===== Request DTOs =====
type createReq struct {
	Name      string  `json:"name" binding:"required"`
	Slug      *string `json:"slug"`
	ParentID  *int    `json:"parent_id"`
	SortOrder *int    `json:"sort_order"`
	IsActive  string  `json:"is_active,omitempty"`

	Subcategories []struct {
		Name      string  `json:"name" binding:"required"`
		Slug      *string `json:"slug"`
		SortOrder *int    `json:"sort_order"`
		IsActive  string  `json:"is_active,omitempty"`
	} `json:"subcategories,omitempty"`
}

type updateReq struct {
	Name      *string `json:"name"`
	Slug      *string `json:"slug"`
	ParentID  *int    `json:"parent_id"`
	SortOrder *int    `json:"sort_order"`
	IsActive  *string `json:"is_active"`
	IconURL   *string `json:"icon_url"`

	Subcategories *[]UpsertSubReq `json:"sub_categories,omitempty"`
}

type UpsertSubReq struct {
	ID        *int    `json:"id,omitempty"`
	Name      string  `json:"name"`
	Slug      *string `json:"slug,omitempty"`
	SortOrder *int    `json:"sort_order,omitempty"`
	IsActive  string  `json:"is_active,omitempty"`
}

type upsertTreeReq struct {
	MainCategory struct {
		ID        *int    `json:"id,omitempty"`
		Name      string  `json:"name" binding:"required"`
		Slug      *string `json:"slug,omitempty"`
		SortOrder *int    `json:"sort_order,omitempty"`
		IsActive  string  `json:"is_active,omitempty"`
	} `json:"main_category" binding:"required"`

	SubCategories []struct {
		ID        *int    `json:"id,omitempty"`
		Name      string  `json:"name" binding:"required"`
		Slug      *string `json:"slug,omitempty"`
		SortOrder *int    `json:"sort_order,omitempty"`
		IsActive  string  `json:"is_active,omitempty"`
	} `json:"sub_categories" binding:"required"`
}

type moveReq struct {
	MoveToSubCategoryID int64 `json:"move_to_sub_category_id"`
}

// ===== Helpers =====

func parseID(c *gin.Context) (int64, bool) {
	idStr := strings.TrimSpace(c.Param("id"))
	if idStr == "" {
		c.Error(apperr.New(apperr.BadRequest, "missing id"))
		return 0, false
	}
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil || id <= 0 {
		c.Error(apperr.New(apperr.BadRequest, "invalid id"))
		return 0, false
	}
	return id, true
}

// func parseParentIDQuery(c *gin.Context) *int64 {
// 	v := strings.TrimSpace(c.Query("parent_id"))
// 	if v == "" {
// 		return nil
// 	}
// 	id, err := strconv.ParseInt(v, 10, 64)
// 	if err != nil || id <= 0 {
// 		// ถ้า parse ไม่ได้ จะถือว่าไม่ใช้ filter parent (ไม่ error ทั้ง request)
// 		return nil
// 	}
// 	return &id
// }

func parseBoolQuery(value string, def bool) bool {
	if value == "" {
		return def
	}
	v := strings.ToLower(strings.TrimSpace(value))
	switch v {
	case "1", "true", "yes", "y":
		return true
	case "0", "false", "no", "n":
		return false
	default:
		return def
	}
}

func parseParentIDQuery(c *gin.Context) *int64 {
	val := strings.TrimSpace(c.Query("parent_id"))
	if val == "" {
		return nil
	}
	if val == "null" {
		x := int64(0)
		return &x
	}
	id, err := strconv.ParseInt(val, 10, 64)
	if err != nil {
		return nil
	}
	return &id
}

// ===== Handlers =====

// POST /api/categories (Admin)
func (h *Handler) create(c *gin.Context) {

	var in UpsertCategoryTreeInput

	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "invalid json body"))
		return
	}

	missing := []string{}

	if strings.TrimSpace(in.Main.Name) == "" {
		missing = append(missing, "main_category.name")
	}

	if len(in.Subs) == 0 {
		missing = append(missing, "sub_categories (must have at least 1 item)")
	} else {
		for i, sc := range in.Subs {
			if strings.TrimSpace(sc.Name) == "" {
				missing = append(missing, fmt.Sprintf("sub_categories[%d].name", i))
			}
		}
	}

	if len(missing) > 0 {
		c.Error(apperr.WithFields(
			apperr.New(apperr.BadRequest, "missing required fields"),
			map[string]any{
				"required": missing,
			},
		))
		return
	}

	// call service
	main, subs, err := h.svc.UpsertCategoryTree(c.Request.Context(), in)
	if err != nil {
		c.Error(err)
		return
	}

	respond.Created(c, apperr.Created, gin.H{
		"main_category":  main,
		"sub_categories": subs,
	})
}

// GET /api/categories/:id (Admin)
func (h *Handler) get(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	cat, err := h.svc.Get(c.Request.Context(), id)
	if err != nil {
		c.Error(err)
		return
	}
	respond.OK(c, apperr.OK, cat)
}

func (h *Handler) update(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}

	var in updateReq
	if err := c.ShouldBindJSON(&in); err != nil {
		c.Error(apperr.New(apperr.BadRequest, "bad json"))
		return
	}

	// ถ้ามี sub_categories ส่งมา → upsert ทั้งชุด
	if in.Subcategories != nil {
		subs := make([]UpsertNodeInput, 0, len(*in.Subcategories))
		for _, s := range *in.Subcategories {
			subs = append(subs, UpsertNodeInput{
				ID:        s.ID,
				Name:      s.Name,
				Slug:      s.Slug,
				SortOrder: s.SortOrder,
				IsActive:  s.IsActive,
			})
		}

		idInt := int(id)
		treeIn := UpsertCategoryTreeInput{
			Main: UpsertNodeInput{
				ID:        &idInt,
				Name:      derefStrOr(in.Name, ""),
				Slug:      in.Slug,
				SortOrder: in.SortOrder,
				IsActive:  derefStrOr(in.IsActive, ""),
				IconURL:   in.IconURL,
			},
			Subs: subs,
		}

		main, subs2, err := h.svc.UpsertCategoryTreeFull(c.Request.Context(), treeIn)
		if err != nil {
			c.Error(err)
			return
		}
		respond.Updated(c, apperr.Updated, gin.H{
			"main_category":  main,
			"sub_categories": subs2,
		})
		return
	}

	// ไม่มี sub_categories → update แค่ main เหมือนเดิม
	input := UpdateInput{
		Name:      in.Name,
		Slug:      in.Slug,
		SortOrder: in.SortOrder,
		IsActive:  in.IsActive,
		IconURL:   in.IconURL,
	}
	cat, err := h.svc.Update(c.Request.Context(), id, input)
	if err != nil {
		c.Error(err)
		return
	}
	respond.Updated(c, apperr.Updated, cat)
}

// helper
func derefStrOr(s *string, def string) string {
	if s == nil {
		return def
	}
	return *s
}

// DELETE /api/categories/:id (Admin)
func (h *Handler) delete(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}

	moveToStr := strings.TrimSpace(c.Query("move_to_sub_category_id"))
	var moveTo int64
	if moveToStr != "" {
		v, err := strconv.ParseInt(moveToStr, 10, 64)
		if err != nil || v <= 0 {
			c.Error(apperr.New(apperr.BadRequest, "invalid move_to_sub_category_id"))
			return
		}
		moveTo = v
	}

	// ส่ง moveTo ไป service ให้ service enforce rule เอง
	if err := h.svc.DeleteCategory(c.Request.Context(), id, moveTo); err != nil {
		c.Error(err)
		return
	}

	respond.Deleted(c, apperr.Deleted, gin.H{"deleted": true})
}

// GET /api/categories (Public)
// ตัวอย่าง filter:
//   - ?q=food
//   - ?parent_id=1
//   - ?active_only=true (default = true ใน public)
func (h *Handler) listPublic(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	parentID := parseParentIDQuery(c)

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))

	// public: activeOnly = true เป็น default
	activeOnly := parseBoolQuery(c.Query("active_only"), true)

	// เพิ่ม query สำหรับ filter เอาเฉพาะ sub category
	onlySub := parseBoolQuery(c.Query("only_sub"), false)

	cats, err := h.svc.List(c.Request.Context(), q, parentID, activeOnly, limit, page)
	if err != nil {
		c.Error(err)
		return
	}
	if cats == nil {
		cats = []Category{}
	}

	if onlySub {
		filtered := make([]Category, 0, len(cats))
		for _, cat := range cats {
			if cat.ParentID != nil && *cat.ParentID != 0 {
				filtered = append(filtered, cat)
			}
		}
		cats = filtered
	}

	respond.OK(c, apperr.OK, cats)
}

// GET /api/categories/:id/public (Public)
// ใช้ดู category เดี่ยวที่ต้อง "เปิดใช้งาน" เท่านั้น
func (h *Handler) getPublic(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	cat, err := h.svc.Get(c.Request.Context(), id)
	if err != nil {
		c.Error(err)
		return
	}
	if !strings.EqualFold(cat.IsActive, "YES") {
		c.Error(apperr.New(apperr.NotFound, "category not found"))
		return
	}
	respond.OK(c, apperr.OK, cat)
}

// GET /api/categories (Admin)
// ?q=&parent_id=&is_active=&page=&limit=
func (h *Handler) listAdmin(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	parentID := parseParentIDQuery(c)

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))

	// is_active: YES/NO/"" (ว่าง = ไม่ filter)
	isActive := strings.TrimSpace(c.Query("is_active"))
	var isActivePtr *string
	if isActive != "" {
		up := strings.ToUpper(isActive)
		if up != "YES" && up != "NO" {
			c.Error(apperr.New(apperr.BadRequest, "is_active must be YES or NO"))
			return
		}
		isActivePtr = &up
	}

	cats, err := h.svc.ListAdmin(c.Request.Context(), q, parentID, isActivePtr, limit, page)
	if err != nil {
		c.Error(err)
		return
	}
	if cats == nil {
		cats = []Category{}
	}
	respond.OK(c, apperr.OK, cats)
}

func (h *Handler) deactivate(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}

	var body moveReq
	if err := c.ShouldBindJSON(&body); err != nil {
		// ยอมให้ body ว่างได้
		// (บาง gin จะเป็น EOF)
		// ถ้าอยาก strict กว่านี้ เช็คว่า err เป็น EOF ค่อยยอม
		body.MoveToSubCategoryID = 0
	}

	cat, err := h.svc.DeactivateCategory(
		c.Request.Context(),
		id,
		body.MoveToSubCategoryID, // 0 ได้
	)
	if err != nil {
		c.Error(err)
		return
	}

	respond.Updated(c, apperr.Updated, cat)
}

func (h *Handler) uploadIcon(c *gin.Context) {
	fh, err := c.FormFile("file")
	if err != nil {
		c.Error(apperr.New(apperr.BadRequest, "file is required"))
		return
	}

	up, err := h.fs.Save(c.Request.Context(), "category-icons", fh)
	if err != nil {
		c.Error(err)
		return
	}

	respond.Created(c, apperr.Created, gin.H{
		"icon_url": up.URL,
	})
}
