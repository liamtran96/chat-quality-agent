package storage

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/minio/minio-go/v7"
)

// Verify chạy trọn một vòng ghi — đọc — đối chiếu — xoá trên nơi cất file.
//
// Cố ý không chỉ kiểm kết nối: khoá đọc được nhưng không ghi được là chuyện
// thường gặp, mà chỉ ping thì vẫn báo "bình thường" rồi tới lúc đồng bộ mới
// hỏng, không ai biết vì sao.
func Verify(ctx context.Context, s Store) error {
	key := fmt.Sprintf("__cqa_kiem_tra/%d.txt", time.Now().UnixNano())
	noiDung := []byte("cqa kiem tra ghi doc " + time.Now().Format(time.RFC3339Nano))

	if err := s.Put(ctx, key, bytes.NewReader(noiDung), int64(len(noiDung)), "text/plain"); err != nil {
		return fmt.Errorf("ghi thử: %w", err)
	}
	// Dọn dấu vết dù phần sau có hỏng hay không.
	defer func() { _ = s.Delete(context.WithoutCancel(ctx), key) }()

	body, _, _, err := s.Get(ctx, key)
	if err != nil {
		return fmt.Errorf("đọc lại: %w", err)
	}
	docRa, err := io.ReadAll(body)
	body.Close()
	if err != nil {
		return fmt.Errorf("đọc lại: %w", err)
	}
	if !bytes.Equal(docRa, noiDung) {
		return fmt.Errorf("nội dung đọc ra khác lúc ghi vào")
	}
	return nil
}

// MoTaLoi đổi lỗi kỹ thuật của dịch vụ S3 thành câu người vận hành hiểu được,
// kèm mã để giao diện xử lý riêng nếu cần.
func MoTaLoi(err error) (ma string, moTa string) {
	if err == nil {
		return "", ""
	}
	resp := minio.ToErrorResponse(unwrapAll(err))
	switch resp.Code {
	case "SignatureDoesNotMatch", "InvalidAccessKeyId":
		return "sai_khoa", "Sai Access Key hoặc Secret Key"
	case "AccessDenied":
		return "thieu_quyen", "Khoá này không đủ quyền trên bucket — cần cả quyền đọc, ghi và xoá"
	case "NoSuchBucket":
		return "khong_co_bucket", "Không tìm thấy bucket này trên dịch vụ"
	}
	if resp.StatusCode == http.StatusNotFound && resp.Code != "" {
		return "khong_tim_thay", "Dịch vụ trả về không tìm thấy: " + resp.Code
	}
	return "khong_ket_noi", "Không kết nối được tới dịch vụ: " + err.Error()
}

// unwrapAll bóc hết các lớp %w để lấy lỗi gốc của thư viện S3.
func unwrapAll(err error) error {
	for {
		u, ok := err.(interface{ Unwrap() error })
		if !ok {
			return err
		}
		next := u.Unwrap()
		if next == nil {
			return err
		}
		err = next
	}
}
