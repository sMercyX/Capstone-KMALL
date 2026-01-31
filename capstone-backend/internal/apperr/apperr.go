package apperr

import (
	"context"
	"errors"
	"fmt"
	"net/http"
)

type Code string

const (
	// Success
	OK      Code = "OK"
	Created Code = "CREATED"
	Updated Code = "UPDATED"
	Deleted Code = "DELETED"

	// Client / Server errors
	BadRequest   Code = "BAD_REQUEST"
	Unauthorized Code = "UNAUTHORIZED"
	Forbidden    Code = "FORBIDDEN"
	NotFound     Code = "NOT_FOUND"
	Conflict     Code = "CONFLICT"
	Timeout      Code = "TIMEOUT"
	Internal     Code = "INTERNAL"
)

var defaultMsg = map[Code]string{
	// Success
	OK:      "ok",
	Created: "created",
	Updated: "updated",
	Deleted: "deleted",

	// Error
	BadRequest:   "bad request",
	Unauthorized: "unauthorized",
	Forbidden:    "forbidden",
	NotFound:     "not found",
	Conflict:     "conflict",
	Timeout:      "request timeout",
	Internal:     "internal error",
}

type AppError struct {
	Code   Code
	Msg    string
	Cause  error
	Fields map[string]any
}

func (e *AppError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("%s: %s: %v", e.Code, e.Msg, e.Cause)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Msg)
}

func New(code Code, msg ...string) *AppError {
	m := defaultMsg[code]
	if len(msg) > 0 && msg[0] != "" {
		m = msg[0]
	}
	return &AppError{Code: code, Msg: m}
}

func Newf(code Code, format string, args ...any) *AppError {
	return &AppError{Code: code, Msg: fmt.Sprintf(format, args...)}
}

func Wrap(code Code, cause error, msg ...string) *AppError {
	m := defaultMsg[code]
	if len(msg) > 0 && msg[0] != "" {
		m = msg[0]
	}
	return &AppError{Code: code, Msg: m, Cause: cause}
}

func Wrapf(code Code, cause error, format string, args ...any) *AppError {
	return &AppError{Code: code, Msg: fmt.Sprintf(format, args...), Cause: cause}
}

func WithFields(e *AppError, fields map[string]any) *AppError {
	e.Fields = fields
	return e
}

func From(err error) *AppError {
	if err == nil {
		return nil
	}

	var ae *AppError
	if errors.As(err, &ae) {
		return ae
	}

	if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
		return &AppError{Code: Timeout, Msg: defaultMsg[Timeout], Cause: err}
	}

	return &AppError{Code: Internal, Msg: defaultMsg[Internal], Cause: err}
}

func Is(err error, code Code) bool {
	if err == nil {
		return false
	}
	var ae *AppError
	if errors.As(err, &ae) {
		return ae.Code == code
	}
	return false
}

func HTTPStatus(code Code) int {
	switch code {
	// Success
	case OK, Updated:
		return http.StatusOK
	case Created:
		return http.StatusCreated
	case Deleted:
		return http.StatusOK

	// Client/Server errors
	case BadRequest:
		return http.StatusBadRequest
	case Unauthorized:
		return http.StatusUnauthorized
	case Forbidden:
		return http.StatusForbidden
	case NotFound:
		return http.StatusNotFound
	case Conflict:
		return http.StatusConflict
	case Timeout:
		return http.StatusGatewayTimeout
	default:
		return http.StatusInternalServerError
	}
}
