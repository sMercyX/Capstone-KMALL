package store

import (
	"context"
	"log"
	"net/url"
	"strings"
	"time"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
	"github.com/Perpasit/Capstone-KMALL/internal/user"
)

// ===== Service DTO =====

type CreateInput struct {
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
	ProfileURL  *string `json:"profile_url,omitempty"`
	IsActive    string  `json:"is_active,omitempty"` // "YES" | "NO"
}

type UpdateInput struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	ProfileURL  *string `json:"profile_url,omitempty"`
	IsActive    *string `json:"is_active,omitempty"` // "YES" | "NO"

	DeliveryRoundUniversityEnabled *bool    `json:"delivery_round_university_enabled,omitempty"`
	RoundUniBaseFee                *float64 `json:"round_uni_base_fee,omitempty"`
}

type BanProvider interface {
	ListActiveBans(ctx context.Context, userID string) ([]BanInfo, error)
}

type BanInfo struct {
	UserRole    string // BUYER / SELLER
	BanType     string // WARNING / TEMPORARY / PERMANENT
	IsActive    bool
	Reason      string
	BannedUntil *time.Time
}

type OrderCanceller interface {
	CancelOrdersByStore(ctx context.Context, actorUserID string, storeID int64, reason string) ([]int64, error)
	CancelOrdersByUserRole(ctx context.Context, actorUserID string, userID, role, reason string) ([]int64, error)
}

// ===== Service Interface =====

type Service interface {
	Create(ctx context.Context, userID string, in CreateInput) (Store, error)
	Get(ctx context.Context, id int64) (Store, error)
	Me(ctx context.Context, userID string) (Store, error)
	List(ctx context.Context, q string, limit, page int) ([]Store, error)
	Update(ctx context.Context, id int64, in UpdateInput) (Store, error)
	Delete(ctx context.Context, id int64) error
	DeleteByAdmin(ctx context.Context, id int64) error
	ForceCloseByAdmin(ctx context.Context, actorUserID string, storeID int64, reason string) error
	SetOrderCanceller(oc OrderCanceller)
}

type service struct {
	repo     Repo
	userSvc  user.Service
	userRepo user.Repo
	banSvc   BanProvider
	orderSvc OrderCanceller
}

func NewService(r Repo, us user.Service, ur user.Repo, ban BanProvider) Service {
	return &service{
		repo: r, userSvc: us, userRepo: ur, banSvc: ban,
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
	t := strings.TrimSpace(*p)
	return &t
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

	in.ProfileURL = trimPtr(in.ProfileURL)
	if in.ProfileURL != nil && *in.ProfileURL != "" {
		if len(*in.ProfileURL) > 255 {
			return apperr.New(apperr.BadRequest, "profile_url must be at most 255 characters")
		}
		if _, err := url.ParseRequestURI(*in.ProfileURL); err != nil {
			return apperr.New(apperr.BadRequest, "profile_url is not a valid URL")
		}
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

	if in.ProfileURL != nil {
		u := strings.TrimSpace(*in.ProfileURL)
		if u != "" {
			if len(u) > 255 {
				return apperr.New(apperr.BadRequest, "profile_url must be at most 255 characters")
			}
			if _, err := url.ParseRequestURI(u); err != nil {
				return apperr.New(apperr.BadRequest, "profile_url is not a valid URL")
			}
		}
		*in.ProfileURL = u
	}

	if in.IsActive != nil {
		v := strings.TrimSpace(strings.ToUpper(*in.IsActive))
		if v != "YES" && v != "NO" {
			return apperr.New(apperr.BadRequest, "is_active must be YES or NO")
		}
		*in.IsActive = v
	}
	return nil
}

// ===== Service Impl =====

func (s *service) Create(ctx context.Context, userID string, in CreateInput) (Store, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return Store{}, apperr.New(apperr.BadRequest, "user_id is required")
	}

	if b, err := s.getBlockingSellerBan(ctx, userID); err != nil {
		return Store{}, err
	} else if b != nil {
		if strings.EqualFold(b.BanType, "TEMPORARY") {
			return Store{}, apperr.New(apperr.Forbidden, "seller is suspended, cannot create store")
		}
		if strings.EqualFold(b.BanType, "PERMANENT") {
			return Store{}, apperr.New(apperr.Forbidden, "seller is banned, cannot create store")
		}
	}

	if err := validateCreate(&in); err != nil {
		return Store{}, err
	}

	if _, err := s.repo.GetByUserID(ctx, userID); err == nil {
		return Store{}, apperr.New(apperr.Conflict, "user already owns a store")
	} else if apperr.From(err).Code != apperr.NotFound {
		return Store{}, apperr.Wrap(apperr.Internal, err, "check existing store failed")
	}

	st, err := s.repo.Create(ctx, userID, CreateParams(in))
	if err != nil {
		return Store{}, err
	}

	if err := s.userSvc.AddRoles(ctx, userID, []string{"Seller"}); err != nil {
		return Store{}, apperr.Wrap(apperr.Internal, err, "store created but failed to assign Seller role")
	}

	return st, nil
}

func (s *service) Get(ctx context.Context, id int64) (Store, error) {
	if id <= 0 {
		return Store{}, apperr.New(apperr.BadRequest, "invalid id")
	}
	return s.repo.Get(ctx, id)
}

func (s *service) Me(ctx context.Context, userID string) (Store, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return Store{}, apperr.New(apperr.BadRequest, "user_id is required")
	}
	return s.repo.GetByUserID(ctx, userID)
}

func (s *service) List(ctx context.Context, q string, limit, page int) ([]Store, error) {
	q = strings.TrimSpace(q)
	if limit <= 0 {
		limit = 10
	}
	if page <= 0 {
		page = 1
	}
	return s.repo.List(ctx, q, limit, page)
}

func (s *service) Update(ctx context.Context, id int64, in UpdateInput) (Store, error) {
	if id <= 0 {
		return Store{}, apperr.New(apperr.BadRequest, "invalid id")
	}

	st, err := s.repo.Get(ctx, id)
	if err != nil {
		return Store{}, err
	}

	if b, err := s.getBlockingSellerBan(ctx, st.UserID.String()); err != nil {
		return Store{}, err
	} else if b != nil {
		if strings.EqualFold(b.BanType, "TEMPORARY") {
			if strings.EqualFold(st.IsActive, "YES") {
				s.forceCloseStore(ctx, st.UserID.String(), id, "AUTO_CANCELLED_DUE_TO_STORE_SUSPENDED")
			}
			return Store{}, apperr.New(apperr.Forbidden, "seller is suspended, store cannot be updated")
		}
		if strings.EqualFold(b.BanType, "PERMANENT") {
			return Store{}, apperr.New(apperr.Forbidden, "seller is banned, store cannot be updated")
		}
	}

	if err := validateUpdate(&in); err != nil {
		return Store{}, err
	}

	params := UpdateParams{
		Name:        in.Name,
		Description: in.Description,
		ProfileURL:  in.ProfileURL,
		IsActive:    in.IsActive,

		DeliveryRoundUniversityEnabled: in.DeliveryRoundUniversityEnabled,
		RoundUniBaseFee:                in.RoundUniBaseFee,
	}

	return s.repo.Update(ctx, id, params)
}

func (s *service) Delete(ctx context.Context, id int64) error {
	st, err := s.repo.Get(ctx, id)
	if err != nil {
		return err
	}

	if b, err := s.getBlockingSellerBan(ctx, st.UserID.String()); err != nil {
		return err
	} else if b != nil {
		if strings.EqualFold(b.BanType, "TEMPORARY") {
			if strings.EqualFold(st.IsActive, "YES") {
				s.forceCloseStore(ctx, st.UserID.String(), id, "AUTO_CANCELLED_DUE_TO_STORE_SUSPENDED")
			}
			return apperr.New(apperr.Forbidden, "seller is suspended, cannot delete store")
		}
		if strings.EqualFold(b.BanType, "PERMANENT") {
			return apperr.New(apperr.Forbidden, "seller is banned, cannot delete store")
		}
	}

	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}

	sellerRoleID := int64(2)
	if err := s.userRepo.RemoveUserRoles(ctx, st.UserID.String(), []int64{sellerRoleID}); err != nil {
		return err
	}

	return nil
}

func (s *service) getBlockingSellerBan(ctx context.Context, userID string) (*BanInfo, error) {
	if s.banSvc == nil {
		return nil, nil
	}

	bans, err := s.banSvc.ListActiveBans(ctx, userID)
	if err != nil {
		if apperr.Is(err, apperr.NotFound) {
			return nil, nil
		}
		return nil, err
	}

	for i := range bans {
		b := bans[i]
		if !b.IsActive {
			continue
		}
		if !strings.EqualFold(strings.TrimSpace(b.UserRole), "SELLER") {
			continue
		}
		if strings.EqualFold(strings.TrimSpace(b.BanType), "WARNING") {
			continue
		}
		if strings.EqualFold(b.BanType, "TEMPORARY") || strings.EqualFold(b.BanType, "PERMANENT") {
			return &b, nil
		}
	}
	return nil, nil
}

func (s *service) DeleteByAdmin(ctx context.Context, id int64) error {
	if id <= 0 {
		return apperr.New(apperr.BadRequest, "invalid id")
	}

	st, err := s.repo.Get(ctx, id)
	if err != nil {
		return err
	}

	if s.orderSvc != nil {
		ids, err := s.orderSvc.CancelOrdersByStore(ctx, "SYSTEM", id, "AUTO_CANCELLED_DUE_TO_STORE_DELETED")
		log.Printf("[STORE] delete store=%d cancel_count=%d err=%v", id, len(ids), err)
	}

	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}

	sellerRoleID := int64(2)
	_ = s.userRepo.RemoveUserRoles(ctx, st.UserID.String(), []int64{sellerRoleID})

	return nil
}

func (s *service) forceCloseStore(ctx context.Context, actorUserID string, storeID int64, reason string) {
	actorUserID = strings.TrimSpace(actorUserID)
	if actorUserID == "" {
		actorUserID = "SYSTEM"
	}

	// 1) close store
	no := "NO"
	_, _ = s.repo.Update(ctx, storeID, UpdateParams{IsActive: &no})

	// 2) cancel active orders (best effort)
	if s.orderSvc != nil {
		ids, err := s.orderSvc.CancelOrdersByStore(ctx, actorUserID, storeID, reason)
		log.Printf("[STORE] force close store=%d actor=%s cancel_count=%d err=%v reason=%s",
			storeID, actorUserID, len(ids), err, reason)
	} else {
		log.Printf("[STORE] force close store=%d actor=%s skip cancel: orderSvc=nil reason=%s",
			storeID, actorUserID, reason)
	}
}

func (s *service) ForceCloseByAdmin(ctx context.Context, actorUserID string, storeID int64, reason string) error {
	actorUserID = strings.TrimSpace(actorUserID)
	reason = strings.TrimSpace(reason)

	if actorUserID == "" {
		return apperr.New(apperr.BadRequest, "invalid actor_user_id")
	}
	if storeID <= 0 {
		return apperr.New(apperr.BadRequest, "invalid store_id")
	}
	if reason == "" {
		return apperr.New(apperr.BadRequest, "reason is required")
	}

	st, err := s.repo.Get(ctx, storeID)
	if err != nil {
		return err
	}

	if strings.EqualFold(st.IsActive, "YES") {
		s.forceCloseStore(ctx, actorUserID, storeID, reason)
	}

	return nil
}

func (s *service) SetOrderCanceller(oc OrderCanceller) {
	s.orderSvc = oc
}
