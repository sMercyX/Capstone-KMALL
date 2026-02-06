package recommendation

import (
	"context"
	"errors"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
)

type Repo interface {
	GetLatestOrderEvent(ctx context.Context, userID string, orderID int64, trigger TriggerType) (*Event, error)
	ListEventItemsDetailed(ctx context.Context, eventID int64, limit int) ([]Item, error)

	BuildOrderCancelledSnapshot(ctx context.Context, userID string, orderID int64, limit int) (eventID int64, createdAt time.Time, items []Item, err error)

	BuildHome(ctx context.Context, userID string, perSection int) (HomeRecommendationsResponse, error)
}

type repo struct {
	db *pgxpool.Pool
}

func NewRepo(db *pgxpool.Pool) Repo {
	return &repo{db: db}
}

func clampLimit(v, def, max int) int {
	if v <= 0 {
		v = def
	}
	if v > max {
		v = max
	}
	return v
}

func scoreFromDist(dist float64) float64 {
	if dist < 0 {
		dist = 0
	}
	return 1.0 / (1.0 + dist)
}

func (r *repo) GetLatestOrderEvent(ctx context.Context, userID string, orderID int64, trigger TriggerType) (*Event, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return nil, apperr.New(apperr.BadRequest, "user_id is required")
	}
	if orderID <= 0 {
		return nil, apperr.New(apperr.BadRequest, "invalid order_id")
	}

	var e Event
	var oid *int64
	err := r.db.QueryRow(ctx, `
		SELECT event_id, user_id, order_id, trigger_type, created_at
		FROM recommendation_events
		WHERE user_id = $1 AND order_id = $2 AND trigger_type = $3
		ORDER BY created_at DESC, event_id DESC
		LIMIT 1;
	`, userID, orderID, string(trigger)).Scan(&e.ID, &e.UserID, &oid, &e.Trigger, &e.CreatedAt)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, apperr.Wrap(apperr.Internal, err, "get latest recommendation event failed")
	}
	e.OrderID = oid
	return &e, nil
}

func (r *repo) ListEventItemsDetailed(ctx context.Context, eventID int64, limit int) ([]Item, error) {
	if eventID <= 0 {
		return nil, apperr.New(apperr.BadRequest, "invalid event_id")
	}
	limit = clampLimit(limit, 12, 30)

	rows, err := r.db.Query(ctx, `
		SELECT
			rei.score,
			rei.rank_no,
			rei.reason,

			p.product_id,
			p.name,
			p.product_desc,
			p.price,
			p.image_url,
			p.is_active,
			p.store_id,
			s.store_name,
			p.category_id,
			c.name AS category_name,

			COALESCE(sold.sold_count, 0) AS sold_count
		FROM recommendation_event_items rei
		JOIN products p ON p.product_id = rei.product_id
		JOIN stores s ON s.store_id = p.store_id
		JOIN categories c ON c.category_id = p.category_id
		LEFT JOIN (
			SELECT oi.product_id, SUM(oi.quantity)::bigint AS sold_count
			FROM order_items oi
			JOIN orders o ON o.order_id = oi.order_id AND o.status = 'Completed'
			GROUP BY oi.product_id
		) sold ON sold.product_id = p.product_id
		WHERE rei.event_id = $1
		  AND p.is_active = 'YES'
		  AND s.is_active = 'YES'
		  AND c.is_active = 'YES'
		ORDER BY rei.rank_no ASC
		LIMIT $2;
	`, eventID, limit)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list event items failed")
	}
	defer rows.Close()

	out := make([]Item, 0, limit)
	for rows.Next() {
		var it Item
		var p ProductDetail
		if err := rows.Scan(
			&it.Score,
			&it.RankNo,
			&it.Reason,

			&p.ID,
			&p.Name,
			&p.Description,
			&p.Price,
			&p.ImageURL,
			&p.IsActive,
			&p.StoreID,
			&p.StoreName,
			&p.CategoryID,
			&p.CategoryName,
			&p.SoldCount,
		); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan event item failed")
		}
		it.Product = p
		out = append(out, it)
	}
	if err := rows.Err(); err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "event items rows failed")
	}
	return out, nil
}

func (r *repo) BuildOrderCancelledSnapshot(ctx context.Context, userID string, orderID int64, limit int) (int64, time.Time, []Item, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return 0, time.Time{}, nil, apperr.New(apperr.BadRequest, "user_id is required")
	}
	if orderID <= 0 {
		return 0, time.Time{}, nil, apperr.New(apperr.BadRequest, "invalid order_id")
	}
	limit = clampLimit(limit, 12, 30)

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return 0, time.Time{}, nil, apperr.Wrap(apperr.Internal, err, "begin tx failed")
	}
	defer tx.Rollback(ctx)

	var ok bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM orders
			WHERE order_id = $1 AND user_id = $2 AND status = 'Cancelled'
		);
	`, orderID, userID).Scan(&ok); err != nil {
		return 0, time.Time{}, nil, apperr.Wrap(apperr.Internal, err, "check order ownership failed")
	}
	if !ok {
		return 0, time.Time{}, nil, apperr.New(apperr.Forbidden, "order not found or not cancelled")
	}

	var eventID int64
	var createdAt time.Time
	if err := tx.QueryRow(ctx, `
		INSERT INTO recommendation_events (user_id, order_id, trigger_type)
		VALUES ($1, $2, 'ORDER_CANCELLED')
		RETURNING event_id, created_at;
	`, userID, orderID).Scan(&eventID, &createdAt); err != nil {
		return 0, time.Time{}, nil, apperr.Wrap(apperr.Internal, err, "insert recommendation event failed")
	}

	reason := "similar_to_cancelled_order"

	rows, err := tx.Query(ctx, `
WITH
op AS (
  SELECT o.order_id, o.store_id
  FROM orders o
  WHERE o.order_id = $2 AND o.user_id = $1
),
seed AS (
  SELECT p.embedding
  FROM order_items oi
  JOIN products p ON p.product_id = oi.product_id
  WHERE oi.order_id = $2
    AND p.embedding IS NOT NULL
),
centroid AS (
  SELECT avg(embedding) AS v
  FROM seed
),
sold AS (
  SELECT oi.product_id, SUM(oi.quantity)::bigint AS sold_count
  FROM order_items oi
  JOIN orders o2 ON o2.order_id = oi.order_id AND o2.status = 'Completed'
  GROUP BY oi.product_id
),
cand AS (
  SELECT
    p.product_id,
    (p.embedding <=> (SELECT v FROM centroid)) AS dist,
    COALESCE(sold.sold_count, 0) AS sold_count
  FROM products p
  JOIN stores s ON s.store_id = p.store_id
  JOIN categories c ON c.category_id = p.category_id
  JOIN op ON TRUE
  LEFT JOIN sold ON sold.product_id = p.product_id
  WHERE p.is_active='YES' AND s.is_active='YES' AND c.is_active='YES'
    AND p.embedding IS NOT NULL
    AND p.product_id NOT IN (SELECT product_id FROM order_items WHERE order_id = $2)
    AND p.store_id <> op.store_id
)
SELECT product_id, dist
FROM cand
ORDER BY (dist + LEAST(0.08, ln(1 + sold_count) * 0.01)) ASC
LIMIT $3;
	`, userID, orderID, limit)
	if err != nil {
		return 0, time.Time{}, nil, apperr.Wrap(apperr.Internal, err, "compute candidates failed")
	}
	defer rows.Close()

	type picked struct {
		pid  int64
		dist float64
	}
	picks := make([]picked, 0, limit)
	for rows.Next() {
		var p picked
		if err := rows.Scan(&p.pid, &p.dist); err != nil {
			return 0, time.Time{}, nil, apperr.Wrap(apperr.Internal, err, "scan candidates failed")
		}
		picks = append(picks, p)
	}
	if err := rows.Err(); err != nil {
		return 0, time.Time{}, nil, apperr.Wrap(apperr.Internal, err, "candidates rows failed")
	}

	for i, p := range picks {
		rank := i + 1
		sc := scoreFromDist(p.dist)
		_, err := tx.Exec(ctx, `
			INSERT INTO recommendation_event_items (event_id, product_id, score, rank_no, reason)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (event_id, product_id) DO UPDATE
			SET score=EXCLUDED.score, rank_no=EXCLUDED.rank_no, reason=EXCLUDED.reason;
		`, eventID, p.pid, sc, rank, reason)
		if err != nil {
			return 0, time.Time{}, nil, apperr.Wrap(apperr.Internal, err, "insert event items failed")
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, time.Time{}, nil, apperr.Wrap(apperr.Internal, err, "commit tx failed")
	}

	items, err := r.ListEventItemsDetailed(ctx, eventID, limit)
	if err != nil {
		return 0, time.Time{}, nil, err
	}

	return eventID, createdAt, items, nil
}

func (r *repo) BuildHome(ctx context.Context, userID string, perSection int) (HomeRecommendationsResponse, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return HomeRecommendationsResponse{}, apperr.New(apperr.BadRequest, "user_id is required")
	}
	perSection = clampLimit(perSection, 12, 30)

	seasonal, err := r.listLatest(ctx, perSection)
	if err != nil {
		return HomeRecommendationsResponse{}, err
	}

	searchItems, err := r.listFromSearchHistory(ctx, userID, perSection)
	if err != nil {
		return HomeRecommendationsResponse{}, err
	}

	orderItems, err := r.listFromOrderHistory(ctx, userID, perSection)
	if err != nil {
		return HomeRecommendationsResponse{}, err
	}

	resp := HomeRecommendationsResponse{
		GeneratedAt: time.Now(),
		Sections: []HomeSection{
			{Key: SectionSeasonal, Title: "Seasonal picks", Items: seasonal},
			{Key: SectionSearchHistory, Title: "Based on your searches", Items: searchItems},
			{Key: SectionOrderHistory, Title: "Based on your orders", Items: orderItems},
		},
	}
	return resp, nil
}

func (r *repo) listLatest(ctx context.Context, limit int) ([]Item, error) {
	limit = clampLimit(limit, 12, 30)

	rows, err := r.db.Query(ctx, `
		WITH sold AS (
			SELECT oi.product_id, SUM(oi.quantity)::bigint AS sold_count
			FROM order_items oi
			JOIN orders o ON o.order_id = oi.order_id AND o.status = 'Completed'
			GROUP BY oi.product_id
		)
		SELECT
			p.product_id,
			p.name,
			p.product_desc,
			p.price,
			p.image_url,
			p.is_active,
			p.store_id,
			s.store_name,
			p.category_id,
			c.name AS category_name,
			COALESCE(sold.sold_count, 0) AS sold_count
		FROM products p
		JOIN stores s ON s.store_id = p.store_id
		JOIN categories c ON c.category_id = p.category_id
		LEFT JOIN sold ON sold.product_id = p.product_id
		WHERE p.is_active='YES' AND s.is_active='YES' AND c.is_active='YES'
		ORDER BY p.created_at DESC, p.product_id ASC
		LIMIT $1;
	`, limit)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list latest failed")
	}
	defer rows.Close()

	out := make([]Item, 0, limit)
	for rows.Next() {
		var p ProductDetail
		if err := rows.Scan(
			&p.ID, &p.Name, &p.Description, &p.Price, &p.ImageURL, &p.IsActive,
			&p.StoreID, &p.StoreName, &p.CategoryID, &p.CategoryName, &p.SoldCount,
		); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan latest failed")
		}
		out = append(out, Item{
			Product: p,
			Score:   nil,
			RankNo:  len(out) + 1,
			Reason:  ptrString("latest"),
		})
	}
	if err := rows.Err(); err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "latest rows failed")
	}
	return out, nil
}

func (r *repo) listFromSearchHistory(ctx context.Context, userID string, limit int) ([]Item, error) {
	limit = clampLimit(limit, 12, 30)

	var q string
	err := r.db.QueryRow(ctx, `
		SELECT query_text
		FROM search_history
		WHERE user_id = $1
		ORDER BY searched_at DESC, search_id DESC
		LIMIT 1;
	`, userID).Scan(&q)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return []Item{}, nil
		}
		return nil, apperr.Wrap(apperr.Internal, err, "get recent search query failed")
	}
	q = strings.TrimSpace(q)
	if q == "" {
		return []Item{}, nil
	}

	terms := strings.Fields(strings.ToLower(q))
	if len(terms) == 0 {
		return []Item{}, nil
	}
	if len(terms) > 4 {
		terms = terms[:4]
	}

	args := []any{}
	where := []string{
		"p.is_active='YES'",
		"s.is_active='YES'",
		"c.is_active='YES'",
	}
	for _, t := range terms {
		args = append(args, t)
		pos := len(args)
		where = append(where, `
			(
				lower(p.name) LIKE '%' || $`+strconv.Itoa(pos)+` || '%'
				OR lower(s.store_name) LIKE '%' || $`+strconv.Itoa(pos)+` || '%'
				OR lower(coalesce(p.product_desc,'')) LIKE '%' || $`+strconv.Itoa(pos)+` || '%'
			)
		`)
	}
	args = append(args, limit)

	query := `
WITH sold AS (
	SELECT oi.product_id, SUM(oi.quantity)::bigint AS sold_count
	FROM order_items oi
	JOIN orders o ON o.order_id = oi.order_id AND o.status = 'Completed'
	GROUP BY oi.product_id
)
SELECT
	p.product_id,
	p.name,
	p.product_desc,
	p.price,
	p.image_url,
	p.is_active,
	p.store_id,
	s.store_name,
	p.category_id,
	c.name AS category_name,
	COALESCE(sold.sold_count, 0) AS sold_count
FROM products p
JOIN stores s ON s.store_id = p.store_id
JOIN categories c ON c.category_id = p.category_id
LEFT JOIN sold ON sold.product_id = p.product_id
WHERE ` + strings.Join(where, " AND ") + `
ORDER BY
	COALESCE(sold.sold_count, 0) DESC,
	p.created_at DESC,
	p.product_id ASC
LIMIT $` + strconv.Itoa(len(args)) + `;
`

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list from search history failed")
	}
	defer rows.Close()

	out := make([]Item, 0, limit)
	for rows.Next() {
		var p ProductDetail
		if err := rows.Scan(
			&p.ID, &p.Name, &p.Description, &p.Price, &p.ImageURL, &p.IsActive,
			&p.StoreID, &p.StoreName, &p.CategoryID, &p.CategoryName, &p.SoldCount,
		); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan latest failed")
		}

		rank := len(out) + 1
		sc := 1.0 - (float64(rank-1) / float64(limit))
		out = append(out, Item{
			Product: p,
			Score:   &sc,
			RankNo:  rank,
			Reason:  ptrString("latest"),
		})
	}
	if err := rows.Err(); err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "search items rows failed")
	}
	return out, nil
}

func (r *repo) listFromOrderHistory(ctx context.Context, userID string, limit int) ([]Item, error) {
	limit = clampLimit(limit, 12, 30)

	var lastOrderID int64
	err := r.db.QueryRow(ctx, `
		SELECT order_id
		FROM orders
		WHERE user_id = $1 AND status = 'Completed'
		ORDER BY updated_at DESC, order_id DESC
		LIMIT 1;
	`, userID).Scan(&lastOrderID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return []Item{}, nil
		}
		return nil, apperr.Wrap(apperr.Internal, err, "get last completed order failed")
	}

	rows, err := r.db.Query(ctx, `
WITH
seed AS (
  SELECT p.embedding
  FROM order_items oi
  JOIN products p ON p.product_id = oi.product_id
  WHERE oi.order_id = $1
    AND p.embedding IS NOT NULL
),
centroid AS (
  SELECT avg(embedding) AS v
  FROM seed
),
sold AS (
  SELECT oi.product_id, SUM(oi.quantity)::bigint AS sold_count
  FROM order_items oi
  JOIN orders o2 ON o2.order_id = oi.order_id AND o2.status = 'Completed'
  GROUP BY oi.product_id
),
cand AS (
  SELECT
    p.product_id,
    (p.embedding <=> (SELECT v FROM centroid)) AS dist,
    COALESCE(sold.sold_count, 0) AS sold_count
  FROM products p
  JOIN stores s ON s.store_id = p.store_id
  JOIN categories c ON c.category_id = p.category_id
  LEFT JOIN sold ON sold.product_id = p.product_id
  WHERE p.is_active='YES' AND s.is_active='YES' AND c.is_active='YES'
    AND p.embedding IS NOT NULL
    AND p.product_id NOT IN (SELECT product_id FROM order_items WHERE order_id = $1)
)
SELECT
	cand.dist,
	p.product_id,
	p.name,
	p.product_desc,
	p.price,
	p.image_url,
	p.is_active,
	p.store_id,
	s.store_name,
	p.category_id,
	c.name AS category_name,
	COALESCE(cand.sold_count, 0) AS sold_count
FROM cand
JOIN products p ON p.product_id = cand.product_id
JOIN stores s ON s.store_id = p.store_id
JOIN categories c ON c.category_id = p.category_id
ORDER BY (cand.dist + LEAST(0.08, ln(1 + cand.sold_count) * 0.01)) ASC
LIMIT $2;
	`, lastOrderID, limit)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list from order history failed")
	}
	defer rows.Close()

	out := make([]Item, 0, limit)
	rs := "based_on_order_history"
	for rows.Next() {
		var dist float64
		var p ProductDetail
		if err := rows.Scan(
			&dist,
			&p.ID, &p.Name, &p.Description, &p.Price, &p.ImageURL, &p.IsActive,
			&p.StoreID, &p.StoreName, &p.CategoryID, &p.CategoryName, &p.SoldCount,
		); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan order history items failed")
		}
		sc := scoreFromDist(dist)
		out = append(out, Item{
			Product: p,
			Score:   &sc,
			RankNo:  len(out) + 1,
			Reason:  &rs,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "order history rows failed")
	}
	return out, nil
}

func ptrString(s string) *string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return &s
}

func safeFloat(v float64) float64 {
	if math.IsNaN(v) || math.IsInf(v, 0) {
		return 0
	}
	return v
}
