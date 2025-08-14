package apperr


import (
	"context"
	"errors"
	"fmt"
)

type Code string

const (
	BadRequest   Code = "BAD_REQUEST"
	Unauthorized Code = "UNAUTHORIZED"
	Forbidden    Code = "FORBIDDEN"
	NotFound     Code = "NOT_FOUND"
	Conflict     Code = "CONFLICT"
	Timeout      Code = "TIMEOUT"
	Internal     Code = "INTERNAL"
)

var defaultMsg = map[Code]string{
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

func HTTPStatus(code Code) int {
	switch code {
	case BadRequest:
		return 400
	case Unauthorized:
		return 401
	case Forbidden:
		return 403
	case NotFound:
		return 404
	case Conflict:
		return 409
	case Timeout:
		return 504 
	default:
		return 500
	}
}
