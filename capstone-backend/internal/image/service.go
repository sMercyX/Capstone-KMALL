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

func (s *service) normalizeStorePrimary(ctx context.Context, storeID int, primaryID int) error {
	// ดึงรูปทั้งหมดของ store นี้
	imgs, err := s.repo.ListStoreImagesByStoreID(ctx, int64(storeID))
	if err != nil {
		return err
	}

	var cur *StoreImage  // รูปที่เพิ่งถูกตั้ง primary (id = primaryID)
	var prev *StoreImage // รูปที่เคยเป็น primary ก่อนหน้า

	for i := range imgs {
		img := imgs[i]
		if img.ID == primaryID {
			tmp := img
			cur = &tmp
		} else if img.IsPrimary {
			tmp := img
			prev = &tmp
		}
	}

	if cur == nil {
		return nil
	}

	// ======================
	// กรณีมี primary เก่า → สลับ sort_order
	// ======================
	if prev != nil {
		curSort := cur.SortOrder

		// ใช้ temp เพื่อกัน unique violation
		tmpSort := -1
		f := false

		// 1) ย้าย primary เก่าไป temp
		if _, err := s.repo.UpdateStoreImage(ctx, int64(prev.ID), StoreImageUpdateParams{
			SortOrder: &tmpSort,
			IsPrimary: &f,
		}); err != nil {
			return err
		}

		// 2) ตั้งรูปใหม่เป็น sort=1
		newPrimarySort := 1
		if _, err := s.repo.UpdateStoreImage(ctx, int64(cur.ID), StoreImageUpdateParams{
			SortOrder: &newPrimarySort,
		}); err != nil {
			return err
		}

		// 3) เอา sort เดิมของรูปใหม่ไปให้ primary เก่า
		if _, err := s.repo.UpdateStoreImage(ctx, int64(prev.ID), StoreImageUpdateParams{
			SortOrder: &curSort,
		}); err != nil {
			return err
		}

		return nil
	}

	// ======================
	// กรณีไม่มี primary เดิม → แค่ตั้ง sort=1
	// ======================
	if cur.SortOrder != 1 {
		one := 1
		if _, err := s.repo.UpdateStoreImage(ctx, int64(cur.ID), StoreImageUpdateParams{
			SortOrder: &one,
		}); err != nil {
			return err
		}
	}

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

func (s *service) normalizeProductPrimary(ctx context.Context, productID int, primaryID int) error {
	imgs, err := s.repo.ListProductImagesByProductID(ctx, int64(productID))
	if err != nil {
		return err
	}

	var cur *ProductImage  // รูปที่เพิ่งถูกตั้ง primary (id = primaryID)
	var prev *ProductImage // รูปที่เคยเป็น primary ก่อนหน้า

	for i := range imgs {
		img := imgs[i]
		if img.ID == primaryID {
			tmp := img
			cur = &tmp
		} else if img.IsPrimary {
			tmp := img
			prev = &tmp
		}
	}

	// ถ้าไม่เจอรูปที่ set primary เลย ก็ไม่ต้องทำอะไร
	if cur == nil {
		return nil
	}

	// มี primary เดิม → ใช้เทคนิค temp = -1 แล้วสลับ sort กัน
	if prev != nil {
		curSort := cur.SortOrder

		tmpSort := -1
		f := false

		// 1) ย้าย primary เก่าไป sort = -1 และเอา is_primary ออก
		if _, err := s.repo.UpdateProductImage(ctx, int64(prev.ID), ProductImageUpdateParams{
			SortOrder: &tmpSort,
			IsPrimary: &f,
		}); err != nil {
			return err
		}

		// 2) ตั้งรูปใหม่เป็น primary + sort_order = 1
		one := 1
		t := true
		if _, err := s.repo.UpdateProductImage(ctx, int64(cur.ID), ProductImageUpdateParams{
			SortOrder: &one,
			IsPrimary: &t,
		}); err != nil {
			return err
		}

		// 3) เอา sort เดิมของรูปใหม่ ให้ primary เก่า
		if _, err := s.repo.UpdateProductImage(ctx, int64(prev.ID), ProductImageUpdateParams{
			SortOrder: &curSort,
		}); err != nil {
			return err
		}

		return nil
	}

	// ไม่มี primary เดิม → แค่ตั้งรูปนี้เป็น primary + sort=1
	if cur.SortOrder != 1 || !cur.IsPrimary {
		one := 1
		t := true
		if _, err := s.repo.UpdateProductImage(ctx, int64(cur.ID), ProductImageUpdateParams{
			SortOrder: &one,
			IsPrimary: &t,
		}); err != nil {
			return err
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
	params := StoreImageCreateParams(in)

	img, err := s.repo.CreateStoreImage(ctx, params)
	if err != nil {
		return StoreImage{}, err
	}

	// ถ้ารูปนี้เป็น primary → เคลียร์ primary รูปอื่น + จัด sort_order
	if img.IsPrimary {
		if err := s.normalizeStorePrimary(ctx, img.StoreID, img.ID); err != nil {
			return StoreImage{}, err
		}
	}

	return img, nil
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
	img, err := s.repo.UpdateStoreImage(ctx, id, params)
	if err != nil {
		return StoreImage{}, err
	}

	// ถ้า update แล้วรูปนี้กลายเป็น primary
	// (กรณีทั้ง update is_primary จาก false -> true หรือเดิมก็ true อยู่แล้ว)
	if img.IsPrimary {
		if err := s.normalizeStorePrimary(ctx, img.StoreID, img.ID); err != nil {
			return StoreImage{}, err
		}
	}

	return img, nil
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
	img, err := s.repo.CreateProductImage(ctx, params)
	if err != nil {
		return ProductImage{}, err
	}
	if img.IsPrimary {
		if err := s.normalizeProductPrimary(ctx, img.ProductID, img.ID); err != nil {
			return ProductImage{}, err
		}
	}
	return img, nil
}

func (s *service) UpdateProductImage(ctx context.Context, id int64, in ProductImageUpdateInput) (ProductImage, error) {
	if id <= 0 {
		return ProductImage{}, apperr.New(apperr.BadRequest, "invalid id")
	}
	if err := validateProductImageUpdate(&in); err != nil {
		return ProductImage{}, err
	}
	params := ProductImageUpdateParams(in)
	img, err := s.repo.UpdateProductImage(ctx, id, params)
	if err != nil {
		return ProductImage{}, err
	}
	if img.IsPrimary {
		if err := s.normalizeProductPrimary(ctx, img.ProductID, img.ID); err != nil {
			return ProductImage{}, err
		}
	}
	return img, nil
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

func (s *service) DeleteProductImage(ctx context.Context, id int64) error {
	if id <= 0 {
		return apperr.New(apperr.BadRequest, "invalid id")
	}
	return s.repo.DeleteProductImage(ctx, id)
}
