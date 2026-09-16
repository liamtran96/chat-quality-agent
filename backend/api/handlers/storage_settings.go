package handlers

import (
	"context"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/vietbui/chat-quality-agent/api/middleware"
	"github.com/vietbui/chat-quality-agent/config"
	"github.com/vietbui/chat-quality-agent/db"
	"github.com/vietbui/chat-quality-agent/db/models"
	"github.com/vietbui/chat-quality-agent/pkg"
	"github.com/vietbui/chat-quality-agent/storage"
	"github.com/vietbui/chat-quality-agent/storagecfg"
)

// storageReq là phần cấu hình nơi cất file mà giao diện gửi lên.
type storageReq struct {
	Backend string `json:"backend" binding:"required,oneof=local s3"`

	Endpoint string `json:"endpoint"`
	Bucket   string `json:"bucket"`
	Region   string `json:"region"`

	AccessKey string `json:"access_key"`
	// Để trống nghĩa là giữ nguyên khoá đã lưu, giống ô API key của AI.
	SecretKey string `json:"secret_key"`

	Prefix         string `json:"prefix"`
	ForcePathStyle bool   `json:"force_path_style"`
}

// dungCauHinh dựng cấu hình từ dữ liệu giao diện gửi lên, lấy Secret Key đã lưu
// khi người dùng để trống ô đó.
func dungCauHinh(cfg *config.Config, tenantID string, req storageReq) (storage.Config, error) {
	out := storage.Config{
		Backend:          req.Backend,
		BaseDir:          cfg.StorageLocalDir,
		S3Endpoint:       strings.TrimSpace(req.Endpoint),
		S3Bucket:         strings.TrimSpace(req.Bucket),
		S3Region:         strings.TrimSpace(req.Region),
		S3AccessKey:      strings.TrimSpace(req.AccessKey),
		S3SecretKey:      req.SecretKey,
		S3Prefix:         strings.TrimSpace(req.Prefix),
		S3ForcePathStyle: req.ForcePathStyle,
	}
	if out.S3SecretKey != "" {
		return out, nil
	}
	daLuu, err := storagecfg.Load(cfg, tenantID)
	if err != nil {
		return out, err
	}
	out.S3SecretKey = daLuu.S3SecretKey
	return out, nil
}

// kiemTraS3 chạy trọn vòng ghi — đọc — xoá và trả về mã lỗi cho giao diện.
func kiemTraS3(scfg storage.Config) (maLoi string, moTa string) {
	store, err := storage.NewS3(scfg)
	if err != nil {
		return "thieu_thong_tin", err.Error()
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := storage.Verify(ctx, store); err != nil {
		return storage.MoTaLoi(err)
	}
	return "", ""
}

// TestStorageSettings kiểm tra cấu hình mà không lưu.
func TestStorageSettings(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)

	var req storageReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request", "details": err.Error()})
		return
	}
	if req.Backend != "s3" {
		c.JSON(http.StatusOK, gin.H{"ok": true, "message": "Đang lưu trên máy chủ, không cần kiểm tra kết nối."})
		return
	}

	cfg, err := config.Load()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "config_error"})
		return
	}
	scfg, err := dungCauHinh(cfg, tenantID, req)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"ok": false, "code": "khong_doc_duoc_cau_hinh", "message": err.Error()})
		return
	}
	if maLoi, moTa := kiemTraS3(scfg); maLoi != "" {
		c.JSON(http.StatusOK, gin.H{"ok": false, "code": maLoi, "message": moTa})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "message": "Kết nối được, ghi và đọc thử thành công."})
}

// SaveStorageSettings lưu cấu hình nơi cất file của một công ty.
//
// Bật S3 thì máy chủ tự chạy lại phép kiểm tra rồi mới ghi — cố ý chặn ở đây
// chứ không chỉ khoá nút bên giao diện, để gọi thẳng API cũng không lách được
// và không ai lưu nhầm một cấu hình hỏng rồi mất ảnh mới đồng bộ.
func SaveStorageSettings(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	userID := middleware.GetUserID(c)

	var req storageReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request", "details": err.Error()})
		return
	}

	cfg, err := config.Load()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "config_error"})
		return
	}

	if req.Backend == "local" {
		upsertSetting(tenantID, storagecfg.KeyBackend, "local", nil)
		storage.InvalidateTenant(tenantID)
		db.LogActivity(tenantID, userID, middleware.GetUserEmail(c), "settings.storage", "settings", tenantID,
			"Chuyển nơi cất file về máy chủ", "", c.ClientIP())
		c.JSON(http.StatusOK, gin.H{"message": "saved", "backend": "local"})
		return
	}

	scfg, err := dungCauHinh(cfg, tenantID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "storage_config_error", "message": err.Error()})
		return
	}
	if maLoi, moTa := kiemTraS3(scfg); maLoi != "" {
		log.Printf("[storage] công ty %s lưu cấu hình S3 không đạt: %s", tenantID, maLoi)
		c.JSON(http.StatusBadRequest, gin.H{"error": "storage_test_failed", "code": maLoi, "message": moTa})
		return
	}

	upsertSetting(tenantID, storagecfg.KeyEndpoint, scfg.S3Endpoint, nil)
	upsertSetting(tenantID, storagecfg.KeyBucket, scfg.S3Bucket, nil)
	upsertSetting(tenantID, storagecfg.KeyAccessKey, scfg.S3AccessKey, nil)
	upsertSetting(tenantID, storagecfg.KeyRegion, scfg.S3Region, nil)
	upsertSetting(tenantID, storagecfg.KeyPrefix, scfg.S3Prefix, nil)
	upsertSetting(tenantID, storagecfg.KeyPathStyle, boolChuoi(scfg.S3ForcePathStyle), nil)

	if req.SecretKey != "" {
		encrypted, err := pkg.Encrypt([]byte(req.SecretKey), cfg.EncryptionKey)
		if err != nil {
			log.Printf("[security] mã hoá Secret Key hỏng: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "encryption_error"})
			return
		}
		upsertSetting(tenantID, storagecfg.KeySecretKey, "", encrypted)
	}

	// Đặt backend sau cùng: mọi thứ trên đã ghi xong mới bật, để không có
	// khoảnh khắc nào backend là s3 mà thông tin còn dở.
	upsertSetting(tenantID, storagecfg.KeyBackend, "s3", nil)
	storage.InvalidateTenant(tenantID)

	db.LogActivity(tenantID, userID, middleware.GetUserEmail(c), "settings.storage", "settings", tenantID,
		"Bật lưu file lên S3, bucket "+scfg.S3Bucket, "", c.ClientIP())

	c.JSON(http.StatusOK, gin.H{"message": "saved", "backend": "s3"})
}

// GetStorageStatus cho giao diện biết công ty đang lưu file ở đâu và đã lưu
// Secret Key hay chưa.
// Đếm file trên đĩa phải duyệt cả thư mục, nên giữ kết quả một lúc: trang Cài
// đặt hay được mở lại và con số này không đổi theo từng giây.
const storageUsageTTL = 60 * time.Second

// Hạn cho một lần đếm. Kho lớn thì trả phần đếm được kèm dấu hiệu dở dang, còn
// hơn để người dùng ngồi chờ.
const storageUsageTimeout = 5 * time.Second

type usageCacheEntry struct {
	usage storage.Usage
	at    time.Time
}

var (
	usageCacheMu sync.Mutex
	usageCache   = map[string]usageCacheEntry{}
)

// localUsageCached đếm dung lượng trên đĩa, dùng lại kết quả cũ nếu còn hạn.
func localUsageCached(ctx context.Context, baseDir, tenantID string) storage.Usage {
	usageCacheMu.Lock()
	if e, ok := usageCache[tenantID]; ok && time.Since(e.at) < storageUsageTTL {
		usageCacheMu.Unlock()
		return e.usage
	}
	usageCacheMu.Unlock()

	ctx, cancel := context.WithTimeout(ctx, storageUsageTimeout)
	defer cancel()

	u, err := storage.LocalUsage(ctx, baseDir, tenantID)
	if err != nil {
		log.Printf("[storage] không đếm được file trên đĩa: tenant=%s", tenantID)
		return storage.Usage{}
	}

	// Số liệu dở dang không đáng để giữ lại, lần sau đếm lại từ đầu.
	if !u.Partial {
		usageCacheMu.Lock()
		usageCache[tenantID] = usageCacheEntry{usage: u, at: time.Now()}
		usageCacheMu.Unlock()
	}
	return u
}

func GetStorageStatus(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)

	var rows []models.AppSetting
	db.DB.Where("tenant_id = ?", tenantID).Find(&rows)
	get := func(key string) string {
		for _, r := range rows {
			if r.SettingKey == key {
				return r.ValuePlain
			}
		}
		return ""
	}

	backend := get(storagecfg.KeyBackend)
	if backend == "" {
		backend = "local"
	}
	cfg, err := config.Load()
	if err != nil {
		log.Printf("[storage] không đọc được cấu hình: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "config_error"})
		return
	}
	// Số file đang nằm trên đĩa máy chủ. Vẫn hiển thị khi đã bật S3, vì đó chính
	// là phần ảnh cũ chưa chuyển đi.
	dungTrenDia := localUsageCached(c.Request.Context(), cfg.StorageLocalDir, tenantID)

	c.JSON(http.StatusOK, gin.H{
		"backend":           backend,
		"local_bytes":       dungTrenDia.Bytes,
		"local_files":       dungTrenDia.Files,
		"local_partial":     dungTrenDia.Partial,
		"endpoint":          get(storagecfg.KeyEndpoint),
		"bucket":            get(storagecfg.KeyBucket),
		"region":            get(storagecfg.KeyRegion),
		"access_key":        get(storagecfg.KeyAccessKey),
		"prefix":            get(storagecfg.KeyPrefix),
		"force_path_style":  get(storagecfg.KeyPathStyle) == "true",
		"secret_key_da_luu": storagecfg.SecretDaLuu(tenantID),
	})
}

func boolChuoi(b bool) string {
	if b {
		return "true"
	}
	return "false"
}
