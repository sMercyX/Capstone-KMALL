package cart

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
	// Cart
	GetCartByUserID(ctx context.Context, userID string) (Cart, error)
	GetOrCreateCartByUserID(ctx context.Context, userID string) (Cart, error)

	// Cart items
	ListItemsByCartID(ctx context.Context, cartID int64) ([]CartItem, error)
	ListItemViewsByCartID(ctx context.Context, cartID int64) ([]CartItemView, error)
	GetItem(ctx context.Context, id int64) (CartItem, error)
	CreateItem(ctx context.Context, in CartItemCreateParams) (CartItem, error)
	UpdateItem(ctx context.Context, id int64, in CartItemUpdateParams) (CartItem, error)
	DeleteItem(ctx context.Context, id int64) error
	ClearItemsByCartID(ctx context.Context, cartID int64) error

	// Product / store helpers
	GetCartStoreID(ctx context.Context, cartID int64) (*int, error)
	GetProductOwnerID(ctx context.Context, productID int) (string, error)
	GetStoreInfoByProductID(ctx context.Context, productID int) (storeID int, isActive string, err error)

	// ดึง product_type + validate variant
	GetProductType(ctx context.Context, productID int) (string, error)
	GetVariantInfo(ctx context.Context, variantID int) (productID int, isActive bool, stockQty int, err error)

	GetCartStoreInfo(ctx context.Context, cartID int64) (*CartStoreInfo, error)
}

type repo struct {
	db *pgxpool.Pool
}

func NewRepo(db *pgxpool.Pool) Repo {
	return &repo{db: db}
}

// ============================================================================
// Cart
// ============================================================================

func (r *repo) GetCartByUserID(ctx context.Context, userID string) (Cart, error) {
	var c Cart
	err := r.db.QueryRow(ctx, `
		SELECT cart_id, user_id, created_at, updated_at
		FROM carts
		WHERE user_id = $1
		ORDER BY cart_id ASC
		LIMIT 1;
	`, userID).Scan(
		&c.ID, &c.UserID, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Cart{}, apperr.New(apperr.NotFound, "cart not found")
		}
		return Cart{}, apperr.Wrap(apperr.Internal, err, "get cart failed")
	}
	return c, nil
}

func (r *repo) GetOrCreateCartByUserID(ctx context.Context, userID string) (Cart, error) {
	c, err := r.GetCartByUserID(ctx, userID)
	if err == nil {
		return c, nil
	}
	if ae := apperr.From(err); ae.Code != apperr.NotFound {
		return Cart{}, err
	}

	var created Cart
	err = r.db.QueryRow(ctx, `
		INSERT INTO carts (user_id)
		VALUES ($1)
		RETURNING cart_id, user_id, created_at, updated_at;
	`, userID).Scan(
		&created.ID, &created.UserID, &created.CreatedAt, &created.UpdatedAt,
	)
	if err != nil {
		if pgErr, ok := err.(*pgconn.PgError); ok {
			return Cart{}, apperr.WithFields(
				apperr.Wrap(apperr.Internal, err, "create cart failed"),
				map[string]any{
					"pg_code":    pgErr.Code,
					"constraint": pgErr.ConstraintName,
					"detail":     pgErr.Detail,
				},
			)
		}
		return Cart{}, apperr.Wrap(apperr.Internal, err, "create cart failed")
	}
	return created, nil
}

// ============================================================================
// Cart Items
// ============================================================================

func (r *repo) ListItemsByCartID(ctx context.Context, cartID int64) ([]CartItem, error) {
	rows, err := r.db.Query(ctx, `
		SELECT cart_item_id, cart_id, product_id, variant_id, quantity
		FROM cart_items
		WHERE cart_id = $1
		ORDER BY cart_item_id ASC;
	`, cartID)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list cart items failed")
	}
	defer rows.Close()

	out := []CartItem{}
	for rows.Next() {
		var it CartItem
		if err := rows.Scan(&it.ID, &it.CartID, &it.ProductID, &it.VariantID, &it.Quantity); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan cart item failed")
		}
		out = append(out, it)
	}
	if err := rows.Err(); err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "rows error")
	}
	return out, nil
}

func (r *repo) GetItem(ctx context.Context, id int64) (CartItem, error) {
	var it CartItem
	err := r.db.QueryRow(ctx, `
		SELECT cart_item_id, cart_id, product_id, variant_id, quantity
		FROM cart_items
		WHERE cart_item_id = $1;
	`, id).Scan(
		&it.ID, &it.CartID, &it.ProductID, &it.VariantID, &it.Quantity,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return CartItem{}, apperr.New(apperr.NotFound, "cart item not found")
		}
		return CartItem{}, apperr.Wrap(apperr.Internal, err, "get cart item failed")
	}
	return it, nil
}

func (r *repo) CreateItem(ctx context.Context, in CartItemCreateParams) (CartItem, error) {
	var item CartItem
	// CreateItem — เพิ่ม note
	err := r.db.QueryRow(ctx, `
    INSERT INTO cart_items (cart_id, product_id, variant_id, quantity, note)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (cart_id, product_id, variant_id)
    DO UPDATE SET
        quantity = cart_items.quantity + EXCLUDED.quantity,
        note     = EXCLUDED.note
    RETURNING cart_item_id, cart_id, product_id, variant_id, quantity, note;
`, in.CartID, in.ProductID, in.VariantID, in.Quantity, in.Note,
	).Scan(&item.ID, &item.CartID, &item.ProductID, &item.VariantID, &item.Quantity, &item.Note)
	if err != nil {
		return CartItem{}, apperr.Wrap(apperr.Internal, err, "create or update cart item failed")
	}
	return item, nil
}

func (r *repo) UpdateItem(ctx context.Context, id int64, in CartItemUpdateParams) (CartItem, error) {
	var it CartItem
	err := r.db.QueryRow(ctx, `
    UPDATE cart_items
    SET quantity = COALESCE($2, quantity),
        note     = COALESCE($3, note)
    WHERE cart_item_id = $1
    RETURNING cart_item_id, cart_id, product_id, variant_id, quantity, note;
`, id, in.Quantity, in.Note).Scan(
		&it.ID, &it.CartID, &it.ProductID, &it.VariantID, &it.Quantity, &it.Note,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return CartItem{}, apperr.New(apperr.NotFound, "cart item not found")
		}
		if pgErr, ok := err.(*pgconn.PgError); ok {
			return CartItem{}, apperr.WithFields(
				apperr.Wrap(apperr.Internal, err, "update cart item failed"),
				map[string]any{
					"pg_code":    pgErr.Code,
					"constraint": pgErr.ConstraintName,
					"detail":     pgErr.Detail,
				},
			)
		}
		return CartItem{}, apperr.Wrap(apperr.Internal, err, "update cart item failed")
	}
	return it, nil
}

func (r *repo) DeleteItem(ctx context.Context, id int64) error {
	cmd, err := r.db.Exec(ctx, `
		DELETE FROM cart_items WHERE cart_item_id = $1;
	`, id)
	if err != nil {
		return apperr.Wrap(apperr.Internal, err, "delete cart item failed")
	}
	if cmd.RowsAffected() == 0 {
		return apperr.New(apperr.NotFound, "cart item not found")
	}
	return nil
}

func (r *repo) ClearItemsByCartID(ctx context.Context, cartID int64) error {
	_, err := r.db.Exec(ctx, `
		DELETE FROM cart_items WHERE cart_id = $1;
	`, cartID)
	if err != nil {
		return apperr.Wrap(apperr.Internal, err, "clear cart items failed")
	}
	return nil
}

// ============================================================================
// ListItemViewsByCartID
// ============================================================================

func (r *repo) ListItemViewsByCartID(ctx context.Context, cartID int64) ([]CartItemView, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
			ci.cart_item_id,
			ci.cart_id,
			ci.product_id,
			ci.variant_id,
			p.name                                                 AS product_name,
			COALESCE(p.image_url, '')                              AS product_image_url,
			p.price + COALESCE(pv.price_delta, 0)                 AS product_price,
			s.store_id,
			s.store_name,
			ci.quantity,
			ci.quantity * (p.price + COALESCE(pv.price_delta, 0)) AS subtotal,

			-- variant label: "สี: ดำ / ขนาด: M"
			COALESCE(
				string_agg(
					ok.key_name || ': ' || ov.value_label,
					' / '
					ORDER BY ok.sort_order
				),
				''
			) AS variant_label,

			-- stock info
			COALESCE(pv.stock_qty, 0)                              AS stock_qty,
			COALESCE(pv.stock_qty, 0) >= ci.quantity               AS is_available,
			ci.note

		FROM cart_items ci
		JOIN products p  ON ci.product_id = p.product_id
		JOIN stores   s  ON p.store_id    = s.store_id

		LEFT JOIN product_variants          pv  ON pv.variant_id      = ci.variant_id
		LEFT JOIN variant_option_selections vos ON vos.variant_id     = ci.variant_id
		LEFT JOIN product_option_values     ov  ON ov.option_value_id = vos.option_value_id
		LEFT JOIN product_option_keys       ok  ON ok.option_key_id   = ov.option_key_id

		WHERE ci.cart_id = $1
		GROUP BY
			ci.cart_item_id, ci.cart_id, ci.product_id, ci.variant_id,
			p.name, p.image_url, p.price,
			pv.price_delta, pv.stock_qty,
			s.store_id, s.store_name,
			ci.quantity, ci.note
		ORDER BY ci.cart_item_id ASC;
	`, cartID)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list cart item views failed")
	}
	defer rows.Close()

	out := []CartItemView{}
	for rows.Next() {
		var v CartItemView
		if err := rows.Scan(
			&v.ID,
			&v.CartID,
			&v.ProductID,
			&v.VariantID,
			&v.ProductName,
			&v.ProductImageURL,
			&v.ProductPrice,
			&v.StoreID,
			&v.StoreName,
			&v.Quantity,
			&v.Subtotal,
			&v.VariantLabel,
			&v.StockQty,
			&v.IsAvailable,
			&v.Note,
		); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan cart item view failed")
		}
		out = append(out, v)
	}
	if err := rows.Err(); err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "rows error")
	}
	return out, nil
}

// ============================================================================
// Product / Store helpers
// ============================================================================

func (r *repo) GetCartStoreID(ctx context.Context, cartID int64) (*int, error) {
	var storeID int
	err := r.db.QueryRow(ctx, `
		SELECT p.store_id
		FROM cart_items ci
		JOIN products p ON ci.product_id = p.product_id
		WHERE ci.cart_id = $1
		ORDER BY ci.cart_item_id ASC
		LIMIT 1;
	`, cartID).Scan(&storeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, apperr.Wrap(apperr.Internal, err, "get cart store_id failed")
	}
	return &storeID, nil
}

func (r *repo) GetProductOwnerID(ctx context.Context, productID int) (string, error) {
	var ownerID string
	err := r.db.QueryRow(ctx, `
		SELECT s.user_id
		FROM products p
		JOIN stores s ON p.store_id = s.store_id
		WHERE p.product_id = $1;
	`, productID).Scan(&ownerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", apperr.New(apperr.NotFound, "product not found")
		}
		return "", apperr.Wrap(apperr.Internal, err, "get product owner failed")
	}
	return ownerID, nil
}

func (r *repo) GetStoreInfoByProductID(ctx context.Context, productID int) (storeID int, isActive string, err error) {
	err = r.db.QueryRow(ctx, `
		SELECT s.store_id, s.is_active
		FROM products p
		JOIN stores s ON s.store_id = p.store_id
		WHERE p.product_id = $1;
	`, productID).Scan(&storeID, &isActive)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, "", apperr.New(apperr.NotFound, "product not found")
		}
		return 0, "", apperr.Wrap(apperr.Internal, err, "get store info failed")
	}
	return storeID, isActive, nil
}

func (r *repo) GetProductType(ctx context.Context, productID int) (string, error) {
	var productType string
	err := r.db.QueryRow(ctx, `
		SELECT product_type FROM products WHERE product_id = $1 AND is_active = 'YES';
	`, productID).Scan(&productType)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", apperr.New(apperr.NotFound, "product not found or inactive")
		}
		return "", apperr.Wrap(apperr.Internal, err, "get product type failed")
	}
	return strings.ToUpper(strings.TrimSpace(productType)), nil
}

func (r *repo) GetVariantInfo(ctx context.Context, variantID int) (productID int, isActive bool, stockQty int, err error) {
	err = r.db.QueryRow(ctx, `
		SELECT product_id, is_active, stock_qty
		FROM product_variants
		WHERE variant_id = $1;
	`, variantID).Scan(&productID, &isActive, &stockQty)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, false, 0, apperr.New(apperr.NotFound, "variant not found")
		}
		return 0, false, 0, apperr.Wrap(apperr.Internal, err, "get variant info failed")
	}
	return productID, isActive, stockQty, nil
}

func (r *repo) GetCartStoreInfo(ctx context.Context, cartID int64) (*CartStoreInfo, error) {
	var s CartStoreInfo

	err := r.db.QueryRow(ctx, `
		SELECT
			st.store_id,
			st.store_name,
			st.delivery_round_university_enabled,
			st.round_uni_base_fee
		FROM cart_items ci
		JOIN products p ON ci.product_id = p.product_id
		JOIN stores st ON p.store_id = st.store_id
		WHERE ci.cart_id = $1
		ORDER BY ci.cart_item_id ASC
		LIMIT 1;
	`, cartID).Scan(
		&s.ID,
		&s.Name,
		&s.DeliveryRoundUniversityEnabled,
		&s.RoundUniBaseFee,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, apperr.Wrap(apperr.Internal, err, "get cart store info failed")
	}

	return &s, nil
}
