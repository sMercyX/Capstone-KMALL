package address

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
)

type Repo interface {
	ListByUser(ctx context.Context, userID string) ([]Address, error)
	Get(ctx context.Context, id int64) (Address, error)
	Create(ctx context.Context, userID string, in CreateAddressInput) (Address, error)
	Update(ctx context.Context, id int64, in UpdateAddressInput) (Address, error)
	Delete(ctx context.Context, id int64) error
}

type repo struct{ db *pgxpool.Pool }

func NewRepo(db *pgxpool.Pool) Repo {
	return &repo{db: db}
}

func scan(row pgx.Row, a *Address) error {
	return row.Scan(
		&a.ID,
		&a.UserID,
		&a.Label,
		&a.AddressLine1,
		&a.AddressLine2,
		&a.District,
		&a.Province,
		&a.PostalCode,
		&a.Phone,
		&a.Latitude,
		&a.Longitude,
		&a.IsDefault,
		&a.IsActive,
		&a.CreatedAt,
		&a.UpdatedAt,
	)
}

func (r *repo) ListByUser(ctx context.Context, userID string) ([]Address, error) {
	rows, err := r.db.Query(ctx, `
SELECT
  address_id, user_id, label,
  address_line1, address_line2,
  district, province, postal_code, phone,
  latitude, longitude,
  is_default, is_active,
  created_at, updated_at
FROM user_addresses
WHERE user_id = $1 AND is_active = TRUE
ORDER BY is_default DESC, created_at DESC;
`, userID)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list addresses failed")
	}
	defer rows.Close()

	var out []Address
	for rows.Next() {
		var a Address
		if err := scan(rows, &a); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan address failed")
		}
		out = append(out, a)
	}
	return out, nil
}

func (r *repo) Get(ctx context.Context, id int64) (Address, error) {
	var a Address
	err := scan(r.db.QueryRow(ctx, `
SELECT
  address_id, user_id, label,
  address_line1, address_line2,
  district, province, postal_code, phone,
  latitude, longitude,
  is_default, is_active,
  created_at, updated_at
FROM user_addresses
WHERE address_id = $1;
`, id), &a)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Address{}, apperr.New(apperr.NotFound, "address not found")
		}
		return Address{}, apperr.Wrap(apperr.Internal, err, "get address failed")
	}
	return a, nil
}

func (r *repo) Create(ctx context.Context, userID string, in CreateAddressInput) (Address, error) {
	isDefault := false
	if in.IsDefault != nil {
		isDefault = *in.IsDefault
	}

	var a Address
	err := scan(r.db.QueryRow(ctx, `
INSERT INTO user_addresses (
  user_id, label,
  address_line1, address_line2,
  district, province, postal_code, phone,
  latitude, longitude,
  is_default
)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
RETURNING
  address_id, user_id, label,
  address_line1, address_line2,
  district, province, postal_code, phone,
  latitude, longitude,
  is_default, is_active,
  created_at, updated_at;
`, userID, in.Label, in.AddressLine1, in.AddressLine2,
		in.District, in.Province, in.PostalCode, in.Phone,
		in.Latitude, in.Longitude, isDefault), &a)

	if err != nil {
		return Address{}, apperr.Wrap(apperr.Internal, err, "create address failed")
	}
	return a, nil
}

func (r *repo) Update(ctx context.Context, id int64, in UpdateAddressInput) (Address, error) {
	var a Address
	err := scan(r.db.QueryRow(ctx, `
UPDATE user_addresses
SET
  label = COALESCE($2, label),
  address_line1 = COALESCE($3, address_line1),
  address_line2 = COALESCE($4, address_line2),
  district = COALESCE($5, district),
  province = COALESCE($6, province),
  postal_code = COALESCE($7, postal_code),
  phone = COALESCE($8, phone),
  latitude = COALESCE($9, latitude),
  longitude = COALESCE($10, longitude),
  is_default = COALESCE($11, is_default),
  is_active = COALESCE($12, is_active),
  updated_at = NOW()
WHERE address_id = $1
RETURNING
  address_id, user_id, label,
  address_line1, address_line2,
  district, province, postal_code, phone,
  latitude, longitude,
  is_default, is_active,
  created_at, updated_at;
`, id,
		in.Label, in.AddressLine1, in.AddressLine2,
		in.District, in.Province, in.PostalCode, in.Phone,
		in.Latitude, in.Longitude,
		in.IsDefault, in.IsActive), &a)

	if err != nil {
		return Address{}, apperr.Wrap(apperr.Internal, err, "update address failed")
	}
	return a, nil
}

func (r *repo) Delete(ctx context.Context, id int64) error {
	ct, err := r.db.Exec(ctx, `
UPDATE user_addresses
SET is_active = FALSE, updated_at = NOW()
WHERE address_id = $1;
`, id)
	if err != nil {
		return apperr.Wrap(apperr.Internal, err, "delete address failed")
	}
	if ct.RowsAffected() == 0 {
		return apperr.New(apperr.NotFound, "address not found")
	}
	return nil
}
