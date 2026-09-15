package storage

import (
	"context"
	"errors"
	"io"
)

// fallbackStore ghi vào một nơi, nhưng khi đọc thì thử nơi đó trước rồi mới
// tìm ở nơi cũ.
//
// Có mặt để bật S3 trên một hệ thống đang chạy không phải chuyển hết file cũ
// trước: file mới lên S3, file cũ vẫn phục vụ được từ đĩa, việc chuyển làm sau
// lúc nào cũng được.
type fallbackStore struct {
	primary  Store
	fallback Store
}

// NewWithFallback ghép hai store lại: ghi vào primary, đọc thì primary trước,
// không có thì tìm trong fallback.
func NewWithFallback(primary, fallback Store) Store {
	return &fallbackStore{primary: primary, fallback: fallback}
}

func (f *fallbackStore) Kind() string { return f.primary.Kind() + "+" + f.fallback.Kind() }

func (f *fallbackStore) Put(ctx context.Context, key string, r io.Reader, size int64, contentType string) error {
	return f.primary.Put(ctx, key, r, size, contentType)
}

func (f *fallbackStore) Get(ctx context.Context, key string) (io.ReadCloser, string, int64, error) {
	body, ct, size, err := f.primary.Get(ctx, key)
	if err == nil {
		return body, ct, size, nil
	}
	if !errors.Is(err, ErrNotFound) {
		return nil, "", 0, err
	}
	return f.fallback.Get(ctx, key)
}

func (f *fallbackStore) Exists(ctx context.Context, key string) (bool, error) {
	ok, err := f.primary.Exists(ctx, key)
	if err != nil || ok {
		return ok, err
	}
	return f.fallback.Exists(ctx, key)
}

func (f *fallbackStore) Stat(ctx context.Context, key string) (int64, error) {
	size, err := f.primary.Stat(ctx, key)
	if err == nil {
		return size, nil
	}
	if !errors.Is(err, ErrNotFound) {
		return 0, err
	}
	return f.fallback.Stat(ctx, key)
}

// List gộp danh sách của cả hai nơi, mỗi khoá chỉ báo một lần.
func (f *fallbackStore) List(ctx context.Context, prefix string, fn func(key string, size int64) error) error {
	daThay := map[string]bool{}
	wrap := func(key string, size int64) error {
		if daThay[key] {
			return nil
		}
		daThay[key] = true
		return fn(key, size)
	}
	if err := f.primary.List(ctx, prefix, wrap); err != nil {
		return err
	}
	return f.fallback.List(ctx, prefix, wrap)
}

// Delete xoá ở cả hai nơi: gọi Delete là muốn file biến mất hẳn, còn sót bản
// trên đĩa thì đường đọc dự phòng sẽ moi nó lên lại.
func (f *fallbackStore) Delete(ctx context.Context, key string) error {
	errPrimary := f.primary.Delete(ctx, key)
	errFallback := f.fallback.Delete(ctx, key)
	if errPrimary != nil {
		return errPrimary
	}
	return errFallback
}

// Primary, Fallback để lệnh chuyển file lấy ra từng nơi mà làm việc trực tiếp.
func (f *fallbackStore) Primary() Store  { return f.primary }
func (f *fallbackStore) Fallback() Store { return f.fallback }
