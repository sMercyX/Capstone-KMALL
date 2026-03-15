package cart

import (
	"context"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
)

// ============================================================================
// DTO / Input Types
// ============================================================================

type CartWithItems struct {
	Cart  Cart           `json:"cart"`
	Items []CartItemView `json:"items"`
}

type CartItemCreateInput struct {
	ProductID int     `json:"product_id"`
	VariantID *int    `json:"variant_id,omitempty"` // required ถ้า product_type = STOCK
	Quantity  int     `json:"quantity"`
	Note      *string `json:"note,omitempty"`
}

type CartItemUpdateInput struct {
	Quantity *int    `json:"quantity"`
	Note     *string `json:"note,omitempty"`
}

// ============================================================================
// Service Interface
// ============================================================================

type Service interface {
	GetCart(ctx context.Context, userID string) (CartWithItems, error)
	AddItem(ctx context.Context, userID string, in CartItemCreateInput) (CartItem, error)
	UpdateItem(ctx context.Context, userID string, itemID int64, in CartItemUpdateInput) (CartItem, error)
	DeleteItem(ctx context.Context, userID string, itemID int64) error
	ClearCart(ctx context.Context, userID string) error
}

type service struct {
	repo Repo
}

func NewService(r Repo) Service {
	return &service{repo: r}
}

// ============================================================================
// Validators
// ============================================================================

func validateCreateInput(in *CartItemCreateInput) error {
	if in.ProductID <= 0 {
		return apperr.New(apperr.BadRequest, "product_id must be positive")
	}
	if in.Quantity <= 0 {
		return apperr.New(apperr.BadRequest, "quantity must be positive")
	}
	if in.VariantID != nil && *in.VariantID <= 0 {
		return apperr.New(apperr.BadRequest, "variant_id must be positive")
	}
	return nil
}

func validateUpdateInput(in *CartItemUpdateInput) error {
	if in.Quantity != nil && *in.Quantity <= 0 {
		return apperr.New(apperr.BadRequest, "quantity must be positive")
	}
	return nil
}

// ============================================================================
// GetCart
// ============================================================================

func (s *service) GetCart(ctx context.Context, userID string) (CartWithItems, error) {
	if userID == "" {
		return CartWithItems{}, apperr.New(apperr.BadRequest, "invalid user_id")
	}

	cart, err := s.repo.GetOrCreateCartByUserID(ctx, userID)
	if err != nil {
		return CartWithItems{}, err
	}

	items, err := s.repo.ListItemViewsByCartID(ctx, int64(cart.ID))
	if err != nil {
		return CartWithItems{}, err
	}

	return CartWithItems{Cart: cart, Items: items}, nil
}

// ============================================================================
// AddItem
// ============================================================================

func (s *service) AddItem(ctx context.Context, userID string, in CartItemCreateInput) (CartItem, error) {
	if userID == "" {
		return CartItem{}, apperr.New(apperr.BadRequest, "invalid user_id")
	}
	if err := validateCreateInput(&in); err != nil {
		return CartItem{}, err
	}

	// ===== ห้าม seller เพิ่มของตัวเองลงตะกร้า =====
	ownerID, err := s.repo.GetProductOwnerID(ctx, in.ProductID)
	if err != nil {
		return CartItem{}, err
	}
	if ownerID == userID {
		return CartItem{}, apperr.New(apperr.Forbidden, "cannot add your own product to cart")
	}

	// ===== validate store active =====
	newStoreID, isActive, err := s.repo.GetStoreInfoByProductID(ctx, in.ProductID)
	if err != nil {
		return CartItem{}, err
	}
	if isActive != "YES" {
		return CartItem{}, apperr.New(apperr.BadRequest, "store is not active")
	}

	// ===== validate product_type vs variant_id =====
	productType, err := s.repo.GetProductType(ctx, in.ProductID)
	if err != nil {
		return CartItem{}, err
	}

	switch productType {
	case "STOCK":
		// STOCK ต้องมี variant_id เสมอ
		if in.VariantID == nil {
			return CartItem{}, apperr.New(apperr.BadRequest, "variant_id is required for STOCK products")
		}
		// validate variant: ต้อง belong to product นี้, active, และมี stock
		variantProductID, variantActive, stockQty, err := s.repo.GetVariantInfo(ctx, *in.VariantID)
		if err != nil {
			return CartItem{}, err
		}
		if variantProductID != in.ProductID {
			return CartItem{}, apperr.New(apperr.BadRequest, "variant does not belong to this product")
		}
		if !variantActive {
			return CartItem{}, apperr.New(apperr.BadRequest, "variant is not active")
		}
		if stockQty < in.Quantity {
			return CartItem{}, apperr.New(apperr.BadRequest, "insufficient stock")
		}

	case "PREORDER":
		// PREORDER ห้ามส่ง variant_id มา
		if in.VariantID != nil {
			return CartItem{}, apperr.New(apperr.BadRequest, "variant_id must not be provided for PREORDER products")
		}
	}

	// ===== ถ้า cart มีสินค้าจาก store อื่น → clear ก่อน =====
	cart, err := s.repo.GetOrCreateCartByUserID(ctx, userID)
	if err != nil {
		return CartItem{}, err
	}

	existingStoreID, err := s.repo.GetCartStoreID(ctx, int64(cart.ID))
	if err != nil {
		return CartItem{}, err
	}
	if existingStoreID != nil && *existingStoreID != newStoreID {
		if err := s.repo.ClearItemsByCartID(ctx, int64(cart.ID)); err != nil {
			return CartItem{}, err
		}
	}

	return s.repo.CreateItem(ctx, CartItemCreateParams{
		CartID:    cart.ID,
		ProductID: in.ProductID,
		VariantID: in.VariantID,
		Quantity:  in.Quantity,
		Note:      in.Note,
	})
}

// ============================================================================
// UpdateItem
// ============================================================================

func (s *service) UpdateItem(ctx context.Context, userID string, itemID int64, in CartItemUpdateInput) (CartItem, error) {
	if userID == "" {
		return CartItem{}, apperr.New(apperr.BadRequest, "invalid user_id")
	}
	if itemID <= 0 {
		return CartItem{}, apperr.New(apperr.BadRequest, "invalid cart_item_id")
	}
	if err := validateUpdateInput(&in); err != nil {
		return CartItem{}, err
	}

	cart, err := s.repo.GetOrCreateCartByUserID(ctx, userID)
	if err != nil {
		return CartItem{}, err
	}

	item, err := s.repo.GetItem(ctx, itemID)
	if err != nil {
		return CartItem{}, err
	}
	if item.CartID != cart.ID {
		return CartItem{}, apperr.New(apperr.Forbidden, "cannot update other user's cart item")
	}

	// ถ้า STOCK ตรวจ stock ใหม่ก่อน update
	if item.VariantID != nil && in.Quantity != nil {
		_, _, stockQty, err := s.repo.GetVariantInfo(ctx, *item.VariantID)
		if err != nil {
			return CartItem{}, err
		}
		if stockQty < *in.Quantity {
			return CartItem{}, apperr.New(apperr.BadRequest, "insufficient stock")
		}
	}

	return s.repo.UpdateItem(ctx, itemID, CartItemUpdateParams(in))
}

// ============================================================================
// DeleteItem
// ============================================================================

func (s *service) DeleteItem(ctx context.Context, userID string, itemID int64) error {
	if userID == "" {
		return apperr.New(apperr.BadRequest, "invalid user_id")
	}
	if itemID <= 0 {
		return apperr.New(apperr.BadRequest, "invalid cart_item_id")
	}

	cart, err := s.repo.GetOrCreateCartByUserID(ctx, userID)
	if err != nil {
		return err
	}

	item, err := s.repo.GetItem(ctx, itemID)
	if err != nil {
		return err
	}
	if item.CartID != cart.ID {
		return apperr.New(apperr.Forbidden, "cannot delete other user's cart item")
	}

	return s.repo.DeleteItem(ctx, itemID)
}

// ============================================================================
// ClearCart
// ============================================================================

func (s *service) ClearCart(ctx context.Context, userID string) error {
	if userID == "" {
		return apperr.New(apperr.BadRequest, "invalid user_id")
	}

	cart, err := s.repo.GetOrCreateCartByUserID(ctx, userID)
	if err != nil {
		return err
	}

	return s.repo.ClearItemsByCartID(ctx, int64(cart.ID))
}
