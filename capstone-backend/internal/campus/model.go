package campus

import "time"

type Location struct {
	ID        int       `json:"id"`
	Name      string    `json:"name"`
	Zone      *string   `json:"zone,omitempty"`
	Latitude  *float64  `json:"latitude,omitempty"`
	Longitude *float64  `json:"longitude,omitempty"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type CreateLocationInput struct {
	Name      string   `json:"name"`
	Zone      *string  `json:"zone,omitempty"`
	Latitude  *float64 `json:"latitude,omitempty"`
	Longitude *float64 `json:"longitude,omitempty"`
	IsActive  *bool    `json:"is_active,omitempty"`
}

type UpdateLocationInput struct {
	Name      *string  `json:"name,omitempty"`
	Zone      *string  `json:"zone,omitempty"`
	Latitude  *float64 `json:"latitude,omitempty"`
	Longitude *float64 `json:"longitude,omitempty"`
	IsActive  *bool    `json:"is_active,omitempty"`
}
