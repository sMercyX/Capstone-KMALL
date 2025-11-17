package store

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgconn"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
)

type Repo interface {
	Create(ctx context.Context, userID string, in CreateParams) (Store, error)
	Get(ctx context.Context, id int64) (Store, error)
	GetByUserID(ctx context.Context, userID string) (Store, error)
	List(ctx context.Context, q string, limit, page int) ([]Store, error)
	Update(ctx context.Context, id int64, in UpdateParams) (Store, error)
	Delete(ctx context.Context, id int64) error
}

type repo struct{ db *pgxpool.Pool }

func NewRepo(db *pgxpool.Pool) Repo { return &repo{db: db} }

type CreateParams struct {
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
	ProfileURL  *string `json:"profile_url,omitempty"`
	IsActive    string  `json:"is_active"`
}

// ===== Create Store =====
func (r *repo) Create(ctx context.Context, userID string, in CreateParams) (Store, error) {
	in.IsActive = strings.ToUpper(strings.TrimSpace(in.IsActive))
	if in.IsActive == "" {
		in.IsActive = "YES"
	}

	// ตรวจสอบว่าผู้ใช้มีร้านแล้วหรือยัง
	var existsID int
	err := r.db.QueryRow(ctx, `
		SELECT store_id FROM stores WHERE user_id = $1 LIMIT 1;
	`, userID).Scan(&existsID)

	if err == nil {
		return Store{}, apperr.New(apperr.Conflict, "user already owns a store")
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return Store{}, apperr.Wrap(apperr.Internal, err, "check existing store failed")
	}

	var s Store
	err = r.db.QueryRow(ctx, `
		INSERT INTO stores (store_name, store_desc, profile_url, is_active, user_id)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING store_id, store_name, store_desc, profile_url, is_active,
		          created_at, updated_at, user_id;
	`, in.Name, in.Description, in.ProfileURL, in.IsActive, userID).
		Scan(&s.ID, &s.Name, &s.Description, &s.ProfileURL, &s.IsActive,
			&s.CreatedAt, &s.UpdatedAt, &s.UserID)

	if err != nil {
		if pgErr, ok := err.(*pgconn.PgError); ok && pgErr.Code == "23505" {
			return Store{}, apperr.New(apperr.Conflict, "user already owns a store")
		}
		return Store{}, apperr.Wrap(apperr.Internal, err, "insert store failed")
	}
	return s, nil
}

// ===== Get Store by ID =====
func (r *repo) Get(ctx context.Context, id int64) (Store, error) {
	var s Store
	err := r.db.QueryRow(ctx, `
		SELECT store_id, store_name, store_desc, profile_url, is_active,
		       created_at, updated_at, user_id
		FROM stores WHERE store_id = $1;
	`, id).Scan(&s.ID, &s.Name, &s.Description, &s.ProfileURL,
		&s.IsActive, &s.CreatedAt, &s.UpdatedAt, &s.UserID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Store{}, apperr.New(apperr.NotFound, "store not found")
		}
		return Store{}, apperr.Wrap(apperr.Internal, err, "get store failed")
	}
	return s, nil
}

// ===== Get Store by User ID =====
func (r *repo) GetByUserID(ctx context.Context, userID string) (Store, error) {
	var s Store
	err := r.db.QueryRow(ctx, `
		SELECT store_id, store_name, store_desc, profile_url, is_active,
		       created_at, updated_at, user_id
		FROM stores
		WHERE user_id = $1
		LIMIT 1;
	`, userID).Scan(&s.ID, &s.Name, &s.Description, &s.ProfileURL,
		&s.IsActive, &s.CreatedAt, &s.UpdatedAt, &s.UserID)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Store{}, apperr.New(apperr.NotFound, "store not found for this user")
		}
		return Store{}, apperr.Wrap(apperr.Internal, err, "get store by user_id failed")
	}
	return s, nil
}

// ===== List Stores (optional: search + pagination) =====
func (r *repo) List(ctx context.Context, q string, limit, page int) ([]Store, error) {
	if limit <= 0 {
		limit = 10
	}
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit
	q = strings.TrimSpace(q)

	var rows pgx.Rows
	var err error
	if q != "" {
		rows, err = r.db.Query(ctx, `
			SELECT store_id, store_name, store_desc, profile_url, is_active,
			       created_at, updated_at, user_id
			FROM stores
			WHERE LOWER(store_name) LIKE LOWER('%' || $1 || '%')
			ORDER BY created_at DESC
			LIMIT $2 OFFSET $3;
		`, q, limit, offset)
	} else {
		rows, err = r.db.Query(ctx, `
			SELECT store_id, store_name, store_desc, profile_url, is_active,
			       created_at, updated_at, user_id
			FROM stores
			ORDER BY created_at DESC
			LIMIT $1 OFFSET $2;
		`, limit, offset)
	}
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list stores failed")
	}
	defer rows.Close()

	var out []Store
	for rows.Next() {
		var s Store
		if err := rows.Scan(&s.ID, &s.Name, &s.Description, &s.ProfileURL,
			&s.IsActive, &s.CreatedAt, &s.UpdatedAt, &s.UserID); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan store failed")
		}
		out = append(out, s)
	}
	if err := rows.Err(); err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "rows error")
	}
	return out, nil
}

// ===== Update Store =====
type UpdateParams struct {
	Name        *string
	Description *string
	ProfileURL  *string
	IsActive    *string
}

func (r *repo) Update(ctx context.Context, id int64, in UpdateParams) (Store, error) {
	var s Store
	err := r.db.QueryRow(ctx, `
		UPDATE stores
		SET store_name = COALESCE($2, store_name),
		    store_desc = COALESCE($3, store_desc),
		    profile_url = COALESCE($4, profile_url),
		    is_active = COALESCE($5, is_active),
		    updated_at = NOW()
		WHERE store_id = $1
		RETURNING store_id, store_name, store_desc, profile_url, is_active,
		          created_at, updated_at, user_id;
	`, id, in.Name, in.Description, in.ProfileURL, in.IsActive).
		Scan(&s.ID, &s.Name, &s.Description, &s.ProfileURL,
			&s.IsActive, &s.CreatedAt, &s.UpdatedAt, &s.UserID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Store{}, apperr.New(apperr.NotFound, "store not found")
		}
		return Store{}, apperr.Wrap(apperr.Internal, err, "update store failed")
	}
	return s, nil
}

// ===== Delete Store =====
func (r *repo) Delete(ctx context.Context, id int64) error {
	_, err := r.db.Exec(ctx, `DELETE FROM stores WHERE store_id = $1;`, id)
	if err != nil {
		return apperr.Wrap(apperr.Internal, err, "delete store failed")
	}
	return nil
}
