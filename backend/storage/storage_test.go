package storage

import (
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"testing"
)

// memStore là nơi cất file trong bộ nhớ, dùng để kiểm phần ghép hai store mà
// không cần dịch vụ thật.
type memStore struct {
	mu    sync.Mutex
	files map[string][]byte
	kind  string
}

func newMemStore(kind string) *memStore {
	return &memStore{files: map[string][]byte{}, kind: kind}
}

func (m *memStore) Kind() string { return m.kind }

func (m *memStore) Put(_ context.Context, key string, r io.Reader, _ int64, _ string) error {
	if err := validKey(key); err != nil {
		return err
	}
	b, err := io.ReadAll(r)
	if err != nil {
		return err
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.files[key] = b
	return nil
}

func (m *memStore) Get(_ context.Context, key string) (io.ReadCloser, string, int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	b, ok := m.files[key]
	if !ok {
		return nil, "", 0, ErrNotFound
	}
	return io.NopCloser(bytes.NewReader(b)), "application/octet-stream", int64(len(b)), nil
}

func (m *memStore) Exists(_ context.Context, key string) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	_, ok := m.files[key]
	return ok, nil
}

func (m *memStore) Stat(_ context.Context, key string) (int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	b, ok := m.files[key]
	if !ok {
		return 0, ErrNotFound
	}
	return int64(len(b)), nil
}

func (m *memStore) List(_ context.Context, prefix string, fn func(string, int64) error) error {
	m.mu.Lock()
	keys := make([]string, 0, len(m.files))
	sizes := map[string]int64{}
	for k, v := range m.files {
		if strings.HasPrefix(k, prefix) {
			keys = append(keys, k)
			sizes[k] = int64(len(v))
		}
	}
	m.mu.Unlock()
	sort.Strings(keys)
	for _, k := range keys {
		if err := fn(k, sizes[k]); err != nil {
			return err
		}
	}
	return nil
}

func (m *memStore) Delete(_ context.Context, key string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.files, key)
	return nil
}

// kiemBoHopDong chạy cùng một bộ kiểm cho mọi nơi cất file, để hai backend
// không âm thầm cư xử khác nhau.
func kiemBoHopDong(t *testing.T, store Store) {
	t.Helper()
	ctx := context.Background()
	key := "tenant-x/conv-y/anh.jpg"
	noiDung := []byte("noi dung file anh")

	t.Cleanup(func() { _ = store.Delete(ctx, key) })

	if ok, err := store.Exists(ctx, key); err != nil || ok {
		t.Fatalf("file chua ton tai: ok=%v err=%v", ok, err)
	}
	if _, _, _, err := store.Get(ctx, key); !errors.Is(err, ErrNotFound) {
		t.Fatalf("doc file chua co phai tra ErrNotFound, nhan %v", err)
	}

	if err := store.Put(ctx, key, bytes.NewReader(noiDung), int64(len(noiDung)), "image/jpeg"); err != nil {
		t.Fatalf("Put loi: %v", err)
	}

	if ok, err := store.Exists(ctx, key); err != nil || !ok {
		t.Fatalf("sau khi ghi phai ton tai: ok=%v err=%v", ok, err)
	}

	body, contentType, size, err := store.Get(ctx, key)
	if err != nil {
		t.Fatalf("Get loi: %v", err)
	}
	doc, _ := io.ReadAll(body)
	body.Close()
	if !bytes.Equal(doc, noiDung) {
		t.Errorf("noi dung doc ra khac luc ghi vao: %q", doc)
	}
	if size != int64(len(noiDung)) {
		t.Errorf("size = %d, muon %d", size, len(noiDung))
	}
	if contentType == "" {
		t.Errorf("content type khong duoc rong")
	}

	if err := store.Delete(ctx, key); err != nil {
		t.Fatalf("Delete loi: %v", err)
	}
	if ok, _ := store.Exists(ctx, key); ok {
		t.Errorf("sau khi xoa van con")
	}
	// Xoá file không tồn tại không được coi là lỗi
	if err := store.Delete(ctx, key); err != nil {
		t.Errorf("xoa file khong ton tai phai bo qua, nhan %v", err)
	}
}

func TestNoiCatTrenDia(t *testing.T) {
	store, err := NewLocal(t.TempDir())
	if err != nil {
		t.Fatalf("NewLocal loi: %v", err)
	}
	kiemBoHopDong(t, store)
}

// TestNoiCatS3 chỉ chạy khi có cấu hình S3 thật, để CI không phụ thuộc mạng.
func TestNoiCatS3(t *testing.T) {
	bucket := os.Getenv("S3_TEST_BUCKET")
	if bucket == "" {
		t.Skip("bo qua: chua dat S3_TEST_BUCKET")
	}
	store, err := NewS3(Config{
		S3Endpoint:       os.Getenv("S3_ENDPOINT"),
		S3Bucket:         bucket,
		S3Region:         os.Getenv("S3_REGION"),
		S3AccessKey:      os.Getenv("S3_ACCESS_KEY"),
		S3SecretKey:      os.Getenv("S3_SECRET_KEY"),
		S3Prefix:         "cqa-test",
		S3ForcePathStyle: os.Getenv("S3_FORCE_PATH_STYLE") == "true",
	})
	if err != nil {
		t.Fatalf("NewS3 loi: %v", err)
	}
	kiemBoHopDong(t, store)
}

// Ghi vào nơi mới, đọc thì nơi mới trước rồi mới tới nơi cũ — đây là cách hệ
// thống đang chạy bật S3 mà không phải chuyển file cũ trước.
func TestDocDuPhongVeNoiCu(t *testing.T) {
	ctx := context.Background()
	moi := newMemStore("s3")
	cu := newMemStore("local")
	ghep := NewWithFallback(moi, cu)

	fileCu := "tenant/conv/cu.jpg"
	fileMoi := "tenant/conv/moi.jpg"
	if err := cu.Put(ctx, fileCu, strings.NewReader("anh cu"), -1, ""); err != nil {
		t.Fatal(err)
	}

	// Ghi qua store ghép: chỉ vào nơi mới
	if err := ghep.Put(ctx, fileMoi, strings.NewReader("anh moi"), -1, ""); err != nil {
		t.Fatal(err)
	}
	if ok, _ := moi.Exists(ctx, fileMoi); !ok {
		t.Error("file moi phai nam o noi moi")
	}
	if ok, _ := cu.Exists(ctx, fileMoi); ok {
		t.Error("khong duoc ghi xuong noi cu nua")
	}

	// Đọc file cũ vẫn được
	body, _, _, err := ghep.Get(ctx, fileCu)
	if err != nil {
		t.Fatalf("doc file cu qua store ghep loi: %v", err)
	}
	doc, _ := io.ReadAll(body)
	body.Close()
	if string(doc) != "anh cu" {
		t.Errorf("noi dung file cu sai: %q", doc)
	}

	// Exists thấy cả hai
	for _, k := range []string{fileCu, fileMoi} {
		if ok, _ := ghep.Exists(ctx, k); !ok {
			t.Errorf("Exists(%s) phai thay", k)
		}
	}

	// File không có ở đâu cả
	if _, _, _, err := ghep.Get(ctx, "tenant/conv/khong-co.jpg"); !errors.Is(err, ErrNotFound) {
		t.Errorf("phai tra ErrNotFound, nhan %v", err)
	}

	// Xoá phải sạch cả hai nơi, nếu không đường đọc dự phòng sẽ moi lại bản cũ
	if err := cu.Put(ctx, fileMoi, strings.NewReader("ban cu con sot"), -1, ""); err != nil {
		t.Fatal(err)
	}
	if err := ghep.Delete(ctx, fileMoi); err != nil {
		t.Fatal(err)
	}
	if ok, _ := ghep.Exists(ctx, fileMoi); ok {
		t.Error("xoa roi ma van con")
	}
}

// Tên file đến từ API bên ngoài, không được để nó trỏ ra khỏi thư mục lưu trữ.
func TestChanKhoaTroRaNgoai(t *testing.T) {
	base := t.TempDir()
	store, err := NewLocal(base)
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()

	for _, khoa := range []string{
		"../ngoai.txt",
		"tenant/../../ngoai.txt",
		"/etc/passwd",
		"",
		"tenant\\conv\\file.jpg",
	} {
		if err := store.Put(ctx, khoa, strings.NewReader("x"), -1, ""); err == nil {
			t.Errorf("Put(%q) phai bi tu choi", khoa)
		}
		if _, _, _, err := store.Get(ctx, khoa); err == nil {
			t.Errorf("Get(%q) phai bi tu choi", khoa)
		}
	}

	// Không có file nào rơi ra ngoài thư mục gốc
	parent := filepath.Dir(base)
	if _, err := os.Stat(filepath.Join(parent, "ngoai.txt")); !os.IsNotExist(err) {
		t.Errorf("co file bi ghi ra ngoai thu muc luu tru")
	}
}
