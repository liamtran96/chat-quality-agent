package engine

import (
	"context"
	"errors"
	"io"
	"strings"
	"testing"

	"github.com/vietbui/chat-quality-agent/storage"
)

// khoHong giả lập kho chính đang trục trặc.
type khoHong struct {
	storage.Store
	kind string
}

func (k *khoHong) Put(context.Context, string, io.Reader, int64, string) error {
	return errors.New("dịch vụ không phản hồi")
}
func (k *khoHong) Kind() string { return k.kind }

func taiOK(noiDung string, dem *int) func() (io.ReadCloser, int64, string, error) {
	return func() (io.ReadCloser, int64, string, error) {
		*dem++
		return io.NopCloser(strings.NewReader(noiDung)), int64(len(noiDung)), "image/jpeg", nil
	}
}

// Kho chính hỏng thì file phải rơi xuống đĩa, tuyệt đối không được bỏ: link ảnh
// bên Zalo và Facebook hết hạn, mất là mất hẳn.
func TestKhoChinhHongThiGhiXuongDia(t *testing.T) {
	dia, err := storage.NewLocal(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	chinh := &khoHong{Store: dia, kind: "s3"}
	ctx := context.Background()
	soLanTai := 0

	noiDaLuu, err := luuFileDinhKem(ctx, chinh, dia, "t1/c1/anh.jpg", taiOK("noi dung anh", &soLanTai))
	if err != nil {
		t.Fatalf("phai luu duoc xuong dia, nhan loi: %v", err)
	}
	if !strings.Contains(noiDaLuu, "local") {
		t.Errorf("phai bao da luu xuong dia, nhan %q", noiDaLuu)
	}
	if soLanTai != 2 {
		t.Errorf("phai tai lai cho luot thu hai, so lan tai = %d", soLanTai)
	}

	body, _, _, err := dia.Get(ctx, "t1/c1/anh.jpg")
	if err != nil {
		t.Fatalf("file khong nam tren dia: %v", err)
	}
	doc, _ := io.ReadAll(body)
	body.Close()
	if string(doc) != "noi dung anh" {
		t.Errorf("noi dung sai: %q", doc)
	}
}

// Kho chính chạy tốt thì chỉ tải một lần, không đụng tới đĩa.
func TestKhoChinhTotThiChiTaiMotLan(t *testing.T) {
	chinh, err := storage.NewLocal(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	dia, err := storage.NewLocal(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	soLanTai := 0

	if _, err := luuFileDinhKem(context.Background(), chinh, dia, "t1/c1/anh.jpg", taiOK("x", &soLanTai)); err != nil {
		t.Fatalf("loi: %v", err)
	}
	if soLanTai != 1 {
		t.Errorf("chi duoc tai mot lan, nhan %d", soLanTai)
	}
	if ok, _ := dia.Exists(context.Background(), "t1/c1/anh.jpg"); ok {
		t.Errorf("kho chinh tot thi khong duoc ghi xuong dia")
	}
}

// Cả hai nơi đều hỏng thì báo lỗi, không im lặng coi như đã lưu.
func TestCaHaiNoiHongThiBaoLoi(t *testing.T) {
	dia, err := storage.NewLocal(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	chinh := &khoHong{Store: dia, kind: "s3"}
	diaHong := &khoHong{Store: dia, kind: "local"}
	soLanTai := 0

	if _, err := luuFileDinhKem(context.Background(), chinh, diaHong, "t1/c1/anh.jpg", taiOK("x", &soLanTai)); err == nil {
		t.Errorf("phai bao loi khi ca hai noi deu hong")
	}
}
