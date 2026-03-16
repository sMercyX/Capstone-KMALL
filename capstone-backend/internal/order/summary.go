package order

import "time"

// ============================================================================
// Summary Cards
// ============================================================================

type StoreSummaryCards struct {
	TotalOrders       int64   `json:"total_orders"`
	TotalRevenue      float64 `json:"total_revenue"`
	PendingOrders     int64   `json:"pending_orders"`
	CancelledOrders   int64   `json:"cancelled_orders"`
	CompletedOrders   int64   `json:"completed_orders"`
	AverageOrderValue float64 `json:"average_order_value"`
	TotalCustomers    int64   `json:"total_customers"`
	TotalItemsSold    int64   `json:"total_items_sold"`
}

// ============================================================================
// Revenue Over Time (Line/Area Chart)
// ============================================================================

type RevenueDataPoint struct {
	// format ขึ้นอยู่กับ granularity:
	//   daily    → "2025-11-01"
	//   monthly  → "2025-11"
	//   yearly   → "2025"
	//   all_time → "2025-11" (monthly auto)
	Date    string  `json:"date"`
	Revenue float64 `json:"revenue"`
	Orders  int64   `json:"orders"`
}

// ============================================================================
// Order Status Distribution (Doughnut Chart)
// ============================================================================

type StatusCount struct {
	Status string `json:"status"`
	Count  int64  `json:"count"`
}

// ============================================================================
// Top Products (Bar Chart)
// ============================================================================

type TopProduct struct {
	ProductID   int     `json:"product_id"`
	ProductName string  `json:"product_name"`
	TotalSold   int64   `json:"total_sold"`
	Revenue     float64 `json:"revenue"`
}

// ============================================================================
// Main Response
// ============================================================================

type StoreSummaryResponse struct {
	Cards           StoreSummaryCards  `json:"cards"`
	RevenueByPeriod []RevenueDataPoint `json:"revenue_by_period"`
	StatusDist      []StatusCount      `json:"status_distribution"`
	TopProducts     []TopProduct       `json:"top_products"`
	// บอก front ว่าช่วงที่ query จริงคืออะไร (มีประโยชน์โดยเฉพาะ all_time)
	PeriodFrom string `json:"period_from"`
	PeriodTo   string `json:"period_to"`
}

// ============================================================================
// Internal Query Input
// ============================================================================

// Granularity ที่รองรับ:
//   "daily"    — รายวัน     (from/to จำเป็น, range ≤ 90 วัน)
//   "monthly"  — รายเดือน   (from/to จำเป็น, range ≤ 2 ปี)
//   "yearly"   — รายปี      (from/to จำเป็น, range ≤ 10 ปี)
//   "all_time" — ตั้งแต่เริ่มขาย (ไม่ต้องส่ง from/to — service หา min/max เอง)
type SummaryQuery struct {
	StoreID     int64
	From        time.Time // ไม่ต้องส่งถ้า Granularity = "all_time"
	To          time.Time // ไม่ต้องส่งถ้า Granularity = "all_time"
	Granularity string
}
