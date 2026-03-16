package order

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
)

// ============================================================================
// Interface
// ============================================================================

type SummaryRepo interface {
	GetStoreOrderDateRange(ctx context.Context, storeID int64) (from, to time.Time, err error)
	GetSummaryCards(ctx context.Context, storeID int64, from, to time.Time) (StoreSummaryCards, error)
	GetRevenueByPeriod(ctx context.Context, storeID int64, from, to time.Time, granularity string) ([]RevenueDataPoint, error)
	GetStatusDistribution(ctx context.Context, storeID int64, from, to time.Time) ([]StatusCount, error)
	GetTopProducts(ctx context.Context, storeID int64, from, to time.Time, limit int) ([]TopProduct, error)
}

type summaryRepo struct {
	db *pgxpool.Pool
}

func NewSummaryRepo(db *pgxpool.Pool) SummaryRepo {
	return &summaryRepo{db: db}
}

// ============================================================================
// GetStoreOrderDateRange
// — ใช้สำหรับ all_time: หา order_date แรกสุดและล่าสุดของร้าน
// ============================================================================

func (r *summaryRepo) GetStoreOrderDateRange(ctx context.Context, storeID int64) (from, to time.Time, err error) {
	err = r.db.QueryRow(ctx, `
		SELECT
			COALESCE(MIN(order_date), NOW()) AS first_order,
			COALESCE(MAX(order_date), NOW()) AS last_order
		FROM orders
		WHERE store_id = $1
	`, storeID).Scan(&from, &to)
	if err != nil {
		return time.Time{}, time.Time{}, apperr.Wrap(apperr.Internal, err, "get store order date range failed")
	}
	return from, to, nil
}

// ============================================================================
// GetSummaryCards
// — ดึงตัวเลข summary การ์ดทั้งหมดใน query เดียว + query แยกสำหรับ items sold
// ============================================================================

func (r *summaryRepo) GetSummaryCards(ctx context.Context, storeID int64, from, to time.Time) (StoreSummaryCards, error) {
	var c StoreSummaryCards

	err := r.db.QueryRow(ctx, `
		SELECT
			COUNT(*)                                                                    AS total_orders,
			COALESCE(SUM(total_price)  FILTER (WHERE status = 'Completed'), 0)         AS total_revenue,
			COUNT(*)                   FILTER (WHERE status IN ('Pending','Proposed'))  AS pending_orders,
			COUNT(*)                   FILTER (WHERE status = 'Cancelled')              AS cancelled_orders,
			COUNT(*)                   FILTER (WHERE status = 'Completed')              AS completed_orders,
			COALESCE(AVG(total_price)  FILTER (WHERE status = 'Completed'), 0)         AS avg_order_value,
			COUNT(DISTINCT user_id)                                                     AS total_customers
		FROM orders
		WHERE store_id   = $1
		  AND order_date BETWEEN $2 AND $3
	`, storeID, from, to).Scan(
		&c.TotalOrders,
		&c.TotalRevenue,
		&c.PendingOrders,
		&c.CancelledOrders,
		&c.CompletedOrders,
		&c.AverageOrderValue,
		&c.TotalCustomers,
	)
	if err != nil {
		return StoreSummaryCards{}, apperr.Wrap(apperr.Internal, err, "get summary cards failed")
	}

	// total items sold — นับเฉพาะ Completed orders
	err = r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(oi.quantity), 0)
		FROM order_items oi
		JOIN orders o ON o.order_id = oi.order_id
		WHERE o.store_id   = $1
		  AND o.order_date BETWEEN $2 AND $3
		  AND o.status     = 'Completed'
	`, storeID, from, to).Scan(&c.TotalItemsSold)
	if err != nil {
		return StoreSummaryCards{}, apperr.Wrap(apperr.Internal, err, "get total items sold failed")
	}

	return c, nil
}

// ============================================================================
// GetRevenueByPeriod
// — รองรับ granularity: "daily" | "monthly" | "yearly"
//   (all_time ถูก resolve เป็น "monthly" หรือ "yearly" ก่อนเรียกฟังก์ชันนี้)
// ============================================================================

func (r *summaryRepo) GetRevenueByPeriod(ctx context.Context, storeID int64, from, to time.Time, granularity string) ([]RevenueDataPoint, error) {
	var trunc, dateFmt string
	switch granularity {
	case "daily":
		trunc = "day"
		dateFmt = "YYYY-MM-DD"
	case "yearly":
		trunc = "year"
		dateFmt = "YYYY"
	default: // monthly (รวม all_time ที่ resolve แล้ว)
		trunc = "month"
		dateFmt = "YYYY-MM"
	}

	rows, err := r.db.Query(ctx, `
		SELECT
			TO_CHAR(DATE_TRUNC($4, order_date), $5) AS period,
			COALESCE(SUM(total_price), 0)           AS revenue,
			COUNT(*)                                AS orders
		FROM orders
		WHERE store_id   = $1
		  AND order_date  BETWEEN $2 AND $3
		  AND status      = 'Completed'
		GROUP BY DATE_TRUNC($4, order_date)
		ORDER BY DATE_TRUNC($4, order_date) ASC
	`, storeID, from, to, trunc, dateFmt)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "get revenue by period failed")
	}
	defer rows.Close()

	var out []RevenueDataPoint
	for rows.Next() {
		var dp RevenueDataPoint
		if err := rows.Scan(&dp.Date, &dp.Revenue, &dp.Orders); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan revenue point failed")
		}
		out = append(out, dp)
	}
	if err := rows.Err(); err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "rows error revenue_by_period")
	}
	return out, nil
}

// ============================================================================
// GetStatusDistribution
// ============================================================================

func (r *summaryRepo) GetStatusDistribution(ctx context.Context, storeID int64, from, to time.Time) ([]StatusCount, error) {
	rows, err := r.db.Query(ctx, `
		SELECT status, COUNT(*) AS count
		FROM orders
		WHERE store_id   = $1
		  AND order_date  BETWEEN $2 AND $3
		GROUP BY status
		ORDER BY count DESC
	`, storeID, from, to)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "get status distribution failed")
	}
	defer rows.Close()

	var out []StatusCount
	for rows.Next() {
		var sc StatusCount
		if err := rows.Scan(&sc.Status, &sc.Count); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan status count failed")
		}
		out = append(out, sc)
	}
	if err := rows.Err(); err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "rows error status_distribution")
	}
	return out, nil
}

// ============================================================================
// GetTopProducts
// ============================================================================

func (r *summaryRepo) GetTopProducts(ctx context.Context, storeID int64, from, to time.Time, limit int) ([]TopProduct, error) {
	if limit <= 0 {
		limit = 10
	}

	rows, err := r.db.Query(ctx, `
		SELECT
			p.product_id,
			p.name              AS product_name,
			SUM(oi.quantity)    AS total_sold,
			SUM(oi.subtotal)    AS revenue
		FROM order_items oi
		JOIN orders   o ON o.order_id   = oi.order_id
		JOIN products p ON p.product_id = oi.product_id
		WHERE o.store_id   = $1
		  AND o.order_date  BETWEEN $2 AND $3
		  AND o.status      = 'Completed'
		GROUP BY p.product_id, p.name
		ORDER BY total_sold DESC
		LIMIT $4
	`, storeID, from, to, limit)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "get top products failed")
	}
	defer rows.Close()

	var out []TopProduct
	for rows.Next() {
		var tp TopProduct
		if err := rows.Scan(&tp.ProductID, &tp.ProductName, &tp.TotalSold, &tp.Revenue); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan top product failed")
		}
		out = append(out, tp)
	}
	if err := rows.Err(); err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "rows error top_products")
	}
	return out, nil
}
