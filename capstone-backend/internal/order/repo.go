package order

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

// ============================================================================
// Repo Interface
// ============================================================================

type Repo interface {
	CreateOrderWithItems(ctx context.Context, in OrderCreateParams, items []OrderItemCreateParams) (OrderWithItems, error)
	GetOrder(ctx context.Context, id int64) (Order, error)
	ListItemsByOrderID(ctx context.Context, orderID int64) ([]OrderItemWithProduct, error)
	UpdateOrderStatus(ctx context.Context, id int64, status string) (Order, error)
	CancelOrder(ctx context.Context, id int64, cancelledBy string, reason string) (Order, error)

	ListByUserID(ctx context.Context, userID string, statuses []string, q string, limit, page int) ([]Order, int64, error)
	ListByStoreID(ctx context.Context, storeID int64, statuses []string, q string, limit, page int) ([]Order, int64, error)
	Propose(ctx context.Context, id int64, proposedAt time.Time, meetingLocationID *int, meetingNote *string) (Order, error)
	RespondProposal(ctx context.Context, id int64, accept bool) (Order, error)

	BulkCancelActiveOrdersByStoreID(ctx context.Context, storeID int64, reason string) ([]BulkCancelledOrder, error)
	BulkCancelActiveOrdersByBuyer(ctx context.Context, buyerID string, reason string) ([]BulkCancelledOrder, error)

	AcceptRoundUniversity(ctx context.Context, id int64, promisedShipDate time.Time) (Order, error)
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
	Status      string
	DeliveryFee float64
	TotalPrice  float64
	UserID      string
	StoreID     int

	DeliveryMethod    string
	DeliveryAddressID *int64
	CampusLocationID  *int
	CampusDetailNote  *string
}

type OrderItemCreateParams struct {
	Quantity         int
	UnitPrice        float64
	FulfillmentType  string
	Subtotal         float64
	DepositAmount    *float64
	PromisedShipDate *time.Time
	ProductID        int
	VariantID        *int // nil = PREORDER, not nil = STOCK (ต้อง deduct stock)
	Note             *string
}

type BulkCancelledOrder struct {
	OrderID     int64
	OldStatus   string
	BuyerUserID string
	StoreID     int64
}

// ============================================================================
// Scan Helpers
// ============================================================================

func scanOrder(row pgx.Row, o *Order) error {
	return row.Scan(
		&o.ID,
		&o.Status,
		&o.TotalPrice,
		&o.DeliveryFee,
		&o.OrderDate,
		&o.UpdatedAt,
		&o.CancelledAt,
		&o.CancelledBy,
		&o.CancelledReason,
		&o.UserID,
		&o.StoreID,
		&o.DeliveryMethod,
		&o.DeliveryAddressID,
		&o.CampusLocationID,
		&o.CampusDetailNote,
		&o.ProposedAt,
		&o.MeetingLocationID,
		&o.MeetingNote,
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
		&it.VariantID,
		&it.Note,
	)
}

func scanOrderItemWithProduct(row pgx.Row, it *OrderItemWithProduct) error {
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
		&it.VariantID,
		&it.Note,
		&it.ProductName,
		&it.ProductImageURL,
		&it.StoreProfileURL,
		&it.VariantLabel,
	)
}

// ============================================================================
// Create Order + Items (Tx)
// — deduct stock สำหรับ STOCK items แบบ atomic ภายใน tx เดียวกัน
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
	defer tx.Rollback(ctx)

	// ===== INSERT order =====
	var ord Order
	err = scanOrder(tx.QueryRow(ctx, `
		INSERT INTO orders (
			status, total_price, delivery_fee, user_id, store_id,
			delivery_method, delivery_address_id,
			campus_location_id, campus_detail_note
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		RETURNING
			order_id, status, total_price, delivery_fee, order_date, updated_at,
			cancelled_at, cancelled_by, cancelled_reason,
			user_id, store_id,
			delivery_method, delivery_address_id, campus_location_id, campus_detail_note,
			proposed_at, meeting_location_id, meeting_note
	`,
		in.Status, in.TotalPrice, in.DeliveryFee, in.UserID, in.StoreID,
		in.DeliveryMethod, in.DeliveryAddressID, in.CampusLocationID, in.CampusDetailNote,
	), &ord)
	if err != nil {
		if pgErr, ok := err.(*pgconn.PgError); ok {
			if pgErr.Code == "23503" {
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

	// ===== INSERT order_items + deduct stock =====
	for _, it := range items {

		var oi OrderItem
		err = scanOrderItem(tx.QueryRow(ctx, `
    INSERT INTO order_items (
        quantity, unit_price, fulfillment_type, subtotal,
        deposit_amount, promised_ship_date,
        order_id, product_id, variant_id, note
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING
        order_item_id, quantity, unit_price, fulfillment_type,
        subtotal, deposit_amount, promised_ship_date,
        order_id, product_id, variant_id, note;
`,
			it.Quantity, it.UnitPrice, it.FulfillmentType, it.Subtotal,
			it.DepositAmount, it.PromisedShipDate,
			ord.ID, it.ProductID, it.VariantID, it.Note,
		), &oi)
		if err != nil {
			if pgErr, ok := err.(*pgconn.PgError); ok {
				if pgErr.Code == "23503" {
					return OrderWithItems{}, apperr.WithFields(
						apperr.Wrap(apperr.BadRequest, err, "invalid product_id or variant_id"),
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

		// ===== deduct stock สำหรับ STOCK product (atomic) =====
		if it.VariantID != nil {
			tag, err := tx.Exec(ctx, `
				UPDATE product_variants
				SET stock_qty  = stock_qty - $2,
				    updated_at = NOW()
				WHERE variant_id = $1
				  AND stock_qty  >= $2
			`, *it.VariantID, it.Quantity)
			if err != nil {
				return OrderWithItems{}, apperr.Wrap(apperr.Internal, err, "deduct stock failed")
			}
			if tag.RowsAffected() == 0 {
				return OrderWithItems{}, apperr.New(apperr.BadRequest, "insufficient stock for variant")
			}
		}
	}

	if err = tx.Commit(ctx); err != nil {
		return OrderWithItems{}, apperr.Wrap(apperr.Internal, err, "commit tx failed")
	}

	itemsWithProduct, err := r.ListItemsByOrderID(ctx, int64(ord.ID))
	if err != nil {
		return OrderWithItems{}, err
	}

	return OrderWithItems{Order: ord, Items: itemsWithProduct}, nil
}

// ============================================================================
// Get Order / Items
// ============================================================================

func (r *repo) GetOrder(ctx context.Context, id int64) (Order, error) {
	var ord Order
	err := scanOrder(r.db.QueryRow(ctx, `
		SELECT
			order_id, status, total_price, delivery_fee, order_date, updated_at,
			cancelled_at, cancelled_by, cancelled_reason,
			user_id, store_id,
			delivery_method, delivery_address_id, campus_location_id, campus_detail_note,
			proposed_at, meeting_location_id, meeting_note
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

func (r *repo) ListItemsByOrderID(ctx context.Context, orderID int64) ([]OrderItemWithProduct, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
			oi.order_item_id,
			oi.quantity,
			oi.unit_price,
			oi.fulfillment_type,
			oi.subtotal,
			oi.deposit_amount,
			oi.promised_ship_date,
			oi.order_id,
			oi.product_id,
			oi.variant_id,
			oi.note,
			p.name                AS product_name,
			p.image_url           AS product_image_url,
			s.profile_url         AS store_profile_url,

			-- รวม selections เป็น label "สี: แดง / ขนาด: M"
			COALESCE(
				string_agg(
					ok.key_name || ': ' || ov.value_label,
					' / '
					ORDER BY ok.sort_order
				),
				''
			) AS variant_label

		FROM order_items oi
		JOIN products p  ON p.product_id = oi.product_id
		JOIN stores   s  ON s.store_id   = p.store_id

		LEFT JOIN product_variants          pv  ON pv.variant_id      = oi.variant_id
		LEFT JOIN variant_option_selections vos ON vos.variant_id     = oi.variant_id
		LEFT JOIN product_option_values     ov  ON ov.option_value_id = vos.option_value_id
		LEFT JOIN product_option_keys       ok  ON ok.option_key_id   = ov.option_key_id

		WHERE oi.order_id = $1
		GROUP BY
			oi.order_item_id, oi.quantity, oi.unit_price, oi.fulfillment_type,
			oi.subtotal, oi.deposit_amount, oi.promised_ship_date,
			oi.order_id, oi.product_id, oi.variant_id, oi.note,
			p.name, p.image_url, s.profile_url
		ORDER BY oi.order_item_id ASC;
	`, orderID)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list order_items failed")
	}
	defer rows.Close()

	var out []OrderItemWithProduct
	for rows.Next() {
		var it OrderItemWithProduct
		if err := scanOrderItemWithProduct(rows, &it); err != nil {
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
		SET status     = $2,
		    updated_at = NOW()
		WHERE order_id = $1
		RETURNING
			order_id, status, total_price, delivery_fee, order_date, updated_at,
			cancelled_at, cancelled_by, cancelled_reason,
			user_id, store_id,
			delivery_method, delivery_address_id, campus_location_id, campus_detail_note,
			proposed_at, meeting_location_id, meeting_note
	`, id, status), &ord)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Order{}, apperr.New(apperr.NotFound, "order not found")
		}
		return Order{}, apperr.Wrap(apperr.Internal, err, "update order status failed")
	}
	return ord, nil
}

func (r *repo) CancelOrder(ctx context.Context, id int64, cancelledBy string, reason string) (Order, error) {
	var ord Order
	err := scanOrder(r.db.QueryRow(ctx, `
		UPDATE orders
		SET
			status           = 'Cancelled',
			cancelled_at     = NOW(),
			cancelled_by     = $2,
			cancelled_reason = $3,
			updated_at       = NOW()
		WHERE order_id = $1
		RETURNING
			order_id, status, total_price, delivery_fee, order_date, updated_at,
			cancelled_at, cancelled_by, cancelled_reason,
			user_id, store_id,
			delivery_method, delivery_address_id, campus_location_id, campus_detail_note,
			proposed_at, meeting_location_id, meeting_note
	`, id, cancelledBy, reason), &ord)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Order{}, apperr.New(apperr.NotFound, "order not found")
		}
		return Order{}, apperr.Wrap(apperr.Internal, err, "cancel order failed")
	}
	return ord, nil
}

// ============================================================================
// List Orders
// ============================================================================

func (r *repo) ListByUserID(ctx context.Context, userID string, statuses []string, q string, limit, page int) ([]Order, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit
	q = strings.TrimSpace(q)

	base := `
		FROM orders o
		JOIN stores s ON s.store_id = o.store_id
		WHERE o.user_id = $1
	`
	args := []any{userID}
	argIdx := 2

	if len(statuses) > 0 {
		base += " AND o.status = ANY($" + strconv.Itoa(argIdx) + ")"
		args = append(args, statuses)
		argIdx++
	}
	if q != "" {
		base += ` AND (CAST(o.order_id AS TEXT) ILIKE $` + strconv.Itoa(argIdx) +
			` OR s.store_name ILIKE $` + strconv.Itoa(argIdx) + `)`
		args = append(args, q+"%")
		argIdx++
	}

	var total int64
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) `+base, args...).Scan(&total); err != nil {
		return nil, 0, apperr.Wrap(apperr.Internal, err, "count orders by user_id failed")
	}

	query := `
		SELECT
			o.order_id, o.status, o.total_price, o.delivery_fee, o.order_date, o.updated_at,
			o.cancelled_at, o.cancelled_by, o.cancelled_reason,
			o.user_id, o.store_id,
			o.delivery_method, o.delivery_address_id, o.campus_location_id, o.campus_detail_note,
			o.proposed_at, o.meeting_location_id, o.meeting_note
	` + base + `
		ORDER BY o.order_date DESC
		LIMIT $` + strconv.Itoa(argIdx) + ` OFFSET $` + strconv.Itoa(argIdx+1)

	args = append(args, limit, offset)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, apperr.Wrap(apperr.Internal, err, "list orders by user_id failed")
	}
	defer rows.Close()

	var out []Order
	for rows.Next() {
		var o Order
		if err := scanOrder(rows, &o); err != nil {
			return nil, 0, apperr.Wrap(apperr.Internal, err, "scan order failed")
		}
		out = append(out, o)
	}
	return out, total, rows.Err()
}

func (r *repo) ListByStoreID(ctx context.Context, storeID int64, statuses []string, q string, limit, page int) ([]Order, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit
	q = strings.TrimSpace(q)

	base := `
		FROM orders o
		JOIN users u ON u.user_id = o.user_id
		WHERE o.store_id = $1
	`
	args := []any{storeID}
	argIdx := 2

	if len(statuses) > 0 {
		base += " AND o.status = ANY($" + strconv.Itoa(argIdx) + ")"
		args = append(args, statuses)
		argIdx++
	}
	if q != "" {
		base += ` AND (CAST(o.order_id AS TEXT) ILIKE $` + strconv.Itoa(argIdx) +
			` OR u.display_name ILIKE $` + strconv.Itoa(argIdx) +
			` OR u.email ILIKE $` + strconv.Itoa(argIdx) + `)`
		args = append(args, q+"%")
		argIdx++
	}

	var total int64
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) `+base, args...).Scan(&total); err != nil {
		return nil, 0, apperr.Wrap(apperr.Internal, err, "count orders by store_id failed")
	}

	query := `
		SELECT
			o.order_id, o.status, o.total_price, o.delivery_fee, o.order_date, o.updated_at,
			o.cancelled_at, o.cancelled_by, o.cancelled_reason,
			o.user_id, o.store_id,
			o.delivery_method, o.delivery_address_id, o.campus_location_id, o.campus_detail_note,
			o.proposed_at, o.meeting_location_id, o.meeting_note
	` + base + `
		ORDER BY o.order_date DESC
		LIMIT $` + strconv.Itoa(argIdx) + ` OFFSET $` + strconv.Itoa(argIdx+1)

	args = append(args, limit, offset)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, apperr.Wrap(apperr.Internal, err, "list orders by store_id failed")
	}
	defer rows.Close()

	var out []Order
	for rows.Next() {
		var o Order
		if err := scanOrder(rows, &o); err != nil {
			return nil, 0, apperr.Wrap(apperr.Internal, err, "scan order failed")
		}
		out = append(out, o)
	}
	return out, total, rows.Err()
}

// ============================================================================
// Propose / RespondProposal
// ============================================================================

func (r *repo) Propose(ctx context.Context, id int64, proposedAt time.Time, meetingLocationID *int, meetingNote *string) (Order, error) {
	var ord Order
	err := scanOrder(r.db.QueryRow(ctx, `
		UPDATE orders
		SET
			status              = 'Proposed',
			proposed_at         = $2,
			meeting_location_id = $3,
			meeting_note        = $4,
			updated_at          = NOW()
		WHERE order_id = $1
		  AND status IN ('Pending','Proposed')
		RETURNING
			order_id, status, total_price, delivery_fee, order_date, updated_at,
			cancelled_at, cancelled_by, cancelled_reason,
			user_id, store_id,
			delivery_method, delivery_address_id, campus_location_id, campus_detail_note,
			proposed_at, meeting_location_id, meeting_note
	`, id, proposedAt, meetingLocationID, meetingNote), &ord)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Order{}, apperr.New(apperr.Conflict, "cannot propose in current status or order not found")
		}
		return Order{}, apperr.Wrap(apperr.Internal, err, "propose order failed")
	}
	return ord, nil
}

func (r *repo) RespondProposal(ctx context.Context, id int64, accept bool) (Order, error) {
	var ord Order
	err := scanOrder(r.db.QueryRow(ctx, `
		UPDATE orders
		SET
			status              = CASE WHEN $2 THEN 'Accepted' ELSE 'Pending' END,
			proposed_at         = CASE WHEN $2 THEN proposed_at         ELSE NULL END,
			meeting_location_id = CASE WHEN $2 THEN meeting_location_id ELSE NULL END,
			meeting_note        = CASE WHEN $2 THEN meeting_note        ELSE NULL END,
			updated_at          = NOW()
		WHERE order_id = $1
		  AND status   = 'Proposed'
		RETURNING
			order_id, status, total_price, delivery_fee, order_date, updated_at,
			cancelled_at, cancelled_by, cancelled_reason,
			user_id, store_id,
			delivery_method, delivery_address_id, campus_location_id, campus_detail_note,
			proposed_at, meeting_location_id, meeting_note
	`, id, accept), &ord)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Order{}, apperr.New(apperr.Conflict, "can respond only when status is Proposed")
		}
		return Order{}, apperr.Wrap(apperr.Internal, err, "respond proposal failed")
	}
	return ord, nil
}

// ============================================================================
// Bulk Cancel
// ============================================================================

func (r *repo) BulkCancelActiveOrdersByBuyer(ctx context.Context, buyerUserID string, reason string) ([]BulkCancelledOrder, error) {
	rows, err := r.db.Query(ctx, `
		WITH to_cancel AS (
			SELECT order_id, status AS old_status, user_id, store_id
			FROM orders
			WHERE user_id = $1
			  AND status IN ('Pending','Proposed','Accepted','Out For Delivery','Arrived')
			FOR UPDATE
		),
		upd AS (
			UPDATE orders o
			SET
				status           = 'Cancelled',
				cancelled_at     = NOW(),
				cancelled_by     = 'SYSTEM',
				cancelled_reason = $2,
				updated_at       = NOW()
			FROM to_cancel tc
			WHERE o.order_id = tc.order_id
			RETURNING o.order_id
		)
		SELECT tc.order_id, tc.old_status, tc.user_id, tc.store_id
		FROM to_cancel tc
		JOIN upd u ON u.order_id = tc.order_id
		ORDER BY tc.order_id ASC
	`, buyerUserID, reason)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "bulk cancel active orders by buyer failed")
	}
	defer rows.Close()

	out := make([]BulkCancelledOrder, 0)
	for rows.Next() {
		var b BulkCancelledOrder
		if err := rows.Scan(&b.OrderID, &b.OldStatus, &b.BuyerUserID, &b.StoreID); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan bulk cancelled order failed")
		}
		out = append(out, b)
	}
	if err := rows.Err(); err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "rows error")
	}
	return out, nil
}

func (r *repo) BulkCancelActiveOrdersByStoreID(ctx context.Context, storeID int64, reason string) ([]BulkCancelledOrder, error) {
	rows, err := r.db.Query(ctx, `
		WITH to_cancel AS (
			SELECT order_id, status AS old_status, user_id, store_id
			FROM orders
			WHERE store_id = $1
			  AND status IN ('Pending','Proposed','Accepted','Out For Delivery','Arrived')
			FOR UPDATE
		),
		upd AS (
			UPDATE orders o
			SET
				status           = 'Cancelled',
				cancelled_at     = NOW(),
				cancelled_by     = 'SYSTEM',
				cancelled_reason = $2,
				updated_at       = NOW()
			FROM to_cancel tc
			WHERE o.order_id = tc.order_id
			RETURNING o.order_id
		)
		SELECT tc.order_id, tc.old_status, tc.user_id, tc.store_id
		FROM to_cancel tc
		JOIN upd u ON u.order_id = tc.order_id
		ORDER BY tc.order_id ASC
	`, storeID, reason)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "bulk cancel active orders by store_id failed")
	}
	defer rows.Close()

	out := make([]BulkCancelledOrder, 0)
	for rows.Next() {
		var b BulkCancelledOrder
		if err := rows.Scan(&b.OrderID, &b.OldStatus, &b.BuyerUserID, &b.StoreID); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan bulk cancelled order failed")
		}
		out = append(out, b)
	}
	if err := rows.Err(); err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "rows error")
	}
	return out, nil
}

func (r *repo) AcceptRoundUniversity(ctx context.Context, id int64, promisedShipDate time.Time) (Order, error) {
	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return Order{}, apperr.Wrap(apperr.Internal, err, "begin tx failed")
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx, `
		UPDATE order_items
		SET promised_ship_date = $2
		WHERE order_id = $1
	`, id, promisedShipDate)
	if err != nil {
		return Order{}, apperr.Wrap(apperr.Internal, err, "update promised_ship_date failed")
	}
	if tag.RowsAffected() == 0 {
		return Order{}, apperr.New(apperr.NotFound, "order items not found")
	}

	var ord Order
	err = scanOrder(tx.QueryRow(ctx, `
		UPDATE orders
		SET
			status = 'Accepted',
			updated_at = NOW()
		WHERE order_id = $1
		  AND status = 'Pending'
		  AND delivery_method = 'ROUND_UNIVERSITY'
		RETURNING
			order_id, status, total_price, delivery_fee, order_date, updated_at,
			cancelled_at, cancelled_by, cancelled_reason,
			user_id, store_id,
			delivery_method, delivery_address_id, campus_location_id, campus_detail_note,
			proposed_at, meeting_location_id, meeting_note
	`, id), &ord)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Order{}, apperr.New(apperr.Conflict, "can accept only pending ROUND_UNIVERSITY order")
		}
		return Order{}, apperr.Wrap(apperr.Internal, err, "accept round university order failed")
	}

	if err := tx.Commit(ctx); err != nil {
		return Order{}, apperr.Wrap(apperr.Internal, err, "commit tx failed")
	}
	return ord, nil
}
