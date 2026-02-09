package address

import (
	"context"
	"strings"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
)

type Service interface {
	ListMy(ctx context.Context, userID string) ([]Address, error)
	GetMyByID(ctx context.Context, userID string, id int64) (Address, error)
	Create(ctx context.Context, userID string, in CreateAddressInput) (Address, error)
	Update(ctx context.Context, userID string, id int64, in UpdateAddressInput) (Address, error)
	Delete(ctx context.Context, userID string, id int64) error
	Get(ctx context.Context, id int64) (Address, error)
}

type service struct{ repo Repo }

func NewService(r Repo) Service {
	return &service{repo: r}
}

func (s *service) ListMy(ctx context.Context, userID string) ([]Address, error) {
	if userID == "" {
		return nil, apperr.New(apperr.BadRequest, "invalid user_id")
	}
	return s.repo.ListByUser(ctx, userID)
}

func (s *service) GetMyByID(ctx context.Context, userID string, id int64) (Address, error) {
	addr, err := s.repo.Get(ctx, id)
	if err != nil {
		return Address{}, err
	}

	if addr.UserID != userID {
		return Address{}, apperr.New(apperr.Forbidden, "not your address")
	}

	return addr, nil
}

func (s *service) Create(ctx context.Context, userID string, in CreateAddressInput) (Address, error) {
	in.AddressLine1 = strings.TrimSpace(in.AddressLine1)
	if in.AddressLine1 == "" {
		return Address{}, apperr.New(apperr.BadRequest, "address_line1 is required")
	}
	return s.repo.Create(ctx, userID, in)
}

func (s *service) Update(ctx context.Context, userID string, id int64, in UpdateAddressInput) (Address, error) {
	if id <= 0 {
		return Address{}, apperr.New(apperr.BadRequest, "invalid address_id")
	}
	addr, err := s.repo.Get(ctx, id)
	if err != nil {
		return Address{}, err
	}
	if addr.UserID != userID {
		return Address{}, apperr.New(apperr.Forbidden, "not your address")
	}
	return s.repo.Update(ctx, id, in)
}

func (s *service) Delete(ctx context.Context, userID string, id int64) error {
	addr, err := s.repo.Get(ctx, id)
	if err != nil {
		return err
	}
	if addr.UserID != userID {
		return apperr.New(apperr.Forbidden, "not your address")
	}
	return s.repo.Delete(ctx, id)
}

func (s *service) Get(ctx context.Context, id int64) (Address, error) {
	return s.repo.Get(ctx, id)
}
