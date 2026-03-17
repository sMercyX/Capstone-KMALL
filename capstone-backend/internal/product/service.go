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

// ===== Inputs =====

type CreateInput struct {
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
	Price       float64 `json:"price"`
	ImageURL    *string `json:"image_url,omitempty"`
	IsActive    string  `json:"is_active,omitempty"`
	ProductType string  `json:"product_type,omitempty"` // "STOCK" | "PREORDER"
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

type CreateVariantInput struct {
	PriceDelta   float64 `json:"price_delta"`
	StockQty     int     `json:"stock_qty"`
	OptionValues []int64 `json:"option_value_ids"` // ต้องครบทุก key
}

type CreateOptionKeyWithValuesInput struct {
	KeyName    string
	SortOrder  int
	Values     []string // value_labels
	IsImageKey bool
}

// ReplaceVariantsConfigInput — ใช้กับ PUT /:id/variants-config
// ส่ง options + variants ใหม่ทั้งหมด backend จะ replace ของเก่าทั้งหมด
type ReplaceVariantsConfigInput struct {
	Options  []ReplaceOptionKeyInput `json:"options"`
	Variants []ReplaceVariantInput   `json:"variants"`
}

type ReplaceOptionKeyInput struct {
	KeyName    string   `json:"key_name"`
	SortOrder  int      `json:"sort_order"`
	Values     []string `json:"values"` // value_labels
	IsImageKey bool     `json:"is_image_key"`
}

type ReplaceVariantInput struct {
	// ใช้ label ตรงๆ เพื่อ UX ง่าย เช่น ["ดำ", "S", "cotton"]
	OptionValueLabels []string `json:"option_value_labels"`
	PriceDelta        float64  `json:"price_delta"`
	StockQty          int      `json:"stock_qty"`
}

// ===== Service interface =====

type Service interface {
	Create(ctx context.Context, in CreateInput) (Product, error)
	Get(ctx context.Context, id int64) (Product, error)
	ListByStoreID(ctx context.Context, storeID int64, q string, limit, page int) ([]Product, int64, error)
	Update(ctx context.Context, id int64, in UpdateInput) (Product, error)
	Delete(ctx context.Context, id int64) error

	ListPublic(ctx context.Context,
		q string,
		categoryIDs []int64,
		parentCategoryID *int64,
		storeID *int64,
		limit, page int,
		sortBy string,
		fulfillment string,
		minPrice *float64,
		maxPrice *float64,
	) ([]Product, int64, float64, error)

	GetPublic(ctx context.Context, id int64) (Product, error)
	SuggestSplit(ctx context.Context, userID string, q string, limit int) (SuggestSplitResult, error)

	// ===== Option Keys =====
	CreateOptionKey(ctx context.Context, productID int64, userID string, keyName string, sortOrder int) (OptionKey, error)
	ListOptionKeys(ctx context.Context, productID int64) ([]OptionKey, error)
	DeleteOptionKey(ctx context.Context, keyID int64, productID int64, userID string) error

	// ===== Option Values =====
	CreateOptionValue(ctx context.Context, keyID int64, productID int64, userID string, valueLabel string, sortOrder int) (OptionValue, error)
	DeleteOptionValue(ctx context.Context, valueID int64, productID int64, userID string) error

	// ===== Variants =====
	CreateVariant(ctx context.Context, productID int64, userID string, in CreateVariantInput) (Variant, error)
	ListVariants(ctx context.Context, productID int64) ([]Variant, error)
	UpdateVariantStock(ctx context.Context, variantID int64, productID int64, userID string, stockQty int) (Variant, error)
	DeleteVariant(ctx context.Context, variantID int64, productID int64, userID string) error

	// ===== Composite =====
	CreateWithOptions(ctx context.Context, in CreateInput, opts []CreateOptionKeyWithValuesInput) (Product, error)
	// ReplaceVariantsConfig — แทนที่ options + variants ทั้งหมดในครั้งเดียว (Shopee/Lazada style)
	ReplaceVariantsConfig(ctx context.Context, productID int64, userID string, in ReplaceVariantsConfigInput) (Product, error)

	UpdateWithVariantsConfig(ctx context.Context, productID int64, userID string, in UpdateWithVariantsInput) (Product, error)

	// เพิ่มใน Service interface
	SetOptionKeyImageKey(ctx context.Context, keyID int64, productID int64, userID string, isImageKey bool) (OptionKey, error)
	SetOptionValueImage(ctx context.Context, valueID int64, productID int64, userID string, imageURL *string) (OptionValue, error)
}

// ===== service struct =====

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
	return &service{repo: r, emb: emb, w: loadEmbWeights()}
}

// ===== Helpers =====

func normalizeYesNo(s, def string) string {
	s = strings.TrimSpace(strings.ToUpper(s))
	if s != "YES" && s != "NO" {
		return def
	}
	return s
}

func normalizeProductType(s string) string {
	s = strings.TrimSpace(strings.ToUpper(s))
	if s != "STOCK" && s != "PREORDER" {
		return "PREORDER"
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
	in.ProductType = normalizeProductType(in.ProductType)
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

	if in.Price != nil && *in.Price <= 0 {
		return apperr.New(apperr.BadRequest, "price must be greater than 0")
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
	}
	sum := w.Name + w.Desc + w.Category
	if sum <= 0 {
		return EmbWeights{Name: 1, Desc: 0, Category: 0}
	}
	w.Name /= sum
	w.Desc /= sum
	w.Category /= sum
	return w
}

func buildNameText(name string) string {
	return fmt.Sprintf("Name: %s", strings.TrimSpace(name))
}
func buildDescText(desc *string) string {
	d := ""
	if desc != nil {
		d = strings.TrimSpace(*desc)
	}
	return fmt.Sprintf("Description: %s", d)
}
func buildCategoryText(categoryName string) string {
	return fmt.Sprintf("Category: %s", strings.TrimSpace(categoryName))
}

// ===== Create =====

func (s *service) Create(ctx context.Context, in CreateInput) (Product, error) {
	if err := validateCreate(&in); err != nil {
		return Product{}, err
	}

	var vName, vDesc, vCat []float64
	if s.emb != nil {
		catName, err := s.repo.GetCategoryName(ctx, in.CategoryID)
		if err != nil {
			return Product{}, err
		}
		rawName, err := s.emb.Embed(ctx, buildNameText(in.Name))
		if err != nil {
			return Product{}, apperr.Wrap(apperr.Internal, err, "embed name failed")
		}
		rawDesc, err := s.emb.Embed(ctx, buildDescText(in.Description))
		if err != nil {
			return Product{}, apperr.Wrap(apperr.Internal, err, "embed desc failed")
		}
		rawCat, err := s.emb.Embed(ctx, buildCategoryText(catName))
		if err != nil {
			return Product{}, apperr.Wrap(apperr.Internal, err, "embed category failed")
		}
		vName = rawName
		vDesc = rawDesc
		vCat = rawCat
	}

	return s.repo.Create(ctx, CreateParams{
		Name:        in.Name,
		Description: in.Description,
		Price:       in.Price,
		ImageURL:    in.ImageURL,
		IsActive:    in.IsActive,
		ProductType: in.ProductType,
		StoreID:     in.StoreID,
		CategoryID:  in.CategoryID,
		EmbName:     vName,
		EmbDesc:     vDesc,
		EmbCategory: vCat,
	})
}

// ===== Get =====

func (s *service) Get(ctx context.Context, id int64) (Product, error) {
	if id <= 0 {
		return Product{}, apperr.New(apperr.BadRequest, "invalid id")
	}
	return s.repo.Get(ctx, id)
}

// ===== ListByStoreID =====

func (s *service) ListByStoreID(ctx context.Context, storeID int64, q string, limit, page int) ([]Product, int64, error) {
	if storeID <= 0 {
		return nil, 0, apperr.New(apperr.BadRequest, "invalid store_id")
	}
	if limit <= 0 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}
	return s.repo.ListByStoreID(ctx, storeID, strings.TrimSpace(q), limit, page)
}

// ===== Update =====

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

	// STOCK: ต้องมี active variant ก่อน set is_active = YES
	if in.IsActive != nil && strings.ToUpper(*in.IsActive) == "YES" && old.ProductType == "STOCK" {
		variants, err := s.repo.ListVariants(ctx, id)
		if err != nil {
			return Product{}, err
		}
		hasActive := false
		for _, v := range variants {
			if v.IsActive {
				hasActive = true
				break
			}
		}
		if !hasActive {
			return Product{}, apperr.New(apperr.BadRequest, "STOCK product must have at least 1 active variant before activation")
		}
	}

	newName := old.Name
	if in.Name != nil {
		newName = strings.TrimSpace(*in.Name)
	}
	newDesc := old.Description
	if in.Description != nil {
		newDesc = in.Description
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
		if strings.TrimSpace(*in.Description) != oldD {
			needEmbed = true
		}
	}
	if in.CategoryID != nil && *in.CategoryID != old.CategoryID {
		needEmbed = true
	}

	var embNamePtr, embDescPtr, embCatPtr *[]float64

	if needEmbed && s.emb != nil {
		catName, err := s.repo.GetCategoryName(ctx, newCatID)
		if err != nil {
			return Product{}, err
		}
		rawName, err := s.emb.Embed(ctx, buildNameText(newName))
		if err != nil {
			return Product{}, apperr.Wrap(apperr.Internal, err, "embed name failed")
		}
		rawDesc, err := s.emb.Embed(ctx, buildDescText(newDesc))
		if err != nil {
			return Product{}, apperr.Wrap(apperr.Internal, err, "embed desc failed")
		}
		rawCat, err := s.emb.Embed(ctx, buildCategoryText(catName))
		if err != nil {
			return Product{}, apperr.Wrap(apperr.Internal, err, "embed category failed")
		}
		embNamePtr = &rawName
		embDescPtr = &rawDesc
		embCatPtr = &rawCat
	}

	return s.repo.Update(ctx, id, UpdateParams{
		Name:        in.Name,
		Description: in.Description,
		Price:       in.Price,
		ImageURL:    in.ImageURL,
		IsActive:    in.IsActive,
		CategoryID:  in.CategoryID,
		EmbName:     embNamePtr,
		EmbDesc:     embDescPtr,
		EmbCategory: embCatPtr,
	})
}

// ===== Delete =====

func (s *service) Delete(ctx context.Context, id int64) error {
	if id <= 0 {
		return apperr.New(apperr.BadRequest, "invalid id")
	}
	return s.repo.Delete(ctx, id)
}

// ===== ListPublic =====

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
	rawSort := strings.TrimSpace(sortBy)
	sortBy = normalizeSortBy(sortBy)
	if sortBy == "" && rawSort != "" {
		return nil, 0, 0, apperr.New(apperr.BadRequest, "invalid sort_by (use latest, sold, price_asc, price_desc)")
	}
	fulfillment = normalizeFulfillment(fulfillment)

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
			maxPrice = nil
		}
	}
	if minPrice != nil && maxPrice != nil && *minPrice > *maxPrice {
		a, b := *maxPrice, *minPrice
		if a < 0 {
			a = 0
		}
		minPrice = &a
		maxPrice = &b
	}

	return s.repo.ListPublic(ctx, q, categoryIDs, parentCategoryID, storeID, limit, page, sortBy, fulfillment, minPrice, maxPrice)
}

// ===== GetPublic =====

func (s *service) GetPublic(ctx context.Context, id int64) (Product, error) {
	if id <= 0 {
		return Product{}, apperr.New(apperr.BadRequest, "invalid id")
	}
	return s.repo.GetPublic(ctx, id)
}

// ===== SuggestSplit =====

func (s *service) SuggestSplit(ctx context.Context, userID string, q string, limit int) (SuggestSplitResult, error) {
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
	return s.repo.SuggestSplit(ctx, userID, strings.TrimSpace(q), limit)
}

// ===== Option Keys =====

func (s *service) CreateOptionKey(ctx context.Context, productID int64, userID string, keyName string, sortOrder int) (OptionKey, error) {
	p, err := s.repo.Get(ctx, productID)
	if err != nil {
		return OptionKey{}, err
	}
	if p.ProductType != "STOCK" {
		return OptionKey{}, apperr.New(apperr.BadRequest, "option keys are only available for STOCK products")
	}

	keyName = strings.TrimSpace(keyName)
	if keyName == "" {
		return OptionKey{}, apperr.New(apperr.BadRequest, "key_name is required")
	}
	if len(keyName) > 50 {
		return OptionKey{}, apperr.New(apperr.BadRequest, "key_name must be at most 50 characters")
	}

	keys, err := s.repo.ListOptionKeys(ctx, productID)
	if err != nil {
		return OptionKey{}, err
	}
	if len(keys) >= 3 {
		return OptionKey{}, apperr.New(apperr.BadRequest, "maximum 3 option keys per product")
	}

	return s.repo.CreateOptionKey(ctx, productID, keyName, sortOrder, false)
}

func (s *service) ListOptionKeys(ctx context.Context, productID int64) ([]OptionKey, error) {
	if productID <= 0 {
		return nil, apperr.New(apperr.BadRequest, "invalid product_id")
	}
	return s.repo.ListOptionKeys(ctx, productID)
}

func (s *service) DeleteOptionKey(ctx context.Context, keyID int64, productID int64, userID string) error {
	if keyID <= 0 {
		return apperr.New(apperr.BadRequest, "invalid key_id")
	}
	variants, err := s.repo.ListVariants(ctx, productID)
	if err != nil {
		return err
	}
	if len(variants) > 0 {
		return apperr.New(apperr.BadRequest, "cannot delete option key while variants exist, use PUT /:id/variants-config instead")
	}
	return s.repo.DeleteOptionKey(ctx, keyID)
}

// ===== Option Values =====

func (s *service) CreateOptionValue(ctx context.Context, keyID int64, productID int64, userID string, valueLabel string, sortOrder int) (OptionValue, error) {
	if keyID <= 0 {
		return OptionValue{}, apperr.New(apperr.BadRequest, "invalid key_id")
	}

	valueLabel = strings.TrimSpace(valueLabel)
	if valueLabel == "" {
		return OptionValue{}, apperr.New(apperr.BadRequest, "value_label is required")
	}
	if len(valueLabel) > 100 {
		return OptionValue{}, apperr.New(apperr.BadRequest, "value_label must be at most 100 characters")
	}

	// ถ้ามี variant อยู่แล้ว แนะนำให้ใช้ ReplaceVariantsConfig แทน
	variants, err := s.repo.ListVariants(ctx, productID)
	if err != nil {
		return OptionValue{}, err
	}
	if len(variants) > 0 {
		return OptionValue{}, apperr.New(apperr.BadRequest, "cannot add option value while variants exist, use PUT /:id/variants-config instead")
	}

	return s.repo.CreateOptionValue(ctx, keyID, valueLabel, sortOrder)
}

func (s *service) DeleteOptionValue(ctx context.Context, valueID int64, productID int64, userID string) error {
	if valueID <= 0 {
		return apperr.New(apperr.BadRequest, "invalid value_id")
	}
	variants, err := s.repo.ListVariants(ctx, productID)
	if err != nil {
		return err
	}
	if len(variants) > 0 {
		return apperr.New(apperr.BadRequest, "cannot delete option value while variants exist, use PUT /:id/variants-config instead")
	}
	return s.repo.DeleteOptionValue(ctx, valueID)
}

// ===== Variants =====

func (s *service) CreateVariant(ctx context.Context, productID int64, userID string, in CreateVariantInput) (Variant, error) {
	p, err := s.repo.Get(ctx, productID)
	if err != nil {
		return Variant{}, err
	}
	if p.ProductType != "STOCK" {
		return Variant{}, apperr.New(apperr.BadRequest, "variants are only available for STOCK products")
	}
	if in.StockQty < 0 {
		return Variant{}, apperr.New(apperr.BadRequest, "stock_qty must be >= 0")
	}

	keys, err := s.repo.ListOptionKeys(ctx, productID)
	if err != nil {
		return Variant{}, err
	}
	if len(keys) == 0 {
		return Variant{}, apperr.New(apperr.BadRequest, "add at least 1 option key before creating variants")
	}
	if len(in.OptionValues) != len(keys) {
		return Variant{}, apperr.New(apperr.BadRequest,
			fmt.Sprintf("expected %d option_value_ids (one per key), got %d", len(keys), len(in.OptionValues)))
	}

	usedKeyIDs := make(map[int]bool, len(in.OptionValues))
	for _, vid := range in.OptionValues {
		foundKeyID := 0
		for _, k := range keys {
			for _, v := range k.Values {
				if int64(v.ID) == vid {
					foundKeyID = k.ID
					break
				}
			}
			if foundKeyID != 0 {
				break
			}
		}
		if foundKeyID == 0 {
			return Variant{}, apperr.New(apperr.BadRequest,
				fmt.Sprintf("option_value_id %d does not belong to this product", vid))
		}
		if usedKeyIDs[foundKeyID] {
			return Variant{}, apperr.New(apperr.BadRequest,
				fmt.Sprintf("duplicate option key in selections (key_id %d used more than once)", foundKeyID))
		}
		usedKeyIDs[foundKeyID] = true
	}

	return s.repo.CreateVariant(ctx, CreateVariantParams{
		ProductID:    productID,
		PriceDelta:   in.PriceDelta,
		StockQty:     in.StockQty,
		OptionValues: in.OptionValues,
	})
}

func (s *service) ListVariants(ctx context.Context, productID int64) ([]Variant, error) {
	if productID <= 0 {
		return nil, apperr.New(apperr.BadRequest, "invalid product_id")
	}
	return s.repo.ListVariants(ctx, productID)
}

func (s *service) UpdateVariantStock(ctx context.Context, variantID int64, productID int64, userID string, stockQty int) (Variant, error) {
	if variantID <= 0 {
		return Variant{}, apperr.New(apperr.BadRequest, "invalid variant_id")
	}
	if stockQty < 0 {
		return Variant{}, apperr.New(apperr.BadRequest, "stock_qty must be >= 0")
	}
	return s.repo.UpdateVariantStock(ctx, variantID, stockQty)
}

func (s *service) DeleteVariant(ctx context.Context, variantID int64, productID int64, userID string) error {
	if variantID <= 0 {
		return apperr.New(apperr.BadRequest, "invalid variant_id")
	}
	return s.repo.DeleteVariant(ctx, variantID)
}

// ===== CreateWithOptions =====

func (s *service) CreateWithOptions(ctx context.Context, in CreateInput, opts []CreateOptionKeyWithValuesInput) (Product, error) {
	p, err := s.Create(ctx, in)
	if err != nil {
		return Product{}, err
	}

	if p.ProductType != "STOCK" || len(opts) == 0 {
		return p, nil
	}

	for _, opt := range opts {
		key, err := s.repo.CreateOptionKey(ctx, int64(p.ID), opt.KeyName, opt.SortOrder, opt.IsImageKey)
		if err != nil {
			return p, err
		}
		for i, label := range opt.Values {
			_, err := s.CreateOptionValue(ctx, int64(key.ID), int64(p.ID), "", label, i+1)
			if err != nil {
				return p, err
			}
		}
	}

	keys, err := s.repo.ListOptionKeys(ctx, int64(p.ID))
	if err != nil {
		return p, nil
	}
	p.Options = keys
	return p, nil
}

// ===== ReplaceVariantsConfig =====
// แทนที่ options + variants ทั้งหมดในครั้งเดียว (Shopee/Lazada style)
// user ส่ง state ใหม่ทั้งหมดมา backend จัดการ delete + recreate เอง

func (s *service) ReplaceVariantsConfig(ctx context.Context, productID int64, userID string, in ReplaceVariantsConfigInput) (Product, error) {
	p, err := s.repo.Get(ctx, productID)
	if err != nil {
		return Product{}, err
	}
	if p.ProductType != "STOCK" {
		return Product{}, apperr.New(apperr.BadRequest, "variants config is only available for STOCK products")
	}
	if len(in.Options) == 0 {
		return Product{}, apperr.New(apperr.BadRequest, "options must not be empty")
	}
	if len(in.Options) > 3 {
		return Product{}, apperr.New(apperr.BadRequest, "maximum 3 option keys per product")
	}

	// validate options
	for _, opt := range in.Options {
		if strings.TrimSpace(opt.KeyName) == "" {
			return Product{}, apperr.New(apperr.BadRequest, "key_name is required")
		}
		if len(opt.Values) == 0 {
			return Product{}, apperr.New(apperr.BadRequest, fmt.Sprintf("option '%s' must have at least 1 value", opt.KeyName))
		}
	}

	// validate variants — ทุก label ต้องอยู่ใน options ที่ส่งมา
	// สร้าง map: key_name -> set of value_labels
	optionMap := make(map[string]map[string]bool, len(in.Options))
	for _, opt := range in.Options {
		vals := make(map[string]bool, len(opt.Values))
		for _, v := range opt.Values {
			vals[strings.TrimSpace(v)] = true
		}
		optionMap[strings.TrimSpace(opt.KeyName)] = vals
	}

	for i, v := range in.Variants {
		if len(v.OptionValueLabels) != len(in.Options) {
			return Product{}, apperr.New(apperr.BadRequest,
				fmt.Sprintf("variant[%d]: expected %d option_value_labels, got %d", i, len(in.Options), len(v.OptionValueLabels)))
		}
		for j, label := range v.OptionValueLabels {
			keyName := strings.TrimSpace(in.Options[j].KeyName)
			if !optionMap[keyName][strings.TrimSpace(label)] {
				return Product{}, apperr.New(apperr.BadRequest,
					fmt.Sprintf("variant[%d]: label '%s' is not in option '%s'", i, label, keyName))
			}
		}
		if v.StockQty < 0 {
			return Product{}, apperr.New(apperr.BadRequest, fmt.Sprintf("variant[%d]: stock_qty must be >= 0", i))
		}
	}

	// ===== Step 1: ลบ variants เก่าทั้งหมด =====
	if err := s.repo.DeleteAllVariantsByProductID(ctx, productID); err != nil {
		return Product{}, err
	}

	// ===== Step 2: ลบ option keys เก่าทั้งหมด (cascade ลบ values ด้วย) =====
	if err := s.repo.DeleteAllOptionKeysByProductID(ctx, productID); err != nil {
		return Product{}, err
	}

	// ===== Step 3: สร้าง option keys + values ใหม่ =====
	// เก็บ map: key_name -> value_label -> option_value_id
	valueIDMap := make(map[string]map[string]int64, len(in.Options))

	for i, opt := range in.Options {
		key, err := s.repo.CreateOptionKey(ctx, productID, strings.TrimSpace(opt.KeyName), opt.SortOrder, opt.IsImageKey)
		if err != nil {
			return Product{}, err
		}
		valueIDMap[strings.TrimSpace(opt.KeyName)] = make(map[string]int64, len(opt.Values))
		for j, label := range opt.Values {
			val, err := s.repo.CreateOptionValue(ctx, int64(key.ID), strings.TrimSpace(label), j+1)
			if err != nil {
				return Product{}, err
			}
			valueIDMap[strings.TrimSpace(opt.KeyName)][strings.TrimSpace(label)] = int64(val.ID)
			_ = i
		}
	}

	// ===== Step 4: สร้าง variants ใหม่ =====
	for i, v := range in.Variants {
		optionValueIDs := make([]int64, 0, len(v.OptionValueLabels))
		for j, label := range v.OptionValueLabels {
			keyName := strings.TrimSpace(in.Options[j].KeyName)
			vid, ok := valueIDMap[keyName][strings.TrimSpace(label)]
			if !ok {
				return Product{}, apperr.New(apperr.Internal, fmt.Sprintf("variant[%d]: could not resolve value_id for '%s'", i, label))
			}
			optionValueIDs = append(optionValueIDs, vid)
		}

		_, err := s.repo.CreateVariant(ctx, CreateVariantParams{
			ProductID:    productID,
			PriceDelta:   v.PriceDelta,
			StockQty:     v.StockQty,
			OptionValues: optionValueIDs,
		})
		if err != nil {
			return Product{}, err
		}
	}

	// ===== Return product พร้อม options + variants ใหม่ =====
	keys, err := s.repo.ListOptionKeys(ctx, productID)
	if err != nil {
		return Product{}, err
	}
	variants, err := s.repo.ListVariants(ctx, productID)
	if err != nil {
		return Product{}, err
	}
	for i := range variants {
		variants[i].FinalPrice = p.Price + variants[i].PriceDelta
	}

	p.Options = keys
	p.Variants = variants
	return p, nil
}

func (s *service) UpdateWithVariantsConfig(ctx context.Context, productID int64, userID string, in UpdateWithVariantsInput) (Product, error) {
	if productID <= 0 {
		return Product{}, apperr.New(apperr.BadRequest, "invalid id")
	}

	// validate product fields
	up := UpdateInput{
		Name:        in.Name,
		Description: in.Description,
		Price:       in.Price,
		ImageURL:    in.ImageURL,
		IsActive:    in.IsActive,
		CategoryID:  in.CategoryID,
	}
	if err := validateUpdate(&up); err != nil {
		return Product{}, err
	}

	old, err := s.repo.Get(ctx, productID)
	if err != nil {
		return Product{}, err
	}

	// ถ้ามี variants_config ต้องเป็น STOCK
	if in.VariantsConfig != nil && old.ProductType != "STOCK" {
		return Product{}, apperr.New(apperr.BadRequest, "variants config is only available for STOCK products")
	}

	// validate variants_config
	if in.VariantsConfig != nil {
		if len(in.VariantsConfig.Options) == 0 {
			return Product{}, apperr.New(apperr.BadRequest, "options must not be empty")
		}
		if len(in.VariantsConfig.Options) > 3 {
			return Product{}, apperr.New(apperr.BadRequest, "maximum 3 option keys per product")
		}

		optionMap := make(map[string]map[string]bool, len(in.VariantsConfig.Options))
		for _, opt := range in.VariantsConfig.Options {
			key := strings.TrimSpace(opt.KeyName)
			if key == "" {
				return Product{}, apperr.New(apperr.BadRequest, "key_name is required")
			}
			if len(opt.Values) == 0 {
				return Product{}, apperr.New(apperr.BadRequest, fmt.Sprintf("option '%s' must have at least 1 value", key))
			}

			if _, exists := optionMap[key]; exists {
				return Product{}, apperr.New(apperr.BadRequest, fmt.Sprintf("duplicate option key '%s'", key))
			}

			optionMap[key] = map[string]bool{}
			for _, v := range opt.Values {
				label := strings.TrimSpace(v)
				if label == "" {
					return Product{}, apperr.New(apperr.BadRequest, fmt.Sprintf("option '%s' has empty value", key))
				}
				if optionMap[key][label] {
					return Product{}, apperr.New(apperr.BadRequest, fmt.Sprintf("duplicate value '%s' in option '%s'", label, key))
				}
				optionMap[key][label] = true
			}
		}

		for i, v := range in.VariantsConfig.Variants {
			if len(v.OptionValueLabels) != len(in.VariantsConfig.Options) {
				return Product{}, apperr.New(apperr.BadRequest,
					fmt.Sprintf("variant[%d]: expected %d option_value_labels, got %d",
						i, len(in.VariantsConfig.Options), len(v.OptionValueLabels)))
			}
			if v.StockQty < 0 {
				return Product{}, apperr.New(apperr.BadRequest,
					fmt.Sprintf("variant[%d]: stock_qty must be >= 0", i))
			}

			for j, label := range v.OptionValueLabels {
				keyName := strings.TrimSpace(in.VariantsConfig.Options[j].KeyName)
				if !optionMap[keyName][strings.TrimSpace(label)] {
					return Product{}, apperr.New(apperr.BadRequest,
						fmt.Sprintf("variant[%d]: label '%s' is not in option '%s'", i, label, keyName))
				}
			}
		}
	}

	if up.IsActive != nil && strings.ToUpper(*up.IsActive) == "YES" && old.ProductType == "STOCK" {
		if in.VariantsConfig == nil {
			// ไม่ได้ส่ง variants_config มา → เช็คว่ามี active variant อยู่แล้ว
			variants, err := s.repo.ListVariants(ctx, productID)
			if err != nil {
				return Product{}, err
			}
			hasActive := false
			for _, v := range variants {
				if v.IsActive {
					hasActive = true
					break
				}
			}
			if !hasActive {
				return Product{}, apperr.New(apperr.BadRequest,
					"STOCK product must have at least 1 active variant before activation")
			}
		} else {
			// ส่ง variants_config มาด้วย → เช็คว่ามี variant อย่างน้อย 1 ตัว
			if len(in.VariantsConfig.Variants) == 0 {
				return Product{}, apperr.New(apperr.BadRequest,
					"STOCK product must have at least 1 variant before activation")
			}
		}
	}

	// re-embed ถ้าจำเป็น
	newName := old.Name
	if up.Name != nil {
		newName = strings.TrimSpace(*up.Name)
	}
	newDesc := old.Description
	if up.Description != nil {
		newDesc = up.Description
	}
	newCatID := old.CategoryID
	if up.CategoryID != nil {
		newCatID = *up.CategoryID
	}

	needEmbed := false
	if up.Name != nil && strings.TrimSpace(old.Name) != strings.TrimSpace(*up.Name) {
		needEmbed = true
	}
	if up.Description != nil {
		oldD := ""
		if old.Description != nil {
			oldD = strings.TrimSpace(*old.Description)
		}
		if strings.TrimSpace(*up.Description) != oldD {
			needEmbed = true
		}
	}
	if up.CategoryID != nil && *up.CategoryID != old.CategoryID {
		needEmbed = true
	}

	var embNamePtr, embDescPtr, embCatPtr *[]float64
	if needEmbed && s.emb != nil {
		catName, err := s.repo.GetCategoryName(ctx, newCatID)
		if err != nil {
			return Product{}, err
		}
		rawName, err := s.emb.Embed(ctx, buildNameText(newName))
		if err != nil {
			return Product{}, apperr.Wrap(apperr.Internal, err, "embed name failed")
		}
		rawDesc, err := s.emb.Embed(ctx, buildDescText(newDesc))
		if err != nil {
			return Product{}, apperr.Wrap(apperr.Internal, err, "embed desc failed")
		}
		rawCat, err := s.emb.Embed(ctx, buildCategoryText(catName))
		if err != nil {
			return Product{}, apperr.Wrap(apperr.Internal, err, "embed category failed")
		}
		embNamePtr = &rawName
		embDescPtr = &rawDesc
		embCatPtr = &rawCat
	}

	return s.repo.UpdateWithVariantsConfig(ctx, productID, UpdateParams{
		Name:        up.Name,
		Description: up.Description,
		Price:       up.Price,
		ImageURL:    up.ImageURL,
		IsActive:    up.IsActive,
		CategoryID:  up.CategoryID,
		EmbName:     embNamePtr,
		EmbDesc:     embDescPtr,
		EmbCategory: embCatPtr,
	}, in.VariantsConfig)
}

func (s *service) SetOptionKeyImageKey(ctx context.Context, keyID int64, productID int64, userID string, isImageKey bool) (OptionKey, error) {
	if keyID <= 0 {
		return OptionKey{}, apperr.New(apperr.BadRequest, "invalid key_id")
	}
	// ownership check ทำที่ handler อยู่แล้ว
	return s.repo.SetOptionKeyImageKey(ctx, keyID, isImageKey)
}

func (s *service) SetOptionValueImage(ctx context.Context, valueID int64, productID int64, userID string, imageURL *string) (OptionValue, error) {
	if valueID <= 0 {
		return OptionValue{}, apperr.New(apperr.BadRequest, "invalid value_id")
	}
	if imageURL != nil {
		u := strings.TrimSpace(*imageURL)
		if u != "" {
			if len(u) > 255 {
				return OptionValue{}, apperr.New(apperr.BadRequest, "image_url must be at most 255 characters")
			}
		}
		imageURL = &u
		if *imageURL == "" {
			imageURL = nil // treat empty string as clear
		}
	}
	return s.repo.SetOptionValueImage(ctx, valueID, imageURL)
}
