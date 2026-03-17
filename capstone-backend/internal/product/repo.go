package product

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgconn"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
)

type Repo interface {
	Create(ctx context.Context, in CreateParams) (Product, error)
	Get(ctx context.Context, id int64) (Product, error)
	ListByStoreID(ctx context.Context, storeID int64, q string, limit, page int) ([]Product, int64, error)
	Update(ctx context.Context, id int64, in UpdateParams) (Product, error)
	Delete(ctx context.Context, id int64) error

	ListPublic(ctx context.Context,
		q string,
		categoryIDs []int64,
		parentCategoryID *int64,
		storeID *int64,
		limit, page int,
		sortBy string,
		fulfillment string,
		minPrice *float64,
		maxPrice *float64,
	) ([]Product, int64, float64, error)

	GetPublic(ctx context.Context, id int64) (Product, error)
	SuggestSplit(ctx context.Context, userID string, q string, limit int) (SuggestSplitResult, error)
	GetCategoryName(ctx context.Context, categoryID int) (string, error)

	// ===== Option Keys =====
	CreateOptionKey(ctx context.Context, productID int64, keyName string, sortOrder int) (OptionKey, error)
	ListOptionKeys(ctx context.Context, productID int64) ([]OptionKey, error)
	DeleteOptionKey(ctx context.Context, keyID int64) error
	DeleteAllOptionKeysByProductID(ctx context.Context, productID int64) error

	// ===== Option Values =====
	CreateOptionValue(ctx context.Context, keyID int64, valueLabel string, sortOrder int) (OptionValue, error)
	DeleteOptionValue(ctx context.Context, valueID int64) error

	// ===== Variants =====
	CreateVariant(ctx context.Context, in CreateVariantParams) (Variant, error)
	ListVariants(ctx context.Context, productID int64) ([]Variant, error)
	UpdateVariantStock(ctx context.Context, variantID int64, stockQty int) (Variant, error)
	SetVariantActive(ctx context.Context, variantID int64, isActive bool) error
	DeleteVariant(ctx context.Context, variantID int64) error
	DeleteAllVariantsByProductID(ctx context.Context, productID int64) error
	DeductStock(ctx context.Context, variantID int64, qty int) error

	UpdateWithVariantsConfig(ctx context.Context, id int64, in UpdateParams, variants *ReplaceVariantsConfigInput) (Product, error)
}

// ===== Params =====

type CreateParams struct {
	Name        string
	Description *string
	Price       float64
	ImageURL    *string
	IsActive    string
	ProductType string // "STOCK" | "PREORDER"
	StoreID     int
	CategoryID  int

	EmbName     []float64
	EmbDesc     []float64
	EmbCategory []float64
}

type UpdateParams struct {
	Name        *string
	Description *string
	Price       *float64
	ImageURL    *string
	IsActive    *string
	CategoryID  *int

	EmbName     *[]float64
	EmbDesc     *[]float64
	EmbCategory *[]float64
}

type CreateVariantParams struct {
	ProductID    int64
	SKU          *string
	PriceDelta   float64
	StockQty     int
	OptionValues []int64 // option_value_ids
}

type SuggestSplitResult struct {
	History []string `json:"history"`
	Suggest []string `json:"suggest"`
}

// ===== repo =====

type repo struct{ db *pgxpool.Pool }

func NewRepo(db *pgxpool.Pool) Repo { return &repo{db: db} }

// ===== Vector helpers =====

func toVecArg(v []float64) (any, error) {
	if len(v) == 0 {
		return nil, nil
	}
	vl, err := vectorLiteral(v)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(vl) == "" {
		return nil, nil
	}
	return vl, nil
}

func vectorLiteral(v []float64) (string, error) {
	if len(v) == 0 {
		return "", nil
	}
	var b strings.Builder
	b.Grow(len(v) * 8)
	b.WriteByte('[')
	for i, f := range v {
		if i > 0 {
			b.WriteByte(',')
		}
		b.WriteString(strconv.FormatFloat(f, 'f', -1, 64))
	}
	b.WriteByte(']')
	return b.String(), nil
}

// ===== Create =====

func (r *repo) Create(ctx context.Context, in CreateParams) (Product, error) {
	in.Name = strings.TrimSpace(in.Name)
	in.IsActive = strings.ToUpper(strings.TrimSpace(in.IsActive))
	if in.IsActive == "" {
		in.IsActive = "YES"
	}
	in.ProductType = strings.ToUpper(strings.TrimSpace(in.ProductType))
	if in.ProductType == "" {
		in.ProductType = "PREORDER"
	}

	var exists bool
	if err := r.db.QueryRow(ctx, `
		SELECT EXISTS (SELECT 1 FROM products WHERE name = $1)
	`, in.Name).Scan(&exists); err != nil {
		return Product{}, apperr.Wrap(apperr.Internal, err, "check product name failed")
	}
	if exists {
		return Product{}, apperr.New(apperr.BadRequest, "product name already exists")
	}

	embName, err := toVecArg(in.EmbName)
	if err != nil {
		return Product{}, apperr.Wrap(apperr.Internal, err, "format embedding_name failed")
	}
	embDesc, err := toVecArg(in.EmbDesc)
	if err != nil {
		return Product{}, apperr.Wrap(apperr.Internal, err, "format embedding_desc failed")
	}
	embCat, err := toVecArg(in.EmbCategory)
	if err != nil {
		return Product{}, apperr.Wrap(apperr.Internal, err, "format embedding_category failed")
	}

	// category must be ACTIVE sub category
	var parentID *int
	var subActive string
	err = r.db.QueryRow(ctx, `
		SELECT parent_id, is_active
		FROM categories
		WHERE category_id = $1
	`, in.CategoryID).Scan(&parentID, &subActive)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Product{}, apperr.New(apperr.BadRequest, "invalid category_id")
		}
		return Product{}, apperr.Wrap(apperr.Internal, err, "check category failed")
	}
	if parentID == nil {
		return Product{}, apperr.New(apperr.BadRequest, "product category must be a sub category")
	}
	if strings.ToUpper(strings.TrimSpace(subActive)) != "YES" {
		return Product{}, apperr.New(apperr.BadRequest, "category is inactive")
	}

	var mainActive string
	err = r.db.QueryRow(ctx, `
		SELECT is_active FROM categories WHERE category_id = $1
	`, *parentID).Scan(&mainActive)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Product{}, apperr.New(apperr.BadRequest, "invalid main category")
		}
		return Product{}, apperr.Wrap(apperr.Internal, err, "check main category failed")
	}
	if strings.ToUpper(strings.TrimSpace(mainActive)) != "YES" {
		return Product{}, apperr.New(apperr.BadRequest, "main category is inactive")
	}

	var p Product
	err = r.db.QueryRow(ctx, `
        INSERT INTO products (
            name, product_desc, price, image_url,
            is_active, product_type, store_id, category_id,
            embedding_name, embedding_desc, embedding_category
        )
        VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, $8,
            COALESCE($9::vector,  NULL),
            COALESCE($10::vector, NULL),
            COALESCE($11::vector, NULL)
        )
        RETURNING product_id
    `,
		in.Name, in.Description, in.Price, in.ImageURL,
		in.IsActive, in.ProductType, in.StoreID, in.CategoryID,
		embName, embDesc, embCat,
	).Scan(&p.ID)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23503" {
			return Product{}, apperr.New(apperr.BadRequest, "invalid store_id or category_id")
		}
		return Product{}, apperr.Wrap(apperr.Internal, err, "insert product failed")
	}

	// SELECT พร้อม JOIN เพื่อดึง store_name + category_name
	err = r.db.QueryRow(ctx, `
        SELECT
            p.product_id, p.name, p.product_desc, p.price, p.image_url,
            p.product_type, p.created_at, p.updated_at, p.is_active,
            p.store_id, p.category_id,
            s.store_name,
            c.name AS category_name,
            0 AS sold_count
        FROM products p
        JOIN stores     s ON s.store_id     = p.store_id
        JOIN categories c ON c.category_id  = p.category_id
        WHERE p.product_id = $1
    `, p.ID).Scan(
		&p.ID, &p.Name, &p.Description, &p.Price, &p.ImageURL,
		&p.ProductType, &p.CreatedAt, &p.UpdatedAt, &p.IsActive,
		&p.StoreID, &p.CategoryID,
		&p.StoreName, &p.CategoryName, &p.SoldCount,
	)
	if err != nil {
		return Product{}, apperr.Wrap(apperr.Internal, err, "fetch product after insert failed")
	}

	return p, nil
}

// ===== Get =====

func (r *repo) Get(ctx context.Context, id int64) (Product, error) {
	var p Product
	err := r.db.QueryRow(ctx, `
        SELECT
            p.product_id, p.name, p.product_desc, p.price, p.image_url,
            p.product_type, p.created_at, p.updated_at, p.is_active,
            p.store_id, p.category_id,
            s.store_name,
            c.name AS category_name,
            0 AS sold_count
        FROM products p
        JOIN stores     s ON s.store_id    = p.store_id
        JOIN categories c ON c.category_id = p.category_id
        WHERE p.product_id = $1
    `, id).Scan(
		&p.ID, &p.Name, &p.Description, &p.Price, &p.ImageURL,
		&p.ProductType, &p.CreatedAt, &p.UpdatedAt, &p.IsActive,
		&p.StoreID, &p.CategoryID,
		&p.StoreName, &p.CategoryName, &p.SoldCount,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Product{}, apperr.New(apperr.NotFound, "product not found")
		}
		return Product{}, apperr.Wrap(apperr.Internal, err, "get product failed")
	}

	// เหมือน GetPublic — ถ้าเป็น STOCK ดึง options + variants มาด้วย
	if p.ProductType == "STOCK" {
		keys, err := r.ListOptionKeys(ctx, int64(p.ID))
		if err != nil {
			return Product{}, err
		}
		p.Options = keys

		variants, err := r.ListVariants(ctx, int64(p.ID))
		if err != nil {
			return Product{}, err
		}
		for i := range variants {
			variants[i].FinalPrice = p.Price + variants[i].PriceDelta
		}

		var total int64
		for _, v := range variants {
			total += int64(v.StockQty)
		}
		p.TotalStock = &total
		p.Variants = variants
	}

	return p, nil
}

// ===== ListByStoreID =====

func (r *repo) ListByStoreID(ctx context.Context, storeID int64, q string, limit, page int) ([]Product, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit
	q = strings.TrimSpace(q)

	base := `
FROM products p
JOIN stores s ON s.store_id = p.store_id
JOIN categories c ON c.category_id = p.category_id
WHERE p.store_id = $1
`
	args := []any{storeID}
	idx := 2

	if q != "" {
		base += " AND p.name ILIKE $" + strconv.Itoa(idx)
		args = append(args, q+"%")
		idx++
	}

	var total int64
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) `+base, args...).Scan(&total); err != nil {
		return nil, 0, apperr.Wrap(apperr.Internal, err, "count products by store failed")
	}

	limitIdx := idx
	offsetIdx := idx + 1

	query := `
SELECT
  p.product_id, p.name, p.product_desc, p.price, p.image_url,
  p.product_type, p.created_at, p.updated_at, p.is_active, p.store_id, p.category_id,
  s.store_name AS store_name,
  c.name       AS category_name,
  0            AS sold_count
` + base + `
ORDER BY p.created_at DESC
LIMIT $` + strconv.Itoa(limitIdx) + ` OFFSET $` + strconv.Itoa(offsetIdx)

	args = append(args, limit, offset)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, apperr.Wrap(apperr.Internal, err, "list products by store failed")
	}
	defer rows.Close()

	out := make([]Product, 0)
	for rows.Next() {
		var p Product
		if err := rows.Scan(
			&p.ID, &p.Name, &p.Description, &p.Price, &p.ImageURL,
			&p.ProductType, &p.CreatedAt, &p.UpdatedAt, &p.IsActive, &p.StoreID, &p.CategoryID,
			&p.StoreName, &p.CategoryName, &p.SoldCount,
		); err != nil {
			return nil, 0, apperr.Wrap(apperr.Internal, err, "scan product failed")
		}
		out = append(out, p)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, apperr.Wrap(apperr.Internal, err, "rows error")
	}
	return out, total, nil
}

// ===== Update =====

func (r *repo) Update(ctx context.Context, id int64, in UpdateParams) (Product, error) {
	if in.Name != nil {
		var exists bool
		if err := r.db.QueryRow(ctx, `
			SELECT EXISTS(
				SELECT 1 FROM products WHERE name = $1 AND product_id <> $2
			);
		`, *in.Name, id).Scan(&exists); err != nil {
			return Product{}, apperr.Wrap(apperr.Internal, err, "check product name failed")
		}
		if exists {
			return Product{}, apperr.New(apperr.BadRequest, "product name already exists")
		}
	}

	var embNameArg any
	var embDescArg any
	var embCatArg any

	if in.EmbName != nil {
		v, err := toVecArg(*in.EmbName)
		if err != nil {
			return Product{}, apperr.Wrap(apperr.Internal, err, "format embedding_name failed")
		}
		embNameArg = v
	}
	if in.EmbDesc != nil {
		v, err := toVecArg(*in.EmbDesc)
		if err != nil {
			return Product{}, apperr.Wrap(apperr.Internal, err, "format embedding_desc failed")
		}
		embDescArg = v
	}
	if in.EmbCategory != nil {
		v, err := toVecArg(*in.EmbCategory)
		if err != nil {
			return Product{}, apperr.Wrap(apperr.Internal, err, "format embedding_category failed")
		}
		embCatArg = v
	}

	var p Product
	err := r.db.QueryRow(ctx, `
        UPDATE products
        SET name         = COALESCE($2,  name),
            product_desc = COALESCE($3,  product_desc),
            price        = COALESCE($4,  price),
            image_url    = COALESCE($5,  image_url),
            is_active    = COALESCE($6,  is_active),
            category_id  = COALESCE($7,  category_id),

            embedding_name     = COALESCE($8::vector,  embedding_name),
            embedding_desc     = COALESCE($9::vector,  embedding_desc),
            embedding_category = COALESCE($10::vector, embedding_category),

            updated_at = NOW()
        WHERE product_id = $1
        RETURNING product_id
    `,
		id,
		in.Name, in.Description, in.Price, in.ImageURL, in.IsActive, in.CategoryID,
		embNameArg, embDescArg, embCatArg,
	).Scan(&p.ID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Product{}, apperr.New(apperr.NotFound, "product not found")
		}
		return Product{}, apperr.Wrap(apperr.Internal, err, "update product failed")
	}

	// SELECT พร้อม JOIN เพื่อดึง store_name + category_name
	err = r.db.QueryRow(ctx, `
        SELECT
            p.product_id, p.name, p.product_desc, p.price, p.image_url,
            p.product_type, p.created_at, p.updated_at, p.is_active,
            p.store_id, p.category_id,
            s.store_name,
            c.name AS category_name,
            0 AS sold_count
        FROM products p
        JOIN stores     s ON s.store_id    = p.store_id
        JOIN categories c ON c.category_id = p.category_id
        WHERE p.product_id = $1
    `, p.ID).Scan(
		&p.ID, &p.Name, &p.Description, &p.Price, &p.ImageURL,
		&p.ProductType, &p.CreatedAt, &p.UpdatedAt, &p.IsActive,
		&p.StoreID, &p.CategoryID,
		&p.StoreName, &p.CategoryName, &p.SoldCount,
	)
	if err != nil {
		return Product{}, apperr.Wrap(apperr.Internal, err, "fetch product after update failed")
	}

	return p, nil
}

// ===== Delete =====

func (r *repo) Delete(ctx context.Context, id int64) error {
	_, err := r.db.Exec(ctx, `DELETE FROM products WHERE product_id = $1;`, id)
	if err != nil {
		return apperr.Wrap(apperr.Internal, err, "delete product failed")
	}
	return nil
}

// ===== ListPublic =====

func (r *repo) ListPublic(
	ctx context.Context,
	q string,
	categoryIDs []int64,
	parentCategoryID *int64,
	storeID *int64,
	limit, page int,
	sortBy string,
	fulfillment string,
	minPrice *float64,
	maxPrice *float64,
) ([]Product, int64, float64, error) {

	if limit <= 0 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit

	q = strings.TrimSpace(q)
	qLower := strings.ToLower(q)
	terms := strings.Fields(qLower)

	fulfillment = strings.ToUpper(strings.TrimSpace(fulfillment))
	sortBy = strings.ToLower(strings.TrimSpace(sortBy))

	if minPrice != nil && *minPrice < 0 {
		return nil, 0, 0, apperr.New(apperr.BadRequest, "min_price must be >= 0")
	}
	if maxPrice != nil && *maxPrice < 0 {
		return nil, 0, 0, apperr.New(apperr.BadRequest, "max_price must be >= 0")
	}
	if minPrice != nil && maxPrice != nil && *maxPrice < *minPrice {
		return nil, 0, 0, apperr.New(apperr.BadRequest, "max_price must be >= min_price")
	}

	base := `
        FROM products p
        JOIN stores s ON p.store_id = s.store_id

        LEFT JOIN order_items oi ON oi.product_id = p.product_id
        LEFT JOIN orders o ON o.order_id = oi.order_id AND o.status = 'Completed'

        WHERE p.is_active = 'YES' AND s.is_active = 'YES'
    `

	selectQuery := `
        SELECT
            p.product_id,
            p.name,
            p.product_desc,
            p.price,
            p.image_url,
            p.product_type,
            p.created_at,
            p.updated_at,
            p.is_active,
            p.store_id,
            p.category_id,
            s.store_name,
            COALESCE(SUM(CASE WHEN o.order_id IS NOT NULL THEN oi.quantity ELSE 0 END), 0) AS sold_count
    ` + base

	countQuery := `SELECT COUNT(DISTINCT p.product_id) ` + base
	maxQuery := `SELECT COALESCE(MAX(p.price), 0) ` + base

	args := []any{}
	var qPos int

	if len(categoryIDs) > 0 {
		ph := make([]string, len(categoryIDs))
		for i := range categoryIDs {
			ph[i] = "$" + strconv.Itoa(len(args)+1+i)
		}
		cond := " AND p.category_id IN (" + strings.Join(ph, ",") + ")"
		selectQuery += cond
		countQuery += cond
		maxQuery += cond
		for _, id := range categoryIDs {
			args = append(args, id)
		}
	}

	if parentCategoryID != nil {
		cond := `
            AND p.category_id IN (
                SELECT c.category_id FROM categories c
                WHERE c.parent_id = $` + strconv.Itoa(len(args)+1) + `
            )
        `
		selectQuery += cond
		countQuery += cond
		maxQuery += cond
		args = append(args, *parentCategoryID)
	}

	if storeID != nil {
		cond := " AND p.store_id = $" + strconv.Itoa(len(args)+1)
		selectQuery += cond
		countQuery += cond
		maxQuery += cond
		args = append(args, *storeID)
	}

	if fulfillment != "" {
		var cond string
		switch fulfillment {
		case "ROUND_UNIVERSITY":
			cond = " AND s.delivery_round_university_enabled = TRUE"
		case "CAMPUS":
			cond = " AND s.campus_enabled = TRUE"
		default:
			return nil, 0, 0, apperr.New(apperr.BadRequest, "invalid fulfillment (use ROUND_UNIVERSITY or CAMPUS)")
		}
		selectQuery += cond
		countQuery += cond
		maxQuery += cond
	}

	if minPrice != nil {
		cond := " AND p.price >= $" + strconv.Itoa(len(args)+1)
		selectQuery += cond
		countQuery += cond
		maxQuery += cond
		args = append(args, *minPrice)
	}
	if maxPrice != nil {
		cond := " AND p.price <= $" + strconv.Itoa(len(args)+1)
		selectQuery += cond
		countQuery += cond
		maxQuery += cond
		args = append(args, *maxPrice)
	}

	if qLower != "" {
		args = append(args, qLower)
		qPos = len(args)
		likeQ := "$" + strconv.Itoa(qPos)

		termParts := []string{}
		for _, t := range terms {
			if t == "" {
				continue
			}
			args = append(args, t)
			tPos := len(args)
			termParts = append(termParts, `
                (
                    lower(p.name) LIKE '%' || $`+strconv.Itoa(tPos)+` || '%'
                    OR lower(s.store_name) LIKE '%' || $`+strconv.Itoa(tPos)+` || '%'
                    OR lower(coalesce(p.product_desc,'')) LIKE '%' || $`+strconv.Itoa(tPos)+` || '%'
                )
            `)
		}

		cond := `
            AND (
                lower(p.name) LIKE '%' || ` + likeQ + ` || '%'
                OR lower(s.store_name) LIKE '%' || ` + likeQ + ` || '%'
                OR lower(coalesce(p.product_desc,'')) LIKE '%' || ` + likeQ + ` || '%'
                OR p.name % ` + likeQ + `
                OR s.store_name % ` + likeQ + `
                OR coalesce(p.product_desc,'') % ` + likeQ + `
        `
		if len(termParts) > 0 {
			cond += " OR (" + strings.Join(termParts, " OR ") + ") "
		}
		cond += ")"

		selectQuery += cond
		countQuery += cond
		maxQuery += cond
	}

	groupBy := `
        GROUP BY
            p.product_id, p.name, p.product_desc, p.price, p.image_url,
            p.product_type, p.created_at, p.updated_at, p.is_active,
            p.store_id, p.category_id, s.store_name
    `
	selectQuery += " " + groupBy

	defaultLatest := "p.created_at DESC, p.product_id ASC"
	relevanceOrder := ""

	if qLower != "" {
		matchCountExpr := "0"
		for i := qPos + 1; i <= len(args); i++ {
			matchCountExpr += `
                + CASE WHEN (
                    lower(p.name) LIKE '%' || $` + strconv.Itoa(i) + ` || '%'
                    OR lower(s.store_name) LIKE '%' || $` + strconv.Itoa(i) + ` || '%'
                    OR lower(coalesce(p.product_desc,'')) LIKE '%' || $` + strconv.Itoa(i) + ` || '%'
                ) THEN 1 ELSE 0 END
            `
		}
		simMax := `
            GREATEST(
                similarity(p.name, $` + strconv.Itoa(qPos) + `),
                similarity(s.store_name, $` + strconv.Itoa(qPos) + `),
                similarity(coalesce(p.product_desc,''), $` + strconv.Itoa(qPos) + `)
            )
        `
		relevanceOrder = `
            (lower(p.name) = $` + strconv.Itoa(qPos) + `) DESC,
            (lower(s.store_name) = $` + strconv.Itoa(qPos) + `) DESC,
            (lower(p.name) LIKE $` + strconv.Itoa(qPos) + ` || '%') DESC,
            (lower(s.store_name) LIKE $` + strconv.Itoa(qPos) + ` || '%') DESC,
            (lower(p.name) LIKE '%' || $` + strconv.Itoa(qPos) + ` || '%') DESC,
            (lower(s.store_name) LIKE '%' || $` + strconv.Itoa(qPos) + ` || '%') DESC,
            (lower(coalesce(p.product_desc,'')) LIKE '%' || $` + strconv.Itoa(qPos) + ` || '%') DESC,
            (` + matchCountExpr + `) DESC,
            (` + simMax + `) DESC
        `
	}

	orderBy := defaultLatest
	switch sortBy {
	case "", "latest":
		if qLower != "" && relevanceOrder != "" {
			orderBy = relevanceOrder + ", " + defaultLatest
		}
	case "sold":
		if qLower != "" && relevanceOrder != "" {
			orderBy = relevanceOrder + ", sold_count DESC, " + defaultLatest
		} else {
			orderBy = "sold_count DESC, " + defaultLatest
		}
	case "price_asc":
		if qLower != "" && relevanceOrder != "" {
			orderBy = "p.price ASC, " + relevanceOrder + ", p.product_id ASC"
		} else {
			orderBy = "p.price ASC, p.product_id ASC"
		}
	case "price_desc":
		if qLower != "" && relevanceOrder != "" {
			orderBy = "p.price DESC, " + relevanceOrder + ", p.product_id ASC"
		} else {
			orderBy = "p.price DESC, p.product_id ASC"
		}
	default:
		return nil, 0, 0, apperr.New(apperr.BadRequest, "invalid sort_by (use latest, sold, price_asc, price_desc)")
	}

	selectQuery += " ORDER BY " + orderBy +
		" LIMIT $" + strconv.Itoa(len(args)+1) +
		" OFFSET $" + strconv.Itoa(len(args)+2)

	argsWithPage := append(append([]any{}, args...), limit, offset)

	var total int64
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, 0, apperr.Wrap(apperr.Internal, err, "count public products failed")
	}

	var maxPriceResult float64
	if err := r.db.QueryRow(ctx, maxQuery, args...).Scan(&maxPriceResult); err != nil {
		return nil, 0, 0, apperr.Wrap(apperr.Internal, err, "max price public products failed")
	}

	rows, err := r.db.Query(ctx, selectQuery, argsWithPage...)
	if err != nil {
		return nil, 0, 0, apperr.Wrap(apperr.Internal, err, "public list failed")
	}
	defer rows.Close()

	var out []Product
	for rows.Next() {
		var p Product
		if err := rows.Scan(
			&p.ID, &p.Name, &p.Description, &p.Price, &p.ImageURL,
			&p.ProductType, &p.CreatedAt, &p.UpdatedAt, &p.IsActive,
			&p.StoreID, &p.CategoryID, &p.StoreName, &p.SoldCount,
		); err != nil {
			return nil, 0, 0, apperr.Wrap(apperr.Internal, err, "scan product failed")
		}
		out = append(out, p)
	}
	if out == nil {
		out = []Product{}
	}
	return out, total, maxPriceResult, nil
}

// ===== GetPublic =====

func (r *repo) GetPublic(ctx context.Context, id int64) (Product, error) {
	var p Product
	err := r.db.QueryRow(ctx, `
		SELECT
		    p.product_id, p.name, p.product_desc, p.price, p.image_url,
		    p.product_type, p.created_at, p.updated_at, p.is_active,
		    p.store_id, p.category_id,
		    s.store_name,
		    c.name AS category_name,
		    COALESCE(SUM(CASE WHEN o.order_id IS NOT NULL THEN oi.quantity ELSE 0 END), 0) AS sold_count
		FROM products p
		JOIN stores s     ON p.store_id    = s.store_id
		JOIN categories c ON c.category_id = p.category_id

		LEFT JOIN order_items oi ON oi.product_id = p.product_id
		LEFT JOIN orders o       ON o.order_id    = oi.order_id AND o.status = 'Completed'

		WHERE p.product_id = $1
		  AND p.is_active  = 'YES'
		  AND s.is_active  = 'YES'
		  AND c.is_active  = 'YES'
		GROUP BY
		    p.product_id, p.name, p.product_desc, p.price, p.image_url,
		    p.product_type, p.created_at, p.updated_at, p.is_active,
		    p.store_id, p.category_id, s.store_name, c.name;
	`, id).Scan(
		&p.ID, &p.Name, &p.Description, &p.Price, &p.ImageURL,
		&p.ProductType, &p.CreatedAt, &p.UpdatedAt, &p.IsActive,
		&p.StoreID, &p.CategoryID, &p.StoreName, &p.CategoryName, &p.SoldCount,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Product{}, apperr.New(apperr.NotFound, "product not found")
		}
		return Product{}, apperr.Wrap(apperr.Internal, err, "public get failed")
	}

	if p.ProductType == "STOCK" {
		keys, err := r.ListOptionKeys(ctx, int64(p.ID))
		if err != nil {
			return Product{}, err
		}
		p.Options = keys

		variants, err := r.ListVariants(ctx, int64(p.ID))
		if err != nil {
			return Product{}, err
		}
		for i := range variants {
			variants[i].FinalPrice = p.Price + variants[i].PriceDelta
		}
		p.Variants = variants
	}

	return p, nil
}

// ===== SuggestSplit =====

func (r *repo) SuggestSplit(ctx context.Context, userID string, q string, limit int) (SuggestSplitResult, error) {
	q = strings.TrimSpace(q)
	userID = strings.TrimSpace(userID)

	if userID == "" {
		return SuggestSplitResult{}, apperr.New(apperr.BadRequest, "user_id is required")
	}
	if limit <= 0 {
		limit = 10
	}
	if limit > 20 {
		limit = 20
	}

	if q == "" {
		rows, err := r.db.Query(ctx, `
			SELECT query_text
			FROM search_history
			WHERE user_id = $1
			ORDER BY searched_at DESC, search_id DESC
			LIMIT $2;
		`, userID, limit)
		if err != nil {
			return SuggestSplitResult{}, apperr.Wrap(apperr.Internal, err, "list history for suggest failed")
		}
		defer rows.Close()

		out := SuggestSplitResult{
			History: make([]string, 0, limit),
			Suggest: []string{},
		}
		for rows.Next() {
			var v string
			if err := rows.Scan(&v); err != nil {
				return SuggestSplitResult{}, apperr.Wrap(apperr.Internal, err, "scan history suggest failed")
			}
			out.History = append(out.History, v)
		}
		return out, nil
	}

	rows, err := r.db.Query(ctx, `
		WITH combined AS (
			SELECT sh.query_text AS v, 0 AS prio, sh.searched_at AS ts
			FROM search_history sh
			WHERE sh.user_id = $2
			  AND lower(sh.query_text) LIKE lower($1) || '%'

			UNION ALL

			SELECT p.name AS v, 1 AS prio, NULL::timestamptz AS ts
			FROM products p
			JOIN stores s ON s.store_id = p.store_id
			WHERE p.is_active='YES' AND s.is_active='YES'
			  AND lower(p.name) LIKE lower($1) || '%'

			UNION ALL

			SELECT s.store_name AS v, 2 AS prio, NULL::timestamptz AS ts
			FROM stores s
			WHERE s.is_active='YES'
			  AND lower(s.store_name) LIKE lower($1) || '%'
		),
		dedup AS (
			SELECT v, prio, ts,
				   ROW_NUMBER() OVER (
					 PARTITION BY v
					 ORDER BY prio ASC, ts DESC NULLS LAST, v ASC
				   ) AS rn
			FROM combined
		)
		SELECT v, prio
		FROM dedup
		WHERE rn = 1
		ORDER BY prio ASC, ts DESC NULLS LAST, v ASC
		LIMIT $3;
	`, q, userID, limit)
	if err != nil {
		return SuggestSplitResult{}, apperr.Wrap(apperr.Internal, err, "suggest+history failed")
	}
	defer rows.Close()

	out := SuggestSplitResult{
		History: make([]string, 0, limit),
		Suggest: make([]string, 0, limit),
	}
	for rows.Next() {
		var v string
		var prio int
		if err := rows.Scan(&v, &prio); err != nil {
			return SuggestSplitResult{}, apperr.Wrap(apperr.Internal, err, "scan suggest split failed")
		}
		if prio == 0 {
			out.History = append(out.History, v)
		} else {
			out.Suggest = append(out.Suggest, v)
		}
	}
	return out, nil
}

// ===== GetCategoryName =====

func (r *repo) GetCategoryName(ctx context.Context, categoryID int) (string, error) {
	if categoryID <= 0 {
		return "", apperr.New(apperr.BadRequest, "invalid category_id")
	}
	var name string
	err := r.db.QueryRow(ctx, `
		SELECT name FROM categories WHERE category_id = $1 AND is_active = 'YES';
	`, categoryID).Scan(&name)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", apperr.New(apperr.BadRequest, "category not found or inactive")
		}
		return "", apperr.Wrap(apperr.Internal, err, "get category name failed")
	}
	return name, nil
}

// ===== Option Keys =====

func (r *repo) CreateOptionKey(ctx context.Context, productID int64, keyName string, sortOrder int) (OptionKey, error) {
	var k OptionKey
	err := r.db.QueryRow(ctx, `
		INSERT INTO product_option_keys (product_id, key_name, sort_order)
		VALUES ($1, $2, $3)
		RETURNING option_key_id, product_id, key_name, sort_order
	`, productID, strings.TrimSpace(keyName), sortOrder).Scan(
		&k.ID, &k.ProductID, &k.KeyName, &k.SortOrder,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return OptionKey{}, apperr.New(apperr.BadRequest, "option key already exists")
		}
		return OptionKey{}, apperr.Wrap(apperr.Internal, err, "create option key failed")
	}
	k.Values = []OptionValue{}
	return k, nil
}

func (r *repo) ListOptionKeys(ctx context.Context, productID int64) ([]OptionKey, error) {
	rows, err := r.db.Query(ctx, `
		SELECT option_key_id, product_id, key_name, sort_order
		FROM product_option_keys
		WHERE product_id = $1
		ORDER BY sort_order, option_key_id
	`, productID)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list option keys failed")
	}
	defer rows.Close()

	keys := make([]OptionKey, 0)
	for rows.Next() {
		var k OptionKey
		if err := rows.Scan(&k.ID, &k.ProductID, &k.KeyName, &k.SortOrder); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan option key failed")
		}
		keys = append(keys, k)
	}
	if err := rows.Err(); err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "rows error")
	}

	for i, k := range keys {
		vals, err := r.listOptionValues(ctx, int64(k.ID))
		if err != nil {
			return nil, err
		}
		keys[i].Values = vals
	}
	return keys, nil
}

func (r *repo) listOptionValues(ctx context.Context, keyID int64) ([]OptionValue, error) {
	rows, err := r.db.Query(ctx, `
		SELECT option_value_id, option_key_id, value_label, sort_order
		FROM product_option_values
		WHERE option_key_id = $1
		ORDER BY sort_order, option_value_id
	`, keyID)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list option values failed")
	}
	defer rows.Close()

	vals := make([]OptionValue, 0)
	for rows.Next() {
		var v OptionValue
		if err := rows.Scan(&v.ID, &v.OptionKeyID, &v.ValueLabel, &v.SortOrder); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan option value failed")
		}
		vals = append(vals, v)
	}
	if err := rows.Err(); err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "rows error")
	}
	return vals, nil
}

func (r *repo) DeleteOptionKey(ctx context.Context, keyID int64) error {
	_, err := r.db.Exec(ctx, `DELETE FROM product_option_keys WHERE option_key_id = $1`, keyID)
	if err != nil {
		return apperr.Wrap(apperr.Internal, err, "delete option key failed")
	}
	return nil
}

// DeleteAllOptionKeysByProductID ลบ option keys ทั้งหมดของ product (cascade ลบ values ด้วย)
func (r *repo) DeleteAllOptionKeysByProductID(ctx context.Context, productID int64) error {
	_, err := r.db.Exec(ctx, `
		DELETE FROM product_option_keys WHERE product_id = $1
	`, productID)
	if err != nil {
		return apperr.Wrap(apperr.Internal, err, "delete all option keys failed")
	}
	return nil
}

// ===== Option Values =====

func (r *repo) CreateOptionValue(ctx context.Context, keyID int64, valueLabel string, sortOrder int) (OptionValue, error) {
	var v OptionValue
	err := r.db.QueryRow(ctx, `
		INSERT INTO product_option_values (option_key_id, value_label, sort_order)
		VALUES ($1, $2, $3)
		RETURNING option_value_id, option_key_id, value_label, sort_order
	`, keyID, strings.TrimSpace(valueLabel), sortOrder).Scan(
		&v.ID, &v.OptionKeyID, &v.ValueLabel, &v.SortOrder,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return OptionValue{}, apperr.New(apperr.BadRequest, "option value already exists")
		}
		return OptionValue{}, apperr.Wrap(apperr.Internal, err, "create option value failed")
	}
	return v, nil
}

func (r *repo) DeleteOptionValue(ctx context.Context, valueID int64) error {
	_, err := r.db.Exec(ctx, `DELETE FROM product_option_values WHERE option_value_id = $1`, valueID)
	if err != nil {
		return apperr.Wrap(apperr.Internal, err, "delete option value failed")
	}
	return nil
}

// ===== Variants =====

func (r *repo) CreateVariant(ctx context.Context, in CreateVariantParams) (Variant, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return Variant{}, apperr.Wrap(apperr.Internal, err, "begin tx failed")
	}
	defer tx.Rollback(ctx)

	if len(in.OptionValues) > 0 {
		var existingID int
		err := tx.QueryRow(ctx, `
            SELECT v.variant_id
            FROM product_variants v
            WHERE v.product_id = $1
              AND v.is_active = true
              AND (
                SELECT COUNT(*)
                FROM variant_option_selections vos
                WHERE vos.variant_id = v.variant_id
                  AND vos.option_value_id = ANY($2)
              ) = $3
              AND (
                SELECT COUNT(*)
                FROM variant_option_selections vos
                WHERE vos.variant_id = v.variant_id
              ) = $3
            LIMIT 1
        `, in.ProductID, in.OptionValues, len(in.OptionValues)).Scan(&existingID)

		if err == nil {
			return Variant{}, apperr.New(apperr.Conflict, "variant with same option combination already exists")
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return Variant{}, apperr.Wrap(apperr.Internal, err, "check duplicate variant failed")
		}
	}

	var v Variant
	err = tx.QueryRow(ctx, `
		INSERT INTO product_variants (product_id, sku, price_delta, stock_qty)
		VALUES ($1, $2, $3, $4)
		RETURNING variant_id, product_id, sku, price_delta, stock_qty, is_active, created_at, updated_at
	`, in.ProductID, in.SKU, in.PriceDelta, in.StockQty).Scan(
		&v.ID, &v.ProductID, &v.SKU, &v.PriceDelta, &v.StockQty, &v.IsActive, &v.CreatedAt, &v.UpdatedAt,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return Variant{}, apperr.New(apperr.BadRequest, "variant sku already exists")
		}
		return Variant{}, apperr.Wrap(apperr.Internal, err, "create variant failed")
	}

	for _, valueID := range in.OptionValues {
		if _, err := tx.Exec(ctx, `
			INSERT INTO variant_option_selections (variant_id, option_value_id)
			VALUES ($1, $2)
		`, v.ID, valueID); err != nil {
			return Variant{}, apperr.Wrap(apperr.Internal, err, "insert variant selection failed")
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return Variant{}, apperr.Wrap(apperr.Internal, err, "commit tx failed")
	}

	v.Selections = []VariantSelection{}
	return v, nil
}

func (r *repo) ListVariants(ctx context.Context, productID int64) ([]Variant, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
		    v.variant_id, v.product_id, v.sku, v.price_delta,
		    v.stock_qty,  v.is_active,  v.created_at, v.updated_at,
		    ok.key_name,  ov.value_label
		FROM product_variants v
		JOIN variant_option_selections vos ON vos.variant_id     = v.variant_id
		JOIN product_option_values     ov  ON ov.option_value_id = vos.option_value_id
		JOIN product_option_keys       ok  ON ok.option_key_id   = ov.option_key_id
		WHERE v.product_id = $1
		ORDER BY v.variant_id, ok.sort_order
	`, productID)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list variants failed")
	}
	defer rows.Close()

	variantMap := make(map[int]*Variant)
	variantOrder := make([]int, 0)

	for rows.Next() {
		var (
			vID        int
			pID        int
			sku        *string
			priceDelta float64
			stockQty   int
			isActive   bool
			createdAt  time.Time
			updatedAt  time.Time
			keyName    string
			valueLabel string
		)
		if err := rows.Scan(
			&vID, &pID, &sku, &priceDelta, &stockQty, &isActive,
			&createdAt, &updatedAt, &keyName, &valueLabel,
		); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan variant row failed")
		}
		if _, ok := variantMap[vID]; !ok {
			v := &Variant{
				ID:         vID,
				ProductID:  pID,
				SKU:        sku,
				PriceDelta: priceDelta,
				StockQty:   stockQty,
				IsActive:   isActive,
				CreatedAt:  createdAt,
				UpdatedAt:  updatedAt,
				Selections: make([]VariantSelection, 0),
			}
			variantMap[vID] = v
			variantOrder = append(variantOrder, vID)
		}
		variantMap[vID].Selections = append(variantMap[vID].Selections, VariantSelection{
			KeyName: keyName, ValueLabel: valueLabel,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "rows error")
	}

	out := make([]Variant, 0, len(variantOrder))
	for _, id := range variantOrder {
		out = append(out, *variantMap[id])
	}
	return out, nil
}

func (r *repo) UpdateVariantStock(ctx context.Context, variantID int64, stockQty int) (Variant, error) {
	var v Variant
	err := r.db.QueryRow(ctx, `
		UPDATE product_variants
		SET stock_qty = $2, updated_at = NOW()
		WHERE variant_id = $1
		RETURNING variant_id, product_id, sku, price_delta, stock_qty, is_active, created_at, updated_at
	`, variantID, stockQty).Scan(
		&v.ID, &v.ProductID, &v.SKU, &v.PriceDelta, &v.StockQty, &v.IsActive, &v.CreatedAt, &v.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Variant{}, apperr.New(apperr.NotFound, "variant not found")
		}
		return Variant{}, apperr.Wrap(apperr.Internal, err, "update variant stock failed")
	}
	v.Selections = []VariantSelection{}
	return v, nil
}

func (r *repo) SetVariantActive(ctx context.Context, variantID int64, isActive bool) error {
	_, err := r.db.Exec(ctx, `
		UPDATE product_variants SET is_active = $2, updated_at = NOW()
		WHERE variant_id = $1
	`, variantID, isActive)
	if err != nil {
		return apperr.Wrap(apperr.Internal, err, "set variant active failed")
	}
	return nil
}

func (r *repo) DeleteVariant(ctx context.Context, variantID int64) error {
	_, err := r.db.Exec(ctx, `DELETE FROM product_variants WHERE variant_id = $1`, variantID)
	if err != nil {
		return apperr.Wrap(apperr.Internal, err, "delete variant failed")
	}
	return nil
}

// DeleteAllVariantsByProductID ลบ variants ทั้งหมดของ product
func (r *repo) DeleteAllVariantsByProductID(ctx context.Context, productID int64) error {
	_, err := r.db.Exec(ctx, `DELETE FROM product_variants WHERE product_id = $1`, productID)
	if err != nil {
		return apperr.Wrap(apperr.Internal, err, "delete all variants failed")
	}
	return nil
}

func (r *repo) DeductStock(ctx context.Context, variantID int64, qty int) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE product_variants
		SET stock_qty = stock_qty - $2, updated_at = NOW()
		WHERE variant_id = $1
		  AND stock_qty  >= $2
	`, variantID, qty)
	if err != nil {
		return apperr.Wrap(apperr.Internal, err, "deduct stock failed")
	}
	if tag.RowsAffected() == 0 {
		return apperr.New(apperr.BadRequest, "insufficient stock")
	}
	return nil
}

func (r *repo) UpdateWithVariantsConfig(ctx context.Context, id int64, in UpdateParams, variants *ReplaceVariantsConfigInput) (Product, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return Product{}, apperr.Wrap(apperr.Internal, err, "begin tx failed")
	}
	defer tx.Rollback(ctx)

	// ===== 1) check duplicate product name =====
	if in.Name != nil {
		var exists bool
		if err := tx.QueryRow(ctx, `
			SELECT EXISTS(
				SELECT 1
				FROM products
				WHERE name = $1
				  AND product_id <> $2
			)
		`, *in.Name, id).Scan(&exists); err != nil {
			return Product{}, apperr.Wrap(apperr.Internal, err, "check product name failed")
		}
		if exists {
			return Product{}, apperr.New(apperr.BadRequest, "product name already exists")
		}
	}

	// ===== 2) prepare embedding args =====
	var embNameArg any
	var embDescArg any
	var embCatArg any

	if in.EmbName != nil {
		v, err := toVecArg(*in.EmbName)
		if err != nil {
			return Product{}, apperr.Wrap(apperr.Internal, err, "format embedding_name failed")
		}
		embNameArg = v
	}
	if in.EmbDesc != nil {
		v, err := toVecArg(*in.EmbDesc)
		if err != nil {
			return Product{}, apperr.Wrap(apperr.Internal, err, "format embedding_desc failed")
		}
		embDescArg = v
	}
	if in.EmbCategory != nil {
		v, err := toVecArg(*in.EmbCategory)
		if err != nil {
			return Product{}, apperr.Wrap(apperr.Internal, err, "format embedding_category failed")
		}
		embCatArg = v
	}

	// ===== 3) update product =====
	var p Product
	err = tx.QueryRow(ctx, `
		UPDATE products
		SET name         = COALESCE($2,  name),
			product_desc = COALESCE($3,  product_desc),
			price        = COALESCE($4,  price),
			image_url    = COALESCE($5,  image_url),
			is_active    = COALESCE($6,  is_active),
			category_id  = COALESCE($7,  category_id),

			embedding_name     = COALESCE($8::vector,  embedding_name),
			embedding_desc     = COALESCE($9::vector,  embedding_desc),
			embedding_category = COALESCE($10::vector, embedding_category),

			updated_at = NOW()
		WHERE product_id = $1
		RETURNING product_id, product_type
	`,
		id,
		in.Name, in.Description, in.Price, in.ImageURL, in.IsActive, in.CategoryID,
		embNameArg, embDescArg, embCatArg,
	).Scan(&p.ID, &p.ProductType)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Product{}, apperr.New(apperr.NotFound, "product not found")
		}
		return Product{}, apperr.Wrap(apperr.Internal, err, "update product failed")
	}

	// ===== 4) replace variants config if provided =====
	if variants != nil {
		if strings.ToUpper(strings.TrimSpace(p.ProductType)) != "STOCK" {
			return Product{}, apperr.New(apperr.BadRequest, "variants config is only available for STOCK products")
		}

		// 4.1 delete old variants first
		if _, err := tx.Exec(ctx, `
			DELETE FROM product_variants
			WHERE product_id = $1
		`, id); err != nil {
			return Product{}, apperr.Wrap(apperr.Internal, err, "delete all variants failed")
		}

		// 4.2 delete old option keys (cascade delete values)
		if _, err := tx.Exec(ctx, `
			DELETE FROM product_option_keys
			WHERE product_id = $1
		`, id); err != nil {
			return Product{}, apperr.Wrap(apperr.Internal, err, "delete all option keys failed")
		}

		// 4.3 recreate option keys + values
		valueIDMap := make(map[string]map[string]int64, len(variants.Options))

		for _, opt := range variants.Options {
			keyName := strings.TrimSpace(opt.KeyName)

			var keyID int64
			if err := tx.QueryRow(ctx, `
				INSERT INTO product_option_keys (product_id, key_name, sort_order)
				VALUES ($1, $2, $3)
				RETURNING option_key_id
			`, id, keyName, opt.SortOrder).Scan(&keyID); err != nil {
				var pgErr *pgconn.PgError
				if errors.As(err, &pgErr) && pgErr.Code == "23505" {
					return Product{}, apperr.New(apperr.BadRequest, "option key already exists")
				}
				return Product{}, apperr.Wrap(apperr.Internal, err, "create option key failed")
			}

			valueIDMap[keyName] = make(map[string]int64, len(opt.Values))

			for j, rawLabel := range opt.Values {
				label := strings.TrimSpace(rawLabel)

				var valueID int64
				if err := tx.QueryRow(ctx, `
					INSERT INTO product_option_values (option_key_id, value_label, sort_order)
					VALUES ($1, $2, $3)
					RETURNING option_value_id
				`, keyID, label, j+1).Scan(&valueID); err != nil {
					var pgErr *pgconn.PgError
					if errors.As(err, &pgErr) && pgErr.Code == "23505" {
						return Product{}, apperr.New(apperr.BadRequest, "option value already exists")
					}
					return Product{}, apperr.Wrap(apperr.Internal, err, "create option value failed")
				}

				valueIDMap[keyName][label] = valueID
			}
		}

		// 4.4 recreate variants
		for i, v := range variants.Variants {
			var variantID int64

			err := tx.QueryRow(ctx, `
				INSERT INTO product_variants (product_id, sku, price_delta, stock_qty)
				VALUES ($1, $2, $3, $4)
				RETURNING variant_id
			`, id, nil, v.PriceDelta, v.StockQty).Scan(&variantID)
			if err != nil {
				var pgErr *pgconn.PgError
				if errors.As(err, &pgErr) && pgErr.Code == "23505" {
					return Product{}, apperr.New(apperr.BadRequest, "variant sku already exists")
				}
				return Product{}, apperr.Wrap(apperr.Internal, err, "create variant failed")
			}

			for j, rawLabel := range v.OptionValueLabels {
				keyName := strings.TrimSpace(variants.Options[j].KeyName)
				label := strings.TrimSpace(rawLabel)

				valueID, ok := valueIDMap[keyName][label]
				if !ok {
					return Product{}, apperr.New(
						apperr.Internal,
						"variant["+strconv.Itoa(i)+"]: could not resolve option value id",
					)
				}

				if _, err := tx.Exec(ctx, `
					INSERT INTO variant_option_selections (variant_id, option_value_id)
					VALUES ($1, $2)
				`, variantID, valueID); err != nil {
					return Product{}, apperr.Wrap(apperr.Internal, err, "insert variant selection failed")
				}
			}
		}
	}

	// ===== 5) fetch product after update =====
	err = tx.QueryRow(ctx, `
		SELECT
			p.product_id, p.name, p.product_desc, p.price, p.image_url,
			p.product_type, p.created_at, p.updated_at, p.is_active,
			p.store_id, p.category_id,
			s.store_name,
			c.name AS category_name,
			0 AS sold_count
		FROM products p
		JOIN stores     s ON s.store_id    = p.store_id
		JOIN categories c ON c.category_id = p.category_id
		WHERE p.product_id = $1
	`, p.ID).Scan(
		&p.ID, &p.Name, &p.Description, &p.Price, &p.ImageURL,
		&p.ProductType, &p.CreatedAt, &p.UpdatedAt, &p.IsActive,
		&p.StoreID, &p.CategoryID,
		&p.StoreName, &p.CategoryName, &p.SoldCount,
	)
	if err != nil {
		return Product{}, apperr.Wrap(apperr.Internal, err, "fetch product after update failed")
	}

	// ===== 6) fetch options =====
	if strings.ToUpper(strings.TrimSpace(p.ProductType)) == "STOCK" {
		keyRows, err := tx.Query(ctx, `
			SELECT option_key_id, product_id, key_name, sort_order
			FROM product_option_keys
			WHERE product_id = $1
			ORDER BY sort_order, option_key_id
		`, p.ID)
		if err != nil {
			return Product{}, apperr.Wrap(apperr.Internal, err, "list option keys failed")
		}

		keys := make([]OptionKey, 0)
		keyIndexByID := make(map[int]int)

		for keyRows.Next() {
			var k OptionKey
			if err := keyRows.Scan(&k.ID, &k.ProductID, &k.KeyName, &k.SortOrder); err != nil {
				keyRows.Close()
				return Product{}, apperr.Wrap(apperr.Internal, err, "scan option key failed")
			}
			k.Values = []OptionValue{}
			keyIndexByID[k.ID] = len(keys)
			keys = append(keys, k)
		}
		if err := keyRows.Err(); err != nil {
			keyRows.Close()
			return Product{}, apperr.Wrap(apperr.Internal, err, "rows error")
		}
		keyRows.Close()

		// query values หลังจากปิด keyRows แล้ว
		valRows, err := tx.Query(ctx, `
			SELECT
				ov.option_value_id,
				ov.option_key_id,
				ov.value_label,
				ov.sort_order
			FROM product_option_values ov
			JOIN product_option_keys ok ON ok.option_key_id = ov.option_key_id
			WHERE ok.product_id = $1
			ORDER BY ok.sort_order, ov.sort_order, ov.option_value_id
		`, p.ID)
		if err != nil {
			return Product{}, apperr.Wrap(apperr.Internal, err, "list option values failed")
		}

		for valRows.Next() {
			var ov OptionValue
			if err := valRows.Scan(&ov.ID, &ov.OptionKeyID, &ov.ValueLabel, &ov.SortOrder); err != nil {
				valRows.Close()
				return Product{}, apperr.Wrap(apperr.Internal, err, "scan option value failed")
			}

			idx, ok := keyIndexByID[ov.OptionKeyID]
			if ok {
				keys[idx].Values = append(keys[idx].Values, ov)
			}
		}
		if err := valRows.Err(); err != nil {
			valRows.Close()
			return Product{}, apperr.Wrap(apperr.Internal, err, "rows error")
		}
		valRows.Close()

		p.Options = keys

		// ===== 7) fetch variants =====
		rows, err := tx.Query(ctx, `
			SELECT
				v.variant_id, v.product_id, v.sku, v.price_delta,
				v.stock_qty, v.is_active, v.created_at, v.updated_at,
				ok.key_name, ov.value_label
			FROM product_variants v
			JOIN variant_option_selections vos ON vos.variant_id     = v.variant_id
			JOIN product_option_values     ov  ON ov.option_value_id = vos.option_value_id
			JOIN product_option_keys       ok  ON ok.option_key_id   = ov.option_key_id
			WHERE v.product_id = $1
			ORDER BY v.variant_id, ok.sort_order
		`, p.ID)
		if err != nil {
			return Product{}, apperr.Wrap(apperr.Internal, err, "list variants failed")
		}
		defer rows.Close()

		variantMap := make(map[int]*Variant)
		variantOrder := make([]int, 0)

		for rows.Next() {
			var (
				vID        int
				pID        int
				sku        *string
				priceDelta float64
				stockQty   int
				isActive   bool
				createdAt  time.Time
				updatedAt  time.Time
				keyName    string
				valueLabel string
			)
			if err := rows.Scan(
				&vID, &pID, &sku, &priceDelta, &stockQty, &isActive,
				&createdAt, &updatedAt, &keyName, &valueLabel,
			); err != nil {
				return Product{}, apperr.Wrap(apperr.Internal, err, "scan variant row failed")
			}

			if _, ok := variantMap[vID]; !ok {
				variantMap[vID] = &Variant{
					ID:         vID,
					ProductID:  pID,
					SKU:        sku,
					PriceDelta: priceDelta,
					StockQty:   stockQty,
					IsActive:   isActive,
					CreatedAt:  createdAt,
					UpdatedAt:  updatedAt,
					Selections: make([]VariantSelection, 0),
				}
				variantOrder = append(variantOrder, vID)
			}

			variantMap[vID].Selections = append(variantMap[vID].Selections, VariantSelection{
				KeyName:    keyName,
				ValueLabel: valueLabel,
			})
		}
		if err := rows.Err(); err != nil {
			return Product{}, apperr.Wrap(apperr.Internal, err, "rows error")
		}

		p.Variants = make([]Variant, 0, len(variantOrder))
		var total int64
		for _, vid := range variantOrder {
			v := *variantMap[vid]
			v.FinalPrice = p.Price + v.PriceDelta
			total += int64(v.StockQty)
			p.Variants = append(p.Variants, v)
		}
		p.TotalStock = &total
	}
	// ===== 8) commit =====
	if err := tx.Commit(ctx); err != nil {
		return Product{}, apperr.Wrap(apperr.Internal, err, "commit tx failed")
	}

	return p, nil
}
