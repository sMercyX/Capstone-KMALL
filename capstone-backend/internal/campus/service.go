package campus

import (
	"context"
	"strings"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
)

type Service interface {
	ListActive(ctx context.Context, q string, zone *string) ([]Location, error)
	ListZones(ctx context.Context) ([]string, error)

	Get(ctx context.Context, id int64) (Location, error)
	Create(ctx context.Context, in CreateLocationInput) (Location, error)
	Update(ctx context.Context, id int64, in UpdateLocationInput) (Location, error)
	Delete(ctx context.Context, id int64) error
}

type service struct{ repo Repo }

func NewService(r Repo) Service { return &service{repo: r} }

func (s *service) ListActive(ctx context.Context, q string, zone *string) ([]Location, error) {
	q = strings.TrimSpace(q)

	if zone != nil {
		z := strings.TrimSpace(*zone)
		if z == "" {
			zone = nil
		} else {
			zone = &z
		}
	}

	return s.repo.ListActive(ctx, q, zone)
}

func (s *service) ListZones(ctx context.Context) ([]string, error) {
	return s.repo.ListZones(ctx)
}

func (s *service) Get(ctx context.Context, id int64) (Location, error) {
	if id <= 0 {
		return Location{}, apperr.New(apperr.BadRequest, "invalid campus_location_id")
	}
	return s.repo.Get(ctx, id)
}

func (s *service) Create(ctx context.Context, in CreateLocationInput) (Location, error) {
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" {
		return Location{}, apperr.New(apperr.BadRequest, "name is required")
	}

	if in.Zone != nil {
		z := strings.TrimSpace(*in.Zone)
		if z == "" {
			in.Zone = nil
		} else {
			in.Zone = &z
		}
	}

	return s.repo.Create(ctx, in)
}

func (s *service) Update(ctx context.Context, id int64, in UpdateLocationInput) (Location, error) {
	if id <= 0 {
		return Location{}, apperr.New(apperr.BadRequest, "invalid campus_location_id")
	}

	if in.Name != nil {
		n := strings.TrimSpace(*in.Name)
		if n == "" {
			return Location{}, apperr.New(apperr.BadRequest, "name cannot be empty")
		}
		in.Name = &n
	}

	if in.Zone != nil {
		z := strings.TrimSpace(*in.Zone)
		if z == "" {
			// อนุญาตให้ client ส่ง "" เพื่อ "ล้างค่า zone"
			empty := ""
			in.Zone = &empty
		} else {
			in.Zone = &z
		}
	}

	return s.repo.Update(ctx, id, in)
}

func (s *service) Delete(ctx context.Context, id int64) error {
	if id <= 0 {
		return apperr.New(apperr.BadRequest, "invalid campus_location_id")
	}
	return s.repo.Delete(ctx, id)
}
