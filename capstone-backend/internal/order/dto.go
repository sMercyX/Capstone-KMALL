package order

import "time"

type OrderDetailResp struct {
	Order      Order                  `json:"order"`
	Items      []OrderItemWithProduct `json:"items"`
	StoreName  string                 `json:"store_name"`
	SellerName string                 `json:"seller_name"`
	BuyerName  string                 `json:"buyer_name"`
	Buyer      *OrderBuyerDTO         `json:"buyer,omitempty"`
}

type OrderBuyerDTO struct {
	ID          string `json:"id"`
	DisplayName string `json:"display_name"`
	Email       string `json:"email"`
}

type ProposeSuggestInput struct {
	ProposedAt        time.Time `json:"proposed_at"`
	MeetingLocationID *int      `json:"meeting_location_id,omitempty"`
	MeetingNote       *string   `json:"meeting_note,omitempty"`
}

type AcceptProposedInput struct {
	Accept bool `json:"accept"`
}
