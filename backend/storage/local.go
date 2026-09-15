package storage

import (
	"context"
	"errors"
	"io"
	"io/fs"
	"mime"
	"os"
	"path/filepath"
	"strings"
)

// localStore cất file trên đĩa máy chủ, đúng cách CQA vẫn làm từ trước.
type localStore struct {
	baseDir string
}

// NewLocal dựng store trên đĩa. baseDir rỗng thì dùng đường dẫn mặc định.
func NewLocal(baseDir string) (Store, error) {
	if baseDir == "" {
		baseDir = DefaultBaseDir
	}
	return &localStore{baseDir: filepath.Clean(baseDir)}, nil
}

// DefaultBaseDir là nơi CQA vẫn cất file từ trước.
const DefaultBaseDir = "/var/lib/cqa/files"

func (l *localStore) Kind() string { return "local" }

// path đổi khoá thành đường dẫn tuyệt đối, và khẳng định nó nằm trong baseDir.
func (l *localStore) path(key string) (string, error) {
	if err := validKey(key); err != nil {
		return "", err
	}
	full := filepath.Join(l.baseDir, filepath.Clean("/"+key))
	if !strings.HasPrefix(full, l.baseDir+string(filepath.Separator)) {
		return "", errors.New("storage: khoá trỏ ra ngoài thư mục lưu trữ")
	}
	return full, nil
}

func (l *localStore) Put(ctx context.Context, key string, r io.Reader, size int64, contentType string) error {
	full, err := l.path(key)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		return err
	}
	f, err := os.Create(full)
	if err != nil {
		return err
	}
	if _, err := io.Copy(f, r); err != nil {
		f.Close()
		os.Remove(full) // không để lại file dở
		return err
	}
	return f.Close()
}

func (l *localStore) Get(ctx context.Context, key string) (io.ReadCloser, string, int64, error) {
	full, err := l.path(key)
	if err != nil {
		return nil, "", 0, err
	}
	f, err := os.Open(full)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, "", 0, ErrNotFound
		}
		return nil, "", 0, err
	}
	st, err := f.Stat()
	if err != nil {
		f.Close()
		return nil, "", 0, err
	}
	ct := mime.TypeByExtension(filepath.Ext(full))
	if ct == "" {
		ct = "application/octet-stream"
	}
	return f, ct, st.Size(), nil
}

func (l *localStore) Exists(ctx context.Context, key string) (bool, error) {
	full, err := l.path(key)
	if err != nil {
		return false, err
	}
	if _, err := os.Stat(full); err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

func (l *localStore) Stat(ctx context.Context, key string) (int64, error) {
	full, err := l.path(key)
	if err != nil {
		return 0, err
	}
	st, err := os.Stat(full)
	if err != nil {
		if os.IsNotExist(err) {
			return 0, ErrNotFound
		}
		return 0, err
	}
	return st.Size(), nil
}

func (l *localStore) List(ctx context.Context, prefix string, fn func(key string, size int64) error) error {
	root := l.baseDir
	if prefix != "" {
		if err := validKey(prefix); err != nil {
			return err
		}
		root = filepath.Join(l.baseDir, filepath.FromSlash(prefix))
	}
	if _, err := os.Stat(root); os.IsNotExist(err) {
		return nil
	}
	return filepath.WalkDir(root, func(p string, d fs.DirEntry, err error) error {
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
		rel, err := filepath.Rel(l.baseDir, p)
		if err != nil {
			return err
		}
		info, err := d.Info()
		if err != nil {
			return err
		}
		return fn(filepath.ToSlash(rel), info.Size())
	})
}

func (l *localStore) Delete(ctx context.Context, key string) error {
	full, err := l.path(key)
	if err != nil {
		return err
	}
	if err := os.Remove(full); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

// BaseDir cho biết thư mục gốc, lệnh chuyển file cần để đi quét đĩa.
func (l *localStore) BaseDir() string { return l.baseDir }
