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

type UpdateInput struct {
	Name      *string `json:"name,omitempty"`
	Slug      *string `json:"slug,omitempty"`
	ParentID  *int    `json:"parent_id,omitempty"`
	SortOrder *int    `json:"sort_order,omitempty"`
	IsActive  *string `json:"is_active,omitempty"` // YES/NO
}

type Service interface {
	Create(ctx context.Context, in CreateInput) (Category, error)
	Get(ctx context.Context, id int64) (Category, error)
	List(ctx context.Context, q string, parentID *int64, activeOnly bool) ([]Category, error)
	Update(ctx context.Context, id int64, in UpdateInput) (Category, error)
	Delete(ctx context.Context, id int64) error
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

func (s *service) Create(ctx context.Context, in CreateInput) (Category, error) {
	if err := validateCreate(&in); err != nil {
		return Category{}, err
	}

	// default sortOrder
	sortOrder := 0
	if in.SortOrder != nil {
		sortOrder = *in.SortOrder
	}

	params := CreateParams{
		Name:      in.Name,
		Slug:      *in.Slug,
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

func (s *service) List(ctx context.Context, q string, parentID *int64, activeOnly bool) ([]Category, error) {
	q = strings.TrimSpace(q)
	return s.repo.List(ctx, q, parentID, activeOnly)
}

func (s *service) Update(ctx context.Context, id int64, in UpdateInput) (Category, error) {
	if id <= 0 {
		return Category{}, apperr.New(apperr.BadRequest, "invalid id")
	}
	if err := validateUpdate(&in); err != nil {
		return Category{}, err
	}

	params := UpdateParams(in)
	return s.repo.Update(ctx, id, params)
}

func (s *service) Delete(ctx context.Context, id int64) error {
	if id <= 0 {
		return apperr.New(apperr.BadRequest, "invalid id")
	}
	return s.repo.Delete(ctx, id)
}
