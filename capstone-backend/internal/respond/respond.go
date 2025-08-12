package respond

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func OK(c *gin.Context, data any) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    data,
	})
}

func Error(c *gin.Context, status int, code, message string, fields map[string]any) {
	errObj := gin.H{
		"status":  status,
		"code":    code,
		"message": message,
	}
	if len(fields) > 0 {
		errObj["fields"] = fields
	}

	body := gin.H{
		"success": false,
		"error":   errObj,
	}
	if rid, ok := c.Get("request_id"); ok {
		body["request_id"] = rid
	}

	c.JSON(status, body)
}
