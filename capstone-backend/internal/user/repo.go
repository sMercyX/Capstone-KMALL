package user

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgconn"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
)

type Repo interface {
	List(ctx context.Context) ([]User, error)
	Get(ctx context.Context, id string) (User, error)
	// Create(ctx context.Context, u User) (User, error)
	// Update(ctx context.Context, id string, u User) (User, error)
	Delete(ctx context.Context, id string) (User, error)

	UpsertByMS(ctx context.Context, msOID, email, name string) (User, error)
	EnsureBuyerRole(ctx context.Context) (int64, error)
	LinkRole(ctx context.Context, userID string, roleID int64) error

	// JWT claims
	GetRolesByUserID(ctx context.Context, userID string) ([]string, error)
}

type repo struct{ db *pgxpool.Pool }

func NewRepo(db *pgxpool.Pool) Repo { return &repo{db: db} }

func (r *repo) List(ctx context.Context) ([]User, error) {
	rows, err := r.db.Query(ctx, `
		SELECT user_id, kms_id, email, display_name, created_at, updated_at, last_login
		FROM users ORDER BY created_at DESC`)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list users failed")
	}
	defer rows.Close()

	var out []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.MSID, &u.Email, &u.DisplayName, &u.CreatedAt, &u.UpdatedAt, &u.LastLogin); err != nil {
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
		SELECT user_id, kms_id, email, display_name, created_at, updated_at, last_login
		FROM users WHERE user_id=$1`, id).
		Scan(&u.ID, &u.MSID, &u.Email, &u.DisplayName, &u.CreatedAt, &u.UpdatedAt, &u.LastLogin)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return User{}, apperr.New(apperr.NotFound, "user not found")
		}
		return User{}, apperr.Wrap(apperr.Internal, err, "get user failed")
	}
	return u, nil
}

// func (r *repo) Create(ctx context.Context, u User) (User, error) {
// 	u.Email = strings.ToLower(u.Email)
// 	err := r.db.QueryRow(ctx, `
// 		INSERT INTO users(kms_id, email, display_name)
// 		VALUES ($1,$2,$3)
// 		RETURNING user_id, kms_id, email, display_name`,
// 		u.MSID, u.Email, u.DisplayName,
// 	).Scan(&u.ID, &u.MSID, &u.Email, &u.DisplayName)
// 	if err != nil {
// 		if pgErr, ok := err.(*pgconn.PgError); ok {
// 			switch pgErr.Code {
// 			case "23505": // unique_violation
// 				return User{}, apperr.New(apperr.Conflict, "duplicate user")
// 			case "23514", "23502": // check_violation, not_null_violation
// 				return User{}, apperr.Wrap(apperr.BadRequest, err, "invalid user data")
// 			}
// 		}
// 		return User{}, apperr.Wrap(apperr.Internal, err, "create user failed")
// 	}
// 	return u, nil
// }

// func (r *repo) Update(ctx context.Context, id string, u User) (User, error) {
// 	u.Email = strings.ToLower(u.Email)
// 	err := r.db.QueryRow(ctx, `
// 		UPDATE users
// 		SET kms_id=$2, email=$3, display_name=$4
// 		WHERE user_id=$1
// 		RETURNING user_id, kms_id, email, display_name`,
// 		id, u.MSID, u.Email, u.DisplayName,
// 	).Scan(&u.ID, &u.MSID, &u.Email, &u.DisplayName)
// 	if err != nil {
// 		if errors.Is(err, pgx.ErrNoRows) {
// 			return User{}, apperr.New(apperr.NotFound, "user not found")
// 		}
// 		if pgErr, ok := err.(*pgconn.PgError); ok {
// 			switch pgErr.Code {
// 			case "23505":
// 				return User{}, apperr.New(apperr.Conflict, "duplicate user")
// 			case "23514", "23502":
// 				return User{}, apperr.Wrap(apperr.BadRequest, err, "invalid user data")
// 			}
// 		}
// 		return User{}, apperr.Wrap(apperr.Internal, err, "update user failed")
// 	}
// 	return u, nil
// }

// func (r *repo) Delete(ctx context.Context, id string) error {
// 	ct, err := r.db.Exec(ctx, `DELETE FROM users WHERE user_id=$1`, id)
// 	if err != nil {
// 		return apperr.Wrap(apperr.Internal, err, "delete user failed")
// 	}
// 	if ct.RowsAffected() == 0 {
// 		return apperr.New(apperr.NotFound, "user not found")
// 	}
// 	return nil
// }

func (r *repo) Delete(ctx context.Context, id string) (User, error) {
	var u User
	err := r.db.QueryRow(ctx, `
        DELETE FROM users
        WHERE user_id = $1
        RETURNING user_id, kms_id, email, display_name,
                  created_at, updated_at, last_login`,
		id,
	).Scan(&u.ID, &u.MSID, &u.Email, &u.DisplayName,
		&u.CreatedAt, &u.UpdatedAt, &u.LastLogin)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return User{}, apperr.New(apperr.NotFound, "user not found")
		}
		return User{}, apperr.Wrap(apperr.Internal, err, "delete user failed")
	}
	return u, nil
}

func (r *repo) UpsertByMS(ctx context.Context, msOID, email, name string) (User, error) {
	email = strings.ToLower(email)
	var u User

	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return User{}, apperr.Wrap(apperr.Internal, err, "begin tx failed")
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback(ctx)
		} else {
			_ = tx.Commit(ctx)
		}
	}()

	// 1) มี kms_id อยู่แล้ว? → อัปเดตชื่อ+last_login (ไม่แตะ email) แล้ว "return ทันที"
	err = tx.QueryRow(ctx, `
		UPDATE users
		SET display_name=$2, last_login=now()
		WHERE kms_id=$1
		RETURNING user_id, kms_id, email, display_name
	`, msOID, name).Scan(&u.ID, &u.MSID, &u.Email, &u.DisplayName)
	if err == nil {
		return u, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		if pgErr, ok := err.(*pgconn.PgError); ok {
			return User{}, apperr.WithFields(
				apperr.Wrap(apperr.Internal, err, "upsert(by kms_id) failed"),
				map[string]any{
					"pg_code":    pgErr.Code,
					"constraint": pgErr.ConstraintName,
					"detail":     pgErr.Detail,
				},
			)
		}

		return User{}, apperr.WithFields(
			apperr.Wrap(apperr.Internal, err, "upsert(by ms_id) failed"),
			map[string]any{
				"cause": err.Error(),
				"type":  fmt.Sprintf("%T", err),
			},
		)
	}

	// 2) ยังไม่เคยมี kms_id → ผูก kms_id ให้เรคคอร์ดที่ email ตรง แล้ว "return ทันที"
	err = tx.QueryRow(ctx, `
		UPDATE users
		SET kms_id=$1, display_name=$3, last_login=now()
		WHERE email=$2
		RETURNING user_id, kms_id, email, display_name
	`, msOID, email, name).Scan(&u.ID, &u.MSID, &u.Email, &u.DisplayName)
	if err == nil {
		return u, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		if pgErr, ok := err.(*pgconn.PgError); ok {
			return User{}, apperr.WithFields(
				apperr.Wrap(apperr.Internal, err, "upsert(by email attach kms_id) failed"),
				map[string]any{"pg_code": pgErr.Code, "constraint": pgErr.ConstraintName, "detail": pgErr.Detail},
			)
		}
		return User{}, apperr.Wrap(apperr.Internal, err, "upsert(by email attach kms_id) failed")
	}

	// 3) ใหม่จริง ๆ → INSERT (อันเดียวที่แตะ email)
	err = tx.QueryRow(ctx, `
		INSERT INTO users(kms_id, email, display_name, last_login)
		VALUES ($1,$2,$3, now())
		RETURNING user_id, kms_id, email, display_name
	`, msOID, email, name).Scan(&u.ID, &u.MSID, &u.Email, &u.DisplayName)
	if err != nil {
		if pgErr, ok := err.(*pgconn.PgError); ok {
			return User{}, apperr.WithFields(
				apperr.Wrap(apperr.Internal, err, "insert user failed"),
				map[string]any{"pg_code": pgErr.Code, "constraint": pgErr.ConstraintName, "detail": pgErr.Detail},
			)
		}
		return User{}, apperr.Wrap(apperr.Internal, err, "insert user failed")
	}

	return u, nil
}

func (r *repo) EnsureBuyerRole(ctx context.Context) (int64, error) {
	var id int64
	if err := r.db.QueryRow(ctx, `
        INSERT INTO roles(role_name, role_desc)
        VALUES ('buyer', 'Default role for new users')
        ON CONFLICT (role_name) DO UPDATE SET role_name=EXCLUDED.role_name
        RETURNING role_id;`).Scan(&id); err != nil {
		// fmt.Println("Ensure Error: ", err)
		return 0, apperr.Wrap(apperr.Internal, err, "ensure buyer role failed")
	}
	return id, nil
}

func (r *repo) LinkRole(ctx context.Context, userID string, roleID int64) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO user_roles(user_id, role_id, created_at)
		VALUES ($1,$2, now())
		ON CONFLICT DO NOTHING;`, userID, roleID)
	if err != nil {
		return apperr.Wrap(apperr.Internal, err, "link role failed")
	}
	return nil
}

func (r *repo) GetRolesByUserID(ctx context.Context, userID string) ([]string, error) {
	const q = `
		SELECT r.role_name
		FROM user_roles ur
		JOIN roles r ON r.role_id = ur.role_id
		WHERE ur.user_id = $1
		ORDER BY r.role_id`
	rows, err := r.db.Query(ctx, q, userID)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "get roles failed")
	}
	defer rows.Close()

	var roles []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan role failed")
		}
		roles = append(roles, name)
	}
	if err := rows.Err(); err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "rows error")
	}
	return roles, nil
}
