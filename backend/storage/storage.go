// Package storage cất file đính kèm của cuộc chat. Có hai nơi cất: đĩa của máy
// chủ, hoặc một dịch vụ tương thích S3.
//
// Khoá (key) của file giữ nguyên đường dẫn tương đối vẫn dùng từ trước —
// "<tenant>/<cuộc chat>/<tên file>" — nên chuyển sang S3 không phải đụng vào
// dữ liệu đã lưu trong database.
package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strings"
)

// ErrNotFound: không có file ứng với khoá đó.
var ErrNotFound = errors.New("storage: không tìm thấy file")

// Store là nơi cất file. Mọi khoá đều là đường dẫn tương đối, không bắt đầu
// bằng "/" và không chứa "..".
type Store interface {
	// Put cất file. size là -1 khi chưa biết trước độ dài.
	Put(ctx context.Context, key string, r io.Reader, size int64, contentType string) error

	// Get đọc file. Trả về ErrNotFound nếu không có.
	Get(ctx context.Context, key string) (body io.ReadCloser, contentType string, size int64, err error)

	Exists(ctx context.Context, key string) (bool, error)

	// Stat cho biết dung lượng file. Trả ErrNotFound nếu không có.
	Stat(ctx context.Context, key string) (size int64, err error)

	Delete(ctx context.Context, key string) error

	// Kind dùng cho log và thông báo, ví dụ "local" hoặc "s3".
	Kind() string
}

// Config là những gì cần để dựng một Store. Tách khỏi config.Config để package
// này không phụ thuộc ngược lại phần cấu hình chung.
type Config struct {
	Backend string // "local" | "s3"
	BaseDir string // cho local

	S3Endpoint       string
	S3Bucket         string
	S3Region         string
	S3AccessKey      string
	S3SecretKey      string
	S3Prefix         string
	S3ForcePathStyle bool
}

// New dựng Store theo cấu hình.
//
// Với backend s3, file cũ vẫn nằm trên đĩa nên Store trả về sẽ ghi lên S3
// nhưng khi đọc thì thử S3 trước rồi mới tìm trên đĩa. Nhờ vậy bật S3 lên là
// chạy được ngay, không cần chuyển hết file cũ trước.
func New(cfg Config) (Store, error) {
	local, err := NewLocal(cfg.BaseDir)
	if err != nil {
		return nil, err
	}

	switch strings.ToLower(strings.TrimSpace(cfg.Backend)) {
	case "", "local":
		return local, nil
	case "s3":
		s3, err := NewS3(cfg)
		if err != nil {
			return nil, err
		}
		return NewWithFallback(s3, local), nil
	default:
		return nil, fmt.Errorf("storage: STORAGE_BACKEND không hợp lệ: %q (chỉ nhận local hoặc s3)", cfg.Backend)
	}
}

// validKey chặn khoá có thể trỏ ra ngoài vùng lưu trữ. Tên file đến từ API của
// Zalo và Facebook nên không được tin.
func validKey(key string) error {
	if key == "" {
		return errors.New("storage: khoá rỗng")
	}
	if strings.HasPrefix(key, "/") || strings.Contains(key, "\\") {
		return fmt.Errorf("storage: khoá không hợp lệ: %q", key)
	}
	for _, part := range strings.Split(key, "/") {
		if part == ".." {
			return fmt.Errorf("storage: khoá không hợp lệ: %q", key)
		}
	}
	return nil
}

