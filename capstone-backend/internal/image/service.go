package images

import (
	"context"
	"net/url"
	"strings"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
)

// ===== Service Interface =====

type Service interface {
	// Store images
	CreateStoreImage(ctx context.Context, in StoreImageCreateInput) (StoreImage, error)
	GetStoreImage(ctx context.Context, id int64) (StoreImage, error)
	ListStoreImagesByStoreID(ctx context.Context, storeID int64) ([]StoreImage, error)
	UpdateStoreImage(ctx context.Context, id int64, in StoreImageUpdateInput) (StoreImage, error)
	DeleteStoreImage(ctx context.Context, id int64) error

	// Product images
	CreateProductImage(ctx context.Context, in ProductImageCreateInput) (ProductImage, error)
	GetProductImage(ctx context.Context, id int64) (ProductImage, error)
	ListProductImagesByProductID(ctx context.Context, productID int64) ([]ProductImage, error)
	UpdateProductImage(ctx context.Context, id int64, in ProductImageUpdateInput) (ProductImage, error)
	DeleteProductImage(ctx context.Context, id int64) error
}

type service struct {
	repo Repo
}

func NewService(r Repo) Service { return &service{repo: r} }

// ===== Helpers =====

func validateURLStr(value string) error {
	value = strings.TrimSpace(value)
	if value == "" {
		return apperr.New(apperr.BadRequest, "image_url is required")
	}
	if len(value) > 255 {
		return apperr.New(apperr.BadRequest, "image_url must be at most 255 characters")
	}
	if _, err := url.ParseRequestURI(value); err != nil {
		return apperr.New(apperr.BadRequest, "image_url is not a valid URL")
	}
	return nil
}

func normalizeSortOrder(n int) int {
	if n <= 0 {
		return 1
	}
	return n
}

// ===== Store Image Validation =====

func validateStoreImageCreate(in *StoreImageCreateInput) error {
	if in.StoreID <= 0 {
		return apperr.New(apperr.BadRequest, "store_id must be positive")
	}
	in.ImageURL = strings.TrimSpace(in.ImageURL)
	if err := validateURLStr(in.ImageURL); err != nil {
		return err
	}
	in.SortOrder = normalizeSortOrder(in.SortOrder)
	return nil
}

func validateStoreImageUpdate(in *StoreImageUpdateInput) error {
	if in.ImageURL != nil {
		val := strings.TrimSpace(*in.ImageURL)
		if err := validateURLStr(val); err != nil {
			return err
		}
		*in.ImageURL = val
	}
	if in.SortOrder != nil {
		if *in.SortOrder <= 0 {
			return apperr.New(apperr.BadRequest, "sort_order must be positive")
		}
	}
	// is_primary เป็น bool ไม่ต้อง validate เพิ่ม
	return nil
}

// ===== Product Image Validation =====

func validateProductImageCreate(in *ProductImageCreateInput) error {
	if in.ProductID <= 0 {
		return apperr.New(apperr.BadRequest, "product_id must be positive")
	}
	in.ImageURL = strings.TrimSpace(in.ImageURL)
	if err := validateURLStr(in.ImageURL); err != nil {
		return err
	}
	in.SortOrder = normalizeSortOrder(in.SortOrder)
	return nil
}

func validateProductImageUpdate(in *ProductImageUpdateInput) error {
	if in.ImageURL != nil {
		val := strings.TrimSpace(*in.ImageURL)
		if err := validateURLStr(val); err != nil {
			return err
		}
		*in.ImageURL = val
	}
	if in.SortOrder != nil {
		if *in.SortOrder <= 0 {
			return apperr.New(apperr.BadRequest, "sort_order must be positive")
		}
	}
	return nil
}

// ============================================================================
// Store Images - Service Methods
// ============================================================================

func (s *service) CreateStoreImage(ctx context.Context, in StoreImageCreateInput) (StoreImage, error) {
	if err := validateStoreImageCreate(&in); err != nil {
		return StoreImage{}, err
	}
	params := StoreImageCreateParams(in) // field name/type ตรงกัน
	return s.repo.CreateStoreImage(ctx, params)
}

func (s *service) GetStoreImage(ctx context.Context, id int64) (StoreImage, error) {
	if id <= 0 {
		return StoreImage{}, apperr.New(apperr.BadRequest, "invalid id")
	}
	return s.repo.GetStoreImage(ctx, id)
}

func (s *service) ListStoreImagesByStoreID(ctx context.Context, storeID int64) ([]StoreImage, error) {
	if storeID <= 0 {
		return nil, apperr.New(apperr.BadRequest, "invalid store_id")
	}
	return s.repo.ListStoreImagesByStoreID(ctx, storeID)
}

func (s *service) UpdateStoreImage(ctx context.Context, id int64, in StoreImageUpdateInput) (StoreImage, error) {
	if id <= 0 {
		return StoreImage{}, apperr.New(apperr.BadRequest, "invalid id")
	}
	if err := validateStoreImageUpdate(&in); err != nil {
		return StoreImage{}, err
	}
	params := StoreImageUpdateParams(in)
	return s.repo.UpdateStoreImage(ctx, id, params)
}

func (s *service) DeleteStoreImage(ctx context.Context, id int64) error {
	if id <= 0 {
		return apperr.New(apperr.BadRequest, "invalid id")
	}
	return s.repo.DeleteStoreImage(ctx, id)
}

// ============================================================================
// Product Images - Service Methods
// ============================================================================

func (s *service) CreateProductImage(ctx context.Context, in ProductImageCreateInput) (ProductImage, error) {
	if err := validateProductImageCreate(&in); err != nil {
		return ProductImage{}, err
	}
	params := ProductImageCreateParams(in)
	return s.repo.CreateProductImage(ctx, params)
}

func (s *service) GetProductImage(ctx context.Context, id int64) (ProductImage, error) {
	if id <= 0 {
		return ProductImage{}, apperr.New(apperr.BadRequest, "invalid id")
	}
	return s.repo.GetProductImage(ctx, id)
}

func (s *service) ListProductImagesByProductID(ctx context.Context, productID int64) ([]ProductImage, error) {
	if productID <= 0 {
		return nil, apperr.New(apperr.BadRequest, "invalid product_id")
	}
	return s.repo.ListProductImagesByProductID(ctx, productID)
}

func (s *service) UpdateProductImage(ctx context.Context, id int64, in ProductImageUpdateInput) (ProductImage, error) {
	if id <= 0 {
		return ProductImage{}, apperr.New(apperr.BadRequest, "invalid id")
	}
	if err := validateProductImageUpdate(&in); err != nil {
		return ProductImage{}, err
	}
	params := ProductImageUpdateParams(in)
	return s.repo.UpdateProductImage(ctx, id, params)
}

func (s *service) DeleteProductImage(ctx context.Context, id int64) error {
	if id <= 0 {
		return apperr.New(apperr.BadRequest, "invalid id")
	}
	return s.repo.DeleteProductImage(ctx, id)
}
