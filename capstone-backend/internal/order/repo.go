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
	ListItemsByOrderID(ctx context.Context, orderID int64) ([]OrderItemWithProduct, error)
	UpdateOrderStatus(ctx context.Context, id int64, status string) (Order, error)
	CancelOrder(ctx context.Context, id int64, cancelledBy string, reason string) (Order, error)

	ListByUserID(ctx context.Context, userID string, statuses []string) ([]Order, error)
	ListByStoreID(ctx context.Context, storeID int64, statuses []string) ([]Order, error)
	Propose(ctx context.Context, id int64, proposedAt time.Time, meetingLocationID *int, meetingNote *string) (Order, error)
	RespondProposal(ctx context.Context, id int64, accept bool) (Order, error)
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
		&it.ProductName,
		&it.ProductImageURL,
		&it.StoreProfileURL,
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

	defer func() {
		if tx != nil {
			_ = tx.Rollback(ctx)
		}
	}()

	var ord Order
	err = scanOrder(tx.QueryRow(ctx, `
	INSERT INTO orders (
  status, total_price, user_id, store_id,
  delivery_method, delivery_address_id,
  campus_location_id, campus_detail_note
)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
	RETURNING
  order_id, status, total_price, order_date, updated_at,
  cancelled_at, cancelled_by, cancelled_reason,
  user_id, store_id,
  delivery_method, delivery_address_id, campus_location_id, campus_detail_note,
  proposed_at, meeting_location_id, meeting_note
`,
		in.Status,
		in.TotalPrice,
		in.UserID,
		in.StoreID,
		in.DeliveryMethod,
		in.DeliveryAddressID,
		in.CampusLocationID,
		in.CampusDetailNote,
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
  VALUES ($1,$2,$3,$4,$5, COALESCE($6::timestamptz, CURRENT_TIMESTAMP), $7,$8)
  RETURNING
    order_item_id, quantity, unit_price, fulfillment_type,
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
	}

	if err = tx.Commit(ctx); err != nil {
		return OrderWithItems{}, apperr.Wrap(apperr.Internal, err, "commit tx failed")
	}
	tx = nil

	itemsWithProduct, err := r.ListItemsByOrderID(ctx, int64(ord.ID))
	if err != nil {
		return OrderWithItems{}, err
	}

	return OrderWithItems{
		Order: ord,
		Items: itemsWithProduct,
	}, nil
}

// ============================================================================
// Get Order / Items
// ============================================================================

func (r *repo) GetOrder(ctx context.Context, id int64) (Order, error) {
	var ord Order
	err := scanOrder(r.db.QueryRow(ctx, `
  SELECT
  order_id, status, total_price, order_date, updated_at,
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
    	p.name AS product_name,
    	p.image_url AS product_image_url,
    	s.profile_url AS store_profile_url  -- เพิ่ม store_profile_url ของร้านค้า
	FROM order_items oi
	JOIN products p ON p.product_id = oi.product_id  -- ใช้ JOIN กับ products
	JOIN stores s ON s.store_id = p.store_id  -- เข้าร่วมกับ stores ผ่าน product.store_id
	WHERE oi.order_id = $1
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
  SET status = $2,
      updated_at = NOW()
  WHERE order_id = $1
  RETURNING
  order_id, status, total_price, order_date, updated_at,
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

func (r *repo) CancelOrder(
	ctx context.Context,
	id int64,
	cancelledBy string,
	reason string,
) (Order, error) {

	var ord Order
	err := scanOrder(r.db.QueryRow(ctx, `
		UPDATE orders
		SET
			status = 'Cancelled',
			cancelled_at = NOW(),
			cancelled_by = $2,
			cancelled_reason = $3,
			updated_at = NOW()
		WHERE order_id = $1
		RETURNING
			order_id, status, total_price, order_date, updated_at,
			cancelled_at, cancelled_by, cancelled_reason,
			user_id, store_id,
			delivery_method, delivery_address_id,
			campus_location_id, campus_detail_note,
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

func (r *repo) ListByUserID(ctx context.Context, userID string, statuses []string) ([]Order, error) {
	query := `
SELECT
  order_id, status, total_price, order_date, updated_at,
  cancelled_at, cancelled_by, cancelled_reason,
  user_id, store_id,
  delivery_method, delivery_address_id, campus_location_id, campus_detail_note,
  proposed_at, meeting_location_id, meeting_note
FROM orders
WHERE user_id = $1
`
	args := []any{userID}

	if len(statuses) > 0 {
		query += " AND status = ANY($2)"
		args = append(args, statuses)
	}

	query += " ORDER BY order_date DESC;"
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list orders by user_id failed")
	}
	defer rows.Close()

	var out []Order
	for rows.Next() {
		var o Order
		if err := scanOrder(rows, &o); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan order failed")
		}
		out = append(out, o)
	}
	if err := rows.Err(); err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "rows error")
	}
	return out, nil
}

func (r *repo) ListByStoreID(ctx context.Context, storeID int64, statuses []string) ([]Order, error) {
	query := `
SELECT
  order_id, status, total_price, order_date, updated_at,
  cancelled_at, cancelled_by, cancelled_reason,
  user_id, store_id,
  delivery_method, delivery_address_id, campus_location_id, campus_detail_note,
  proposed_at, meeting_location_id, meeting_note
FROM orders
WHERE store_id = $1
`
	args := []any{storeID}

	if len(statuses) > 0 {
		query += " AND status = ANY($2)"
		args = append(args, statuses)
	}

	query += " ORDER BY order_date DESC;"

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list orders by store_id failed")
	}
	defer rows.Close()

	var out []Order
	for rows.Next() {
		var o Order
		if err := scanOrder(rows, &o); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan order failed")
		}
		out = append(out, o)
	}
	if err := rows.Err(); err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "rows error")
	}
	return out, nil
}

func (r *repo) Propose(ctx context.Context, id int64, proposedAt time.Time, meetingLocationID *int, meetingNote *string) (Order, error) {
	var ord Order
	err := scanOrder(r.db.QueryRow(ctx, `
    UPDATE orders
    SET
      status = 'Proposed',
      proposed_at = $2,
      meeting_location_id = $3,
      meeting_note = $4,
      updated_at = NOW()
    WHERE order_id = $1
      AND status IN ('Pending','Proposed')
    RETURNING
      order_id, status, total_price, order_date, updated_at,
      cancelled_at, cancelled_by, cancelled_reason,
      user_id, store_id,
      delivery_method, delivery_address_id, campus_location_id, campus_detail_note,
      proposed_at, meeting_location_id, meeting_note
  `, id, proposedAt, meetingLocationID, meetingNote), &ord)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// ตรงนี้จะเกิดได้ทั้ง "ไม่เจอ order" หรือ "status ไม่อนุญาต (เช่น Accepted)"
			// ถ้าอยากแยกให้ชัด ต้อง query สถานะอีกรอบหรือใช้ RETURNING status เดิมแบบอื่น
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
			status = CASE WHEN $2 THEN 'Accepted' ELSE 'Pending' END,
			-- ถ้า reject ให้ล้าง proposal เก่าออก เพื่อไม่ให้ data ค้าง
			proposed_at = CASE WHEN $2 THEN proposed_at ELSE NULL END,
			meeting_location_id = CASE WHEN $2 THEN meeting_location_id ELSE NULL END,
			meeting_note = CASE WHEN $2 THEN meeting_note ELSE NULL END,
			updated_at = NOW()
		WHERE order_id = $1
		RETURNING
  order_id, status, total_price, order_date, updated_at,
  cancelled_at, cancelled_by, cancelled_reason,
  user_id, store_id,
  delivery_method, delivery_address_id, campus_location_id, campus_detail_note,
  proposed_at, meeting_location_id, meeting_note
	`, id, accept), &ord)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Order{}, apperr.New(apperr.NotFound, "order not found")
		}
		return Order{}, apperr.Wrap(apperr.Internal, err, "respond proposal failed")
	}
	return ord, nil
}
