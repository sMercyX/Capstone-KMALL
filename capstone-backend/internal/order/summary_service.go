package order

import (
	"context"
	"strings"
	"time"

	"golang.org/x/sync/errgroup"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
)

// ============================================================================
// Interface
// ============================================================================

type SummaryService interface {
	GetStoreSummary(ctx context.Context, q SummaryQuery) (StoreSummaryResponse, error)
}

type summaryService struct {
	repo SummaryRepo
}

func NewSummaryService(r SummaryRepo) SummaryService {
	return &summaryService{repo: r}
}

// ============================================================================
// GetStoreSummary
// ============================================================================

func (s *summaryService) GetStoreSummary(ctx context.Context, q SummaryQuery) (StoreSummaryResponse, error) {
	if err := validateSummaryQuery(&q); err != nil {
		return StoreSummaryResponse{}, err
	}

	// all_time: ดึง min/max order_date ของร้านก่อน แล้ว resolve granularity อัตโนมัติ
	if q.Granularity == "all_time" {
		from, to, err := s.repo.GetStoreOrderDateRange(ctx, q.StoreID)
		if err != nil {
			return StoreSummaryResponse{}, err
		}
		q.From = from
		q.To = to
		q.Granularity = resolveAllTimeGranularity(from, to)
	}

	var (
		cards    StoreSummaryCards
		revenue  []RevenueDataPoint
		statDist []StatusCount
		topProds []TopProduct
	)

	eg, egCtx := errgroup.WithContext(ctx)

	eg.Go(func() error {
		var err error
		cards, err = s.repo.GetSummaryCards(egCtx, q.StoreID, q.From, q.To)
		return err
	})

	eg.Go(func() error {
		var err error
		revenue, err = s.repo.GetRevenueByPeriod(egCtx, q.StoreID, q.From, q.To, q.Granularity)
		return err
	})

	eg.Go(func() error {
		var err error
		statDist, err = s.repo.GetStatusDistribution(egCtx, q.StoreID, q.From, q.To)
		return err
	})

	eg.Go(func() error {
		var err error
		topProds, err = s.repo.GetTopProducts(egCtx, q.StoreID, q.From, q.To, 10)
		return err
	})

	if err := eg.Wait(); err != nil {
		return StoreSummaryResponse{}, err
	}

	// ป้องกัน nil slice ใน JSON response
	if revenue == nil {
		revenue = []RevenueDataPoint{}
	}
	if statDist == nil {
		statDist = []StatusCount{}
	}
	if topProds == nil {
		topProds = []TopProduct{}
	}

	return StoreSummaryResponse{
		Cards:           cards,
		RevenueByPeriod: revenue,
		StatusDist:      statDist,
		TopProducts:     topProds,
		PeriodFrom:      q.From.Format("2006-01-02"),
		PeriodTo:        q.To.Format("2006-01-02"),
	}, nil
}

// ============================================================================
// resolveAllTimeGranularity
// — เลือก granularity ที่เหมาะสมอัตโนมัติจากช่วงเวลาทั้งหมดของร้าน:
//     < 3 เดือน  → daily
//     < 2 ปี    → monthly
//     ≥ 2 ปี    → yearly
// ============================================================================

func resolveAllTimeGranularity(from, to time.Time) string {
	return "monthly"
}

// ============================================================================
// validateSummaryQuery
// ============================================================================

func validateSummaryQuery(q *SummaryQuery) error {
	if q.StoreID <= 0 {
		return apperr.New(apperr.BadRequest, "invalid store_id")
	}

	q.Granularity = strings.ToLower(strings.TrimSpace(q.Granularity))

	allowed := map[string]bool{
		"daily": true, "monthly": true, "yearly": true, "all_time": true,
	}
	if !allowed[q.Granularity] {
		// default fallback
		q.Granularity = "monthly"
	}

	// all_time ไม่ต้องส่ง from/to — service จะ query เอง
	if q.Granularity == "all_time" {
		return nil
	}

	if q.From.IsZero() || q.To.IsZero() {
		return apperr.New(apperr.BadRequest, "from and to are required")
	}
	if q.From.After(q.To) {
		return apperr.New(apperr.BadRequest, "from must be before to")
	}

	// จำกัด range ตาม granularity ป้องกัน query หนักเกิน
	diff := q.To.Sub(q.From)
	switch q.Granularity {
	case "daily":
		if diff > 100*24*time.Hour {
			return apperr.New(apperr.BadRequest, "daily granularity supports max 150 days range")
		}
	case "monthly":
		if diff > 10*365*24*time.Hour {
			return apperr.New(apperr.BadRequest, "monthly granularity supports max 10 years range")
		}
	case "yearly":
		if diff > 10*365*24*time.Hour {
			return apperr.New(apperr.BadRequest, "yearly granularity supports max 10 years range")
		}
	}

	return nil
}
