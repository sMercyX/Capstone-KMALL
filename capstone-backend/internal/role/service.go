package role

import (
	"context"
	"strings"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
)

type Service interface {
	List(ctx context.Context) ([]Role, error)
	GetIDByName(ctx context.Context, name string) (int64, error)
	ListNamesByUserID(ctx context.Context, userID string) ([]string, error)
	ListByUserID(ctx context.Context, userID string) ([]Role, error)
	Has(ctx context.Context, userID string, roleName string) (bool, error)
}

type service struct {
	repo Repo
}

func NewService(r Repo) Service {
	return &service{repo: r}
}

func (s *service) List(ctx context.Context) ([]Role, error) {
	roles, err := s.repo.List(ctx)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list roles failed")
	}
	if roles == nil {
		roles = []Role{}
	}
	return roles, nil
}

func (s *service) GetIDByName(ctx context.Context, name string) (int64, error) {
	id, err := s.repo.GetIDByName(ctx, name)
	if err != nil {
		return 0, err
	}
	return id, nil
}

// role/service.go
func (s *service) ListNamesByUserID(ctx context.Context, userIDOrSubject string) ([]string, error) {
	names, err := s.repo.ListNamesByUserID(ctx, userIDOrSubject)
	if err == nil && len(names) > 0 {
		return names, nil
	}

	internalID, err := s.repo.GetUserIDBySubject(ctx, userIDOrSubject)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(internalID) == "" {
		return []string{}, nil
	}

	names, err = s.repo.ListNamesByUserID(ctx, internalID)
	if err != nil {
		return nil, err
	}
	if names == nil {
		names = []string{}
	}
	return names, nil
}

func (s *service) ListByUserID(ctx context.Context, userID string) ([]Role, error) {
	roles, err := s.repo.ListByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if roles == nil {
		roles = []Role{}
	}
	return roles, nil
}

func (s *service) Has(ctx context.Context, userID string, roleName string) (bool, error) {
	target := strings.ToLower(strings.TrimSpace(roleName))
	if target == "" {
		return false, nil
	}

	names, err := s.repo.ListNamesByUserID(ctx, userID)
	if err != nil {
		return false, err
	}

	for _, n := range names {
		if strings.ToLower(strings.TrimSpace(n)) == target {
			return true, nil
		}
	}
	return false, nil
}
