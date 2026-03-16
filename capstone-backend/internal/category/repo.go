package category

import (
	"context"
	"errors"
	"strconv"
	"strings"

	"github.com/jackc/pgconn"
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

	CreateMainWithSubs(ctx context.Context, main CreateParams, subs []CreateParams) (Category, []Category, error)
	ListAdmin(ctx context.Context, q string, parentID *int64, isActive *string, limit, page int) ([]Category, error)

	UpsertMainAndLinkSubs(ctx context.Context, main UpsertMainParams, subs []UpsertNodeParams) (Category, []Category, error)
	CountSubcategories(ctx context.Context, mainID int64) (int64, error)
	CountProductsByCategory(ctx context.Context, subID int64) (int64, error)
	MoveProductsCategory(ctx context.Context, fromSubID, toSubID int64) (int64, error)
	SetCategoryActive(ctx context.Context, id int64, isActive string) (Category, error)
	DeactivateSubAndMoveProducts(ctx context.Context, subID, moveToSubID int64) (Category, int64, error)

	DeleteCategoryHard(ctx context.Context, id int64) error
	DeleteSubAndMoveProducts(ctx context.Context, subID, moveToSubID int64) (int64, error)
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
	IconURL   *string
}

type UpdateParams struct {
	Name      *string
	Slug      *string
	ParentID  *int
	SortOrder *int
	IsActive  *string
	IconURL   *string
}

type UpsertMainParams struct {
	ID        *int
	Name      string
	Slug      string
	SortOrder int
	IsActive  string
	IconURL   *string
}

type UpsertNodeParams struct {
	ID        *int
	Name      string
	Slug      string
	SortOrder int
	IsActive  string
}

// ===== Impl =====

// Create category
func (r *repo) Create(ctx context.Context, in CreateParams) (Category, error) {
	in.Name = strings.TrimSpace(in.Name)
	in.Slug = strings.TrimSpace(in.Slug)

	var c Category
	err := r.db.QueryRow(ctx, `
		INSERT INTO categories (name, slug, parent_id, sort_order, is_active, icon_url)
	VALUES ($1,$2,$3,$4,$5,$6)
	RETURNING category_id, name, slug, parent_id, sort_order, is_active, icon_url, created_at, updated_at
	`,
		in.Name, in.Slug, in.ParentID, in.SortOrder, in.IsActive, in.IconURL,
	).Scan(
		&c.ID, &c.Name, &c.Slug, &c.ParentID, &c.SortOrder, &c.IsActive, &c.IconURL,
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
	       icon_url, created_at, updated_at
	FROM categories
	WHERE category_id = $1
`, id).Scan(
		&c.ID, &c.Name, &c.Slug, &c.ParentID, &c.SortOrder, &c.IsActive,
		&c.IconURL, &c.CreatedAt, &c.UpdatedAt,
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
	       	icon_url, created_at, updated_at
		FROM categories
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY created_at ASC
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
			&c.IconURL, &c.CreatedAt, &c.UpdatedAt,
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
	    	icon_url   = COALESCE($7, icon_url),
	    	updated_at = NOW()
		WHERE category_id = $1
		RETURNING category_id, name, slug, parent_id, sort_order, is_active,
	          icon_url, created_at, updated_at
	`,
		id, in.Name, in.Slug, in.ParentID, in.SortOrder, in.IsActive, in.IconURL,
	).Scan(
		&c.ID, &c.Name, &c.Slug, &c.ParentID, &c.SortOrder, &c.IsActive,
		&c.IconURL, &c.CreatedAt, &c.UpdatedAt,
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

func (r *repo) CreateMainWithSubs(ctx context.Context, main CreateParams, subs []CreateParams) (Category, []Category, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return Category{}, nil, apperr.Wrap(apperr.Internal, err, "begin tx failed")
	}
	defer tx.Rollback(ctx)

	// 1) insert main (parent_id = NULL)
	var createdMain Category
	err = tx.QueryRow(ctx, `
  	INSERT INTO categories (name, slug, parent_id, sort_order, is_active, icon_url)
  	VALUES ($1, $2, NULL, $3, $4, $5)
  	RETURNING category_id, name, slug, parent_id, sort_order, is_active,
            	icon_url, created_at, updated_at
	`, strings.TrimSpace(main.Name), strings.TrimSpace(main.Slug), main.SortOrder, main.IsActive, main.IconURL).
		Scan(&createdMain.ID, &createdMain.Name, &createdMain.Slug, &createdMain.ParentID,
			&createdMain.SortOrder, &createdMain.IsActive, &createdMain.IconURL,
			&createdMain.CreatedAt, &createdMain.UpdatedAt)
	if err != nil {
		return Category{}, nil, apperr.Wrap(apperr.Internal, err, "insert main category failed")
	}

	// 2) insert subs (parent_id = main.id)
	createdSubs := make([]Category, 0, len(subs))
	for _, sc := range subs {
		var c Category
		err = tx.QueryRow(ctx, `
  INSERT INTO categories (name, slug, parent_id, sort_order, is_active, icon_url)
  VALUES ($1, $2, $3, $4, $5, NULL)
  RETURNING category_id, name, slug, parent_id, sort_order, is_active,
            icon_url, created_at, updated_at
`, strings.TrimSpace(sc.Name), strings.TrimSpace(sc.Slug), createdMain.ID, sc.SortOrder, sc.IsActive).
			Scan(&c.ID, &c.Name, &c.Slug, &c.ParentID, &c.SortOrder, &c.IsActive,
				&c.IconURL, &c.CreatedAt, &c.UpdatedAt)
		if err != nil {
			return Category{}, nil, apperr.Wrap(apperr.Internal, err, "insert subcategory failed")
		}
		createdSubs = append(createdSubs, c)
	}

	// 3) commit
	if err := tx.Commit(ctx); err != nil {
		return Category{}, nil, apperr.Wrap(apperr.Internal, err, "commit tx failed")
	}

	return createdMain, createdSubs, nil
}

func (r *repo) ListAdmin(ctx context.Context, q string, parentID *int64, isActive *string, limit, page int) ([]Category, error) {
	if limit <= 0 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit
	q = strings.TrimSpace(q)

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

	if isActive != nil {
		where = append(where, `is_active = $`+strconv.Itoa(argPos))
		args = append(args, strings.ToUpper(strings.TrimSpace(*isActive)))
		argPos++
	}

	// paging
	args = append(args, limit, offset)

	sql := `
	SELECT category_id, name, slug, parent_id, sort_order, is_active,
	       icon_url, created_at, updated_at
	FROM categories
	WHERE ` + strings.Join(where, " AND ") + `
	ORDER BY created_at ASC
	LIMIT $` + strconv.Itoa(argPos) + ` OFFSET $` + strconv.Itoa(argPos+1)

	rows, err := r.db.Query(ctx, sql, args...)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list admin categories failed")
	}
	defer rows.Close()

	var out []Category
	for rows.Next() {
		var c Category
		if err := rows.Scan(
			&c.ID, &c.Name, &c.Slug, &c.ParentID, &c.SortOrder, &c.IsActive,
			&c.IconURL, &c.CreatedAt, &c.UpdatedAt,
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

func (r *repo) UpsertMainAndLinkSubs(
	ctx context.Context,
	main UpsertMainParams,
	subs []UpsertNodeParams,
) (Category, []Category, error) {

	if len(subs) < 1 {
		return Category{}, nil, apperr.New(apperr.BadRequest, "sub_categories must have at least 1 item")
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return Category{}, nil, apperr.Wrap(apperr.Internal, err, "begin tx failed")
	}
	defer tx.Rollback(ctx)

	var createdMain Category

	if main.ID != nil && *main.ID > 0 {
		// lock main + ensure it's main (parent_id must be NULL)
		var parentID *int
		err := tx.QueryRow(ctx, `
			SELECT parent_id
			FROM categories
			WHERE category_id = $1
			FOR UPDATE
		`, *main.ID).Scan(&parentID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return Category{}, nil, apperr.New(apperr.NotFound, "main category not found")
			}
			return Category{}, nil, apperr.Wrap(apperr.Internal, err, "get main category failed")
		}
		if parentID != nil {
			return Category{}, nil, apperr.New(apperr.BadRequest, "main_category.id must be a main category (parent_id must be NULL)")
		}

		// update main
		err = tx.QueryRow(ctx, `
  		UPDATE categories
  		SET name = $2,
      		slug = $3,
      		sort_order = $4,
      		is_active = $5,
      		icon_url = COALESCE($6, icon_url),
      		parent_id = NULL,
      		updated_at = NOW()
  		WHERE category_id = $1
  		RETURNING category_id, name, slug, parent_id, sort_order, is_active,
            icon_url, created_at, updated_at
		`,
			*main.ID,
			strings.TrimSpace(main.Name),
			strings.TrimSpace(main.Slug),
			main.SortOrder,
			main.IsActive,
			main.IconURL,
		).Scan(
			&createdMain.ID, &createdMain.Name, &createdMain.Slug, &createdMain.ParentID,
			&createdMain.SortOrder, &createdMain.IsActive, &createdMain.IconURL,
			&createdMain.CreatedAt, &createdMain.UpdatedAt,
		)
		if err != nil {
			return Category{}, nil, mapCategoryPgErr(err, "update main category failed")
		}
	} else {
		// insert main
		err = tx.QueryRow(ctx, `
  		INSERT INTO categories (name, slug, parent_id, sort_order, is_active, icon_url)
 		VALUES ($1, $2, NULL, $3, $4, $5)
  		RETURNING category_id, name, slug, parent_id, sort_order, is_active,
            icon_url, created_at, updated_at
		`,
			strings.TrimSpace(main.Name),
			strings.TrimSpace(main.Slug),
			main.SortOrder,
			main.IsActive,
			main.IconURL,
		).Scan(
			&createdMain.ID, &createdMain.Name, &createdMain.Slug, &createdMain.ParentID,
			&createdMain.SortOrder, &createdMain.IsActive, &createdMain.IconURL,
			&createdMain.CreatedAt, &createdMain.UpdatedAt,
		)
		if err != nil {
			return Category{}, nil, mapCategoryPgErr(err, "insert main category failed")
		}
	}

	mainID := createdMain.ID
	createdSubs := make([]Category, 0, len(subs))

	seen := map[int]bool{}
	for _, sc := range subs {
		// duplicate id in request
		if sc.ID != nil && *sc.ID > 0 {
			if seen[*sc.ID] {
				return Category{}, nil, apperr.New(apperr.BadRequest, "duplicate sub_categories.id in request")
			}
			seen[*sc.ID] = true
		}

		var c Category
		if sc.ID != nil && *sc.ID > 0 {
			// lock & validate existing sub: must be sub (parent_id != NULL)
			var parentID *int
			err := tx.QueryRow(ctx, `
				SELECT parent_id
				FROM categories
				WHERE category_id = $1
				FOR UPDATE
			`, *sc.ID).Scan(&parentID)
			if err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					return Category{}, nil, apperr.New(apperr.NotFound, "sub category not found")
				}
				return Category{}, nil, apperr.Wrap(apperr.Internal, err, "get sub category failed")
			}
			if parentID == nil {
				return Category{}, nil, apperr.New(apperr.BadRequest, "sub_categories.id must be a sub category (cannot use a main category as sub)")
			}

			// update sub + force parent_id=mainID
			err = tx.QueryRow(ctx, `
				UPDATE categories
				SET name = $2,
				    slug = $3,
				    parent_id = $4,
				    sort_order = $5,
				    is_active = $6,
					icon_url = NULL,
				    updated_at = NOW()
				WHERE category_id = $1
				RETURNING category_id, name, slug, parent_id, sort_order, is_active,icon_url, created_at, updated_at
			`,
				*sc.ID,
				strings.TrimSpace(sc.Name),
				strings.TrimSpace(sc.Slug),
				mainID,
				sc.SortOrder,
				sc.IsActive,
			).Scan(
				&c.ID, &c.Name, &c.Slug, &c.ParentID, &c.SortOrder, &c.IsActive,
				&c.IconURL, &c.CreatedAt, &c.UpdatedAt,
			)
			if err != nil {
				return Category{}, nil, mapCategoryPgErr(err, "update subcategory failed")
			}
		} else {
			// insert sub
			err = tx.QueryRow(ctx, `
				INSERT INTO categories (name, slug, parent_id, sort_order, is_active, icon_url)
				VALUES ($1, $2, $3, $4, $5, NULL)
				RETURNING category_id, name, slug, parent_id, sort_order, is_active, icon_url, created_at, updated_at
			`,
				strings.TrimSpace(sc.Name),
				strings.TrimSpace(sc.Slug),
				mainID,
				sc.SortOrder,
				sc.IsActive,
			).Scan(
				&c.ID, &c.Name, &c.Slug, &c.ParentID, &c.SortOrder, &c.IsActive,
				&c.IconURL, &c.CreatedAt, &c.UpdatedAt,
			)
			if err != nil {
				return Category{}, nil, mapCategoryPgErr(err, "insert subcategory failed")
			}
		}

		createdSubs = append(createdSubs, c)
	}

	if err := tx.Commit(ctx); err != nil {
		return Category{}, nil, apperr.Wrap(apperr.Internal, err, "commit tx failed")
	}

	return createdMain, createdSubs, nil
}

func (r *repo) CountSubcategories(ctx context.Context, mainID int64) (int64, error) {
	var n int64
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM categories
		WHERE parent_id = $1
	`, mainID).Scan(&n)
	if err != nil {
		return 0, apperr.Wrap(apperr.Internal, err, "count subcategories failed")
	}
	return n, nil
}

func (r *repo) CountProductsByCategory(ctx context.Context, subID int64) (int64, error) {
	var n int64
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM products
		WHERE category_id = $1
	`, subID).Scan(&n)
	if err != nil {
		return 0, apperr.Wrap(apperr.Internal, err, "count products by category failed")
	}
	return n, nil
}

func (r *repo) MoveProductsCategory(ctx context.Context, fromSubID, toSubID int64) (int64, error) {
	cmd, err := r.db.Exec(ctx, `
		UPDATE products
		SET category_id = $2, updated_at = NOW()
		WHERE category_id = $1
	`, fromSubID, toSubID)
	if err != nil {
		return 0, apperr.Wrap(apperr.Internal, err, "move products category failed")
	}
	return cmd.RowsAffected(), nil
}

func (r *repo) SetCategoryActive(ctx context.Context, id int64, isActive string) (Category, error) {
	var c Category
	err := r.db.QueryRow(ctx, `
		UPDATE categories
		SET is_active = $2,
		    updated_at = NOW()
		WHERE category_id = $1
		RETURNING category_id, name, slug, parent_id, sort_order, is_active,
          icon_url, created_at, updated_at
	`, id, strings.ToUpper(strings.TrimSpace(isActive))).
		Scan(&c.ID, &c.Name, &c.Slug, &c.ParentID, &c.SortOrder, &c.IsActive, &c.IconURL, &c.CreatedAt, &c.UpdatedAt)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Category{}, apperr.New(apperr.NotFound, "category not found")
		}
		return Category{}, apperr.Wrap(apperr.Internal, err, "set category active failed")
	}
	return c, nil
}

func (r *repo) DeactivateSubAndMoveProducts(ctx context.Context, subID, moveToSubID int64) (Category, int64, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return Category{}, 0, apperr.Wrap(apperr.Internal, err, "begin tx failed")
	}
	defer tx.Rollback(ctx)

	// 1) lock sub
	var sub Category
	err = tx.QueryRow(ctx, `
		SELECT category_id, name, slug, parent_id, sort_order, is_active, created_at, updated_at
		FROM categories
		WHERE category_id = $1
		FOR UPDATE
	`, subID).Scan(&sub.ID, &sub.Name, &sub.Slug, &sub.ParentID, &sub.SortOrder, &sub.IsActive, &sub.CreatedAt, &sub.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Category{}, 0, apperr.New(apperr.NotFound, "category not found")
		}
		return Category{}, 0, apperr.Wrap(apperr.Internal, err, "get category failed")
	}
	if sub.ParentID == nil {
		return Category{}, 0, apperr.New(apperr.BadRequest, "cannot deactivate main category")
	}

	// 2) lock moveTo sub + validate (ต้องเป็น sub และควร active)
	var moveTo Category
	err = tx.QueryRow(ctx, `
		SELECT category_id, parent_id, is_active
		FROM categories
		WHERE category_id = $1
		FOR UPDATE
	`, moveToSubID).Scan(&moveTo.ID, &moveTo.ParentID, &moveTo.IsActive)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Category{}, 0, apperr.New(apperr.NotFound, "move_to category not found")
		}
		return Category{}, 0, apperr.Wrap(apperr.Internal, err, "get move_to category failed")
	}
	if moveTo.ParentID == nil {
		return Category{}, 0, apperr.New(apperr.BadRequest, "move_to category must be a sub category")
	}
	if strings.ToUpper(moveTo.IsActive) != "YES" {
		return Category{}, 0, apperr.New(apperr.BadRequest, "move_to category must be active")
	}

	// 3) move products
	cmd, err := tx.Exec(ctx, `
		UPDATE products
		SET category_id = $2, updated_at = NOW()
		WHERE category_id = $1
	`, subID, moveToSubID)
	if err != nil {
		return Category{}, 0, apperr.Wrap(apperr.Internal, err, "move products failed")
	}
	moved := cmd.RowsAffected()

	// 4) deactivate sub
	err = tx.QueryRow(ctx, `
		UPDATE categories
		SET is_active = 'NO', updated_at = NOW()
		WHERE category_id = $1
		RETURNING category_id, name, slug, parent_id, sort_order, is_active,
          icon_url, created_at, updated_at
	`, subID).Scan(&sub.ID, &sub.Name, &sub.Slug, &sub.ParentID, &sub.SortOrder, &sub.IsActive, &sub.IconURL, &sub.CreatedAt, &sub.UpdatedAt)
	if err != nil {
		return Category{}, 0, apperr.Wrap(apperr.Internal, err, "deactivate category failed")
	}

	if err := tx.Commit(ctx); err != nil {
		return Category{}, 0, apperr.Wrap(apperr.Internal, err, "commit tx failed")
	}

	return sub, moved, nil
}

// Delete main category hard delete
func (r *repo) DeleteCategoryHard(ctx context.Context, id int64) error {
	cmd, err := r.db.Exec(ctx, `
		DELETE FROM categories
		WHERE category_id = $1
	`, id)
	if err != nil {
		return apperr.Wrap(apperr.Internal, err, "delete category hard failed")
	}
	if cmd.RowsAffected() == 0 {
		return apperr.New(apperr.NotFound, "category not found")
	}
	return nil
}

// Delete sub category + move products to another sub category (tx)
func (r *repo) DeleteSubAndMoveProducts(ctx context.Context, subID, moveToSubID int64) (int64, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return 0, apperr.Wrap(apperr.Internal, err, "begin tx failed")
	}
	defer tx.Rollback(ctx)

	// 1) lock source sub
	var sub Category
	err = tx.QueryRow(ctx, `
		SELECT category_id, parent_id, is_active
		FROM categories
		WHERE category_id = $1
		FOR UPDATE
	`, subID).Scan(&sub.ID, &sub.ParentID, &sub.IsActive)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, apperr.New(apperr.NotFound, "category not found")
		}
		return 0, apperr.Wrap(apperr.Internal, err, "get category failed")
	}
	if sub.ParentID == nil {
		return 0, apperr.New(apperr.BadRequest, "cannot delete main category with DeleteSubAndMoveProducts")
	}

	// 2) lock target sub + validate
	var moveTo Category
	err = tx.QueryRow(ctx, `
		SELECT category_id, parent_id, is_active
		FROM categories
		WHERE category_id = $1
		FOR UPDATE
	`, moveToSubID).Scan(&moveTo.ID, &moveTo.ParentID, &moveTo.IsActive)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, apperr.New(apperr.NotFound, "move_to category not found")
		}
		return 0, apperr.Wrap(apperr.Internal, err, "get move_to category failed")
	}
	if moveTo.ParentID == nil {
		return 0, apperr.New(apperr.BadRequest, "move_to category must be a sub category")
	}
	if strings.ToUpper(moveTo.IsActive) != "YES" {
		return 0, apperr.New(apperr.BadRequest, "move_to category must be active")
	}
	if moveToSubID == subID {
		return 0, apperr.New(apperr.BadRequest, "move_to_sub_category_id cannot be same as source")
	}

	// 3) move products
	cmd, err := tx.Exec(ctx, `
		UPDATE products
		SET category_id = $2, updated_at = NOW()
		WHERE category_id = $1
	`, subID, moveToSubID)
	if err != nil {
		return 0, apperr.Wrap(apperr.Internal, err, "move products failed")
	}
	moved := cmd.RowsAffected()

	// 4) hard delete sub category
	cmd, err = tx.Exec(ctx, `
		DELETE FROM categories
		WHERE category_id = $1
	`, subID)
	if err != nil {
		return 0, apperr.Wrap(apperr.Internal, err, "delete sub category failed")
	}
	if cmd.RowsAffected() == 0 {
		return 0, apperr.New(apperr.NotFound, "category not found")
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, apperr.Wrap(apperr.Internal, err, "commit tx failed")
	}

	return moved, nil
}

func mapCategoryPgErr(err error, op string) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {

		// unique violation
		if pgErr.Code == "23505" {
			switch pgErr.ConstraintName {
			case "uq_categories_slug":
				return apperr.WithFields(
					apperr.New(apperr.Conflict, "slug already exists"),
					map[string]any{
						"field":      "slug",
						"constraint": pgErr.ConstraintName,
						"detail":     pgErr.Detail,
					},
				)
			default:
				return apperr.WithFields(
					apperr.New(apperr.Conflict, "duplicate value"),
					map[string]any{
						"constraint": pgErr.ConstraintName,
						"detail":     pgErr.Detail,
					},
				)
			}
		}

		if pgErr.Code == "23503" {
			return apperr.New(apperr.BadRequest, "invalid reference")
		}
	}

	return apperr.Wrap(apperr.Internal, err, op)
}
