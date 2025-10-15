package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/lib/pq"
	_ "github.com/lib/pq"
)

// -----------------------------
// Structs
// -----------------------------

type OllamaEmbedRequest struct {
	Model string `json:"model"`
	Input string `json:"input"`
}

type OllamaEmbedResponse struct {
	Embeddings [][]float64 `json:"embeddings"`
}

type Product struct {
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Price       float64 `json:"price"`
	CategoryID  int     `json:"category_id"`
}

type DBProduct struct {
	ID         int
	Name       string
	Desc       string
	CategoryID int
	Similarity float64
}

// -----------------------------
// Helper Function
// -----------------------------
func getIDs(products []DBProduct) []int {
	ids := make([]int, 0)
	for _, p := range products {
		ids = append(ids, p.ID)
	}
	return ids
}

// -----------------------------
// Main Function
// -----------------------------
func main() {
	// ปรับให้ตรงกับ PostgreSQL ของคุณ
	connStr := "host=localhost port=5433 user=postgres password=postgres/25 dbname=kmall sslmode=disable"
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		panic(err)
	}
	defer db.Close()

	r := gin.Default()

	// -----------------------------
	// /embed — สร้างสินค้าใหม่พร้อม embedding
	// -----------------------------
	r.POST("/embed", func(c *gin.Context) {
		var body Product
		if err := c.BindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}

		// เรียก Ollama เพื่อสร้าง vector
		payload := OllamaEmbedRequest{Model: "nomic-embed-text", Input: body.Description}
		payloadBytes, _ := json.Marshal(payload)
		resp, err := http.Post("http://localhost:11434/api/embed", "application/json", bytes.NewBuffer(payloadBytes))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot connect to Ollama"})
			return
		}
		defer resp.Body.Close()

		respBytes, _ := io.ReadAll(resp.Body)
		var embedResp OllamaEmbedResponse
		if err := json.Unmarshal(respBytes, &embedResp); err != nil {
			fmt.Println("Decode error:", string(respBytes))
			c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot decode response"})
			return
		}

		vectorJSON, _ := json.Marshal(embedResp.Embeddings[0])

		// บันทึกลง DB
		_, err = db.Exec(`
			INSERT INTO products (name, product_desc, price, category_id, embedding)
			VALUES ($1, $2, $3, $4, $5::vector)
		`, body.Name, body.Description, body.Price, body.CategoryID, string(vectorJSON))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message":     "product inserted successfully",
			"name":        body.Name,
			"vector_size": len(embedResp.Embeddings[0]),
		})
	})

	// -----------------------------
	// /recommend — แนะนำสินค้า
	// -----------------------------
	r.POST("/recommend", func(c *gin.Context) {
		var body struct {
			Query string `json:"query"`
		}
		if err := c.BindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}

		// 1️ สร้าง embedding ของ query
		payload := OllamaEmbedRequest{Model: "nomic-embed-text", Input: body.Query}
		payloadBytes, _ := json.Marshal(payload)
		resp, err := http.Post("http://localhost:11434/api/embed", "application/json", bytes.NewBuffer(payloadBytes))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot connect to Ollama"})
			return
		}
		defer resp.Body.Close()

		respBytes, _ := io.ReadAll(resp.Body)
		var embedResp OllamaEmbedResponse
		json.Unmarshal(respBytes, &embedResp)
		vectorJSON, _ := json.Marshal(embedResp.Embeddings[0])

		// 2️ ดึงสินค้าทั้งหมดพร้อม similarity
		rows, err := db.Query(`
		SELECT p.product_id, p.name, p.product_desc, p.category_id,
			   1 - (p.embedding <=> $1::vector) AS similarity
		FROM products p
		ORDER BY similarity DESC
	`, string(vectorJSON))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var allProducts []DBProduct
		for rows.Next() {
			var p DBProduct
			rows.Scan(&p.ID, &p.Name, &p.Desc, &p.CategoryID, &p.Similarity)
			allProducts = append(allProducts, p)
		}

		// 3️ เงื่อนไข: similarity ≥ 0.5 (ไม่ซ้ำหมวด)
		chosen := make([]DBProduct, 0)
		usedCats := map[int]bool{}
		for _, p := range allProducts {
			if p.Similarity >= 0.5 && !usedCats[p.CategoryID] {
				chosen = append(chosen, p)
				usedCats[p.CategoryID] = true
				if len(chosen) == 3 {
					break
				}
			}
		}

		// 4️ Fallback: ถ้า similarity < 3 → เติมสินค้าขายดีจาก order_items
		if len(chosen) < 3 {
			rows2, err := db.Query(`
			SELECT 
				p.product_id,
				p.name,
				p.product_desc,
				p.category_id,
				COALESCE(SUM(oi.quantity), 0) AS total_sold
			FROM products p
			JOIN order_items oi ON p.product_id = oi.store_id
			JOIN orders o ON oi.order_id = o.order_id
			WHERE o.status = 'Completed'
			  AND p.category_id NOT IN (
				  SELECT category_id FROM products WHERE product_id = ANY($1)
			  )
			GROUP BY p.product_id, p.name, p.product_desc, p.category_id
			ORDER BY total_sold DESC
			LIMIT $2
		`, pq.Array(getIDs(chosen)), 3-len(chosen))
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			defer rows2.Close()

			for rows2.Next() {
				var p DBProduct
				rows2.Scan(&p.ID, &p.Name, &p.Desc, &p.CategoryID)
				if !usedCats[p.CategoryID] {
					chosen = append(chosen, p)
					usedCats[p.CategoryID] = true
					if len(chosen) == 3 {
						break
					}
				}
			}
		}

		// 5️ ส่งผลลัพธ์กลับ
		c.JSON(http.StatusOK, gin.H{
			"query":           body.Query,
			"recommendations": chosen,
		})
	})

	// -----------------------------
	// /search — Realtime Semantic Autocomplete
	// -----------------------------
	r.GET("/search", func(c *gin.Context) {
		// ดึงค่าจาก query parameter q
		query := c.DefaultQuery("q", "")
		if query == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "missing query"})
			return
		}

		// 🔹 เรียก Ollama เพื่อสร้าง embedding ของข้อความที่ผู้ใช้พิมพ์
		payload := OllamaEmbedRequest{
			Model: "nomic-embed-text",
			Input: query,
		}
		payloadBytes, _ := json.Marshal(payload)
		resp, err := http.Post("http://localhost:11434/api/embed", "application/json", bytes.NewBuffer(payloadBytes))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot connect to Ollama"})
			return
		}
		defer resp.Body.Close()

		respBytes, _ := io.ReadAll(resp.Body)
		var embedResp OllamaEmbedResponse
		if err := json.Unmarshal(respBytes, &embedResp); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot decode embedding response"})
			return
		}
		vectorJSON, _ := json.Marshal(embedResp.Embeddings[0])

		// 🔹 ค้นหาสินค้าที่ใกล้เคียงที่สุด (semantic similarity)
		rows, err := db.Query(`
        SELECT p.product_id, p.name, p.product_desc, 
               1 - (p.embedding <=> $1::vector) AS similarity
        FROM products p
        ORDER BY similarity DESC
        LIMIT 5
    `, string(vectorJSON))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var results []DBProduct
		for rows.Next() {
			var p DBProduct
			rows.Scan(&p.ID, &p.Name, &p.Desc, &p.Similarity)
			results = append(results, p)
		}

		// 🔹 ส่งผลลัพธ์กลับ
		c.JSON(http.StatusOK, gin.H{
			"query":  query,
			"result": results,
		})
	})

	// -----------------------------
	// Run Server
	// -----------------------------
	r.Run(":8080")
}
