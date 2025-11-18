package product

import (
	"context"
	"net/url"
	"strings"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
)

type CreateInput struct {
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
	Price       float64 `json:"price"`
	ImageURL    *string `json:"image_url,omitempty"`
	IsActive    string  `json:"is_active,omitempty"`
	StoreID     int     `json:"store_id"`
	CategoryID  int     `json:"category_id"`
}

type UpdateInput struct {
	Name        *string  `json:"name,omitempty"`
	Description *string  `json:"description,omitempty"`
	Price       *float64 `json:"price,omitempty"`
	ImageURL    *string  `json:"image_url,omitempty"`
	IsActive    *string  `json:"is_active,omitempty"`
	CategoryID  *int     `json:"category_id,omitempty"`
}

type Service interface {
	Create(ctx context.Context, in CreateInput) (Product, error)
	Get(ctx context.Context, id int64) (Product, error)
	ListByStoreID(ctx context.Context, storeID int64) ([]Product, error)
	Update(ctx context.Context, id int64, in UpdateInput) (Product, error)
	Delete(ctx context.Context, id int64) error

	ListPublic(ctx context.Context, q string, categoryID *int64, parentCategoryID *int64, storeID *int64, limit, page int) ([]Product, int64, error)
	GetPublic(ctx context.Context, id int64) (Product, error)
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

func trimPtr(p *string) *string {
	if p == nil {
		return nil
	}
	v := strings.TrimSpace(*p)
	return &v
}

func validatePrice(val float64) error {
	if val <= 0 {
		return apperr.New(apperr.BadRequest, "price must be greater than 0")
	}
	return nil
}

func validateCreate(in *CreateInput) error {
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" {
		return apperr.New(apperr.BadRequest, "name is required")
	}
	if len(in.Name) > 100 {
		return apperr.New(apperr.BadRequest, "name must be at most 100 characters")
	}

	in.Description = trimPtr(in.Description)
	if in.Description != nil && len(*in.Description) > 255 {
		return apperr.New(apperr.BadRequest, "description must be at most 255 characters")
	}

	if err := validatePrice(in.Price); err != nil {
		return err
	}

	in.ImageURL = trimPtr(in.ImageURL)
	if in.ImageURL != nil && *in.ImageURL != "" {
		if len(*in.ImageURL) > 255 {
			return apperr.New(apperr.BadRequest, "image_url must be at most 255 characters")
		}
		if _, err := url.ParseRequestURI(*in.ImageURL); err != nil {
			return apperr.New(apperr.BadRequest, "image_url is not a valid URL")
		}
	}

	if in.StoreID <= 0 {
		return apperr.New(apperr.BadRequest, "store_id must be positive")
	}
	if in.CategoryID <= 0 {
		return apperr.New(apperr.BadRequest, "category_id must be positive")
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
		if len(n) > 100 {
			return apperr.New(apperr.BadRequest, "name must be at most 100 characters")
		}
		*in.Name = n
	}

	if in.Description != nil {
		d := strings.TrimSpace(*in.Description)
		if len(d) > 255 {
			return apperr.New(apperr.BadRequest, "description must be at most 255 characters")
		}
		*in.Description = d
	}

	if in.Price != nil {
		if *in.Price <= 0 {
			return apperr.New(apperr.BadRequest, "price must be greater than 0")
		}
	}

	if in.ImageURL != nil {
		u := strings.TrimSpace(*in.ImageURL)
		if u != "" {
			if len(u) > 255 {
				return apperr.New(apperr.BadRequest, "image_url must be at most 255 characters")
			}
			if _, err := url.ParseRequestURI(u); err != nil {
				return apperr.New(apperr.BadRequest, "image_url is not a valid URL")
			}
		}
		*in.ImageURL = u
	}

	if in.IsActive != nil {
		v := normalizeYesNo(*in.IsActive, "")
		if v == "" {
			return apperr.New(apperr.BadRequest, "is_active must be YES or NO")
		}
		*in.IsActive = v
	}

	if in.CategoryID != nil && *in.CategoryID <= 0 {
		return apperr.New(apperr.BadRequest, "category_id must be positive")
	}

	return nil
}

func (s *service) Create(ctx context.Context, in CreateInput) (Product, error) {
	if err := validateCreate(&in); err != nil {
		return Product{}, err
	}

	params := CreateParams(in)
	return s.repo.Create(ctx, params)
}

func (s *service) Get(ctx context.Context, id int64) (Product, error) {
	if id <= 0 {
		return Product{}, apperr.New(apperr.BadRequest, "invalid id")
	}
	return s.repo.Get(ctx, id)
}

func (s *service) ListByStoreID(ctx context.Context, storeID int64) ([]Product, error) {
	if storeID <= 0 {
		return nil, apperr.New(apperr.BadRequest, "invalid store_id")
	}
	return s.repo.ListByStoreID(ctx, storeID)
}

func (s *service) Update(ctx context.Context, id int64, in UpdateInput) (Product, error) {
	if id <= 0 {
		return Product{}, apperr.New(apperr.BadRequest, "invalid id")
	}
	if err := validateUpdate(&in); err != nil {
		return Product{}, err
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

func (s *service) ListPublic(ctx context.Context, q string, categoryID *int64, parentCategoryID *int64, storeID *int64, limit, page int) ([]Product, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}
	q = strings.TrimSpace(q)
	return s.repo.ListPublic(ctx, q, categoryID, parentCategoryID, storeID, limit, page)
}

func (s *service) GetPublic(ctx context.Context, id int64) (Product, error) {
	if id <= 0 {
		return Product{}, apperr.New(apperr.BadRequest, "invalid id")
	}
	return s.repo.GetPublic(ctx, id)
}
