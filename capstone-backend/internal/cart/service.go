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
	ProductID int `json:"product_id"`
	Quantity  int `json:"quantity"`
}

type CartItemUpdateInput struct {
	Quantity *int `json:"quantity"`
}

// ============================================================================
// Service Interface
// ============================================================================

type Service interface {
	// GET /api/cart   → ดึง/สร้างตะกร้าของ user + items
	GetCart(ctx context.Context, userID string) (CartWithItems, error)

	// POST /api/cart/items → เพิ่มสินค้าเข้าตะกร้า (ถ้า user ยังไม่มี cart จะสร้างให้)
	AddItem(ctx context.Context, userID string, in CartItemCreateInput) (CartItem, error)

	// PUT /api/cart/items/:id → อัปเดตจำนวนสินค้า (ต้องเป็นของ cart user นี้เท่านั้น)
	UpdateItem(ctx context.Context, userID string, itemID int64, in CartItemUpdateInput) (CartItem, error)

	// DELETE /api/cart/items/:id → ลบ item (ต้องเป็นของ cart user นี้เท่านั้น)
	DeleteItem(ctx context.Context, userID string, itemID int64) error
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
	return nil
}

func validateUpdateInput(in *CartItemUpdateInput) error {
	if in.Quantity != nil && *in.Quantity <= 0 {
		// ถ้าอยากรองรับ quantity = 0 = ลบ item ก็เปลี่ยน logic ตรงนี้ได้
		return apperr.New(apperr.BadRequest, "quantity must be positive")
	}
	return nil
}

// ============================================================================
// Service Methods
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

	return CartWithItems{
		Cart:  cart,
		Items: items,
	}, nil
}

func (s *service) AddItem(ctx context.Context, userID string, in CartItemCreateInput) (CartItem, error) {
	if userID == "" {
		return CartItem{}, apperr.New(apperr.BadRequest, "invalid user_id")
	}
	if err := validateCreateInput(&in); err != nil {
		return CartItem{}, err
	}

	ownerID, err := s.repo.GetProductOwnerID(ctx, in.ProductID)
	if err != nil {
		return CartItem{}, err
	}
	if ownerID == userID {
		return CartItem{}, apperr.New(apperr.Forbidden, "cannot add your own product to cart")
	}

	cart, err := s.repo.GetOrCreateCartByUserID(ctx, userID)
	if err != nil {
		return CartItem{}, err
	}

	existingStoreID, err := s.repo.GetCartStoreID(ctx, int64(cart.ID))
	if err != nil {
		return CartItem{}, err
	}

	newStoreID, err := s.repo.GetProductStoreID(ctx, in.ProductID)
	if err != nil {
		return CartItem{}, err
	}

	if existingStoreID != nil && *existingStoreID != newStoreID {
		if err := s.repo.ClearItemsByCartID(ctx, int64(cart.ID)); err != nil {
			return CartItem{}, err
		}
	}

	params := CartItemCreateParams{
		CartID:    cart.ID,
		ProductID: in.ProductID,
		Quantity:  in.Quantity,
	}

	item, err := s.repo.CreateItem(ctx, params)
	if err != nil {
		return CartItem{}, err
	}

	return item, nil
}

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

	params := CartItemUpdateParams(in)

	updated, err := s.repo.UpdateItem(ctx, itemID, params)
	if err != nil {
		return CartItem{}, err
	}
	return updated, nil
}

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

	if err := s.repo.DeleteItem(ctx, itemID); err != nil {
		return err
	}
	return nil
}
