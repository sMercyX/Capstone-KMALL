package user

import "context"

type Service interface {
	List(ctx context.Context) ([]User, error)
	Get(ctx context.Context, id string) (User, error)
	Create(ctx context.Context, u User) (User, error)
	Update(ctx context.Context, id string, u User) (User, error)
	Delete(ctx context.Context, id string) error

	UpsertAndEnsureBuyer(ctx context.Context, msOID, email, name string) (User, error)
}

type service struct{ repo Repo }

func NewService(r Repo) Service { return &service{repo: r} }

func (s *service) List(ctx context.Context) ([]User, error)         { return s.repo.List(ctx) }
func (s *service) Get(ctx context.Context, id string) (User, error) { return s.repo.Get(ctx, id) }
func (s *service) Create(ctx context.Context, u User) (User, error) { return s.repo.Create(ctx, u) }
func (s *service) Update(ctx context.Context, id string, u User) (User, error) {
	return s.repo.Update(ctx, id, u)
}
func (s *service) Delete(ctx context.Context, id string) error { return s.repo.Delete(ctx, id) }

func (s *service) UpsertAndEnsureBuyer(ctx context.Context, msOID, email, name string) (User, error) {
	u, err := s.repo.UpsertByMS(ctx, msOID, email, name)
	if err != nil { return User{}, err }
	roleID, err := s.repo.EnsureBuyerRole(ctx)
	if err != nil { return User{}, err }
	if err := s.repo.LinkRole(ctx, u.ID, roleID); err != nil { return User{}, err }
	return u, nil
}
