package order

import (
	"time"

	"github.com/Perpasit/Capstone-KMALL/internal/address"
)

type OrderDetailResp struct {
	Order           Order                  `json:"order"`
	Items           []OrderItemWithProduct `json:"items"`
	StoreName       string                 `json:"store_name"`
	StoreProfileURL *string                `json:"store_profile_url,omitempty"`
	SellerName      string                 `json:"seller_name"`
	SellerUserID    string                 `json:"seller_user_id"`
	BuyerName       string                 `json:"buyer_name"`
	Buyer           *OrderBuyerDTO         `json:"buyer,omitempty"`
	DeliveryAddress *address.Address       `json:"delivery_address,omitempty"`
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
