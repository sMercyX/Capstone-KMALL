package recommendation

import (
	"context"
	"strings"
	"time"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
)

type Service interface {
	GetOrderRecommendations(ctx context.Context, userID string, orderID int64, context string, limit int) (OrderRecommendationsResponse, error)
	GetHomeRecommendations(ctx context.Context, userID string, perSection int) (HomeRecommendationsResponse, error)
}

type service struct {
	repo Repo
}

func NewService(r Repo) Service {
	return &service{repo: r}
}

func clamp(v, def, max int) int {
	if v <= 0 {
		v = def
	}
	if v > max {
		v = max
	}
	return v
}

func (s *service) GetOrderRecommendations(
	ctx context.Context,
	userID string,
	orderID int64,
	context string,
	limit int,
) (OrderRecommendationsResponse, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return OrderRecommendationsResponse{}, apperr.New(apperr.BadRequest, "user_id is required")
	}
	if orderID <= 0 {
		return OrderRecommendationsResponse{}, apperr.New(apperr.BadRequest, "invalid order_id")
	}

	context = strings.TrimSpace(strings.ToLower(context))
	if context == "" {
		context = string(ContextCancellation)
	}
	if context != string(ContextCancellation) {
		return OrderRecommendationsResponse{}, apperr.New(apperr.BadRequest, "invalid context (use cancellation)")
	}

	limit = clamp(limit, 12, 30)

	// 1) snapshot-first
	latest, err := s.repo.GetLatestOrderEvent(ctx, userID, orderID, TriggerOrderCancelled)
	if err != nil {
		return OrderRecommendationsResponse{}, err
	}

	now := time.Now()

	if latest != nil {
		items, err := s.repo.ListEventItemsDetailed(ctx, latest.ID, limit)
		if err != nil {
			return OrderRecommendationsResponse{}, err
		}

		return OrderRecommendationsResponse{
			OrderID:     orderID,
			Context:     Context(context),
			Items:       items,
			Source:      "snapshot",
			EventID:     latest.ID,
			CreatedAt:   latest.CreatedAt,
			GeneratedAt: now,
		}, nil
	}

	eventID, createdAt, items, err :=
		s.repo.BuildOrderCancelledSnapshot(ctx, userID, orderID, limit)
	if err != nil {
		return OrderRecommendationsResponse{}, err
	}

	return OrderRecommendationsResponse{
		OrderID:     orderID,
		Context:     Context(context),
		Items:       items,
		Source:      "snapshot",
		EventID:     eventID,
		CreatedAt:   createdAt,
		GeneratedAt: now,
	}, nil
}

func (s *service) GetHomeRecommendations(ctx context.Context, userID string, perSection int) (HomeRecommendationsResponse, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return HomeRecommendationsResponse{}, apperr.New(apperr.BadRequest, "user_id is required")
	}
	perSection = clamp(perSection, 12, 30)
	return s.repo.BuildHome(ctx, userID, perSection)
}
