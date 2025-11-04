package user

import (
	"context"
	"fmt"
	"strings"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
)

type Service interface {
	List(ctx context.Context) ([]User, error)
	Get(ctx context.Context, id string) (User, error)
	// Create(ctx context.Context, u User) (User, error)
	// Update(ctx context.Context, id string, u User) (User, error)
	Delete(ctx context.Context, id string) (User, error)

	UpsertAndEnsureBuyer(ctx context.Context, msOID, email, name string) (User, error)

	FindByID(ctx context.Context, id string) (User, error)
	GetRoles(ctx context.Context, userID string) ([]string, error)
}

type service struct{ repo Repo }

func NewService(r Repo) Service { return &service{repo: r} }

func (s *service) List(ctx context.Context) ([]User, error)         { return s.repo.List(ctx) }
func (s *service) Get(ctx context.Context, id string) (User, error) { return s.repo.Get(ctx, id) }

// func (s *service) Create(ctx context.Context, u User) (User, error) {
// 	if err := validateUser(u); err != nil {
// 		return User{}, err
// 	}
// 	u.Email = strings.ToLower(u.Email)
// 	return s.repo.Create(ctx, u)
// }

// func (s *service) Update(ctx context.Context, id string, u User) (User, error) {
// 	if err := validateUser(u); err != nil {
// 		return User{}, err
// 	}
// 	u.Email = strings.ToLower(u.Email)
// 	return s.repo.Update(ctx, id, u)
// }

func (s *service) Delete(ctx context.Context, id string) (User, error) {
	return s.repo.Delete(ctx, id)
}

func (s *service) UpsertAndEnsureBuyer(ctx context.Context, msOID, email, name string) (User, error) {
	u, err := s.repo.UpsertByMS(ctx, msOID, strings.ToLower(email), name)
	if err != nil {
		fmt.Printf("[DEBUG] UpsertByMS failed: %+v\n", err)
		return User{}, err
	}

	roleID, err := s.repo.EnsureBuyerRole(ctx)
	if err != nil {
		fmt.Printf("[DEBUG] EnsureBuyerRole failed: %+v\n", err)
		return User{}, apperr.Wrap(apperr.Internal, err, "ensure buyer role failed")
	}

	if err := s.repo.LinkRole(ctx, u.ID, roleID); err != nil {
		fmt.Printf("[DEBUG] LinkRole failed: %+v\n", err)
		return User{}, apperr.Wrap(apperr.Internal, err, "link buyer role failed")
	}

	return u, nil
}

// ===== เพิ่มใหม่สำหรับ JWT/Refresh =====

func (s *service) FindByID(ctx context.Context, id string) (User, error) {
	return s.repo.Get(ctx, id)
}

func (s *service) GetRoles(ctx context.Context, userID string) ([]string, error) {
	return s.repo.GetRolesByUserID(ctx, userID)
}

// ——— helpers ———

func validateUser(u User) error {
	fields := map[string]any{}
	if u.Email == "" {
		fields["email"] = "required"
	}
	if u.DisplayName == "" {
		fields["display_name"] = "required"
	}
	if len(fields) > 0 {
		return apperr.WithFields(apperr.New(apperr.BadRequest, "validation failed"), fields)
	}
	return nil
}
