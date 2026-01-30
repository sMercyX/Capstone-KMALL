package address

import "time"

type Address struct {
	ID           int64     `json:"id"`
	UserID       string    `json:"user_id"`
	Label        *string   `json:"label,omitempty"`
	AddressLine1 string    `json:"address_line1"`
	AddressLine2 *string   `json:"address_line2,omitempty"`
	District     *string   `json:"district,omitempty"`
	Province     *string   `json:"province,omitempty"`
	PostalCode   *string   `json:"postal_code,omitempty"`
	Phone        *string   `json:"phone,omitempty"`
	Latitude     *float64  `json:"latitude,omitempty"`
	Longitude    *float64  `json:"longitude,omitempty"`
	IsDefault    bool      `json:"is_default"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type CreateAddressInput struct {
	Label        *string  `json:"label,omitempty"`
	AddressLine1 string   `json:"address_line1"`
	AddressLine2 *string  `json:"address_line2,omitempty"`
	District     *string  `json:"district,omitempty"`
	Province     *string  `json:"province,omitempty"`
	PostalCode   *string  `json:"postal_code,omitempty"`
	Phone        *string  `json:"phone,omitempty"`
	Latitude     *float64 `json:"latitude,omitempty"`
	Longitude    *float64 `json:"longitude,omitempty"`
	IsDefault    *bool    `json:"is_default,omitempty"`
}

type UpdateAddressInput struct {
	Label        *string  `json:"label,omitempty"`
	AddressLine1 *string  `json:"address_line1,omitempty"`
	AddressLine2 *string  `json:"address_line2,omitempty"`
	District     *string  `json:"district,omitempty"`
	Province     *string  `json:"province,omitempty"`
	PostalCode   *string  `json:"postal_code,omitempty"`
	Phone        *string  `json:"phone,omitempty"`
	Latitude     *float64 `json:"latitude,omitempty"`
	Longitude    *float64 `json:"longitude,omitempty"`
	IsDefault    *bool    `json:"is_default,omitempty"`
	IsActive     *bool    `json:"is_active,omitempty"`
}
