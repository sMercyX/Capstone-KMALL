package filestore

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"

	apperr "github.com/Perpasit/Capstone-KMALL/internal/apperr"
)

type LocalStore struct {
	BaseDir string // เช่น "./uploads"
	BaseURL string // เช่น "/uploads"
}

func NewLocalStore(baseDir, baseURL string) *LocalStore {
	return &LocalStore{BaseDir: baseDir, BaseURL: baseURL}
}

func (s *LocalStore) Save(ctx context.Context, keyPrefix string, fh *multipart.FileHeader) (UploadedFile, error) {
	_ = ctx // local save ไม่ได้ใช้ ctx โดยตรง

	if fh == nil {
		return UploadedFile{}, apperr.New(apperr.BadRequest, "file is required")
	}

	// sanitize prefix กัน path traversal
	keyPrefix = strings.TrimSpace(keyPrefix)
	keyPrefix = strings.TrimPrefix(keyPrefix, "/")
	keyPrefix = filepath.Clean(keyPrefix)
	if keyPrefix == "." || strings.HasPrefix(keyPrefix, "..") {
		return UploadedFile{}, apperr.New(apperr.BadRequest, "invalid keyPrefix")
	}

	src, err := fh.Open()
	if err != nil {
		return UploadedFile{}, apperr.Wrap(apperr.BadRequest, err, "open upload failed")
	}
	defer src.Close()

	// gen random name + keep ext
	ext := strings.ToLower(filepath.Ext(fh.Filename))
	if ext == "" {
		ext = ".bin"
	}
	rnd := make([]byte, 16)
	_, _ = rand.Read(rnd)
	name := hex.EncodeToString(rnd) + ext

	// ensure dir
	dir := filepath.Join(s.BaseDir, keyPrefix)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return UploadedFile{}, apperr.Wrap(apperr.Internal, err, "mkdir failed")
	}

	dstPath := filepath.Join(dir, name)
	dst, err := os.Create(dstPath)
	if err != nil {
		return UploadedFile{}, apperr.Wrap(apperr.Internal, err, "create file failed")
	}
	defer dst.Close()

	n, err := io.Copy(dst, src)
	if err != nil {
		return UploadedFile{}, apperr.Wrap(apperr.Internal, err, "save file failed")
	}

	ct := strings.TrimSpace(fh.Header.Get("Content-Type"))
	if ct == "" {
		ct = "application/octet-stream"
	}

	url := strings.TrimRight(s.BaseURL, "/") + "/" + strings.TrimPrefix(filepath.ToSlash(filepath.Join(keyPrefix, name)), "/")

	return UploadedFile{
		URL:      url,
		FileName: fh.Filename,
		MimeType: ct,
		Size:     n,
		SHA256:   nil, // ถ้าจะทำ hash ค่อยเพิ่มทีหลัง
	}, nil
}
