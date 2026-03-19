package category

import (
	"context"
	"sort"
	"strings"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
)

type CreateInput struct {
	Name      string  `json:"name"`
	Slug      *string `json:"slug,omitempty"`
	ParentID  *int    `json:"parent_id,omitempty"`
	SortOrder *int    `json:"sort_order,omitempty"`
	IsActive  string  `json:"is_active,omitempty"`
	IconURL   *string `json:"icon_url,omitempty"`
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
	IconURL   *string `json:"icon_url,omitempty"`
}

type UpsertNodeInput struct {
	ID        *int    `json:"id,omitempty"`
	Name      string  `json:"name"`
	Slug      *string `json:"slug,omitempty"`
	SortOrder *int    `json:"sort_order,omitempty"`
	IsActive  string  `json:"is_active,omitempty"`
	IconURL   *string `json:"icon_url,omitempty"`
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
	DeleteCategory(ctx context.Context, id int64) error

	UpsertCategoryTreeFull(ctx context.Context, in UpsertCategoryTreeInput) (Category, []Category, error)

	GetBySlug(ctx context.Context, slug string) (Category, error)
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
		if parent.ParentID != nil {
			return Category{}, apperr.New(apperr.BadRequest, "parent category must be a main category")
		}
	}

	defaultSort := 1
	if in.ParentID != nil {
		defaultSort = 2
	}
	sortOrder := defaultSort
	if in.SortOrder != nil {
		sortOrder = *in.SortOrder
	}

	params := CreateParams{
		Name:      in.Name,
		Slug:      *in.Slug,
		ParentID:  in.ParentID,
		SortOrder: sortOrder,
		IsActive:  in.IsActive,
		IconURL:   in.IconURL,
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

	if in.Name != nil && in.Slug == nil {
		newSlug := generateSlug(*in.Name)
		in.Slug = &newSlug
	}

	cur, err := s.repo.Get(ctx, id)
	if err != nil {
		return Category{}, err
	}

	if in.IsActive != nil && strings.EqualFold(*in.IsActive, "NO") {
		if cur.ParentID != nil {
			cnt, err := s.repo.CountProductsByCategory(ctx, id)
			if err != nil {
				return Category{}, err
			}
			if cnt > 0 {
				return Category{}, apperr.New(
					apperr.BadRequest,
					"cannot deactivate category that still has products, use PATCH /:id/deactivate with move_to_sub_category_id instead",
				)
			}
		} else {
			cnt, err := s.repo.CountSubcategories(ctx, id)
			if err != nil {
				return Category{}, err
			}
			if cnt > 0 {
				return Category{}, apperr.New(
					apperr.BadRequest,
					"cannot deactivate main category while it still has sub categories",
				)
			}
		}
	}

	isMain := cur.ParentID == nil
	isSub := cur.ParentID != nil

	if isMain {
		if in.ParentID != nil {
			return Category{}, apperr.New(apperr.BadRequest, "main category cannot set parent_id")
		}
	} else if isSub {
		if in.ParentID != nil && *in.ParentID == 0 {
			return Category{}, apperr.New(apperr.BadRequest, "sub category cannot set parent_id to NULL")
		}
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
	main := CreateInput{
		Name: in.Name, Slug: in.Slug, SortOrder: in.SortOrder, IsActive: in.IsActive,
	}
	if err := validateCreate(&main); err != nil {
		return Category{}, nil, err
	}

	if len(in.Subcategories) < 1 {
		return Category{}, nil, apperr.New(apperr.BadRequest, "main category must have at least 1 subcategory")
	}

	subs := make([]CreateParams, 0, len(in.Subcategories))
	for _, sc := range in.Subcategories {
		tmp := sc
		if err := validateCreate(&tmp); err != nil {
			return Category{}, nil, err
		}
		sortOrder := 2
		if tmp.SortOrder != nil {
			sortOrder = *tmp.SortOrder
		}

		subs = append(subs, CreateParams{
			Name:      tmp.Name,
			Slug:      *tmp.Slug,
			ParentID:  nil,
			SortOrder: sortOrder,
			IsActive:  tmp.IsActive,
		})
	}

	mainParams := CreateParams{
		Name:      main.Name,
		Slug:      *main.Slug,
		ParentID:  nil,
		SortOrder: derefInt(main.SortOrder, 1),
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

	if isActive != nil {
		v := normalizeYesNo(*isActive, "")
		if v == "" {
			return nil, apperr.New(apperr.BadRequest, "is_active must be YES or NO")
		}
		*isActive = v
	}

	cats, err := s.repo.ListAdmin(ctx, q, parentID, isActive, limit, page)
	if err != nil {
		return nil, err
	}

	// ถ้าไม่ได้ search ไม่ต้องแทรก parent
	if q == "" {
		return cats, nil
	}

	// รวบ id ที่มีอยู่แล้วใน result
	existingIDs := make(map[int64]struct{}, len(cats))
	for _, c := range cats {
		existingIDs[int64(c.ID)] = struct{}{}
	}

	// หา parent_id ที่ยังไม่อยู่ใน result
	missingParentIDs := make(map[int64]struct{})
	for _, c := range cats {
		if c.ParentID != nil {
			pid := int64(*c.ParentID)
			if _, found := existingIDs[pid]; !found {
				missingParentIDs[pid] = struct{}{}
			}
		}
	}

	// ดึง parent มาเพิ่มใน list
	for pid := range missingParentIDs {
		parent, err := s.repo.Get(ctx, pid)
		if err != nil {
			continue
		}
		cnt, err := s.repo.CountSubcategories(ctx, pid)
		if err == nil {
			parent.SubCategoryCount = cnt
		}
		cats = append(cats, parent)
	}

	// เรียง main ขึ้นก่อน แล้วค่อย sub เรียงตาม id
	sort.Slice(cats, func(i, j int) bool {
		iIsMain := cats[i].ParentID == nil
		jIsMain := cats[j].ParentID == nil
		if iIsMain != jIsMain {
			return iIsMain
		}
		return cats[i].ID < cats[j].ID
	})

	return cats, nil
}

func (s *service) UpsertCategoryTree(ctx context.Context, in UpsertCategoryTreeInput) (Category, []Category, error) {
	if len(in.Subs) < 1 {
		return Category{}, nil, apperr.New(apperr.BadRequest, "sub_categories must have at least 1 item")
	}

	mainCreate := CreateInput{
		Name:      in.Main.Name,
		Slug:      in.Main.Slug,
		SortOrder: in.Main.SortOrder,
		IsActive:  in.Main.IsActive,
		ParentID:  nil,
		IconURL:   in.Main.IconURL,
	}

	if in.Main.Slug == nil {
		newSlug := generateSlug(in.Main.Name)
		mainCreate.Slug = &newSlug
	}
	if err := validateCreate(&mainCreate); err != nil {
		return Category{}, nil, err
	}

	subParams := make([]UpsertNodeParams, 0, len(in.Subs))
	for _, sc := range in.Subs {
		tmp := CreateInput{
			Name:      sc.Name,
			Slug:      sc.Slug,
			SortOrder: sc.SortOrder,
			IsActive:  sc.IsActive,
			ParentID:  nil,
		}
		if err := validateCreate(&tmp); err != nil {
			return Category{}, nil, err
		}

		subParams = append(subParams, UpsertNodeParams{
			ID:        sc.ID,
			Name:      tmp.Name,
			Slug:      *tmp.Slug,
			SortOrder: derefInt(tmp.SortOrder, 2),
			IsActive:  tmp.IsActive,
		})
	}

	mainParam := UpsertMainParams{
		ID:        in.Main.ID,
		Name:      mainCreate.Name,
		Slug:      *mainCreate.Slug,
		SortOrder: derefInt(mainCreate.SortOrder, 1),
		IsActive:  mainCreate.IsActive,
		IconURL:   in.Main.IconURL,
	}

	main, subs, err := s.repo.UpsertMainAndLinkSubs(ctx, mainParam, subParams)
	if err != nil {
		return Category{}, nil, err
	}
	return main, subs, nil
}

func (s *service) DeleteCategory(ctx context.Context, id int64) error {
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

	if strings.ToUpper(strings.TrimSpace(cur.IsActive)) != "NO" {
		return apperr.New(apperr.BadRequest, "category must be deactivated before deletion")
	}

	cnt, err := s.repo.CountProductsByCategory(ctx, id)
	if err != nil {
		return err
	}
	if cnt > 0 {
		return apperr.New(
			apperr.BadRequest,
			"category still has products, move them to another category first",
		)
	}

	return s.repo.DeleteCategoryHard(ctx, id)
}

func (s *service) DeactivateCategory(ctx context.Context, id int64, moveToSubID int64) (Category, error) {
	if id <= 0 {
		return Category{}, apperr.New(apperr.BadRequest, "invalid id")
	}

	cur, err := s.repo.Get(ctx, id)
	if err != nil {
		return Category{}, err
	}

	if cur.ParentID == nil {
		cnt, err := s.repo.CountSubcategories(ctx, id)
		if err != nil {
			return Category{}, err
		}
		if cnt > 0 {
			return Category{}, apperr.New(
				apperr.BadRequest,
				"cannot deactivate main category while it still has sub categories",
			)
		}
		return s.repo.SetCategoryActive(ctx, id, "NO")
	}

	cnt, err := s.repo.CountProductsByCategory(ctx, id)
	if err != nil {
		return Category{}, err
	}

	if cnt > 0 {
		if moveToSubID <= 0 {
			return Category{}, apperr.New(
				apperr.BadRequest,
				"category has products, move_to_sub_category_id is required",
			)
		}
		if moveToSubID == id {
			return Category{}, apperr.New(
				apperr.BadRequest,
				"move_to_sub_category_id cannot be same as source",
			)
		}

		target, err := s.repo.Get(ctx, moveToSubID)
		if err != nil {
			return Category{}, apperr.New(apperr.NotFound, "move_to category not found")
		}
		if target.ParentID == nil {
			return Category{}, apperr.New(
				apperr.BadRequest,
				"move_to_sub_category_id must be a sub category",
			)
		}
		if !strings.EqualFold(target.IsActive, "YES") {
			return Category{}, apperr.New(
				apperr.BadRequest,
				"move_to_sub_category_id must be active",
			)
		}
		if *cur.ParentID != *target.ParentID {
			return Category{}, apperr.New(
				apperr.BadRequest,
				"move_to_sub_category_id must be in the same main category",
			)
		}

		deactivated, _, err := s.repo.DeactivateSubAndMoveProducts(ctx, id, moveToSubID)
		if err != nil {
			return Category{}, err
		}
		return deactivated, nil
	}

	return s.repo.SetCategoryActive(ctx, id, "NO")
}

// impl — เหมือน UpsertCategoryTree แต่เพิ่ม deactivate subs ที่ไม่ได้ส่งมา
func (s *service) UpsertCategoryTreeFull(ctx context.Context, in UpsertCategoryTreeInput) (Category, []Category, error) {
	if in.Main.ID == nil || *in.Main.ID <= 0 {
		return Category{}, nil, apperr.New(apperr.BadRequest, "main_category.id is required for full upsert")
	}
	if len(in.Subs) < 1 {
		return Category{}, nil, apperr.New(apperr.BadRequest, "sub_categories must have at least 1 item")
	}

	mainCreate := CreateInput{
		Name:      in.Main.Name,
		Slug:      in.Main.Slug,
		SortOrder: in.Main.SortOrder,
		IsActive:  in.Main.IsActive,
		ParentID:  nil,
		IconURL:   in.Main.IconURL,
	}
	if err := validateCreate(&mainCreate); err != nil {
		return Category{}, nil, err
	}

	subParams := make([]UpsertNodeParams, 0, len(in.Subs))
	for _, sc := range in.Subs {
		tmp := CreateInput{
			Name:      sc.Name,
			Slug:      sc.Slug,
			SortOrder: sc.SortOrder,
			IsActive:  sc.IsActive,
		}
		if err := validateCreate(&tmp); err != nil {
			return Category{}, nil, err
		}

		subParams = append(subParams, UpsertNodeParams{
			ID:        sc.ID,
			Name:      tmp.Name,
			Slug:      *tmp.Slug,
			SortOrder: derefInt(tmp.SortOrder, 2),
			IsActive:  tmp.IsActive,
		})
	}

	mainParam := UpsertMainParams{
		ID:        in.Main.ID,
		Name:      mainCreate.Name,
		Slug:      *mainCreate.Slug,
		SortOrder: derefInt(mainCreate.SortOrder, 1),
		IsActive:  mainCreate.IsActive,
		IconURL:   in.Main.IconURL,
	}

	if err := s.validateFullUpsertDeactivateRules(
		ctx,
		int64(*in.Main.ID),
		mainParam.IsActive,
		subParams,
	); err != nil {
		return Category{}, nil, err
	}

	return s.repo.UpsertMainAndLinkSubsFull(ctx, mainParam, subParams)
}

func (s *service) GetBySlug(ctx context.Context, slug string) (Category, error) {
	return s.repo.GetBySlug(ctx, slug)
}

func (s *service) validateDeactivateSubcategories(
	ctx context.Context,
	mainID int64,
	subs []UpsertNodeParams,
) error {
	sentIDs := make(map[int64]struct{}, len(subs))

	for _, sc := range subs {
		if sc.ID != nil && *sc.ID > 0 {
			subID := int64(*sc.ID)
			sentIDs[subID] = struct{}{}

			if strings.EqualFold(strings.TrimSpace(sc.IsActive), "NO") {
				cnt, err := s.repo.CountProductsByCategory(ctx, subID)
				if err != nil {
					return err
				}
				if cnt > 0 {
					return apperr.New(
						apperr.BadRequest,
						"cannot deactivate category that still has products, use PATCH /:id/deactivate with move_to_sub_category_id instead",
					)
				}
			}
		}
	}

	existingSubs, err := s.repo.List(ctx, "", &mainID, false, 1000, 1)
	if err != nil {
		return err
	}

	for _, ex := range existingSubs {
		if ex.ParentID == nil {
			continue
		}
		if _, ok := sentIDs[int64(ex.ID)]; ok {
			continue
		}

		cnt, err := s.repo.CountProductsByCategory(ctx, int64(ex.ID))
		if err != nil {
			return err
		}
		if cnt > 0 {
			return apperr.New(
				apperr.BadRequest,
				"cannot deactivate category that still has products, use PATCH /:id/deactivate with move_to_sub_category_id instead",
			)
		}
	}

	return nil
}

func (s *service) validateFullUpsertDeactivateRules(
	ctx context.Context,
	mainID int64,
	mainIsActive string,
	subs []UpsertNodeParams,
) error {
	if strings.EqualFold(strings.TrimSpace(mainIsActive), "NO") {
		if len(subs) > 0 {
			return apperr.New(
				apperr.BadRequest,
				"cannot deactivate main category while it still has sub categories",
			)
		}

		cnt, err := s.repo.CountSubcategories(ctx, mainID)
		if err != nil {
			return err
		}
		if cnt > 0 {
			return apperr.New(
				apperr.BadRequest,
				"cannot deactivate main category while it still has sub categories",
			)
		}
	}

	if err := s.validateDeactivateSubcategories(ctx, mainID, subs); err != nil {
		return err
	}

	return nil
}
