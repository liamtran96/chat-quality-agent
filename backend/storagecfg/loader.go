// Package storagecfg đọc cấu hình nơi cất file của từng công ty từ database.
//
// Tách riêng khỏi package storage để storage không phải biết tới database, và
// khỏi package handlers để cả tiến trình nền lẫn đường HTTP dùng chung một
// nguồn cấu hình.
package storagecfg

import (
	"fmt"
	"strings"

	"gorm.io/gorm"

	"github.com/vietbui/chat-quality-agent/config"
	"github.com/vietbui/chat-quality-agent/db"
	"github.com/vietbui/chat-quality-agent/db/models"
	"github.com/vietbui/chat-quality-agent/pkg"
	"github.com/vietbui/chat-quality-agent/storage"
)

// Các khoá cài đặt của một công ty.
const (
	KeyBackend   = "storage_backend"
	KeyEndpoint  = "s3_endpoint"
	KeyBucket    = "s3_bucket"
	KeyRegion    = "s3_region"
	KeyAccessKey = "s3_access_key"
	KeySecretKey = "s3_secret_key" // lưu mã hoá
	KeyPrefix    = "s3_prefix"
	KeyPathStyle = "s3_force_path_style"
)

// Load đọc cấu hình nơi cất file của một công ty.
func Load(cfg *config.Config, tenantID string) (storage.Config, error) {
	var rows []models.AppSetting
	if err := db.DB.Where("tenant_id = ?", tenantID).Find(&rows).Error; err != nil {
		return storage.Config{}, fmt.Errorf("đọc cài đặt công ty: %w", err)
	}

	get := func(key string) models.AppSetting {
		for _, r := range rows {
			if r.SettingKey == key {
				return r
			}
		}
		return models.AppSetting{}
	}

	out := storage.Config{
		Backend: strings.TrimSpace(get(KeyBackend).ValuePlain),
		BaseDir: cfg.StorageLocalDir,
	}
	if out.Backend == "" {
		out.Backend = "local"
	}
	// Nạp thông tin S3 kể cả khi công ty đang ở chế độ máy chủ: nó vẫn cần cho
	// lệnh chép ngược S3 → máy chủ sau khi đã tắt. Hàm dựng kho chỉ dùng tới
	// đám này khi Backend là s3.
	out.S3Endpoint = strings.TrimSpace(get(KeyEndpoint).ValuePlain)
	out.S3Bucket = strings.TrimSpace(get(KeyBucket).ValuePlain)
	out.S3Region = strings.TrimSpace(get(KeyRegion).ValuePlain)
	out.S3AccessKey = strings.TrimSpace(get(KeyAccessKey).ValuePlain)
	out.S3Prefix = strings.TrimSpace(get(KeyPrefix).ValuePlain)
	out.S3ForcePathStyle = get(KeyPathStyle).ValuePlain == "true"

	secret := get(KeySecretKey)
	if len(secret.ValueEncrypted) > 0 {
		plain, err := pkg.Decrypt(secret.ValueEncrypted, cfg.EncryptionKey)
		if err != nil {
			return storage.Config{}, fmt.Errorf("không giải mã được Secret Key đã lưu — kiểm tra ENCRYPTION_KEY: %w", err)
		}
		out.S3SecretKey = string(plain)
	}
	return out, nil
}

// Loader gói Load thành hàm mà package storage nhận được.
func Loader(cfg *config.Config) storage.ConfigLoader {
	return func(tenantID string) (storage.Config, error) {
		return Load(cfg, tenantID)
	}
}

// SecretDaLuu cho biết công ty đã lưu Secret Key hay chưa, để giao diện biết có
// được phép để trống ô đó không.
func SecretDaLuu(tenantID string) bool {
	var row models.AppSetting
	err := db.DB.Where("tenant_id = ? AND setting_key = ?", tenantID, KeySecretKey).First(&row).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return false
		}
		return false
	}
	return len(row.ValueEncrypted) > 0
}
