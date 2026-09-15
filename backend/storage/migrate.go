package storage

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// MigrateStats là kết quả một lượt chuyển file.
type MigrateStats struct {
	Scanned    int   // số file quét được trên đĩa
	AlreadyOK  int   // đã có ở nơi mới, đúng dung lượng
	Copied     int   // vừa chép lên
	Deleted    int   // đã xoá khỏi đĩa
	Failed     int   // hỏng, giữ nguyên trên đĩa
	BytesTotal int64 // tổng dung lượng file quét được
	BytesToDo  int64 // dung lượng phần còn phải chép
}

// MigrateOptions điều khiển một lượt chuyển.
type MigrateOptions struct {
	Apply       bool // false là chỉ xem trước, không đụng gì
	DeleteLocal bool // xoá bản trên đĩa sau khi đã chắc chắn có ở nơi mới

	// KeyPrefix ghép vào trước đường dẫn tương đối để ra khoá cuối cùng.
	// Cần khi chỉ quét thư mục con của một công ty: khoá mà ứng dụng dùng để
	// đọc file luôn có dạng "<công ty>/<cuộc chat>/<tên file>", nên quét từ
	// thư mục của công ty thì phải ghép lại mã công ty vào đầu.
	KeyPrefix string
}

// MigrateLocalToRemote chép file từ đĩa lên nơi cất mới.
//
// Chạy lại được bao nhiêu lần cũng được: file đã có ở nơi mới và đúng dung
// lượng thì bỏ qua, nên dừng giữa chừng rồi chạy tiếp không phải làm lại từ
// đầu. Chép xong mới đối chiếu dung lượng, sai thì tính là hỏng và giữ nguyên
// bản trên đĩa.
//
// DeleteLocal chỉ xoá file đã xác nhận có ở nơi mới đúng dung lượng — không
// bao giờ xoá một file chưa chép được.
func MigrateLocalToRemote(ctx context.Context, dst Store, localDir string, opts MigrateOptions, progress func(st MigrateStats)) (MigrateStats, error) {
	var st MigrateStats

	localDir = filepath.Clean(localDir)
	info, err := os.Stat(localDir)
	if err != nil {
		if os.IsNotExist(err) {
			return st, nil // chưa có file nào trên đĩa, không có gì để chuyển
		}
		return st, fmt.Errorf("đọc thư mục %s: %w", localDir, err)
	}
	if !info.IsDir() {
		return st, fmt.Errorf("%s không phải thư mục", localDir)
	}

	walkErr := filepath.WalkDir(localDir, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() || !d.Type().IsRegular() {
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		rel, err := filepath.Rel(localDir, p)
		if err != nil {
			return err
		}
		key := strings.TrimSuffix(opts.KeyPrefix, "/")
		if key != "" {
			key += "/"
		}
		key += filepath.ToSlash(rel)
		if err := validKey(key); err != nil {
			st.Failed++
			return nil
		}

		fi, err := d.Info()
		if err != nil {
			st.Failed++
			return nil
		}
		st.Scanned++
		st.BytesTotal += fi.Size()

		remoteSize, err := dst.Stat(ctx, key)
		switch {
		case err == nil && remoteSize == fi.Size():
			st.AlreadyOK++
		case err == nil || errors.Is(err, ErrNotFound):
			// Chưa có, hoặc có nhưng lệch dung lượng thì chép đè.
			st.BytesToDo += fi.Size()
			if opts.Apply {
				if copyErr := copyOne(ctx, dst, p, key, fi.Size()); copyErr != nil {
					st.Failed++
					return nil
				}
				st.Copied++
			}
		default:
			st.Failed++
			return nil
		}

		// Chỉ xoá khi đã chắc chắn bản ở nơi mới đúng dung lượng.
		if opts.Apply && opts.DeleteLocal {
			remoteSize, err := dst.Stat(ctx, key)
			if err != nil || remoteSize != fi.Size() {
				st.Failed++
				return nil
			}
			if err := os.Remove(p); err != nil {
				st.Failed++
				return nil
			}
			st.Deleted++
		}

		if progress != nil && st.Scanned%100 == 0 {
			progress(st)
		}
		return nil
	})
	if walkErr != nil {
		return st, walkErr
	}

	if opts.Apply && opts.DeleteLocal {
		removeEmptyDirs(localDir)
	}
	return st, nil
}

func copyOne(ctx context.Context, dst Store, path, key string, size int64) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()

	if err := dst.Put(ctx, key, f, size, guessContentType(key)); err != nil {
		return err
	}
	// Đối chiếu ngay: chép lên mà lệch dung lượng thì coi như chưa chép.
	remoteSize, err := dst.Stat(ctx, key)
	if err != nil {
		return err
	}
	if remoteSize != size {
		return fmt.Errorf("dung lượng lệch sau khi chép: %d ≠ %d", remoteSize, size)
	}
	return nil
}

func guessContentType(key string) string {
	switch strings.ToLower(filepath.Ext(key)) {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	case ".mp4":
		return "video/mp4"
	case ".pdf":
		return "application/pdf"
	default:
		return "application/octet-stream"
	}
}

// removeEmptyDirs dọn các thư mục rỗng còn lại sau khi xoá file.
func removeEmptyDirs(root string) {
	var dirs []string
	_ = filepath.WalkDir(root, func(p string, d fs.DirEntry, err error) error {
		if err == nil && d.IsDir() && p != root {
			dirs = append(dirs, p)
		}
		return nil
	})
	// Xoá từ sâu ra ngoài
	for i := len(dirs) - 1; i >= 0; i-- {
		_ = os.Remove(dirs[i]) // chỉ xoá được nếu rỗng
	}
}

// MigrateRemoteToLocal chép file từ S3 về đĩa máy chủ — lối thoát cho công ty
// muốn thôi dùng S3.
//
// Cùng bảo đảm với chiều đi: chạy lại được, file đã có trên đĩa đúng dung lượng
// thì bỏ qua, đứt giữa chừng thì lần sau chép tiếp. Cố ý **không** đụng gì tới
// bucket — xoá dữ liệu ở nơi mình không kiểm soát là việc của chủ bucket.
func MigrateRemoteToLocal(ctx context.Context, src Store, localDir string, opts MigrateOptions, progress func(st MigrateStats)) (MigrateStats, error) {
	var st MigrateStats

	dich, err := NewLocal(localDir)
	if err != nil {
		return st, err
	}
	prefix := strings.TrimSuffix(opts.KeyPrefix, "/")

	err = src.List(ctx, prefix, func(key string, size int64) error {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		if err := validKey(key); err != nil {
			st.Failed++
			return nil
		}

		st.Scanned++
		st.BytesTotal += size

		// Khoá trên S3 gồm cả mã công ty; thư mục đích đã là thư mục của công ty
		// đó nên cắt phần trùng ra.
		duongDan := key
		if prefix != "" {
			duongDan = strings.TrimPrefix(strings.TrimPrefix(key, prefix), "/")
		}
		if duongDan == "" {
			return nil
		}

		coSan, err := dich.Stat(ctx, duongDan)
		switch {
		case err == nil && coSan == size:
			st.AlreadyOK++
			return nil
		case err != nil && !errors.Is(err, ErrNotFound):
			st.Failed++
			return nil
		}

		st.BytesToDo += size
		if !opts.Apply {
			return nil
		}

		body, contentType, _, err := src.Get(ctx, key)
		if err != nil {
			st.Failed++
			return nil
		}
		err = dich.Put(ctx, duongDan, body, size, contentType)
		body.Close()
		if err != nil {
			st.Failed++
			return nil
		}
		// Đối chiếu ngay, lệch thì coi như chưa chép.
		if got, err := dich.Stat(ctx, duongDan); err != nil || got != size {
			st.Failed++
			return nil
		}
		st.Copied++

		if progress != nil && st.Scanned%100 == 0 {
			progress(st)
		}
		return nil
	})
	if err != nil {
		return st, err
	}
	return st, nil
}
