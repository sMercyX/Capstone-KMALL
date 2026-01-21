package searchhistory

import (
	"context"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
)

type Repo interface {
	ListByUser(ctx context.Context, userID string, limit int) ([]SearchHistory, error)
	Upsert(ctx context.Context, userID string, queryText string) (SearchHistory, error)
	DeleteByID(ctx context.Context, userID string, searchID int64) error
	DeleteAll(ctx context.Context, userID string) (int64, error)
}

type repo struct{ db *pgxpool.Pool }

func NewRepo(db *pgxpool.Pool) Repo { return &repo{db: db} }

func (r *repo) ListByUser(ctx context.Context, userID string, limit int) ([]SearchHistory, error) {
	if limit <= 0 {
		limit = 10
	}
	if limit > 50 {
		limit = 50
	}

	rows, err := r.db.Query(ctx, `
		SELECT search_id, user_id, query_text, searched_at
		FROM search_history
		WHERE user_id = $1
		ORDER BY searched_at DESC, search_id DESC
		LIMIT $2;
	`, userID, limit)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list search history failed")
	}
	defer rows.Close()

	out := make([]SearchHistory, 0, limit)
	for rows.Next() {
		var sh SearchHistory
		if err := rows.Scan(&sh.ID, &sh.UserID, &sh.QueryText, &sh.SearchedAt); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan search history failed")
		}
		out = append(out, sh)
	}

	if err := rows.Err(); err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "rows search history failed")
	}

	return out, nil
}

func (r *repo) Upsert(ctx context.Context, userID string, queryText string) (SearchHistory, error) {
	q := strings.TrimSpace(queryText)
	if q == "" {
		return SearchHistory{}, apperr.New(apperr.BadRequest, "query_text is required")
	}

	var sh SearchHistory

	err := r.db.QueryRow(ctx, `
		INSERT INTO search_history (user_id, query_text, searched_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (user_id, query_text)
		DO UPDATE SET searched_at = NOW()
		RETURNING search_id, user_id, query_text, searched_at;
	`, userID, q).Scan(&sh.ID, &sh.UserID, &sh.QueryText, &sh.SearchedAt)

	if err != nil {
		return SearchHistory{}, apperr.Wrap(apperr.Internal, err, "upsert search history failed")
	}

	return sh, nil
}

func (r *repo) DeleteByID(ctx context.Context, userID string, searchID int64) error {
	tag, err := r.db.Exec(ctx, `
		DELETE FROM search_history
		WHERE search_id = $1 AND user_id = $2;
	`, searchID, userID)
	if err != nil {
		return apperr.Wrap(apperr.Internal, err, "delete search history failed")
	}

	if tag.RowsAffected() == 0 {
		return apperr.New(apperr.NotFound, "search history not found")
	}

	return nil
}

func (r *repo) DeleteAll(ctx context.Context, userID string) (int64, error) {
	tag, err := r.db.Exec(ctx, `
		DELETE FROM search_history
		WHERE user_id = $1;
	`, userID)
	if err != nil {
		return 0, apperr.Wrap(apperr.Internal, err, "delete all search history failed")
	}

	return tag.RowsAffected(), nil
}
