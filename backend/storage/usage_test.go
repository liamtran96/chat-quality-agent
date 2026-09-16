package storage

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func viet(t *testing.T, path string, noiDung string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("tạo thư mục: %v", err)
	}
	if err := os.WriteFile(path, []byte(noiDung), 0o644); err != nil {
		t.Fatalf("ghi file: %v", err)
	}
}

func TestLocalUsageDemDungDungLuongVaSoFile(t *testing.T) {
	base := t.TempDir()
	viet(t, filepath.Join(base, "cty-a", "chat-1", "anh.jpg"), "12345")
	viet(t, filepath.Join(base, "cty-a", "chat-1", "tai-lieu.pdf"), "123")
	viet(t, filepath.Join(base, "cty-a", "chat-2", "video.mp4"), "1234567890")
	// File của công ty khác không được tính vào.
	viet(t, filepath.Join(base, "cty-b", "chat-9", "cua-cty-khac.png"), "999999999999")

	u, err := LocalUsage(context.Background(), base, "cty-a")
	if err != nil {
		t.Fatalf("LocalUsage: %v", err)
	}
	if u.Files != 3 {
		t.Errorf("số file = %d, mong đợi 3", u.Files)
	}
	if u.Bytes != 18 {
		t.Errorf("dung lượng = %d, mong đợi 18", u.Bytes)
	}
	if u.Partial {
		t.Error("phép đếm nhỏ không được đánh dấu là dở dang")
	}
}

func TestLocalUsageCongTyChuaCoFile(t *testing.T) {
	base := t.TempDir()
	u, err := LocalUsage(context.Background(), base, "cty-chua-co-gi")
	if err != nil {
		t.Fatalf("công ty chưa có file không được coi là lỗi: %v", err)
	}
	if u.Files != 0 || u.Bytes != 0 {
		t.Errorf("mong đợi số không, nhận %+v", u)
	}
}

func TestLocalUsageChanMaCongTyDanRaNgoai(t *testing.T) {
	base := t.TempDir()
	viet(t, filepath.Join(base, "cty-a", "chat", "f.txt"), "x")

	for _, xau := range []string{"", "..", "../..", "/", "."} {
		if _, err := LocalUsage(context.Background(), base, xau); err == nil {
			t.Errorf("mã công ty %q phải bị từ chối", xau)
		}
	}
}

func TestLocalUsageDungKhiQuaHan(t *testing.T) {
	base := t.TempDir()
	for i := 0; i < 50; i++ {
		viet(t, filepath.Join(base, "cty-a", "chat", string(rune('a'+i%26))+string(rune('a'+i/26))+".txt"), "xx")
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // quá hạn ngay từ đầu

	u, err := LocalUsage(ctx, base, "cty-a")
	if err != nil {
		t.Fatalf("quá hạn không được trả lỗi: %v", err)
	}
	if !u.Partial {
		t.Error("quá hạn phải đánh dấu số liệu dở dang")
	}
}
