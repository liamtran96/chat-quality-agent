package storage

import (
	"context"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
)

// Usage là số liệu file đang nằm trên đĩa máy chủ của một công ty.
type Usage struct {
	Bytes int64
	Files int64
	// Partial báo rằng việc đếm bị cắt giữa chừng vì quá hạn, nên hai con số
	// trên chỉ là phần đếm được. Thà nói rõ còn hơn đưa số thiếu mà im lặng.
	Partial bool
}

// LocalUsage đếm dung lượng và số file trên đĩa của một công ty.
//
// Khoá file có dạng "<công ty>/<cuộc chat>/<tên file>" nên chỉ cần duyệt thư
// mục mang tên công ty. Công ty chưa có file nào thì trả về số không, không
// phải lỗi.
func LocalUsage(ctx context.Context, baseDir, tenantID string) (Usage, error) {
	var u Usage

	if tenantID == "" {
		return u, fmt.Errorf("storage: thiếu mã công ty")
	}
	if baseDir == "" {
		baseDir = DefaultBaseDir
	}
	baseDir = filepath.Clean(baseDir)

	// Dựng đường dẫn qua cùng phép kiểm tra như khi đọc ghi file, để mã công ty
	// lạ không dẫn ra ngoài thư mục lưu trữ.
	root := filepath.Join(baseDir, filepath.Clean("/"+tenantID))
	if root == baseDir || !isInside(baseDir, root) {
		return u, fmt.Errorf("storage: mã công ty không hợp lệ")
	}

	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			// Thư mục chưa tồn tại nghĩa là công ty chưa có file nào.
			if os.IsNotExist(err) {
				return fs.SkipAll
			}
			return err
		}
		// Quá hạn thì dừng và đánh dấu số liệu chưa trọn vẹn.
		if ctx.Err() != nil {
			u.Partial = true
			return fs.SkipAll
		}
		if d.IsDir() {
			return nil
		}
		info, err := d.Info()
		if err != nil {
			// File vừa bị xoá giữa chừng thì bỏ qua, không làm hỏng cả phép đếm.
			if os.IsNotExist(err) {
				return nil
			}
			return err
		}
		u.Bytes += info.Size()
		u.Files++
		return nil
	})
	if err != nil && !os.IsNotExist(err) {
		return u, fmt.Errorf("đếm file trên đĩa: %w", err)
	}
	return u, nil
}

func isInside(base, path string) bool {
	rel, err := filepath.Rel(base, path)
	if err != nil {
		return false
	}
	return rel != ".." && !filepath.IsAbs(rel) &&
		!(len(rel) >= 3 && rel[:3] == ".."+string(filepath.Separator))
}
