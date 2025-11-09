package role

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
)

type Repo interface {
	List(ctx context.Context) ([]Role, error)
	GetIDByName(ctx context.Context, name string) (int32, error)
	ListNamesByUserID(ctx context.Context, userID string) ([]string, error)
	ListByUserID(ctx context.Context, userID string) ([]Role, error)
}

type repo struct{ db *pgxpool.Pool }

func NewRepo(db *pgxpool.Pool) Repo { return &repo{db: db} }

// returns all roles in the system, ordered by role_id.
func (r *repo) List(ctx context.Context) ([]Role, error) {
	rows, err := r.db.Query(ctx, `
		SELECT role_id, role_name, role_desc
		FROM roles
		ORDER BY role_id`)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list roles failed")
	}
	defer rows.Close()

	var out []Role
	for rows.Next() {
		var rl Role
		if err := rows.Scan(&rl.ID, &rl.Name, &rl.Desc); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan role failed")
		}
		out = append(out, rl)
	}
	if err := rows.Err(); err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "rows error")
	}
	return out, nil
}

// returns the role_id for a given role_name.
func (r *repo) GetIDByName(ctx context.Context, name string) (int32, error) {
	name = strings.ToLower(strings.TrimSpace(name))
	var id int32
	err := r.db.QueryRow(ctx, `
		SELECT role_id
		FROM roles
		WHERE LOWER(role_name) = $1`, name).
		Scan(&id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, apperr.New(apperr.NotFound, "role not found")
		}
		return 0, apperr.Wrap(apperr.Internal, err, "get role_id by name failed")
	}
	return id, nil
}

// returns only the role names assigned to a given user.
func (r *repo) ListNamesByUserID(ctx context.Context, userID string) ([]string, error) {
	const q = `
		SELECT r.role_name
		FROM user_roles ur
		JOIN roles r ON r.role_id = ur.role_id
		WHERE ur.user_id = $1
		ORDER BY r.role_id`
	rows, err := r.db.Query(ctx, q, userID)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list role names by user failed")
	}
	defer rows.Close()

	var names []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan role name failed")
		}
		names = append(names, name)
	}
	if err := rows.Err(); err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "rows error")
	}
	return names, nil
}

// returns the full role structs assigned to a given user.
func (r *repo) ListByUserID(ctx context.Context, userID string) ([]Role, error) {
	const q = `
		SELECT r.role_id, r.role_name, r.role_desc
		FROM user_roles ur
		JOIN roles r ON r.role_id = ur.role_id
		WHERE ur.user_id = $1
		ORDER BY r.role_id`
	rows, err := r.db.Query(ctx, q, userID)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list roles by user failed")
	}
	defer rows.Close()

	var out []Role
	for rows.Next() {
		var rl Role
		if err := rows.Scan(&rl.ID, &rl.Name, &rl.Desc); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan role failed")
		}
		out = append(out, rl)
	}
	if err := rows.Err(); err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "rows error")
	}
	return out, nil
}
