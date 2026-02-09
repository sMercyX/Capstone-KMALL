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

	// UPDATED: add fulfillment + return maxPriceInResult
	ListPublic(ctx context.Context,
		q string,
		categoryIDs []int64,
		parentCategoryID *int64,
		storeID *int64,
		limit, page int,
		sortBy string, // NEW: "latest" | "sold" | | "price_asc" | "price_desc" | ""
		fulfillment string, // "ROUND_UNIVERSITY" | "CAMPUS" | ""
		minPrice *float64,
		maxPrice *float64,
	) ([]Product, int64, float64, error)

	GetPublic(ctx context.Context, id int64) (Product, error)
	SuggestSplit(ctx context.Context, userID string, q string, limit int) (SuggestSplitResult, error)
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
	Embedding   []float64
}

type UpdateParams struct {
	Name        *string
	Description *string
	Price       *float64
	ImageURL    *string
	IsActive    *string
	CategoryID  *int
	Embedding   *[]float64
}

type SuggestSplitResult struct {
	History []string `json:"history"`
	Suggest []string `json:"suggest"`
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

func (r *repo) Create(ctx context.Context, in CreateParams) (Product, error) {
	in.IsActive = strings.ToUpper(strings.TrimSpace(in.IsActive))
	if in.IsActive == "" {
		in.IsActive = "YES"
	}

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

	// ===== embedding (optional) =====
	var vec any = nil
	if in.Embedding != nil {
		vl, err := vectorLiteral(in.Embedding)
		if err != nil {
			return Product{}, apperr.Wrap(apperr.Internal, err, "format embedding failed")
		}
		if strings.TrimSpace(vl) != "" {
			vec = vl // string => $8::vector
		}
	}

	// ----- INSERT -----
	var p Product
	err := r.db.QueryRow(ctx, `
		INSERT INTO products (
			name, product_desc, price, image_url,
			is_active, store_id, category_id,
			embedding
		)
		VALUES (
			$1, $2, $3, $4,
			$5, $6, $7,
			COALESCE($8::vector, NULL)
		)
		RETURNING
			product_id, name, product_desc, price, image_url,
			created_at, updated_at, is_active, store_id, category_id;
	`,
		in.Name, in.Description, in.Price, in.ImageURL,
		in.IsActive, in.StoreID, in.CategoryID,
		vec,
	).Scan(
		&p.ID, &p.Name, &p.Description, &p.Price, &p.ImageURL,
		&p.CreatedAt, &p.UpdatedAt, &p.IsActive, &p.StoreID, &p.CategoryID,
	)

	if err != nil {
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

	// ===== embedding (optional) =====
	// vecArg:
	// - nil => COALESCE($8::vector, embedding) => keep old
	// - string => set new
	var vecArg any = nil
	if in.Embedding != nil {
		vl, err := vectorLiteral(*in.Embedding)
		if err != nil {
			return Product{}, apperr.Wrap(apperr.Internal, err, "format embedding failed")
		}
		if strings.TrimSpace(vl) != "" {
			vecArg = vl
		} else {
			// ถ้าส่งมาว่างจริง ๆ จะไม่ set (ถือว่า ignore)
			vecArg = nil
		}
	}

	// ----- UPDATE -----
	var p Product
	err := r.db.QueryRow(ctx, `
		UPDATE products
		SET name = COALESCE($2, name),
		    product_desc = COALESCE($3, product_desc),
		    price = COALESCE($4, price),
		    image_url = COALESCE($5, image_url),
		    is_active = COALESCE($6, is_active),
		    category_id = COALESCE($7, category_id),
		    embedding = COALESCE($8::vector, embedding),
		    updated_at = NOW()
		WHERE product_id = $1
		RETURNING
			product_id, name, product_desc, price, image_url,
			created_at, updated_at, is_active, store_id, category_id;
	`,
		id,
		in.Name,
		in.Description,
		in.Price,
		in.ImageURL,
		in.IsActive,
		in.CategoryID,
		vecArg,
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
	sortBy string, // "latest" | "sold" | "price_asc" | "price_desc" | ""
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

	// price range validation
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
	var qPos int // position of qLower in args (1-based placeholder index)

	// ===== Filters =====
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
                SELECT c.category_id
                FROM categories c
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

	// fulfillment filter
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

	// price range filter
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

	// ===== Search =====
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

	// ===== GROUP BY =====
	groupBy := `
        GROUP BY
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
    `
	selectQuery += " " + groupBy

	// ===== ORDER BY =====
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
		// มี q => relevance ก่อน แล้วค่อย latest เป็นตัวกัน tie
		if qLower != "" && relevanceOrder != "" {
			orderBy = relevanceOrder + ", " + defaultLatest
		} else {
			orderBy = defaultLatest
		}

	case "sold":
		// sold เป็นหลัก (แต่ถ้ามี q ให้ relevance ช่วยดันของที่เกี่ยวข้องก่อน)
		if qLower != "" && relevanceOrder != "" {
			orderBy = relevanceOrder + ", sold_count DESC, " + defaultLatest
		} else {
			orderBy = "sold_count DESC, " + defaultLatest
		}

	case "price_asc":
		// ราคาเป็นหลักเสมอ
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

	// ===== Paging =====
	selectQuery += " ORDER BY " + orderBy +
		" LIMIT $" + strconv.Itoa(len(args)+1) +
		" OFFSET $" + strconv.Itoa(len(args)+2)

	argsWithPage := append(append([]any{}, args...), limit, offset)

	// ===== Count =====
	var total int64
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, 0, apperr.Wrap(apperr.Internal, err, "count public products failed")
	}

	// ===== Max price (after ALL filters) =====
	var maxPriceResult float64
	if err := r.db.QueryRow(ctx, maxQuery, args...).Scan(&maxPriceResult); err != nil {
		return nil, 0, 0, apperr.Wrap(apperr.Internal, err, "max price public products failed")
	}

	// ===== Query =====
	rows, err := r.db.Query(ctx, selectQuery, argsWithPage...)
	if err != nil {
		return nil, 0, 0, apperr.Wrap(apperr.Internal, err, "public list failed")
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
			&p.SoldCount,
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

func (r *repo) GetPublic(ctx context.Context, id int64) (Product, error) {
	var p Product

	err := r.db.QueryRow(ctx, `
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
        s.store_name,
        c.name AS category_name,
        COALESCE(SUM(CASE WHEN o.order_id IS NOT NULL THEN oi.quantity ELSE 0 END), 0) AS sold_count
    FROM products p
    JOIN stores s ON p.store_id = s.store_id
    JOIN categories c ON c.category_id = p.category_id

    LEFT JOIN order_items oi ON oi.product_id = p.product_id
    LEFT JOIN orders o ON o.order_id = oi.order_id AND o.status = 'Completed'

    WHERE p.product_id = $1
      AND p.is_active = 'YES'
      AND s.is_active = 'YES'
      AND c.is_active = 'YES'
    GROUP BY
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
        s.store_name,
        c.name;
`, id).Scan(
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
		&p.CategoryName,
		&p.SoldCount,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Product{}, apperr.New(apperr.NotFound, "product not found")
		}
		return Product{}, apperr.Wrap(apperr.Internal, err, "public get failed")
	}

	return p, nil
}

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

	// q ว่าง => history ล้วน
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
			-- 0) history match ก่อน
			SELECT sh.query_text AS v, 0 AS prio, sh.searched_at AS ts
			FROM search_history sh
			WHERE sh.user_id = $2
			  AND lower(sh.query_text) LIKE lower($1) || '%'

			UNION ALL

			-- 1) product name
			SELECT p.name AS v, 1 AS prio, NULL::timestamptz AS ts
			FROM products p
			JOIN stores s ON s.store_id = p.store_id
			WHERE p.is_active='YES' AND s.is_active='YES'
			  AND lower(p.name) LIKE lower($1) || '%'

			UNION ALL

			-- 2) store name
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
