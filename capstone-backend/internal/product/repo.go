package product

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
	Create(ctx context.Context, in CreateParams) (Product, error)
	Get(ctx context.Context, id int64) (Product, error)
	ListByStoreID(ctx context.Context, storeID int64, limit, page int) ([]Product, int64, error)
	Update(ctx context.Context, id int64, in UpdateParams) (Product, error)
	Delete(ctx context.Context, id int64) error

	ListPublic(ctx context.Context,
		q string,
		categoryIDs []int64,
		parentCategoryID *int64,
		storeID *int64,
		limit, page int,
		priceSort string,
	) ([]Product, int64, error)
	GetPublic(ctx context.Context, id int64) (Product, error)
}

type repo struct{ db *pgxpool.Pool }

func NewRepo(db *pgxpool.Pool) Repo { return &repo{db: db} }

type CreateParams struct {
	Name        string
	Description *string
	Price       float64
	ImageURL    *string
	IsActive    string
	StoreID     int
	CategoryID  int
}

type UpdateParams struct {
	Name        *string
	Description *string
	Price       *float64
	ImageURL    *string
	IsActive    *string
	CategoryID  *int
}

func (r *repo) Create(ctx context.Context, in CreateParams) (Product, error) {
	in.IsActive = strings.ToUpper(strings.TrimSpace(in.IsActive))
	if in.IsActive == "" {
		in.IsActive = "YES"
	}

	// ----- เช็คชื่อสินค้าซ้ำ -----
	var exists bool
	if err := r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM products WHERE name = $1
		);
	`, in.Name).Scan(&exists); err != nil {
		return Product{}, apperr.Wrap(apperr.Internal, err, "check product name failed")
	}

	if exists {
		return Product{}, apperr.New(apperr.BadRequest, "product name already exists")
	}

	// ----- INSERT ปกติ -----
	var p Product
	err := r.db.QueryRow(ctx, `
		INSERT INTO products (name, product_desc, price, image_url, is_active, store_id, category_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING product_id, name, product_desc, price, image_url, created_at, updated_at,
		          is_active, store_id, category_id;
	`,
		in.Name, in.Description, in.Price, in.ImageURL, in.IsActive, in.StoreID, in.CategoryID,
	).Scan(
		&p.ID, &p.Name, &p.Description, &p.Price, &p.ImageURL,
		&p.CreatedAt, &p.UpdatedAt, &p.IsActive, &p.StoreID, &p.CategoryID,
	)

	if err != nil {
		// ถ้าอยากดัก FK ผิดก็ยังใช้ได้เหมือนเดิม
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23503" {
			return Product{}, apperr.New(apperr.BadRequest, "invalid store_id or category_id")
		}
		return Product{}, apperr.Wrap(apperr.Internal, err, "insert product failed")
	}

	return p, nil
}

func (r *repo) Get(ctx context.Context, id int64) (Product, error) {
	var p Product

	err := r.db.QueryRow(ctx, `
		SELECT product_id, name, product_desc, price, image_url,
		       created_at, updated_at, is_active, store_id, category_id
		FROM products
		WHERE product_id = $1;
	`, id).Scan(
		&p.ID, &p.Name, &p.Description, &p.Price, &p.ImageURL,
		&p.CreatedAt, &p.UpdatedAt, &p.IsActive, &p.StoreID, &p.CategoryID,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Product{}, apperr.New(apperr.NotFound, "product not found")
		}
		return Product{}, apperr.Wrap(apperr.Internal, err, "get product failed")
	}

	return p, nil
}

func (r *repo) ListByStoreID(
	ctx context.Context,
	storeID int64,
	limit, page int,
) ([]Product, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit

	// ===== ดึง total count ก่อน =====
	var total int64
	if err := r.db.QueryRow(ctx, `
        SELECT COUNT(*)
        FROM products
        WHERE store_id = $1
    `, storeID).Scan(&total); err != nil {
		return nil, 0, apperr.Wrap(apperr.Internal, err, "count products by store failed")
	}

	// ===== ดึงรายการตาม page =====
	rows, err := r.db.Query(ctx, `
        SELECT product_id, name, product_desc, price, image_url,
               created_at, updated_at, is_active, store_id, category_id
        FROM products
        WHERE store_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3;
    `, storeID, limit, offset)

	if err != nil {
		return nil, 0, apperr.Wrap(apperr.Internal, err, "list products by store failed")
	}
	defer rows.Close()

	var out []Product
	for rows.Next() {
		var p Product
		if err := rows.Scan(
			&p.ID, &p.Name, &p.Description, &p.Price, &p.ImageURL,
			&p.CreatedAt, &p.UpdatedAt, &p.IsActive, &p.StoreID, &p.CategoryID,
		); err != nil {
			return nil, 0, apperr.Wrap(apperr.Internal, err, "scan product failed")
		}
		out = append(out, p)
	}

	return out, total, nil
}

func (r *repo) Update(ctx context.Context, id int64, in UpdateParams) (Product, error) {
	// ----- ถ้ามีส่ง name มา ให้เช็คชื่อซ้ำก่อน -----
	if in.Name != nil {
		var exists bool
		if err := r.db.QueryRow(ctx, `
			SELECT EXISTS(
				SELECT 1
				FROM products
				WHERE name = $1
				  AND product_id <> $2
			);
		`, *in.Name, id).Scan(&exists); err != nil {
			return Product{}, apperr.Wrap(apperr.Internal, err, "check product name failed")
		}

		if exists {
			return Product{}, apperr.New(apperr.BadRequest, "product name already exists")
		}
	}

	// ----- UPDATE ปกติ -----
	var p Product
	err := r.db.QueryRow(ctx, `
		UPDATE products
		SET name = COALESCE($2, name),
		    product_desc = COALESCE($3, product_desc),
		    price = COALESCE($4, price),
		    image_url = COALESCE($5, image_url),
		    is_active = COALESCE($6, is_active),
		    category_id = COALESCE($7, category_id),
		    updated_at = NOW()
		WHERE product_id = $1
		RETURNING product_id, name, product_desc, price, image_url,
		          created_at, updated_at, is_active, store_id, category_id;
	`,
		id, in.Name, in.Description, in.Price, in.ImageURL, in.IsActive, in.CategoryID,
	).Scan(
		&p.ID, &p.Name, &p.Description, &p.Price, &p.ImageURL,
		&p.CreatedAt, &p.UpdatedAt, &p.IsActive, &p.StoreID, &p.CategoryID,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Product{}, apperr.New(apperr.NotFound, "product not found")
		}
		return Product{}, apperr.Wrap(apperr.Internal, err, "update product failed")
	}

	return p, nil
}

func (r *repo) Delete(ctx context.Context, id int64) error {
	_, err := r.db.Exec(ctx, `
		DELETE FROM products
		WHERE product_id = $1;
	`, id)

	if err != nil {
		return apperr.Wrap(apperr.Internal, err, "delete product failed")
	}
	return nil
}

func (r *repo) ListPublic(
	ctx context.Context,
	q string,
	categoryIDs []int64,
	parentCategoryID *int64,
	storeID *int64,
	limit, page int,
	priceSort string,
) ([]Product, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit
	q = strings.TrimSpace(strings.ToLower(q))

	base := `
        FROM products p
        JOIN stores s ON p.store_id = s.store_id
        WHERE p.is_active = 'YES' AND s.is_active = 'YES'
    `

	selectQuery := `
        SELECT 
            p.product_id,
            p.name,
            p.product_desc,
            p.price,
            p.image_url,
            p.created_at,
            p.updated_at,
            p.is_active,
            p.store_id,
            p.category_id,
            s.store_name
    ` + base

	countQuery := `SELECT COUNT(*) ` + base

	args := []any{}

	// if q != "" {
	// 	cond := " AND LOWER(p.name) LIKE '%' || $" + strconv.Itoa(len(args)+1) + " || '%' "
	// 	selectQuery += cond
	// 	countQuery += cond
	// 	args = append(args, q)
	// }
	if q != "" {
		idx := strconv.Itoa(len(args) + 1)
		cond := `
    		AND (
      			LOWER(p.name) LIKE '%' || $` + idx + ` || '%'
      			OR LOWER(p.product_desc) LIKE '%' || $` + idx + ` || '%'
      			OR LOWER(s.store_name) LIKE '%' || $` + idx + ` || '%'
    		)
  		`
		selectQuery += cond
		countQuery += cond
		args = append(args, q)
	}

	if len(categoryIDs) > 0 {
		placeholders := make([]string, len(categoryIDs))
		for i := range categoryIDs {
			placeholders[i] = "$" + strconv.Itoa(len(args)+1+i)
		}
		cond := " AND p.category_id IN (" + strings.Join(placeholders, ",") + ")"
		selectQuery += cond
		countQuery += cond
		for _, id := range categoryIDs {
			args = append(args, id)
		}
	}

	if parentCategoryID != nil {
		cond := `
            AND p.category_id IN (
                SELECT c.category_id
                FROM categories c
                WHERE c.parent_id = $` + strconv.Itoa(len(args)+1) + `
            )
        `
		selectQuery += cond
		countQuery += cond
		args = append(args, *parentCategoryID)
	}

	if storeID != nil {
		cond := " AND p.store_id = $" + strconv.Itoa(len(args)+1)
		selectQuery += cond
		countQuery += cond
		args = append(args, *storeID)
	}

	orderBy := "p.created_at DESC, p.product_id ASC"
	switch priceSort {
	case "asc":
		orderBy = "p.price ASC, p.product_id ASC"
	case "desc":
		orderBy = "p.price DESC, p.product_id ASC"
	}

	selectQuery += " ORDER BY " + orderBy +
		" LIMIT $" + strconv.Itoa(len(args)+1) +
		" OFFSET $" + strconv.Itoa(len(args)+2)

	argsWithPage := append(append([]any{}, args...), limit, offset)

	var total int64
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, apperr.Wrap(apperr.Internal, err, "count public products failed")
	}

	rows, err := r.db.Query(ctx, selectQuery, argsWithPage...)
	if err != nil {
		return nil, 0, apperr.Wrap(apperr.Internal, err, "public list failed")
	}
	defer rows.Close()

	var out []Product
	for rows.Next() {
		var p Product
		if err := rows.Scan(
			&p.ID,
			&p.Name,
			&p.Description,
			&p.Price,
			&p.ImageURL,
			&p.CreatedAt,
			&p.UpdatedAt,
			&p.IsActive,
			&p.StoreID,
			&p.CategoryID,
			&p.StoreName,
		); err != nil {
			return nil, 0, apperr.Wrap(apperr.Internal, err, "scan product failed")
		}
		out = append(out, p)
	}

	return out, total, nil
}

func (r *repo) GetPublic(ctx context.Context, id int64) (Product, error) {
	var p Product

	err := r.db.QueryRow(ctx, `
		SELECT p.product_id, p.name, p.product_desc, p.price, p.image_url,
		       p.created_at, p.updated_at, p.is_active, p.store_id, p.category_id
		FROM products p
		JOIN stores s ON p.store_id = s.store_id
		WHERE p.product_id = $1 AND p.is_active = 'YES' AND s.is_active = 'YES';
	`, id).Scan(
		&p.ID, &p.Name, &p.Description, &p.Price, &p.ImageURL,
		&p.CreatedAt, &p.UpdatedAt, &p.IsActive, &p.StoreID, &p.CategoryID,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Product{}, apperr.New(apperr.NotFound, "product not found")
		}
		return Product{}, apperr.Wrap(apperr.Internal, err, "public get failed")
	}

	return p, nil
}
