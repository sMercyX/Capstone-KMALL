package filestore

import (
	"context"
	"mime/multipart"
)

type UploadedFile struct {
	URL      string
	FileName string
	MimeType string
	Size     int64
	SHA256   *string
}

type Store interface {
	Save(ctx context.Context, keyPrefix string, fh *multipart.FileHeader) (UploadedFile, error)
	Delete(ctx context.Context, fileURL string) error
}
