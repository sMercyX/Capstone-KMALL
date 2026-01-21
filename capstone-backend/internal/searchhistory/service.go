package searchhistory

import (
	"context"
	"strings"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
)

type Service interface {
	ListByUser(ctx context.Context, userID string, limit int) ([]SearchHistory, error)
	Create(ctx context.Context, userID string, queryText string) (SearchHistory, error)
	Delete(ctx context.Context, userID string, searchID int64) error
	DeleteAll(ctx context.Context, userID string) (int64, error)
}

type service struct {
	repo Repo
}

func NewService(repo Repo) Service {
	return &service{repo: repo}
}

func (s *service) ListByUser(ctx context.Context, userID string, limit int) ([]SearchHistory, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return nil, apperr.New(apperr.BadRequest, "user_id is required")
	}

	if limit <= 0 {
		limit = 10
	}
	if limit > 50 {
		limit = 50
	}

	out, err := s.repo.ListByUser(ctx, userID, limit)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (s *service) Create(ctx context.Context, userID string, queryText string) (SearchHistory, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return SearchHistory{}, apperr.New(apperr.BadRequest, "user_id is required")
	}

	q := normalizeQuery(queryText)
	if q == "" {
		return SearchHistory{}, apperr.New(apperr.BadRequest, "query_text is required")
	}

	if len([]rune(q)) > 200 {
		return SearchHistory{}, apperr.New(apperr.BadRequest, "query_text too long (max 200 chars)")
	}

	sh, err := s.repo.Upsert(ctx, userID, q)
	if err != nil {
		return SearchHistory{}, err
	}
	return sh, nil
}

func (s *service) Delete(ctx context.Context, userID string, searchID int64) error {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return apperr.New(apperr.BadRequest, "user_id is required")
	}
	if searchID <= 0 {
		return apperr.New(apperr.BadRequest, "invalid search_id")
	}
	return s.repo.DeleteByID(ctx, userID, searchID)
}

func (s *service) DeleteAll(ctx context.Context, userID string) (int64, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return 0, apperr.New(apperr.BadRequest, "user_id is required")
	}
	return s.repo.DeleteAll(ctx, userID)
}

func normalizeQuery(q string) string {
	q = strings.TrimSpace(q)
	if q == "" {
		return ""
	}

	q = strings.Join(strings.Fields(q), " ")

	return q
}
