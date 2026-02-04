package embedding

import (
	"context"
	"time"
)

type Client interface {
	Embed(ctx context.Context, text string) ([]float64, error)
}

type Config struct {
	BaseURL string // docker-compose network: http://ollama:11434
	Model   string // "nomic-embed-text"
	Dim     int    // vector(768)
	Timeout time.Duration
}
