package order

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgconn"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
)

// ============================================================================
// Repo Interface
// ============================================================================

type Repo interface {
	CreateOrderWithItems(ctx context.Context, in OrderCreateParams, items []OrderItemCreateParams) (OrderWithItems, error)
	GetOrder(ctx context.Context, id int64) (Order, error)
	ListItemsByOrderID(ctx context.Context, orderID int64) ([]OrderItem, error)
	UpdateOrderStatus(ctx context.Context, id int64, status string) (Order, error)
	CancelOrder(ctx context.Context, id int64) (Order, error)
}

type repo struct {
	db *pgxpool.Pool
}

func NewRepo(db *pgxpool.Pool) Repo {
	return &repo{db: db}
}

// ============================================================================
// Param Types
// ============================================================================

type OrderCreateParams struct {
	Status     string
	TotalPrice float64
	UserID     string
	StoreID    int
}

type OrderItemCreateParams struct {
	Quantity         int
	UnitPrice        float64
	FulfillmentType  string
	Subtotal         float64
	DepositAmount    *float64
	PromisedShipDate time.Time
	ProductID        int
}

// ============================================================================
// Helpers
// ============================================================================

func scanOrder(row pgx.Row, o *Order) error {
	return row.Scan(
		&o.ID,
		&o.Status,
		&o.TotalPrice,
		&o.OrderDate,
		&o.UpdatedAt,
		&o.CancelledAt,
		&o.UserID,
		&o.StoreID,
	)
}

func scanOrderItem(row pgx.Row, it *OrderItem) error {
	return row.Scan(
		&it.ID,
		&it.Quantity,
		&it.UnitPrice,
		&it.FulfillmentType,
		&it.Subtotal,
		&it.DepositAmount,
		&it.PromisedShipDate,
		&it.OrderID,
		&it.ProductID,
	)
}

// ============================================================================
// Create Order + Items (Tx)
// ============================================================================

func (r *repo) CreateOrderWithItems(
	ctx context.Context,
	in OrderCreateParams,
	items []OrderItemCreateParams,
) (OrderWithItems, error) {
	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return OrderWithItems{}, apperr.Wrap(apperr.Internal, err, "begin tx failed")
	}
	// ถ้า return ก่อน commit → rollback
	defer func() {
		if tx != nil {
			_ = tx.Rollback(ctx)
		}
	}()

	var ord Order
	err = scanOrder(tx.QueryRow(ctx, `
		INSERT INTO orders (status, total_price, user_id, store_id)
		VALUES ($1, $2, $3, $4)
		RETURNING order_id, status, total_price, order_date, updated_at,
		          cancelled_at, user_id, store_id;
	`, in.Status, in.TotalPrice, in.UserID, in.StoreID), &ord)
	if err != nil {
		if pgErr, ok := err.(*pgconn.PgError); ok {
			if pgErr.Code == "23503" { // fk users / stores
				return OrderWithItems{}, apperr.WithFields(
					apperr.Wrap(apperr.BadRequest, err, "invalid user_id or store_id"),
					map[string]any{"pg_code": pgErr.Code, "constraint": pgErr.ConstraintName},
				)
			}
			return OrderWithItems{}, apperr.WithFields(
				apperr.Wrap(apperr.Internal, err, "insert order failed"),
				map[string]any{"pg_code": pgErr.Code, "constraint": pgErr.ConstraintName},
			)
		}
		return OrderWithItems{}, apperr.Wrap(apperr.Internal, err, "insert order failed")
	}

	outItems := make([]OrderItem, 0, len(items))

	for _, it := range items {
		var promised any
		if it.PromisedShipDate.IsZero() {
			promised = nil
		} else {
			promised = it.PromisedShipDate
		}

		var oi OrderItem
		err = scanOrderItem(tx.QueryRow(ctx, `
			INSERT INTO order_items
				(quantity, unit_price, fulfillment_type, subtotal,
				 deposit_amount, promised_ship_date, order_id, product_id)
			VALUES ($1, $2, $3, $4, $5,
			        COALESCE($6, DEFAULT),
			        $7, $8)
			RETURNING order_item_id, quantity, unit_price, fulfillment_type,
			          subtotal, deposit_amount, promised_ship_date,
			          order_id, product_id;
		`,
			it.Quantity,
			it.UnitPrice,
			it.FulfillmentType,
			it.Subtotal,
			it.DepositAmount,
			promised,
			ord.ID,
			it.ProductID,
		), &oi)

		if err != nil {
			if pgErr, ok := err.(*pgconn.PgError); ok {
				if pgErr.Code == "23503" {
					return OrderWithItems{}, apperr.WithFields(
						apperr.Wrap(apperr.BadRequest, err, "invalid order_id or product_id"),
						map[string]any{"pg_code": pgErr.Code, "constraint": pgErr.ConstraintName},
					)
				}
				return OrderWithItems{}, apperr.WithFields(
					apperr.Wrap(apperr.Internal, err, "insert order_item failed"),
					map[string]any{"pg_code": pgErr.Code, "constraint": pgErr.ConstraintName},
				)
			}
			return OrderWithItems{}, apperr.Wrap(apperr.Internal, err, "insert order_item failed")
		}

		outItems = append(outItems, oi)
	}

	if err = tx.Commit(ctx); err != nil {
		return OrderWithItems{}, apperr.Wrap(apperr.Internal, err, "commit tx failed")
	}
	tx = nil

	return OrderWithItems{
		Order: ord,
		Items: outItems,
	}, nil
}

// ============================================================================
// Get Order / Items
// ============================================================================

func (r *repo) GetOrder(ctx context.Context, id int64) (Order, error) {
	var ord Order
	err := scanOrder(r.db.QueryRow(ctx, `
		SELECT order_id, status, total_price, order_date, updated_at,
		       cancelled_at, user_id, store_id
		FROM orders
		WHERE order_id = $1;
	`, id), &ord)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Order{}, apperr.New(apperr.NotFound, "order not found")
		}
		return Order{}, apperr.Wrap(apperr.Internal, err, "get order failed")
	}
	return ord, nil
}

func (r *repo) ListItemsByOrderID(ctx context.Context, orderID int64) ([]OrderItem, error) {
	rows, err := r.db.Query(ctx, `
		SELECT order_item_id, quantity, unit_price, fulfillment_type,
		       subtotal, deposit_amount, promised_ship_date,
		       order_id, product_id
		FROM order_items
		WHERE order_id = $1
		ORDER BY order_item_id ASC;
	`, orderID)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list order_items failed")
	}
	defer rows.Close()

	var out []OrderItem
	for rows.Next() {
		var it OrderItem
		if err := scanOrderItem(rows, &it); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan order_item failed")
		}
		out = append(out, it)
	}
	if err := rows.Err(); err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "rows error")
	}
	return out, nil
}

// ============================================================================
// Update Status / Cancel
// ============================================================================

func (r *repo) UpdateOrderStatus(ctx context.Context, id int64, status string) (Order, error) {
	var ord Order
	err := scanOrder(r.db.QueryRow(ctx, `
		UPDATE orders
		SET status = $2,
		    updated_at = NOW()
		WHERE order_id = $1
		RETURNING order_id, status, total_price, order_date, updated_at,
		          cancelled_at, user_id, store_id;
	`, id, status), &ord)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Order{}, apperr.New(apperr.NotFound, "order not found")
		}
		return Order{}, apperr.Wrap(apperr.Internal, err, "update order status failed")
	}
	return ord, nil
}

func (r *repo) CancelOrder(ctx context.Context, id int64) (Order, error) {
	var ord Order
	err := scanOrder(r.db.QueryRow(ctx, `
		UPDATE orders
		SET status = 'Cancelled',
		    updated_at = NOW(),
		    cancelled_at = NOW()
		WHERE order_id = $1
		RETURNING order_id, status, total_price, order_date, updated_at,
		          cancelled_at, user_id, store_id;
	`, id), &ord)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Order{}, apperr.New(apperr.NotFound, "order not found")
		}
		return Order{}, apperr.Wrap(apperr.Internal, err, "cancel order failed")
	}
	return ord, nil
}
