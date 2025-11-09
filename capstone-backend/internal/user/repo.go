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
	// Create(ctx context.Context, u User) (User, error)
	// Update(ctx context.Context, id string, u User) (User, error)
	Delete(ctx context.Context, id string) (User, error)

	UpsertByMS(ctx context.Context, msOID, email, name string) (User, error)
	EnsureBuyerRole(ctx context.Context) (int64, error)
	LinkRole(ctx context.Context, userID string, roleID int64) error

	// JWT claims
	GetRolesByUserID(ctx context.Context, userID string) ([]string, error)

	AddUserRoles(ctx context.Context, userID string, roleIDs []int64) error
	RemoveUserRoles(ctx context.Context, userID string, roleIDs []int64) error
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

	// 1) Update Last Login
	err = tx.QueryRow(ctx, `
		UPDATE users
		SET display_name = $2,
		    last_login   = now()
		WHERE kms_id     = $1
		RETURNING user_id, kms_id, email, display_name,
		          created_at, updated_at, last_login
	`, msOID, name).
		Scan(&u.ID, &u.MSID, &u.Email, &u.DisplayName,
			&u.CreatedAt, &u.UpdatedAt, &u.LastLogin)
	if err == nil {
		return u, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		if pgErr, ok := err.(*pgconn.PgError); ok {
			return User{}, apperr.WithFields(
				apperr.Wrap(apperr.Internal, err, "upsert(by kms_id) failed"),
				map[string]any{"pg_code": pgErr.Code, "constraint": pgErr.ConstraintName, "detail": pgErr.Detail},
			)
		}
		return User{}, apperr.Wrap(apperr.Internal, err, "upsert(by kms_id) failed")
	}

	// 2) Update User
	err = tx.QueryRow(ctx, `
		UPDATE users
		SET kms_id       = $1,
		    display_name = $3,
		    last_login   = now()
		WHERE email      = $2
		RETURNING user_id, kms_id, email, display_name,
		          created_at, updated_at, last_login
	`, msOID, email, name).
		Scan(&u.ID, &u.MSID, &u.Email, &u.DisplayName,
			&u.CreatedAt, &u.UpdatedAt, &u.LastLogin)
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

	// 3) New User
	err = tx.QueryRow(ctx, `
		INSERT INTO users (kms_id, email, display_name, last_login)
		VALUES ($1, $2, $3, now())
		RETURNING user_id, kms_id, email, display_name,
		          created_at, updated_at, last_login
	`, msOID, email, name).
		Scan(&u.ID, &u.MSID, &u.Email, &u.DisplayName,
			&u.CreatedAt, &u.UpdatedAt, &u.LastLogin)
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

func (r *repo) AddUserRoles(ctx context.Context, userID string, roleIDs []int64) error {
	if len(roleIDs) == 0 {
		return nil
	}

	seen := map[int64]struct{}{}
	uniq := make([]int64, 0, len(roleIDs))
	for _, id := range roleIDs {
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		uniq = append(uniq, id)
	}
	if len(uniq) == 0 {
		return nil
	}

	batch := &pgx.Batch{}
	for _, rid := range uniq {
		batch.Queue(`
			INSERT INTO user_roles(user_id, role_id, created_at)
			VALUES ($1, $2, now())
			ON CONFLICT (user_id, role_id) DO NOTHING
		`, userID, rid)
	}

	br := r.db.SendBatch(ctx, batch)
	for range uniq {
		if _, err := br.Exec(); err != nil {
			_ = br.Close()
			return apperr.Wrap(apperr.Internal, err, "add user roles failed")
		}
	}
	if err := br.Close(); err != nil {
		return apperr.Wrap(apperr.Internal, err, "batch close failed")
	}
	return nil
}

func (r *repo) RemoveUserRoles(ctx context.Context, userID string, roleIDs []int64) error {
	if len(roleIDs) == 0 {
		return nil
	}

	_, err := r.db.Exec(ctx, `
		DELETE FROM user_roles
		WHERE user_id = $1 AND role_id = ANY($2)
	`, userID, roleIDs)
	if err != nil {
		return apperr.Wrap(apperr.Internal, err, "remove user roles failed")
	}
	return nil
}
