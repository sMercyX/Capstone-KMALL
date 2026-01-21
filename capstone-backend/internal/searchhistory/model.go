package searchhistory

import "time"

type SearchHistory struct {
	ID         int64     `json:"id"`
	UserID     string    `json:"user_id"`
	QueryText  string    `json:"query_text"`
	SearchedAt time.Time `json:"searched_at"`
}

type CreateInput struct {
	QueryText string `json:"query_text"`
}

type DeleteInput struct {
	ID int64 `json:"id"`
}
