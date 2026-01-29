package campus

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgconn"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
)

type Repo interface {
	ListActive(ctx context.Context, q string, zone *string) ([]Location, error)
	ListZones(ctx context.Context) ([]string, error)

	Get(ctx context.Context, id int64) (Location, error)
	Create(ctx context.Context, in CreateLocationInput) (Location, error)
	Update(ctx context.Context, id int64, in UpdateLocationInput) (Location, error)
	Delete(ctx context.Context, id int64) error
}

type repo struct{ db *pgxpool.Pool }

func NewRepo(db *pgxpool.Pool) Repo { return &repo{db: db} }

func scanLocation(row pgx.Row, out *Location) error {
	return row.Scan(
		&out.ID,
		&out.Name,
		&out.Zone,
		&out.Latitude,
		&out.Longitude,
		&out.IsActive,
		&out.CreatedAt,
		&out.UpdatedAt,
	)
}
func (r *repo) ListActive(ctx context.Context, q string, zone *string) ([]Location, error) {
	q = strings.TrimSpace(q)
	if zone != nil {
		z := strings.TrimSpace(*zone)
		if z == "" {
			zone = nil
		} else {
			zone = &z
		}
	}

	rows, err := r.db.Query(ctx, `
SELECT campus_location_id, name, zone, latitude, longitude, is_active, created_at, updated_at
FROM campus_locations
WHERE is_active = TRUE
  AND (
    $1 = '' OR
    name ILIKE '%' || $1 || '%' OR
    COALESCE(zone,'') ILIKE '%' || $1 || '%'
  )
  AND (
    $2::text IS NULL OR zone = $2
  )
ORDER BY name ASC;
`, q, zone)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list campus locations failed")
	}
	defer rows.Close()

	var out []Location
	for rows.Next() {
		var it Location
		if err := scanLocation(rows, &it); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan campus location failed")
		}
		out = append(out, it)
	}
	if err := rows.Err(); err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "rows error")
	}
	return out, nil
}

func (r *repo) ListZones(ctx context.Context) ([]string, error) {
	rows, err := r.db.Query(ctx, `
SELECT DISTINCT zone
FROM campus_locations
WHERE is_active = TRUE
  AND zone IS NOT NULL
  AND btrim(zone) <> ''
ORDER BY zone ASC;
`)
	if err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "list campus zones failed")
	}
	defer rows.Close()

	var out []string
	for rows.Next() {
		var z string
		if err := rows.Scan(&z); err != nil {
			return nil, apperr.Wrap(apperr.Internal, err, "scan zone failed")
		}
		out = append(out, z)
	}
	if err := rows.Err(); err != nil {
		return nil, apperr.Wrap(apperr.Internal, err, "rows error")
	}
	return out, nil
}

func (r *repo) Get(ctx context.Context, id int64) (Location, error) {
	var it Location
	err := scanLocation(r.db.QueryRow(ctx, `
SELECT campus_location_id, name, zone, latitude, longitude, is_active, created_at, updated_at
FROM campus_locations
WHERE campus_location_id = $1;
`, id), &it)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Location{}, apperr.New(apperr.NotFound, "campus location not found")
		}
		return Location{}, apperr.Wrap(apperr.Internal, err, "get campus location failed")
	}
	return it, nil
}

func (r *repo) Create(ctx context.Context, in CreateLocationInput) (Location, error) {
	isActive := true
	if in.IsActive != nil {
		isActive = *in.IsActive
	}

	var it Location
	err := scanLocation(r.db.QueryRow(ctx, `
INSERT INTO campus_locations (name, zone, latitude, longitude, is_active)
VALUES ($1,$2,$3,$4,$5)
RETURNING campus_location_id, name, zone, latitude, longitude, is_active, created_at, updated_at;
`, in.Name, in.Zone, in.Latitude, in.Longitude, isActive), &it)

	if err != nil {
		if pgErr, ok := err.(*pgconn.PgError); ok {
			if pgErr.Code == "23505" {
				return Location{}, apperr.Wrap(apperr.Conflict, err, "campus location name already exists")
			}
		}
		return Location{}, apperr.Wrap(apperr.Internal, err, "create campus location failed")
	}
	return it, nil
}

func (r *repo) Update(ctx context.Context, id int64, in UpdateLocationInput) (Location, error) {
	var it Location
	err := scanLocation(r.db.QueryRow(ctx, `
UPDATE campus_locations
SET
  name = COALESCE($2, name),
  zone = CASE
    WHEN $3::text IS NULL THEN zone
    WHEN btrim($3) = '' THEN NULL
    ELSE $3
  END,
  latitude = COALESCE($4, latitude),
  longitude = COALESCE($5, longitude),
  is_active = COALESCE($6, is_active),
  updated_at = NOW()
WHERE campus_location_id = $1
RETURNING campus_location_id, name, zone, latitude, longitude, is_active, created_at, updated_at;
`, id, in.Name, in.Zone, in.Latitude, in.Longitude, in.IsActive), &it)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Location{}, apperr.New(apperr.NotFound, "campus location not found")
		}
		if pgErr, ok := err.(*pgconn.PgError); ok && pgErr.Code == "23505" {
			return Location{}, apperr.Wrap(apperr.Conflict, err, "campus location name already exists")
		}
		return Location{}, apperr.Wrap(apperr.Internal, err, "update campus location failed")
	}
	return it, nil
}

func (r *repo) Delete(ctx context.Context, id int64) error {
	ct, err := r.db.Exec(ctx, `DELETE FROM campus_locations WHERE campus_location_id=$1;`, id)
	if err != nil {
		return apperr.Wrap(apperr.Internal, err, "delete campus location failed")
	}
	if ct.RowsAffected() == 0 {
		return apperr.New(apperr.NotFound, "campus location not found")
	}
	return nil
}
