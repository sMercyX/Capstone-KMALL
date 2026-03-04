package category

import (
	"context"
	"strings"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
)

type CreateInput struct {
	Name      string  `json:"name"`
	Slug      *string `json:"slug,omitempty"`
	ParentID  *int    `json:"parent_id,omitempty"`
	SortOrder *int    `json:"sort_order,omitempty"`
	IsActive  string  `json:"is_active,omitempty"`
}

type CreateWithSubsInput struct {
	Name      string
	Slug      *string
	SortOrder *int
	IsActive  string

	Subcategories []CreateInput
}

type UpdateInput struct {
	Name      *string `json:"name,omitempty"`
	Slug      *string `json:"slug,omitempty"`
	ParentID  *int    `json:"parent_id,omitempty"`
	SortOrder *int    `json:"sort_order,omitempty"`
	IsActive  *string `json:"is_active,omitempty"` // YES/NO
}

type UpsertNodeInput struct {
	ID        *int    `json:"id,omitempty"`
	Name      string  `json:"name"`
	Slug      *string `json:"slug,omitempty"`
	SortOrder *int    `json:"sort_order,omitempty"`
	IsActive  string  `json:"is_active,omitempty"`
}

type UpsertCategoryTreeInput struct {
	Main UpsertNodeInput   `json:"main_category"`
	Subs []UpsertNodeInput `json:"sub_categories"`
}

type Service interface {
	Create(ctx context.Context, in CreateInput) (Category, error)
	Get(ctx context.Context, id int64) (Category, error)
	List(ctx context.Context, q string, parentID *int64, activeOnly bool, limit, page int) ([]Category, error)
	Update(ctx context.Context, id int64, in UpdateInput) (Category, error)
	Delete(ctx context.Context, id int64) error

	CreateWithSubs(ctx context.Context, in CreateWithSubsInput) (Category, []Category, error)
	ListAdmin(ctx context.Context, q string, parentID *int64, isActive *string, limit, page int) ([]Category, error)

	UpsertCategoryTree(ctx context.Context, in UpsertCategoryTreeInput) (Category, []Category, error)
	DeactivateCategory(ctx context.Context, id int64, moveToSubID int64) (Category, error)
	DeleteCategory(ctx context.Context, id int64, moveToSubID int64) error
}

type service struct {
	repo Repo
}

func NewService(r Repo) Service { return &service{repo: r} }

// ===== Helpers =====

func normalizeYesNo(s, def string) string {
	s = strings.TrimSpace(strings.ToUpper(s))
	if s != "YES" && s != "NO" {
		return def
	}
	return s
}

func generateSlug(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	if s == "" {
		return ""
	}

	var b strings.Builder
	prevDash := false

	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z':
			b.WriteRune(r)
			prevDash = false
		case r >= '0' && r <= '9':
			b.WriteRune(r)
			prevDash = false
		case r == ' ' || r == '-' || r == '_' || r == '/':
			if !prevDash && b.Len() > 0 {
				b.WriteRune('-')
				prevDash = true
			}
		default:
		}
	}

	out := b.String()
	return strings.Trim(out, "-")
}

func validateCreate(in *CreateInput) error {
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" {
		return apperr.New(apperr.BadRequest, "name is required")
	}
	if len(in.Name) > 45 {
		return apperr.New(apperr.BadRequest, "name must be at most 45 characters")
	}

	if in.Slug != nil {
		s := strings.TrimSpace(*in.Slug)
		if s == "" {
			s = generateSlug(in.Name)
		} else {
			s = generateSlug(s)
		}
		if s == "" {
			return apperr.New(apperr.BadRequest, "slug is required")
		}
		if len(s) > 100 {
			return apperr.New(apperr.BadRequest, "slug must be at most 100 characters")
		}
		*in.Slug = s
	} else {
		s := generateSlug(in.Name)
		if s == "" {
			return apperr.New(apperr.BadRequest, "slug is required")
		}
		in.Slug = &s
	}

	if in.SortOrder != nil && *in.SortOrder < 0 {
		return apperr.New(apperr.BadRequest, "sort_order must be >= 0")
	}

	in.IsActive = normalizeYesNo(in.IsActive, "YES")
	return nil
}

func validateUpdate(in *UpdateInput) error {
	if in.Name != nil {
		n := strings.TrimSpace(*in.Name)
		if n == "" {
			return apperr.New(apperr.BadRequest, "name cannot be empty")
		}
		if len(n) > 45 {
			return apperr.New(apperr.BadRequest, "name must be at most 45 characters")
		}
		*in.Name = n
	}

	if in.Slug != nil {
		s := strings.TrimSpace(*in.Slug)
		if s == "" {
			return apperr.New(apperr.BadRequest, "slug cannot be empty")
		}
		s = generateSlug(s)
		if s == "" {
			return apperr.New(apperr.BadRequest, "slug cannot be empty")
		}
		if len(s) > 100 {
			return apperr.New(apperr.BadRequest, "slug must be at most 100 characters")
		}
		*in.Slug = s
	}

	if in.SortOrder != nil && *in.SortOrder < 0 {
		return apperr.New(apperr.BadRequest, "sort_order must be >= 0")
	}

	if in.IsActive != nil {
		v := normalizeYesNo(*in.IsActive, "")
		if v == "" {
			return apperr.New(apperr.BadRequest, "is_active must be YES or NO")
		}
		*in.IsActive = v
	}
	return nil
}

func derefInt(v *int, def int) int {
	if v == nil {
		return def
	}
	return *v
}

func (s *service) Create(ctx context.Context, in CreateInput) (Category, error) {
	if err := validateCreate(&in); err != nil {
		return Category{}, err
	}

	if in.ParentID != nil {
		parent, err := s.repo.Get(ctx, int64(*in.ParentID))
		if err != nil {
			return Category{}, apperr.New(apperr.BadRequest, "parent category not found")
		}
		if parent.ParentID != nil { // parent is not main
			return Category{}, apperr.New(apperr.BadRequest, "parent category must be a main category")
		}
	}

	// default sortOrder
	sortOrder := 0
	if in.SortOrder != nil {
		sortOrder = *in.SortOrder
	}

	params := CreateParams{
		Name: in.Name, Slug: *in.Slug,
		ParentID:  in.ParentID,
		SortOrder: sortOrder,
		IsActive:  in.IsActive,
	}
	return s.repo.Create(ctx, params)
}

func (s *service) Get(ctx context.Context, id int64) (Category, error) {
	if id <= 0 {
		return Category{}, apperr.New(apperr.BadRequest, "invalid id")
	}
	return s.repo.Get(ctx, id)
}

func (s *service) List(ctx context.Context, q string, parentID *int64, activeOnly bool, limit, page int) ([]Category, error) {
	q = strings.TrimSpace(q)
	return s.repo.List(ctx, q, parentID, activeOnly, limit, page)
}

func (s *service) Update(ctx context.Context, id int64, in UpdateInput) (Category, error) {
	if id <= 0 {
		return Category{}, apperr.New(apperr.BadRequest, "invalid id")
	}
	if err := validateUpdate(&in); err != nil {
		return Category{}, err
	}

	// 1) ดูสถานะปัจจุบันว่าเป็น main หรือ sub
	cur, err := s.repo.Get(ctx, id)
	if err != nil {
		return Category{}, err
	}
	isMain := cur.ParentID == nil
	isSub := cur.ParentID != nil

	// 2) enforce rule
	if isMain {
		// main ห้ามโดน set parent_id
		if in.ParentID != nil {
			return Category{}, apperr.New(apperr.BadRequest, "main category cannot set parent_id")
		}
	} else if isSub {
		// sub ห้าม set parent_id = NULL
		if in.ParentID != nil && *in.ParentID == 0 { // (ถ้าคุณใช้ 0 แทน null ใน update) ไม่แนะนำ
			return Category{}, apperr.New(apperr.BadRequest, "sub category cannot set parent_id to NULL")
		}
		// ถ้าส่ง parent_id มา ต้องเป็น main เท่านั้น
		if in.ParentID != nil {
			if int64(*in.ParentID) == id {
				return Category{}, apperr.New(apperr.BadRequest, "parent_id cannot be itself")
			}
			parent, err := s.repo.Get(ctx, int64(*in.ParentID))
			if err != nil {
				return Category{}, apperr.New(apperr.BadRequest, "parent category not found")
			}
			if parent.ParentID != nil {
				return Category{}, apperr.New(apperr.BadRequest, "parent category must be a main category")
			}
		}
	}

	return s.repo.Update(ctx, id, UpdateParams(in))
}

func (s *service) Delete(ctx context.Context, id int64) error {
	if id <= 0 {
		return apperr.New(apperr.BadRequest, "invalid id")
	}
	return s.repo.Delete(ctx, id)
}

func (s *service) CreateWithSubs(ctx context.Context, in CreateWithSubsInput) (Category, []Category, error) {
	// validate main
	main := CreateInput{
		Name: in.Name, Slug: in.Slug, SortOrder: in.SortOrder, IsActive: in.IsActive,
	}
	if err := validateCreate(&main); err != nil {
		return Category{}, nil, err
	}

	if len(in.Subcategories) < 1 {
		return Category{}, nil, apperr.New(apperr.BadRequest, "main category must have at least 1 subcategory")
	}

	// validate subs
	subs := make([]CreateParams, 0, len(in.Subcategories))
	for _, sc := range in.Subcategories {
		tmp := sc
		if err := validateCreate(&tmp); err != nil {
			return Category{}, nil, err
		}
		sortOrder := 0
		if tmp.SortOrder != nil {
			sortOrder = *tmp.SortOrder
		}

		subs = append(subs, CreateParams{
			Name: tmp.Name, Slug: *tmp.Slug,
			ParentID:  nil, // set later after main insert
			SortOrder: sortOrder,
			IsActive:  tmp.IsActive,
		})
	}

	// ✅ call repo tx
	mainParams := CreateParams{
		Name: main.Name, Slug: *main.Slug,
		ParentID:  nil, // main
		SortOrder: derefInt(main.SortOrder, 0),
		IsActive:  main.IsActive,
	}

	createdMain, createdSubs, err := s.repo.CreateMainWithSubs(ctx, mainParams, subs)
	if err != nil {
		return Category{}, nil, err
	}
	return createdMain, createdSubs, nil
}

func (s *service) ListAdmin(ctx context.Context, q string, parentID *int64, isActive *string, limit, page int) ([]Category, error) {
	q = strings.TrimSpace(q)

	// validate isActive if provided
	if isActive != nil {
		v := normalizeYesNo(*isActive, "")
		if v == "" {
			return nil, apperr.New(apperr.BadRequest, "is_active must be YES or NO")
		}
		*isActive = v
	}

	return s.repo.ListAdmin(ctx, q, parentID, isActive, limit, page)
}

func (s *service) UpsertCategoryTree(ctx context.Context, in UpsertCategoryTreeInput) (Category, []Category, error) {
	// 1) ต้องมี sub อย่างน้อย 1
	if len(in.Subs) < 1 {
		return Category{}, nil, apperr.New(apperr.BadRequest, "sub_categories must have at least 1 item")
	}

	// 2) validate main (ใช้ validateCreate ได้ เพราะเราต้องการ name/slug/...)
	mainCreate := CreateInput{
		Name:      in.Main.Name,
		Slug:      in.Main.Slug,
		SortOrder: in.Main.SortOrder,
		IsActive:  in.Main.IsActive,
		ParentID:  nil, // main ต้องเป็น NULL เสมอ
	}
	if err := validateCreate(&mainCreate); err != nil {
		return Category{}, nil, err
	}

	// 3) validate subs (ใช้ validateCreate เช่นกัน)
	subParams := make([]UpsertNodeParams, 0, len(in.Subs))
	for _, sc := range in.Subs {
		tmp := CreateInput{
			Name:      sc.Name,
			Slug:      sc.Slug,
			SortOrder: sc.SortOrder,
			IsActive:  sc.IsActive,
			ParentID:  nil, // set โดย repo เป็น main_id
		}
		if err := validateCreate(&tmp); err != nil {
			return Category{}, nil, err
		}

		subParams = append(subParams, UpsertNodeParams{
			ID:        sc.ID,
			Name:      tmp.Name,
			Slug:      *tmp.Slug,
			SortOrder: derefInt(tmp.SortOrder, 0),
			IsActive:  tmp.IsActive,
		})
	}

	// 4) เตรียม main params
	mainParam := UpsertMainParams{
		ID:        in.Main.ID,
		Name:      mainCreate.Name,
		Slug:      *mainCreate.Slug,
		SortOrder: derefInt(mainCreate.SortOrder, 0),
		IsActive:  mainCreate.IsActive,
	}

	// 5) call repo tx
	main, subs, err := s.repo.UpsertMainAndLinkSubs(ctx, mainParam, subParams)
	if err != nil {
		return Category{}, nil, err
	}
	return main, subs, nil
}

func (s *service) DeleteCategory(ctx context.Context, id int64, moveToSubID int64) error {
	if id <= 0 {
		return apperr.New(apperr.BadRequest, "invalid id")
	}

	cur, err := s.repo.Get(ctx, id)
	if err != nil {
		return err
	}

	if cur.ParentID == nil {
		cnt, err := s.repo.CountSubcategories(ctx, id)
		if err != nil {
			return err
		}
		if cnt > 0 {
			return apperr.New(apperr.BadRequest, "cannot delete main category while it still has sub categories")
		}
		return s.repo.DeleteCategoryHard(ctx, id)
	}

	if moveToSubID <= 0 {
		cntP, err := s.repo.CountProductsByCategory(ctx, id)
		if err != nil {
			return err
		}
		if cntP == 0 {
			return s.repo.DeleteCategoryHard(ctx, id)
		}
		return apperr.New(apperr.BadRequest, "move_to_sub_category_id is required")
	}

	if moveToSubID == id {
		return apperr.New(apperr.BadRequest, "move_to_sub_category_id cannot be same as source")
	}

	target, err := s.repo.Get(ctx, moveToSubID)
	if err != nil {
		return err
	}
	if target.ParentID == nil {
		return apperr.New(apperr.BadRequest, "move_to_sub_category_id must be a sub category")
	}
	if !strings.EqualFold(target.IsActive, "YES") {
		return apperr.New(apperr.BadRequest, "move_to_sub_category_id must be active (YES)")
	}

	if *cur.ParentID != *target.ParentID {
		return apperr.New(apperr.BadRequest, "move_to_sub_category_id must be in the same main category")
	}

	_, err = s.repo.DeleteSubAndMoveProducts(ctx, id, moveToSubID)
	return err
}

func (s *service) DeactivateCategory(ctx context.Context, id int64, moveToSubID int64) (Category, error) {
	if id <= 0 {
		return Category{}, apperr.New(apperr.BadRequest, "invalid id")
	}

	cur, err := s.repo.Get(ctx, id)
	if err != nil {
		return Category{}, err
	}

	// main
	if cur.ParentID == nil {
		cnt, err := s.repo.CountSubcategories(ctx, id)
		if err != nil {
			return Category{}, err
		}
		if cnt > 0 {
			return Category{}, apperr.New(apperr.BadRequest, "cannot deactivate main category while it still has sub categories")
		}
		return s.repo.SetCategoryActive(ctx, id, "NO")
	}

	// sub
	if moveToSubID <= 0 {
		return Category{}, apperr.New(apperr.BadRequest, "move_to_sub_category_id is required")
	}
	if moveToSubID == id {
		return Category{}, apperr.New(apperr.BadRequest, "move_to_sub_category_id cannot be same as source")
	}

	target, err := s.repo.Get(ctx, moveToSubID)
	if err != nil {
		return Category{}, err
	}
	if target.ParentID == nil {
		return Category{}, apperr.New(apperr.BadRequest, "move_to_sub_category_id must be a sub category")
	}
	if !strings.EqualFold(target.IsActive, "YES") {
		return Category{}, apperr.New(apperr.BadRequest, "move_to_sub_category_id must be active (YES)")
	}

	if cur.ParentID == nil || target.ParentID == nil {
		return Category{}, apperr.New(apperr.BadRequest, "move_to_sub_category_id must be a sub category")
	}
	if *cur.ParentID != *target.ParentID {
		return Category{}, apperr.New(apperr.BadRequest, "move_to_sub_category_id must be in the same main category")
	}

	deactivated, _, err := s.repo.DeactivateSubAndMoveProducts(ctx, id, moveToSubID)
	if err != nil {
		return Category{}, err
	}
	return deactivated, nil
}
