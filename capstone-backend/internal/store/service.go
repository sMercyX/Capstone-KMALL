package store

import (
	"context"
	"net/url"
	"strings"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
)

// ===== Service DTO =====

type CreateInput struct {
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
	ProfileURL  *string `json:"profile_url,omitempty"`
	// ว่าง/ไม่ได้ส่ง -> default "YES"
	IsActive string `json:"is_active,omitempty"` // "YES" | "NO"
}

type UpdateInput struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	ProfileURL  *string `json:"profile_url,omitempty"`
	IsActive    *string `json:"is_active,omitempty"` // "YES" | "NO"
}

// ===== Service Interface =====

type Service interface {
	Create(ctx context.Context, userID string, in CreateInput) (Store, error)
	Get(ctx context.Context, id int64) (Store, error)
	Me(ctx context.Context, userID string) (Store, error)
	List(ctx context.Context, q string, limit, page int) ([]Store, error)
	Update(ctx context.Context, id int64, in UpdateInput) (Store, error)
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

func trimPtr(p *string) *string {
	if p == nil {
		return nil
	}
	t := strings.TrimSpace(*p)
	return &t
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

	in.ProfileURL = trimPtr(in.ProfileURL)
	if in.ProfileURL != nil && *in.ProfileURL != "" {
		if len(*in.ProfileURL) > 255 {
			return apperr.New(apperr.BadRequest, "profile_url must be at most 255 characters")
		}
		if _, err := url.ParseRequestURI(*in.ProfileURL); err != nil {
			return apperr.New(apperr.BadRequest, "profile_url is not a valid URL")
		}
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

	if in.ProfileURL != nil {
		u := strings.TrimSpace(*in.ProfileURL)
		if u != "" {
			if len(u) > 255 {
				return apperr.New(apperr.BadRequest, "profile_url must be at most 255 characters")
			}
			if _, err := url.ParseRequestURI(u); err != nil {
				return apperr.New(apperr.BadRequest, "profile_url is not a valid URL")
			}
		}
		*in.ProfileURL = u
	}

	if in.IsActive != nil {
		v := strings.TrimSpace(strings.ToUpper(*in.IsActive))
		if v != "YES" && v != "NO" {
			return apperr.New(apperr.BadRequest, "is_active must be YES or NO")
		}
		*in.IsActive = v
	}
	return nil
}

// ===== Service Impl =====

func (s *service) Create(ctx context.Context, userID string, in CreateInput) (Store, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return Store{}, apperr.New(apperr.BadRequest, "user_id is required")
	}
	if err := validateCreate(&in); err != nil {
		return Store{}, err
	}

	// กันซ้ำเชิงแอป (ซ้ำกับ UNIQUE/เช็คใน repo เพื่อ error message ที่ชัดเจน)
	if _, err := s.repo.GetByUserID(ctx, userID); err == nil {
		return Store{}, apperr.New(apperr.Conflict, "user already owns a store")
	} else if apperr.From(err).Code != apperr.NotFound {
		return Store{}, apperr.Wrap(apperr.Internal, err, "check existing store failed")
	}

	return s.repo.Create(ctx, userID, CreateParams(in))
}

func (s *service) Get(ctx context.Context, id int64) (Store, error) {
	if id <= 0 {
		return Store{}, apperr.New(apperr.BadRequest, "invalid id")
	}
	return s.repo.Get(ctx, id)
}

func (s *service) Me(ctx context.Context, userID string) (Store, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return Store{}, apperr.New(apperr.BadRequest, "user_id is required")
	}
	return s.repo.GetByUserID(ctx, userID)
}

func (s *service) List(ctx context.Context, q string, limit, page int) ([]Store, error) {
	q = strings.TrimSpace(q)
	if limit <= 0 {
		limit = 10
	}
	if page <= 0 {
		page = 1
	}
	return s.repo.List(ctx, q, limit, page)
}

func (s *service) Update(ctx context.Context, id int64, in UpdateInput) (Store, error) {
	if id <= 0 {
		return Store{}, apperr.New(apperr.BadRequest, "invalid id")
	}
	if err := validateUpdate(&in); err != nil {
		return Store{}, err
	}

	return s.repo.Update(ctx, id, UpdateParams(in))
}

func (s *service) Delete(ctx context.Context, id int64) error {
	if id <= 0 {
		return apperr.New(apperr.BadRequest, "invalid id")
	}
	return s.repo.Delete(ctx, id)
}
