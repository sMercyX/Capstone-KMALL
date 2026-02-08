package recommendation

import "time"

type Context string

const (
	ContextCancellation Context = "cancellation"
)

type TriggerType string

const (
	TriggerOrderCancelled TriggerType = "ORDER_CANCELLED"
	TriggerSearch         TriggerType = "SEARCH"
	TriggerProductView    TriggerType = "PRODUCT_VIEW"
)

type HomeSectionKey string

const (
	SectionSeasonal      HomeSectionKey = "seasonal"
	SectionSearchHistory HomeSectionKey = "search_history"
	SectionOrderHistory  HomeSectionKey = "order_history"
)

type Event struct {
	ID        int64
	UserID    string
	OrderID   *int64
	Trigger   TriggerType
	CreatedAt time.Time
}

type ProductDetail struct {
	ID           int64   `json:"id"`
	Name         string  `json:"name"`
	Description  *string `json:"description,omitempty"`
	Price        float64 `json:"price"`
	ImageURL     *string `json:"image_url,omitempty"`
	IsActive     string  `json:"is_active"`
	StoreID      int64   `json:"store_id"`
	StoreName    string  `json:"store_name"`
	CategoryID   int64   `json:"category_id"`
	CategoryName string  `json:"category_name"`
	SoldCount    int64   `json:"sold_count"`
}

type Item struct {
	Product ProductDetail `json:"product"`
	Score   *float64      `json:"score,omitempty"`
	RankNo  int           `json:"rank_no"`
	Reason  *string       `json:"reason,omitempty"`
}

type CancelledItem struct {
	Product   ProductDetail `json:"product"`
	Quantity  int           `json:"quantity"`
	UnitPrice float64       `json:"unit_price"`
	Subtotal  float64       `json:"subtotal"`
}

type OrderRecommendationsResponse struct {
	OrderID        int64           `json:"order_id"`
	Context        Context         `json:"context"`
	CancelledItems []CancelledItem `json:"cancelled_items"`
	Items          []Item          `json:"items"`
	Source         string          `json:"source"`
	EventID        int64           `json:"event_id"`
	CreatedAt      time.Time       `json:"created_at"`
	GeneratedAt    time.Time       `json:"generated_at"`
}

type HomeSection struct {
	Key   HomeSectionKey `json:"key"`
	Title string         `json:"title"`
	Items []Item         `json:"items"`
}

type HomeRecommendationsResponse struct {
	Sections    []HomeSection `json:"sections"`
	GeneratedAt time.Time     `json:"generated_at"`
}
