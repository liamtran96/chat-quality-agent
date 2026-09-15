package storagecfg

import (
	"os"
	"testing"

	"github.com/vietbui/chat-quality-agent/config"
	"github.com/vietbui/chat-quality-agent/db"
	"github.com/vietbui/chat-quality-agent/db/models"
	"github.com/vietbui/chat-quality-agent/pkg"
)

func dungCaiDat(t *testing.T, khoaMaHoa string) (string, *config.Config) {
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

	tenantID := "scfg-" + pkg.NewUUID()[:8]
	cfg := &config.Config{EncryptionKey: khoaMaHoa, StorageLocalDir: "/tmp/cqa-test-files"}

	secret, err := pkg.Encrypt([]byte("secret-that"), khoaMaHoa)
	if err != nil {
		t.Fatal(err)
	}
	dat := func(key, val string, enc []byte) {
		db.DB.Create(&models.AppSetting{
			ID: pkg.NewUUID(), TenantID: tenantID, SettingKey: key,
			ValuePlain: val, ValueEncrypted: enc,
		})
	}
	dat(KeyEndpoint, "https://s3.vi-du.vn", nil)
	dat(KeyBucket, "bucket-cua-toi", nil)
	dat(KeyAccessKey, "AKIA-VI-DU", nil)
	dat(KeySecretKey, "", secret)

	t.Cleanup(func() { db.DB.Where("tenant_id = ?", tenantID).Delete(&models.AppSetting{}) })
	return tenantID, cfg
}

// Công ty đã tắt S3 vẫn phải đọc ra được thông tin S3 đã lưu: lệnh chép ngược
// S3 → máy chủ cần đúng khoá đó, mà lúc cần chạy thì công tắc đã ở local rồi.
func TestTatS3VanDocDuocThongTinDaLuu(t *testing.T) {
	khoa := "khoa-ma-hoa-32-byte-abcdefghijk!"
	tenantID, cfg := dungCaiDat(t, khoa)

	// Không đặt storage_backend: mặc định là local
	got, err := Load(cfg, tenantID)
	if err != nil {
		t.Fatalf("Load loi: %v", err)
	}
	if got.Backend != "local" {
		t.Errorf("backend = %q, muon local", got.Backend)
	}
	if got.S3Bucket != "bucket-cua-toi" || got.S3Endpoint != "https://s3.vi-du.vn" {
		t.Errorf("thong tin S3 bi bo qua khi dang o che do may chu: %+v", got)
	}
	if got.S3SecretKey != "secret-that" {
		t.Errorf("secret key khong duoc giai ma dung: %q", got.S3SecretKey)
	}
}

func TestBatS3DocDuDuLieu(t *testing.T) {
	khoa := "khoa-ma-hoa-32-byte-abcdefghijk!"
	tenantID, cfg := dungCaiDat(t, khoa)
	db.DB.Create(&models.AppSetting{ID: pkg.NewUUID(), TenantID: tenantID, SettingKey: KeyBackend, ValuePlain: "s3"})

	got, err := Load(cfg, tenantID)
	if err != nil {
		t.Fatalf("Load loi: %v", err)
	}
	if got.Backend != "s3" || got.S3AccessKey != "AKIA-VI-DU" || got.S3SecretKey != "secret-that" {
		t.Errorf("doc thieu du lieu: %+v", got)
	}
	if got.BaseDir != "/tmp/cqa-test-files" {
		t.Errorf("thu muc may chu phai lay tu config, nhan %q", got.BaseDir)
	}
}

// Sai ENCRYPTION_KEY thì phải báo lỗi rõ chứ không im lặng trả về khoá rỗng.
func TestSaiKhoaMaHoaThiBaoLoi(t *testing.T) {
	tenantID, _ := dungCaiDat(t, "khoa-ma-hoa-32-byte-abcdefghijk!")
	cfgKhac := &config.Config{EncryptionKey: "khoa-khac-32-byte-zyxwvutsrqpo!!", StorageLocalDir: "/tmp/x"}

	if _, err := Load(cfgKhac, tenantID); err == nil {
		t.Errorf("phai bao loi khi khong giai ma duoc secret key")
	}
}
