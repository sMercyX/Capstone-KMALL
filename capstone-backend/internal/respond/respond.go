package respond

import (
	"net/http"

	"github.com/Perpasit/Capstone-KMALL/internal/apperr"

	"github.com/gin-gonic/gin"
)

// func OK(c *gin.Context, data any) {
// 	c.JSON(http.StatusOK, gin.H{
// 		"success": true,
// 		"data":    data,
// 	})
// }

func OK(c *gin.Context, code apperr.Code, data any) {
	c.JSON(apperr.HTTPStatus(code), gin.H{
		"status": code,
		"code":   apperr.HTTPStatus(code),
		"data":   data,
	})
}

func Created(c *gin.Context, code apperr.Code, data any) {
	status := apperr.HTTPStatus(code)
	if status == 0 {
		status = http.StatusCreated
	}
	c.JSON(status, gin.H{
		"status":  code,
		"code":    status,
		"created": true,
		"data":    data,
	})
}

func Updated(c *gin.Context, code apperr.Code, data any) {
	status := apperr.HTTPStatus(code)
	c.JSON(status, gin.H{
		"status":  code,
		"code":    status,
		"updated": true,
		"data":    data,
	})
}

func Deleted(c *gin.Context, code apperr.Code, data any) {
	c.JSON(apperr.HTTPStatus(code), gin.H{
		"status": code,
		"code":   apperr.HTTPStatus(code),
		"data":   data,
	})
}

func Error(c *gin.Context, httpStatus int, code, message string, fields map[string]any) {
	body := gin.H{
		"status":  code,
		"code":    httpStatus,
		"message": message,
	}
	if len(fields) > 0 {
		body["fields"] = fields
	}
	if rid, ok := c.Get("request_id"); ok {
		body["request_id"] = rid
	}
	c.JSON(httpStatus, body)
}
