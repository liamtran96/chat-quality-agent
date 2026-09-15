package storage

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

// dungThuMucCoFile dựng thư mục đĩa giống hệt cấu trúc CQA đang dùng.
func dungThuMucCoFile(t *testing.T, files map[string]string) string {
	t.Helper()
	dir := t.TempDir()
	for rel, noiDung := range files {
		full := filepath.Join(dir, filepath.FromSlash(rel))
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(full, []byte(noiDung), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return dir
}

func TestXemTruocKhongDungGiVaoDuLieu(t *testing.T) {
	dir := dungThuMucCoFile(t, map[string]string{
		"t1/c1/a.jpg": "anh mot",
		"t1/c2/b.png": "anh hai",
	})
	dst := newMemStore("s3")

	st, err := MigrateLocalToRemote(context.Background(), dst, dir, MigrateOptions{}, nil)
	if err != nil {
		t.Fatalf("loi: %v", err)
	}
	if st.Scanned != 2 || st.Copied != 0 {
		t.Errorf("xem truoc: quet %d, chep %d — khong duoc chep gi", st.Scanned, st.Copied)
	}
	if st.BytesToDo == 0 {
		t.Errorf("phai bao truoc dung luong can chep")
	}
	if len(dst.files) != 0 {
		t.Errorf("noi moi phai con rong, dang co %d file", len(dst.files))
	}
	if _, err := os.Stat(filepath.Join(dir, "t1/c1/a.jpg")); err != nil {
		t.Errorf("file tren dia phai con nguyen")
	}
}

func TestChuyenFileVaChayLaiKhongChepThua(t *testing.T) {
	dir := dungThuMucCoFile(t, map[string]string{
		"t1/c1/a.jpg": "anh mot",
		"t1/c2/b.png": "anh hai",
		"t2/c3/c.gif": "anh ba",
	})
	dst := newMemStore("s3")
	ctx := context.Background()

	st, err := MigrateLocalToRemote(ctx, dst, dir, MigrateOptions{Apply: true}, nil)
	if err != nil {
		t.Fatalf("loi: %v", err)
	}
	if st.Copied != 3 || st.Failed != 0 {
		t.Fatalf("lan dau: chep %d, hong %d — muon chep 3", st.Copied, st.Failed)
	}
	if got := string(dst.files["t1/c1/a.jpg"]); got != "anh mot" {
		t.Errorf("noi dung sai: %q", got)
	}
	// File vẫn còn trên đĩa vì chưa yêu cầu xoá
	if _, err := os.Stat(filepath.Join(dir, "t1/c1/a.jpg")); err != nil {
		t.Errorf("chua yeu cau xoa thi file phai con")
	}

	// Chạy lại: không chép thêm gì
	st2, err := MigrateLocalToRemote(ctx, dst, dir, MigrateOptions{Apply: true}, nil)
	if err != nil {
		t.Fatalf("loi: %v", err)
	}
	if st2.Copied != 0 || st2.AlreadyOK != 3 {
		t.Errorf("chay lai: chep %d, bo qua %d — muon chep 0, bo qua 3", st2.Copied, st2.AlreadyOK)
	}
}

func TestChepTiepSauKhiDungGiuaChung(t *testing.T) {
	dir := dungThuMucCoFile(t, map[string]string{
		"t1/c1/a.jpg": "anh mot",
		"t1/c1/b.jpg": "anh hai",
	})
	dst := newMemStore("s3")
	ctx := context.Background()

	// Giả lập lượt trước mới chép được một file
	if err := dst.Put(ctx, "t1/c1/a.jpg", stringReader("anh mot"), -1, ""); err != nil {
		t.Fatal(err)
	}

	st, err := MigrateLocalToRemote(ctx, dst, dir, MigrateOptions{Apply: true}, nil)
	if err != nil {
		t.Fatalf("loi: %v", err)
	}
	if st.AlreadyOK != 1 || st.Copied != 1 {
		t.Errorf("bo qua %d, chep %d — muon bo qua 1, chep 1", st.AlreadyOK, st.Copied)
	}
}

func TestChepDeKhiDungLuongLech(t *testing.T) {
	dir := dungThuMucCoFile(t, map[string]string{"t1/c1/a.jpg": "noi dung day du"})
	dst := newMemStore("s3")
	ctx := context.Background()

	// Bản trên nơi mới bị cụt, ví dụ lượt trước đứt giữa chừng
	if err := dst.Put(ctx, "t1/c1/a.jpg", stringReader("cut"), -1, ""); err != nil {
		t.Fatal(err)
	}

	st, err := MigrateLocalToRemote(ctx, dst, dir, MigrateOptions{Apply: true}, nil)
	if err != nil {
		t.Fatalf("loi: %v", err)
	}
	if st.Copied != 1 {
		t.Errorf("phai chep de ban cut, chep %d", st.Copied)
	}
	if got := string(dst.files["t1/c1/a.jpg"]); got != "noi dung day du" {
		t.Errorf("ban tren noi moi van cut: %q", got)
	}
}

func TestXoaDiaChiXoaFileDaChacChanCoONoiMoi(t *testing.T) {
	dir := dungThuMucCoFile(t, map[string]string{
		"t1/c1/a.jpg": "anh mot",
		"t1/c1/b.jpg": "anh hai",
	})
	dst := newMemStore("s3")
	ctx := context.Background()

	st, err := MigrateLocalToRemote(ctx, dst, dir, MigrateOptions{Apply: true, DeleteLocal: true}, nil)
	if err != nil {
		t.Fatalf("loi: %v", err)
	}
	if st.Deleted != 2 || st.Failed != 0 {
		t.Fatalf("xoa %d, hong %d — muon xoa 2", st.Deleted, st.Failed)
	}
	for _, f := range []string{"t1/c1/a.jpg", "t1/c1/b.jpg"} {
		if _, err := os.Stat(filepath.Join(dir, filepath.FromSlash(f))); !os.IsNotExist(err) {
			t.Errorf("%s phai bi xoa khoi dia", f)
		}
		if _, ok := dst.files[f]; !ok {
			t.Errorf("%s phai con o noi moi", f)
		}
	}
	// Thư mục rỗng được dọn theo
	if _, err := os.Stat(filepath.Join(dir, "t1", "c1")); !os.IsNotExist(err) {
		t.Errorf("thu muc rong phai duoc don")
	}
}

// Nơi mới hỏng thì tuyệt đối không được xoá file trên đĩa.
func TestKhongXoaKhiChepHong(t *testing.T) {
	dir := dungThuMucCoFile(t, map[string]string{"t1/c1/a.jpg": "anh mot"})
	dst := &memStoreHong{newMemStore("s3")}
	ctx := context.Background()

	st, err := MigrateLocalToRemote(ctx, dst, dir, MigrateOptions{Apply: true, DeleteLocal: true}, nil)
	if err != nil {
		t.Fatalf("loi: %v", err)
	}
	if st.Deleted != 0 {
		t.Errorf("khong duoc xoa file nao, da xoa %d", st.Deleted)
	}
	if st.Failed != 1 {
		t.Errorf("phai ghi nhan 1 file hong, nhan %d", st.Failed)
	}
	if _, err := os.Stat(filepath.Join(dir, "t1/c1/a.jpg")); err != nil {
		t.Errorf("file tren dia phai con nguyen khi noi moi hong")
	}
}

// Quét thư mục riêng của một công ty thì khoá phải được ghép lại mã công ty ở
// đầu, đúng dạng mà ứng dụng dùng để đọc file. Thiếu tiền tố thì file chép lên
// xong không đọc lại được.
func TestGhepMaCongTyVaoKhoa(t *testing.T) {
	congTy := "e3abe5bb-4ade-418d-ae49-aec20434019c"
	dir := dungThuMucCoFile(t, map[string]string{
		"conv-x/tep.txt":   "noi dung",
		"conv-y/anh/a.jpg": "anh long nhau",
	})
	dst := newMemStore("s3")

	st, err := MigrateLocalToRemote(context.Background(), dst, dir,
		MigrateOptions{Apply: true, KeyPrefix: congTy}, nil)
	if err != nil {
		t.Fatalf("loi: %v", err)
	}
	if st.Copied != 2 {
		t.Fatalf("chep %d file, muon 2", st.Copied)
	}
	for _, khoa := range []string{
		congTy + "/conv-x/tep.txt",
		congTy + "/conv-y/anh/a.jpg",
	} {
		if _, ok := dst.files[khoa]; !ok {
			t.Errorf("thieu khoa %q; dang co: %v", khoa, khoaCo(dst))
		}
	}
}

func khoaCo(m *memStore) []string {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]string, 0, len(m.files))
	for k := range m.files {
		out = append(out, k)
	}
	return out
}
