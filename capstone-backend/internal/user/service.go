package user

import (
	"context"
	"fmt"
	"strings"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
)

const (
	roleBuyer  = "Buyer"
	roleSeller = "Seller"
	roleAdmin  = "Admin"
)

type roleLookup interface {
	GetIDByName(ctx context.Context, name string) (int64, error)
	ListNamesByUserID(ctx context.Context, userID string) ([]string, error)
}

type Service interface {
	List(ctx context.Context) ([]User, error)
	Get(ctx context.Context, id string) (User, error)
	// Create(ctx context.Context, u User) (User, error)
	// Update(ctx context.Context, id string, u User) (User, error)
	Delete(ctx context.Context, id string) (User, error)

	UpsertAndEnsureBuyer(ctx context.Context, msOID, email, name string) (User, error)

	FindByID(ctx context.Context, id string) (User, error)
	GetRoles(ctx context.Context, userID string) ([]string, error)

	AddRoles(ctx context.Context, targetID string, roleNames []string) error
	RemoveRoles(ctx context.Context, targetID string, roleNames []string) error
}

type service struct {
	repo  Repo
	roles roleLookup
}

func NewService(r Repo, rl roleLookup) Service {
	return &service{repo: r, roles: rl}
}

func (s *service) List(ctx context.Context) ([]User, error)         { return s.repo.List(ctx) }
func (s *service) Get(ctx context.Context, id string) (User, error) { return s.repo.Get(ctx, id) }

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

// ===== JWT/Refresh =====
func (s *service) FindByID(ctx context.Context, id string) (User, error) {
	return s.repo.Get(ctx, id)
}

func (s *service) GetRoles(ctx context.Context, userID string) ([]string, error) {
	return s.repo.GetRolesByUserID(ctx, userID)
}

func (s *service) AddRoles(ctx context.Context, targetID string, roleNames []string) error {
	names := normalize(roleNames)
	if len(names) == 0 {
		return nil
	}

	if needsBuyer(names) {
		has, err := s.userHasRole(ctx, targetID, roleBuyer)
		if err != nil {
			return err
		}
		if !has {
			bid, err := s.roles.GetIDByName(ctx, roleBuyer)
			if err != nil {
				return err
			}
			if err := s.repo.AddUserRoles(ctx, targetID, []int64{bid}); err != nil {
				return err
			}
		}
	}

	ids, err := s.resolveRoleIDs(ctx, names)
	if err != nil {
		return err
	}
	return s.repo.AddUserRoles(ctx, targetID, ids)
}

func (s *service) RemoveRoles(ctx context.Context, targetID string, roleNames []string) error {
	var filtered []string
	for _, n := range normalize(roleNames) {
		if !strings.EqualFold(n, roleBuyer) {
			filtered = append(filtered, n)
		}
	}
	if len(filtered) == 0 {
		return nil
	}

	ids, err := s.resolveRoleIDs(ctx, filtered)
	if err != nil {
		return err
	}
	return s.repo.RemoveUserRoles(ctx, targetID, ids)
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

func (s *service) userHasRole(ctx context.Context, userID, name string) (bool, error) {
	names, err := s.roles.ListNamesByUserID(ctx, userID)
	if err != nil {
		return false, err
	}
	needle := strings.ToLower(strings.TrimSpace(name))
	for _, n := range names {
		if strings.ToLower(strings.TrimSpace(n)) == needle {
			return true, nil
		}
	}
	return false, nil
}

func (s *service) resolveRoleIDs(ctx context.Context, names []string) ([]int64, error) {
	if len(names) == 0 {
		return nil, nil
	}
	seen := map[int64]struct{}{}
	var out []int64
	for _, n := range names {
		id, err := s.roles.GetIDByName(ctx, n)
		if err != nil {
			return nil, err
		}
		if _, dup := seen[id]; dup {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out, nil
}

func normalize(names []string) []string {
	var out []string
	for _, n := range names {
		if v := strings.TrimSpace(n); v != "" {
			out = append(out, v)
		}
	}
	return out
}

func needsBuyer(names []string) bool {
	for _, n := range names {
		if strings.EqualFold(n, roleSeller) || strings.EqualFold(n, roleAdmin) {
			return true
		}
	}
	return false
}
