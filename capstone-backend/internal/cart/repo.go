package cart

import (
	"context"
	"errors"

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
	GetItem(ctx context.Context, id int64) (CartItem, error)
	CreateItem(ctx context.Context, in CartItemCreateParams) (CartItem, error)
	UpdateItem(ctx context.Context, id int64, in CartItemUpdateParams) (CartItem, error)
	DeleteItem(ctx context.Context, id int64) error
}

type repo struct {
	db *pgxpool.Pool
}

func NewRepo(db *pgxpool.Pool) Repo {
	return &repo{db: db}
}

// ============================================================================
// Params
// ============================================================================

type CartItemUpdateParams struct {
	Quantity *int
}

// ============================================================================
// Cart
// ============================================================================

// GetCartByUserID ดึง cart แรกของ user (ถ้าไม่มี → NOT_FOUND)
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

// GetOrCreateCartByUserID ถ้าไม่มี cart → สร้างใหม่ให้ user
func (r *repo) GetOrCreateCartByUserID(ctx context.Context, userID string) (Cart, error) {
	// 1) ลองดึงก่อน
	c, err := r.GetCartByUserID(ctx, userID)
	if err == nil {
		return c, nil
	}
	if ae := apperr.From(err); ae.Code != apperr.NotFound {
		return Cart{}, err
	}

	// 2) ไม่มี → สร้างใหม่
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
					"table":      pgErr.TableName,
					"column":     pgErr.ColumnName,
					"schema":     pgErr.SchemaName,
					"internal_q": pgErr.InternalQuery,
					"where":      pgErr.Where,
					"routine":    pgErr.Routine,
					"hint":       pgErr.Hint,
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
		SELECT cart_item_id, cart_id, product_id, quantity
		FROM cart_items
		WHERE cart_id = $1
		ORDER BY cart_item_id ASC;
	`, cartID)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list cart items failed")
	}
	defer rows.Close()

	var out []CartItem
	for rows.Next() {
		var it CartItem
		if err := rows.Scan(&it.ID, &it.CartID, &it.ProductID, &it.Quantity); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan cart item failed")
		}
		out = append(out, it)
	}
	if err := rows.Err(); err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "rows error")
	}
	if out == nil {
		out = []CartItem{}
	}
	return out, nil
}

func (r *repo) GetItem(ctx context.Context, id int64) (CartItem, error) {
	var it CartItem
	err := r.db.QueryRow(ctx, `
		SELECT cart_item_id, cart_id, product_id, quantity
		FROM cart_items
		WHERE cart_item_id = $1;
	`, id).Scan(
		&it.ID, &it.CartID, &it.ProductID, &it.Quantity,
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
	err := r.db.QueryRow(ctx, `
        INSERT INTO cart_items (cart_id, product_id, quantity)
        VALUES ($1, $2, $3)
        ON CONFLICT (cart_id, product_id)
        DO UPDATE SET
            quantity = cart_items.quantity + EXCLUDED.quantity
        RETURNING cart_item_id, cart_id, product_id, quantity;
    `,
		in.CartID, in.ProductID, in.Quantity,
	).Scan(&item.ID, &item.CartID, &item.ProductID, &item.Quantity)

	if err != nil {
		return CartItem{}, apperr.Wrap(apperr.Internal, err, "create or update cart item failed")
	}
	return item, nil
}

func (r *repo) UpdateItem(ctx context.Context, id int64, in CartItemUpdateParams) (CartItem, error) {
	var it CartItem
	err := r.db.QueryRow(ctx, `
		UPDATE cart_items
		SET quantity  = COALESCE($2, quantity)
		WHERE cart_item_id = $1
		RETURNING cart_item_id, cart_id, product_id, quantity;
	`,
		id, in.Quantity,
	).Scan(&it.ID, &it.CartID, &it.ProductID, &it.Quantity)

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
		DELETE FROM cart_items
		WHERE cart_item_id = $1;
	`, id)
	if err != nil {
		return apperr.Wrap(apperr.Internal, err, "delete cart item failed")
	}
	if cmd.RowsAffected() == 0 {
		return apperr.New(apperr.NotFound, "cart item not found")
	}
	return nil
}
