package embedding

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type ollamaClient struct {
	baseURL string
	model   string
	dim     int
	http    *http.Client
}

func NewOllama(cfg Config) Client {
	base := strings.TrimSpace(cfg.BaseURL)
	base = strings.TrimRight(base, "/")

	timeout := cfg.Timeout
	if timeout <= 0 {
		timeout = 8 * time.Second
	}

	return &ollamaClient{
		baseURL: base,
		model:   strings.TrimSpace(cfg.Model),
		dim:     cfg.Dim,
		http: &http.Client{
			Timeout: timeout,
		},
	}
}

func (c *ollamaClient) Embed(ctx context.Context, text string) ([]float64, error) {
	if strings.TrimSpace(c.baseURL) == "" {
		return nil, fmt.Errorf("embedding baseURL is empty")
	}
	if strings.TrimSpace(c.model) == "" {
		return nil, fmt.Errorf("embedding model is empty")
	}

	text = strings.TrimSpace(text)
	if text == "" {
		return nil, fmt.Errorf("embed text is empty")
	}

	payload := ollamaEmbedRequest{
		Model: c.model,
		Input: text,
	}

	b, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/api/embed", bytes.NewBuffer(b))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	res, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	raw, _ := io.ReadAll(res.Body)

	// Non-2xx => return error with body (useful when model not found, etc.)
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return nil, fmt.Errorf("ollama embed failed: status=%d body=%s", res.StatusCode, string(raw))
	}

	var out ollamaEmbedResponse
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}

	if len(out.Embeddings) == 0 || len(out.Embeddings[0]) == 0 {
		return nil, fmt.Errorf("ollama embed empty embeddings")
	}

	vec := out.Embeddings[0]
	if c.dim > 0 && len(vec) != c.dim {
		return nil, fmt.Errorf("embedding dimension mismatch: got=%d want=%d", len(vec), c.dim)
	}

	return vec, nil
}
