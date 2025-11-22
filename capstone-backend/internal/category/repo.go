package category

import (
	"context"
	"errors"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
)

type Repo interface {
	Create(ctx context.Context, in CreateParams) (Category, error)
	Get(ctx context.Context, id int64) (Category, error)
	List(ctx context.Context, q string, parentID *int64, activeOnly bool, limit, page int) ([]Category, error)
	Update(ctx context.Context, id int64, in UpdateParams) (Category, error)
	Delete(ctx context.Context, id int64) error
}

type repo struct{ db *pgxpool.Pool }

func NewRepo(db *pgxpool.Pool) Repo { return &repo{db: db} }

// ===== Params =====

type CreateParams struct {
	Name      string
	Slug      string
	ParentID  *int
	SortOrder int
	IsActive  string // "YES" / "NO"
}

type UpdateParams struct {
	Name      *string
	Slug      *string
	ParentID  *int
	SortOrder *int
	IsActive  *string
}

// ===== Impl =====

// Create category
func (r *repo) Create(ctx context.Context, in CreateParams) (Category, error) {
	in.Name = strings.TrimSpace(in.Name)
	in.Slug = strings.TrimSpace(in.Slug)

	var c Category
	err := r.db.QueryRow(ctx, `
		INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING category_id, name, slug, parent_id, sort_order, is_active,
		          created_at, updated_at
	`,
		in.Name, in.Slug, in.ParentID, in.SortOrder, in.IsActive,
	).Scan(
		&c.ID, &c.Name, &c.Slug, &c.ParentID, &c.SortOrder, &c.IsActive,
		&c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return Category{}, apperr.Wrap(apperr.Internal, err, "insert category failed")
	}
	return c, nil
}

// Get category by id
func (r *repo) Get(ctx context.Context, id int64) (Category, error) {
	var c Category
	err := r.db.QueryRow(ctx, `
		SELECT category_id, name, slug, parent_id, sort_order, is_active,
		       created_at, updated_at
		FROM categories
		WHERE category_id = $1
	`, id).Scan(
		&c.ID, &c.Name, &c.Slug, &c.ParentID, &c.SortOrder, &c.IsActive,
		&c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Category{}, apperr.New(apperr.NotFound, "category not found")
		}
		return Category{}, apperr.Wrap(apperr.Internal, err, "get category failed")
	}
	return c, nil
}

// List categories (optional search + parent filter + activeOnly)
func (r *repo) List(ctx context.Context, q string, parentID *int64, activeOnly bool, limit, page int) ([]Category, error) {
	if limit <= 0 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit
	q = strings.TrimSpace(q)

	// สร้าง where clause แบบง่าย ๆ
	where := []string{"1=1"}
	args := []any{}
	argPos := 1

	if q != "" {
		where = append(where, `LOWER(name) LIKE LOWER('%' || $`+strconv.Itoa(argPos)+` || '%')`)
		args = append(args, q)
		argPos++
	}

	if parentID != nil {
		if *parentID == 0 {
			where = append(where, `parent_id IS NULL`)
		} else {
			where = append(where, `parent_id = $`+strconv.Itoa(argPos))
			args = append(args, *parentID)
			argPos++
		}
	}

	if activeOnly {
		where = append(where, `is_active = 'YES'`)
	}

	args = append(args, limit, offset)

	sql := `
		SELECT category_id, name, slug, parent_id, sort_order, is_active,
		       created_at, updated_at
		FROM categories
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY sort_order ASC, name ASC
		LIMIT $` + strconv.Itoa(argPos) + ` OFFSET $` + strconv.Itoa(argPos+1)

	rows, err := r.db.Query(ctx, sql, args...)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list categories failed")
	}
	defer rows.Close()

	var out []Category
	for rows.Next() {
		var c Category
		if err := rows.Scan(
			&c.ID, &c.Name, &c.Slug, &c.ParentID, &c.SortOrder, &c.IsActive,
			&c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan category failed")
		}
		out = append(out, c)
	}
	if err := rows.Err(); err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "rows error")
	}
	return out, nil
}

// Update category
func (r *repo) Update(ctx context.Context, id int64, in UpdateParams) (Category, error) {
	var c Category
	err := r.db.QueryRow(ctx, `
		UPDATE categories
		SET name       = COALESCE($2, name),
		    slug       = COALESCE($3, slug),
		    parent_id  = COALESCE($4, parent_id),
		    sort_order = COALESCE($5, sort_order),
		    is_active  = COALESCE($6, is_active),
		    updated_at = NOW()
		WHERE category_id = $1
		RETURNING category_id, name, slug, parent_id, sort_order, is_active,
		          created_at, updated_at
	`,
		id, in.Name, in.Slug, in.ParentID, in.SortOrder, in.IsActive,
	).Scan(
		&c.ID, &c.Name, &c.Slug, &c.ParentID, &c.SortOrder, &c.IsActive,
		&c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Category{}, apperr.New(apperr.NotFound, "category not found")
		}
		return Category{}, apperr.Wrap(apperr.Internal, err, "update category failed")
	}
	return c, nil
}

// Delete category (hard delete; ถ้าจะ soft delete ใช้ update is_active แทน)
func (r *repo) Delete(ctx context.Context, id int64) error {
	cmd, err := r.db.Exec(ctx, `DELETE FROM categories WHERE category_id = $1`, id)
	if err != nil {
		return apperr.Wrap(apperr.Internal, err, "delete category failed")
	}
	if cmd.RowsAffected() == 0 {
		return apperr.New(apperr.NotFound, "category not found")
	}
	return nil
}
