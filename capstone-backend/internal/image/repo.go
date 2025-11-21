package images

import (
	"context"
	"errors"

	"github.com/jackc/pgconn"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
)

// ===== Repo Interface =====

type Repo interface {
	// Store Images
	CreateStoreImage(ctx context.Context, in StoreImageCreateParams) (StoreImage, error)
	GetStoreImage(ctx context.Context, id int64) (StoreImage, error)
	ListStoreImagesByStoreID(ctx context.Context, storeID int64) ([]StoreImage, error)
	UpdateStoreImage(ctx context.Context, id int64, in StoreImageUpdateParams) (StoreImage, error)
	DeleteStoreImage(ctx context.Context, id int64) error

	// Product Images
	CreateProductImage(ctx context.Context, in ProductImageCreateParams) (ProductImage, error)
	GetProductImage(ctx context.Context, id int64) (ProductImage, error)
	ListProductImagesByProductID(ctx context.Context, productID int64) ([]ProductImage, error)
	UpdateProductImage(ctx context.Context, id int64, in ProductImageUpdateParams) (ProductImage, error)
	DeleteProductImage(ctx context.Context, id int64) error
}

type repo struct{ db *pgxpool.Pool }

func NewRepo(db *pgxpool.Pool) Repo { return &repo{db: db} }

// ===== Params =====
type StoreImageCreateParams struct {
	StoreID   int
	ImageURL  string
	SortOrder int
	IsPrimary bool
}

type StoreImageUpdateParams struct {
	ImageURL  *string
	SortOrder *int
	IsPrimary *bool
}

type ProductImageCreateParams struct {
	ProductID int
	ImageURL  string
	SortOrder int
	IsPrimary bool
}

type ProductImageUpdateParams struct {
	ImageURL  *string
	SortOrder *int
	IsPrimary *bool
}

// ============================================================================
// Store Images
// ============================================================================

// CreateStoreImage inserts a new store image row.
func (r *repo) CreateStoreImage(ctx context.Context, in StoreImageCreateParams) (StoreImage, error) {
	var img StoreImage
	err := r.db.QueryRow(ctx, `
		INSERT INTO store_images (store_id, image_url, sort_order, is_primary)
		VALUES ($1, $2, $3, $4)
		RETURNING store_image_id, store_id, image_url, sort_order, is_primary,
		          created_at, updated_at;
	`,
		in.StoreID, in.ImageURL, in.SortOrder, in.IsPrimary,
	).Scan(
		&img.ID, &img.StoreID, &img.ImageURL, &img.SortOrder, &img.IsPrimary,
		&img.CreatedAt, &img.UpdatedAt,
	)

	if err != nil {
		if pgErr, ok := err.(*pgconn.PgError); ok {
			// 23503 = foreign key violation
			if pgErr.Code == "23503" {
				return StoreImage{}, apperr.New(apperr.BadRequest, "invalid store_id")
			}
			// 23505 = unique violation (uq_store_images_store_sort)
			if pgErr.Code == "23505" {
				return StoreImage{}, apperr.New(apperr.Conflict, "duplicate sort_order for this store")
			}
			return StoreImage{}, apperr.WithFields(
				apperr.Wrap(apperr.Internal, err, "insert store image failed"),
				map[string]any{"pg_code": pgErr.Code, "constraint": pgErr.ConstraintName, "detail": pgErr.Detail},
			)
		}
		return StoreImage{}, apperr.Wrap(apperr.Internal, err, "insert store image failed")
	}

	return img, nil
}

// GetStoreImage fetches a store image by its ID.
func (r *repo) GetStoreImage(ctx context.Context, id int64) (StoreImage, error) {
	var img StoreImage
	err := r.db.QueryRow(ctx, `
		SELECT store_image_id, store_id, image_url, sort_order, is_primary,
		       created_at, updated_at
		FROM store_images
		WHERE store_image_id = $1;
	`, id).Scan(
		&img.ID, &img.StoreID, &img.ImageURL, &img.SortOrder, &img.IsPrimary,
		&img.CreatedAt, &img.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return StoreImage{}, apperr.New(apperr.NotFound, "store image not found")
		}
		return StoreImage{}, apperr.Wrap(apperr.Internal, err, "get store image failed")
	}
	return img, nil
}

// ListStoreImagesByStoreID lists all images for a given store.
func (r *repo) ListStoreImagesByStoreID(ctx context.Context, storeID int64) ([]StoreImage, error) {
	rows, err := r.db.Query(ctx, `
		SELECT store_image_id, store_id, image_url, sort_order, is_primary,
		       created_at, updated_at
		FROM store_images
		WHERE store_id = $1
		ORDER BY sort_order ASC, created_at ASC;
	`, storeID)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list store images failed")
	}
	defer rows.Close()

	var out []StoreImage
	for rows.Next() {
		var img StoreImage
		if err := rows.Scan(
			&img.ID, &img.StoreID, &img.ImageURL, &img.SortOrder, &img.IsPrimary,
			&img.CreatedAt, &img.UpdatedAt,
		); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan store image failed")
		}
		out = append(out, img)
	}
	if err := rows.Err(); err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "rows error")
	}
	return out, nil
}

// UpdateStoreImage updates fields for a store image.
func (r *repo) UpdateStoreImage(ctx context.Context, id int64, in StoreImageUpdateParams) (StoreImage, error) {
	var img StoreImage

	err := r.db.QueryRow(ctx, `
		UPDATE store_images
		SET image_url  = COALESCE($2, image_url),
		    sort_order = COALESCE($3, sort_order),
		    is_primary = COALESCE($4, is_primary),
		    updated_at = NOW()
		WHERE store_image_id = $1
		RETURNING store_image_id, store_id, image_url, sort_order, is_primary,
		          created_at, updated_at;
	`,
		id, in.ImageURL, in.SortOrder, in.IsPrimary,
	).Scan(
		&img.ID, &img.StoreID, &img.ImageURL, &img.SortOrder, &img.IsPrimary,
		&img.CreatedAt, &img.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return StoreImage{}, apperr.New(apperr.NotFound, "store image not found")
		}
		if pgErr, ok := err.(*pgconn.PgError); ok {
			if pgErr.Code == "23505" {
				return StoreImage{}, apperr.New(apperr.Conflict, "duplicate sort_order for this store")
			}
			return StoreImage{}, apperr.WithFields(
				apperr.Wrap(apperr.Internal, err, "update store image failed"),
				map[string]any{"pg_code": pgErr.Code, "constraint": pgErr.ConstraintName, "detail": pgErr.Detail},
			)
		}
		return StoreImage{}, apperr.Wrap(apperr.Internal, err, "update store image failed")
	}

	return img, nil
}

// DeleteStoreImage deletes a store image by ID.
func (r *repo) DeleteStoreImage(ctx context.Context, id int64) error {
	cmd, err := r.db.Exec(ctx, `
		DELETE FROM store_images
		WHERE store_image_id = $1;
	`, id)
	if err != nil {
		return apperr.Wrap(apperr.Internal, err, "delete store image failed")
	}
	if cmd.RowsAffected() == 0 {
		return apperr.New(apperr.NotFound, "store image not found")
	}
	return nil
}

// ============================================================================
// Product Images
// ============================================================================

// CreateProductImage inserts a new product image row.
func (r *repo) CreateProductImage(ctx context.Context, in ProductImageCreateParams) (ProductImage, error) {
	var img ProductImage
	err := r.db.QueryRow(ctx, `
		INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
		VALUES ($1, $2, $3, $4)
		RETURNING product_image_id, product_id, image_url, sort_order, is_primary,
		          created_at, updated_at;
	`,
		in.ProductID, in.ImageURL, in.SortOrder, in.IsPrimary,
	).Scan(
		&img.ID, &img.ProductID, &img.ImageURL, &img.SortOrder, &img.IsPrimary,
		&img.CreatedAt, &img.UpdatedAt,
	)

	if err != nil {
		if pgErr, ok := err.(*pgconn.PgError); ok {
			if pgErr.Code == "23503" {
				return ProductImage{}, apperr.New(apperr.BadRequest, "invalid product_id")
			}
			if pgErr.Code == "23505" {
				return ProductImage{}, apperr.New(apperr.Conflict, "duplicate sort_order for this product")
			}
			return ProductImage{}, apperr.WithFields(
				apperr.Wrap(apperr.Internal, err, "insert product image failed"),
				map[string]any{"pg_code": pgErr.Code, "constraint": pgErr.ConstraintName, "detail": pgErr.Detail},
			)
		}
		return ProductImage{}, apperr.Wrap(apperr.Internal, err, "insert product image failed")
	}

	return img, nil
}

// GetProductImage fetches a product image by its ID.
func (r *repo) GetProductImage(ctx context.Context, id int64) (ProductImage, error) {
	var img ProductImage
	err := r.db.QueryRow(ctx, `
		SELECT product_image_id, product_id, image_url, sort_order, is_primary,
		       created_at, updated_at
		FROM product_images
		WHERE product_image_id = $1;
	`, id).Scan(
		&img.ID, &img.ProductID, &img.ImageURL, &img.SortOrder, &img.IsPrimary,
		&img.CreatedAt, &img.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ProductImage{}, apperr.New(apperr.NotFound, "product image not found")
		}
		return ProductImage{}, apperr.Wrap(apperr.Internal, err, "get product image failed")
	}
	return img, nil
}

// ListProductImagesByProductID lists images for a product.
func (r *repo) ListProductImagesByProductID(ctx context.Context, productID int64) ([]ProductImage, error) {
	rows, err := r.db.Query(ctx, `
		SELECT product_image_id, product_id, image_url, sort_order, is_primary,
		       created_at, updated_at
		FROM product_images
		WHERE product_id = $1
		ORDER BY sort_order ASC, created_at ASC;
	`, productID)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list product images failed")
	}
	defer rows.Close()

	var out []ProductImage
	for rows.Next() {
		var img ProductImage
		if err := rows.Scan(
			&img.ID, &img.ProductID, &img.ImageURL, &img.SortOrder, &img.IsPrimary,
			&img.CreatedAt, &img.UpdatedAt,
		); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan product image failed")
		}
		out = append(out, img)
	}
	if err := rows.Err(); err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "rows error")
	}
	return out, nil
}

// UpdateProductImage updates fields for a product image.
func (r *repo) UpdateProductImage(ctx context.Context, id int64, in ProductImageUpdateParams) (ProductImage, error) {
	var img ProductImage
	err := r.db.QueryRow(ctx, `
		UPDATE product_images
		SET image_url  = COALESCE($2, image_url),
		    sort_order = COALESCE($3, sort_order),
		    is_primary = COALESCE($4, is_primary),
		    updated_at = NOW()
		WHERE product_image_id = $1
		RETURNING product_image_id, product_id, image_url, sort_order, is_primary,
		          created_at, updated_at;
	`,
		id, in.ImageURL, in.SortOrder, in.IsPrimary,
	).Scan(
		&img.ID, &img.ProductID, &img.ImageURL, &img.SortOrder, &img.IsPrimary,
		&img.CreatedAt, &img.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ProductImage{}, apperr.New(apperr.NotFound, "product image not found")
		}
		if pgErr, ok := err.(*pgconn.PgError); ok {
			if pgErr.Code == "23505" {
				return ProductImage{}, apperr.New(apperr.Conflict, "duplicate sort_order for this product")
			}
			return ProductImage{}, apperr.WithFields(
				apperr.Wrap(apperr.Internal, err, "update product image failed"),
				map[string]any{"pg_code": pgErr.Code, "constraint": pgErr.ConstraintName, "detail": pgErr.Detail},
			)
		}
		return ProductImage{}, apperr.Wrap(apperr.Internal, err, "update product image failed")
	}

	return img, nil
}

// DeleteProductImage deletes a product image by ID.
func (r *repo) DeleteProductImage(ctx context.Context, id int64) error {
	cmd, err := r.db.Exec(ctx, `
		DELETE FROM product_images
		WHERE product_image_id = $1;
	`, id)
	if err != nil {
		return apperr.Wrap(apperr.Internal, err, "delete product image failed")
	}
	if cmd.RowsAffected() == 0 {
		return apperr.New(apperr.NotFound, "product image not found")
	}
	return nil
}
