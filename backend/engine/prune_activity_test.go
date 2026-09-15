package engine

import (
	"os"
	"testing"
	"time"

	"github.com/vietbui/chat-quality-agent/db"
	"github.com/vietbui/chat-quality-agent/db/models"
	"github.com/vietbui/chat-quality-agent/pkg"
)

// seedActivityLogs dựng nhật ký cũ và mới cho một tenant riêng.
func seedActivityLogs(t *testing.T) string {
	t.Helper()

	dsn := os.Getenv("TEST_DB_DSN")
	if dsn == "" {
		dsn = "cqa:cqa_password@tcp(127.0.0.1:3306)/cqa?charset=utf8mb4&parseTime=True&loc=UTC"
	}
	if err := db.Connect(dsn, false); err != nil {
		t.Skipf("bo qua: khong ket noi duoc DB test: %v", err)
	}
	if err := db.AutoMigrate(); err != nil {
		t.Fatalf("AutoMigrate loi: %v", err)
	}

	tenantID := "prunelog-" + pkg.NewUUID()[:8]
	now := time.Now()
	add := func(age time.Duration) {
		db.DB.Exec(`INSERT INTO activity_logs (id, tenant_id, user_id, user_email, action, resource_type, resource_id, detail, error_message, ip_address, created_at) VALUES (?, ?, '', 'system', 'job.run.completed', 'job', 'x', 'chi tiet', '', '', ?)`,
			pkg.NewUUID(), tenantID, now.Add(-age))
	}
	for i := 0; i < 5; i++ {
		add(time.Duration(100+i) * 24 * time.Hour) // cũ hơn 90 ngày
	}
	for i := 0; i < 3; i++ {
		add(time.Duration(i) * 24 * time.Hour) // vài ngày gần đây
	}

	t.Cleanup(func() { db.DB.Exec("DELETE FROM activity_logs WHERE tenant_id = ?", tenantID) })
	return tenantID
}

func countLogs(t *testing.T, tenantID string) int64 {
	t.Helper()
	var n int64
	db.DB.Model(&models.ActivityLog{}).Where("tenant_id = ?", tenantID).Count(&n)
	return n
}

func TestDonNhatKyCuHonSoNgayGiuLai(t *testing.T) {
	tenantID := seedActivityLogs(t)
	if got := countLogs(t, tenantID); got != 8 {
		t.Fatalf("du lieu dung san phai co 8 dong, nhan %d", got)
	}

	PruneActivityLogs(90)

	if got := countLogs(t, tenantID); got != 3 {
		t.Errorf("phai con 3 dong trong 90 ngay, nhan %d", got)
	}

	// Chạy lại không xoá thêm gì
	before := countLogs(t, tenantID)
	PruneActivityLogs(90)
	if after := countLogs(t, tenantID); after != before {
		t.Errorf("chay lai khong duoc xoa them: truoc %d, sau %d", before, after)
	}
}

func TestGiuMaiKhiKhongCauHinhSoNgay(t *testing.T) {
	tenantID := seedActivityLogs(t)

	for _, days := range []int{0, -1} {
		if got := PruneActivityLogs(days); got != 0 {
			t.Errorf("retention=%d khong duoc xoa gi, da xoa %d dong", days, got)
		}
	}
	if got := countLogs(t, tenantID); got != 8 {
		t.Errorf("phai giu nguyen 8 dong, nhan %d", got)
	}
}
