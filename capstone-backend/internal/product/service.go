package product

import (
	"context"
	"fmt"
	"math"
	"net/url"
	"os"
	"strconv"
	"strings"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
	"github.com/Perpasit/Capstone-KMALL/internal/embedding"
)

type CreateInput struct {
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
	Price       float64 `json:"price"`
	ImageURL    *string `json:"image_url,omitempty"`
	IsActive    string  `json:"is_active,omitempty"`
	StoreID     int     `json:"store_id"`
	CategoryID  int     `json:"category_id"`
}

type UpdateInput struct {
	Name        *string  `json:"name,omitempty"`
	Description *string  `json:"description,omitempty"`
	Price       *float64 `json:"price,omitempty"`
	ImageURL    *string  `json:"image_url,omitempty"`
	IsActive    *string  `json:"is_active,omitempty"`
	CategoryID  *int     `json:"category_id,omitempty"`
}

type Service interface {
	Create(ctx context.Context, in CreateInput) (Product, error)
	Get(ctx context.Context, id int64) (Product, error)
	ListByStoreID(ctx context.Context, storeID int64, limit, page int) ([]Product, int64, error)
	Update(ctx context.Context, id int64, in UpdateInput) (Product, error)
	Delete(ctx context.Context, id int64) error

	ListPublic(ctx context.Context,
		q string,
		categoryIDs []int64,
		parentCategoryID *int64,
		storeID *int64,
		limit, page int,
		sortBy string, // "", "latest", "sold", "price_asc", "price_desc"
		fulfillment string,
		minPrice *float64,
		maxPrice *float64,
	) ([]Product, int64, float64, error)

	GetPublic(ctx context.Context, id int64) (Product, error)
	SuggestSplit(ctx context.Context, userID string, q string, limit int) (SuggestSplitResult, error)
}

type service struct {
	repo Repo
	emb  embedding.Client
	w    EmbWeights
}

type EmbWeights struct {
	Name     float64
	Desc     float64
	Category float64
	Price    float64
}

func NewService(r Repo, emb embedding.Client) Service {
	return &service{
		repo: r,
		emb:  emb,
		w:    loadEmbWeights(),
	}
}

// ===== Helpers =====

func normalizeYesNo(s, def string) string {
	s = strings.TrimSpace(strings.ToUpper(s))
	if s != "YES" && s != "NO" {
		return def
	}
	return s
}

func trimPtr(p *string) *string {
	if p == nil {
		return nil
	}
	v := strings.TrimSpace(*p)
	return &v
}

func validatePrice(val float64) error {
	if val <= 0 {
		return apperr.New(apperr.BadRequest, "price must be greater than 0")
	}
	return nil
}

func validateCreate(in *CreateInput) error {
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" {
		return apperr.New(apperr.BadRequest, "name is required")
	}
	if len(in.Name) > 100 {
		return apperr.New(apperr.BadRequest, "name must be at most 100 characters")
	}

	in.Description = trimPtr(in.Description)
	if in.Description != nil && len(*in.Description) > 255 {
		return apperr.New(apperr.BadRequest, "description must be at most 255 characters")
	}

	if err := validatePrice(in.Price); err != nil {
		return err
	}

	in.ImageURL = trimPtr(in.ImageURL)
	if in.ImageURL != nil && *in.ImageURL != "" {
		if len(*in.ImageURL) > 255 {
			return apperr.New(apperr.BadRequest, "image_url must be at most 255 characters")
		}
		if _, err := url.ParseRequestURI(*in.ImageURL); err != nil {
			return apperr.New(apperr.BadRequest, "image_url is not a valid URL")
		}
	}

	if in.StoreID <= 0 {
		return apperr.New(apperr.BadRequest, "store_id must be positive")
	}
	if in.CategoryID <= 0 {
		return apperr.New(apperr.BadRequest, "category_id must be positive")
	}

	in.IsActive = normalizeYesNo(in.IsActive, "YES")
	return nil
}

func validateUpdate(in *UpdateInput) error {
	if in.Name != nil {
		n := strings.TrimSpace(*in.Name)
		if n == "" {
			return apperr.New(apperr.BadRequest, "name cannot be empty")
		}
		if len(n) > 100 {
			return apperr.New(apperr.BadRequest, "name must be at most 100 characters")
		}
		*in.Name = n
	}

	if in.Description != nil {
		d := strings.TrimSpace(*in.Description)
		if len(d) > 255 {
			return apperr.New(apperr.BadRequest, "description must be at most 255 characters")
		}
		*in.Description = d
	}

	if in.Price != nil {
		if *in.Price <= 0 {
			return apperr.New(apperr.BadRequest, "price must be greater than 0")
		}
	}

	if in.ImageURL != nil {
		u := strings.TrimSpace(*in.ImageURL)
		if u != "" {
			if len(u) > 255 {
				return apperr.New(apperr.BadRequest, "image_url must be at most 255 characters")
			}
			if _, err := url.ParseRequestURI(u); err != nil {
				return apperr.New(apperr.BadRequest, "image_url is not a valid URL")
			}
		}
		*in.ImageURL = u
	}

	if in.IsActive != nil {
		v := normalizeYesNo(*in.IsActive, "")
		if v == "" {
			return apperr.New(apperr.BadRequest, "is_active must be YES or NO")
		}
		*in.IsActive = v
	}

	if in.CategoryID != nil && *in.CategoryID <= 0 {
		return apperr.New(apperr.BadRequest, "category_id must be positive")
	}

	return nil
}

func normalizeSortBy(s string) string {
	s = strings.TrimSpace(strings.ToLower(s))
	switch s {
	case "", "latest", "sold", "price_asc", "price_desc":
		return s
	default:
		return ""
	}
}

func normalizeFulfillment(s string) string {
	s = strings.TrimSpace(strings.ToUpper(s))
	switch s {
	case "ROUND_UNIVERSITY", "CAMPUS":
		return s
	default:
		return ""
	}
}

func buildEmbeddingText(name string, desc *string, price float64, categoryName string) string {
	d := ""
	if desc != nil {
		d = strings.TrimSpace(*desc)
	}
	return fmt.Sprintf(
		"Name: %s\nCategory: %s\nDescription: %s\nPrice: %.2f THB",
		strings.TrimSpace(name),
		strings.TrimSpace(categoryName),
		d,
		price,
	)
}

func readFloatEnv(key string, def float64) float64 {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return def
	}
	f, err := strconv.ParseFloat(v, 64)
	if err != nil || math.IsNaN(f) || math.IsInf(f, 0) || f < 0 {
		return def
	}
	return f
}

func loadEmbWeights() EmbWeights {
	w := EmbWeights{
		Name:     readFloatEnv("REC_W_NAME", 0.45),
		Desc:     readFloatEnv("REC_W_DESC", 0.35),
		Category: readFloatEnv("REC_W_CATEGORY", 0.15),
		Price:    readFloatEnv("REC_W_PRICE", 0.05),
	}

	// normalize ให้รวม = 1 (กันพลาด)
	sum := w.Name + w.Desc + w.Category + w.Price
	if sum <= 0 {
		return EmbWeights{Name: 1, Desc: 0, Category: 0, Price: 0}
	}
	w.Name /= sum
	w.Desc /= sum
	w.Category /= sum
	w.Price /= sum
	return w
}

func (s *service) Create(ctx context.Context, in CreateInput) (Product, error) {
	if err := validateCreate(&in); err != nil {
		return Product{}, err
	}

	var vec []float64 = nil
	if s.emb != nil {
		catName, err := s.repo.GetCategoryName(ctx, in.CategoryID)
		if err != nil {
			return Product{}, err
		}

		text := buildEmbeddingText(in.Name, in.Description, in.Price, catName)
		v, err := s.emb.Embed(ctx, text)
		if err != nil {
			return Product{}, apperr.Wrap(apperr.Internal, err, "embed product failed")
		}
		if len(v) > 0 {
			vec = v
		}
	}

	params := CreateParams{
		Name:        in.Name,
		Description: in.Description,
		Price:       in.Price,
		ImageURL:    in.ImageURL,
		IsActive:    in.IsActive,
		StoreID:     in.StoreID,
		CategoryID:  in.CategoryID,
		Embedding:   vec,
	}

	return s.repo.Create(ctx, params)
}

func (s *service) Get(ctx context.Context, id int64) (Product, error) {
	if id <= 0 {
		return Product{}, apperr.New(apperr.BadRequest, "invalid id")
	}
	return s.repo.Get(ctx, id)
}

func (s *service) ListByStoreID(
	ctx context.Context,
	storeID int64,
	limit, page int,
) ([]Product, int64, error) {
	if storeID <= 0 {
		return nil, 0, apperr.New(apperr.BadRequest, "invalid store_id")
	}

	if limit <= 0 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}

	return s.repo.ListByStoreID(ctx, storeID, limit, page)
}

func (s *service) Update(ctx context.Context, id int64, in UpdateInput) (Product, error) {
	if id <= 0 {
		return Product{}, apperr.New(apperr.BadRequest, "invalid id")
	}
	if err := validateUpdate(&in); err != nil {
		return Product{}, err
	}

	old, err := s.repo.Get(ctx, id)
	if err != nil {
		return Product{}, err
	}

	newName := old.Name
	if in.Name != nil {
		newName = strings.TrimSpace(*in.Name)
	}

	newDesc := old.Description
	if in.Description != nil {
		newDesc = in.Description
	}

	newPrice := old.Price
	if in.Price != nil {
		newPrice = *in.Price
	}

	newCatID := old.CategoryID
	if in.CategoryID != nil {
		newCatID = *in.CategoryID
	}

	needEmbed := false

	if in.Name != nil && strings.TrimSpace(old.Name) != strings.TrimSpace(*in.Name) {
		needEmbed = true
	}

	if in.Description != nil {
		oldD := ""
		if old.Description != nil {
			oldD = strings.TrimSpace(*old.Description)
		}
		newD := strings.TrimSpace(*in.Description)
		if newD != oldD {
			needEmbed = true
		}
	}

	if in.Price != nil && old.Price != *in.Price {
		needEmbed = true
	}

	if in.CategoryID != nil && *in.CategoryID != old.CategoryID {
		needEmbed = true
	}

	var vecPtr *[]float64 = nil
	if needEmbed && s.emb != nil {
		catName, err := s.repo.GetCategoryName(ctx, newCatID)
		if err != nil {
			return Product{}, err
		}

		text := buildEmbeddingText(newName, newDesc, newPrice, catName)
		v, err := s.emb.Embed(ctx, text)
		if err != nil {
			return Product{}, apperr.Wrap(apperr.Internal, err, "embed product failed")
		}
		if len(v) > 0 {
			vecPtr = &v
		}
	}

	params := UpdateParams{
		Name:        in.Name,
		Description: in.Description,
		Price:       in.Price,
		ImageURL:    in.ImageURL,
		IsActive:    in.IsActive,
		CategoryID:  in.CategoryID,
		Embedding:   vecPtr,
	}

	return s.repo.Update(ctx, id, params)
}

func (s *service) Delete(ctx context.Context, id int64) error {
	if id <= 0 {
		return apperr.New(apperr.BadRequest, "invalid id")
	}
	return s.repo.Delete(ctx, id)
}
func (s *service) ListPublic(
	ctx context.Context,
	q string,
	categoryIDs []int64,
	parentCategoryID *int64,
	storeID *int64,
	limit, page int,
	sortBy string,
	fulfillment string,
	minPrice *float64,
	maxPrice *float64,
) ([]Product, int64, float64, error) {

	if limit <= 0 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}

	q = strings.TrimSpace(q)
	sortBy = normalizeSortBy(sortBy)
	fulfillment = normalizeFulfillment(fulfillment)

	// ถ้าส่ง sort_by แปลก ๆ มา
	if sortBy == "" && strings.TrimSpace(strings.ToLower(sortBy)) != "" {
		return nil, 0, 0, apperr.New(apperr.BadRequest, "invalid sort_by (use latest, sold, price_asc, price_desc)")
	}

	// ===== normalize price range =====
	// goal: UI slider length should start at 0 always
	if minPrice != nil {
		if math.IsNaN(*minPrice) || math.IsInf(*minPrice, 0) {
			return nil, 0, 0, apperr.New(apperr.BadRequest, "min_price is invalid")
		}
		if *minPrice < 0 {
			v := 0.0
			minPrice = &v
		}
	}
	if maxPrice != nil {
		if math.IsNaN(*maxPrice) || math.IsInf(*maxPrice, 0) {
			return nil, 0, 0, apperr.New(apperr.BadRequest, "max_price is invalid")
		}
		if *maxPrice < 0 {
			// ignore invalid negative max
			maxPrice = nil
		}
	}

	// if both provided and min > max -> swap (friendly)
	if minPrice != nil && maxPrice != nil && *minPrice > *maxPrice {
		*minPrice, *maxPrice = *maxPrice, *minPrice
		if *minPrice < 0 {
			*minPrice = 0
		}
	}

	return s.repo.ListPublic(
		ctx,
		q,
		categoryIDs,
		parentCategoryID,
		storeID,
		limit,
		page,
		sortBy,
		fulfillment,
		minPrice,
		maxPrice,
	)
}

func (s *service) GetPublic(ctx context.Context, id int64) (Product, error) {
	if id <= 0 {
		return Product{}, apperr.New(apperr.BadRequest, "invalid id")
	}
	return s.repo.GetPublic(ctx, id)
}

func (s *service) SuggestSplit(ctx context.Context, userID string, q string, limit int) (SuggestSplitResult, error) {
	q = strings.TrimSpace(q)
	userID = strings.TrimSpace(userID)

	if userID == "" {
		return SuggestSplitResult{}, apperr.New(apperr.BadRequest, "user_id is required")
	}

	if limit <= 0 {
		limit = 10
	}
	if limit > 20 {
		limit = 20
	}

	return s.repo.SuggestSplit(ctx, userID, q, limit)
}
