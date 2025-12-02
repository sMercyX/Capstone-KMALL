package order

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
