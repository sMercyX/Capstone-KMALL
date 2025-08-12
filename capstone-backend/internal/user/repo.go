package user

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
	List(ctx context.Context) ([]User, error)
	Get(ctx context.Context, id string) (User, error)
	Create(ctx context.Context, u User) (User, error)
	Update(ctx context.Context, id string, u User) (User, error)
	Delete(ctx context.Context, id string) error

	UpsertByMS(ctx context.Context, msOID, email, name string) (User, error)
	EnsureBuyerRole(ctx context.Context) (int64, error)
	LinkRole(ctx context.Context, userID string, roleID int64) error
}

type repo struct{ db *pgxpool.Pool }

func NewRepo(db *pgxpool.Pool) Repo { return &repo{db: db} }

func (r *repo) List(ctx context.Context) ([]User, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, ms_id, email, display_name, profile_url
		FROM users ORDER BY created_at DESC`)
	if err != nil { return nil, apperr.Wrap(apperr.Internal, err, "list users failed") }
	defer rows.Close()

	var out []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.MSID, &u.Email, &u.DisplayName, &u.ProfileURL); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan user failed")
		}
		out = append(out, u)
	}
	if err := rows.Err(); err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "rows error")
	}
	return out, nil
}

func (r *repo) Get(ctx context.Context, id string) (User, error) {
	var u User
	err := r.db.QueryRow(ctx, `
		SELECT id, ms_id, email, display_name, profile_url
		FROM users WHERE id=$1`, id).
		Scan(&u.ID, &u.MSID, &u.Email, &u.DisplayName, &u.ProfileURL)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return User{}, apperr.New(apperr.NotFound, "user not found")
		}
		return User{}, apperr.Wrap(apperr.Internal, err, "get user failed")
	}
	return u, nil
}

func (r *repo) Create(ctx context.Context, u User) (User, error) {
	u.Email = strings.ToLower(u.Email)
	err := r.db.QueryRow(ctx, `
		INSERT INTO users(ms_id, email, display_name)
		VALUES ($1,$2,$3)
		RETURNING id, ms_id, email, display_name, profile_url`,
		u.MSID, u.Email, u.DisplayName,
	).Scan(&u.ID, &u.MSID, &u.Email, &u.DisplayName, &u.ProfileURL)
	if err != nil {
		if pgErr, ok := err.(*pgconn.PgError); ok {
			switch pgErr.Code {
			case "23505": // unique_violation
				// ระบุ field ได้ถ้ามี constraint name
				return User{}, apperr.New(apperr.Conflict, "duplicate user")
			case "23514", "23502": // check_violation, not_null_violation
				return User{}, apperr.Wrap(apperr.BadRequest, err, "invalid user data")
			}
		}
		return User{}, apperr.Wrap(apperr.Internal, err, "create user failed")
	}
	return u, nil
}

func (r *repo) Update(ctx context.Context, id string, u User) (User, error) {
	u.Email = strings.ToLower(u.Email)
	err := r.db.QueryRow(ctx, `
		UPDATE users
		SET ms_id=$2, email=$3, display_name=$4
		WHERE id=$1
		RETURNING id, ms_id, email, display_name, profile_url`,
		id, u.MSID, u.Email, u.DisplayName,
	).Scan(&u.ID, &u.MSID, &u.Email, &u.DisplayName, &u.ProfileURL)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return User{}, apperr.New(apperr.NotFound, "user not found")
		}
		if pgErr, ok := err.(*pgconn.PgError); ok {
			switch pgErr.Code {
			case "23505":
				return User{}, apperr.New(apperr.Conflict, "duplicate user")
			case "23514", "23502":
				return User{}, apperr.Wrap(apperr.BadRequest, err, "invalid user data")
			}
		}
		return User{}, apperr.Wrap(apperr.Internal, err, "update user failed")
	}
	return u, nil
}

func (r *repo) Delete(ctx context.Context, id string) error {
	ct, err := r.db.Exec(ctx, `DELETE FROM users WHERE id=$1`, id)
	if err != nil {
		return apperr.Wrap(apperr.Internal, err, "delete user failed")
	}
	if ct.RowsAffected() == 0 {
		return apperr.New(apperr.NotFound, "user not found")
	}
	return nil
}

func (r *repo) UpsertByMS(ctx context.Context, msOID, email, name string) (User, error) {
	email = strings.ToLower(email)
	var u User
	err := r.db.QueryRow(ctx, `
		INSERT INTO users(ms_id, email, display_name, last_login)
		VALUES ($1,$2,$3, now())
		ON CONFLICT (ms_id) DO UPDATE
		  SET email=EXCLUDED.email,
		      display_name=EXCLUDED.display_name,
		      last_login=now()
		RETURNING id, ms_id, email, display_name, profile_url;
	`, msOID, email, name).
		Scan(&u.ID, &u.MSID, &u.Email, &u.DisplayName, &u.ProfileURL)
	if err != nil {
		return User{}, apperr.Wrap(apperr.Internal, err, "upsert user failed")
	}
	return u, nil
}

func (r *repo) EnsureBuyerRole(ctx context.Context) (int64, error) {
	var id int64
	if err := r.db.QueryRow(ctx, `
		INSERT INTO roles(role_name, description)
		VALUES ('buyer', 'Default role for new users')
		ON CONFLICT (role_name) DO UPDATE SET role_name=EXCLUDED.role_name
		RETURNING id;`).Scan(&id); err != nil {
		return 0, apperr.Wrap(apperr.Internal, err, "ensure buyer role failed")
	}
	return id, nil
}

func (r *repo) LinkRole(ctx context.Context, userID string, roleID int64) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO user_roles(user_id, role_id)
		VALUES ($1,$2)
		ON CONFLICT DO NOTHING;`, userID, roleID)
	if err != nil {
		return apperr.Wrap(apperr.Internal, err, "link role failed")
	}
	return nil
}
