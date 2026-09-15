package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/vietbui/chat-quality-agent/ai/catalog"
	"github.com/vietbui/chat-quality-agent/api/middleware"
	"github.com/vietbui/chat-quality-agent/config"
	"github.com/vietbui/chat-quality-agent/db"
	"github.com/vietbui/chat-quality-agent/db/models"
	"github.com/vietbui/chat-quality-agent/pkg"
)

// Danh sách model đổi rất hiếm, nên bản lưu dùng được cả ngày.
const modelCacheTTL = 24 * time.Hour

const (
	settingModelsCache   = "ai_models_cache"
	settingModelsFetched = "ai_models_fetched_at"
)

type modelListResponse struct {
	Provider  string          `json:"provider"`
	Models    []catalog.Model `json:"models"`
	Source    string          `json:"source"` // provider | cache | static
	FetchedAt string          `json:"fetched_at,omitempty"`
	Message   string          `json:"message,omitempty"`
}

// Danh sách dự phòng khi chưa từng lấy được từ nhà cung cấp.
var staticClaudeModels = []catalog.Model{
	{ID: "claude-sonnet-5", Title: "Claude Sonnet 5 (Khuyến nghị)"},
	{ID: "claude-haiku-4-5", Title: "Claude Haiku 4.5 (Nhanh & rẻ)"},
	{ID: "claude-opus-5", Title: "Claude Opus 5 (Mạnh nhất)"},
	{ID: "claude-sonnet-4-6", Title: "Claude Sonnet 4.6 (Thế hệ cũ)"},
	{ID: "claude-opus-4-6", Title: "Claude Opus 4.6 (Thế hệ cũ)"},
}

var staticGeminiModels = []catalog.Model{
	{ID: "gemini-3.8-flash", Title: "Gemini 3.8 Flash (Khuyến nghị)"},
	{ID: "gemini-3.1-flash-lite", Title: "Gemini 3.1 Flash Lite (Nhanh & rẻ nhất)"},
	{ID: "gemini-3.5-flash-lite", Title: "Gemini 3.5 Flash Lite (Rẻ)"},
	{ID: "gemini-3.5-flash", Title: "Gemini 3.5 Flash (Mạnh hơn)"},
	{ID: "gemini-2.5-pro", Title: "Gemini 2.5 Pro (Thế hệ cũ)"},
	{ID: "gemini-2.5-flash", Title: "Gemini 2.5 Flash (Thế hệ cũ)"},
}

func staticModels(provider string) []catalog.Model {
	if provider == "gemini" {
		return staticGeminiModels
	}
	return staticClaudeModels
}

// ListAIModels trả danh sách model cho phần cấu hình AI.
//
// Trả ngay bản đã lưu để trang mở không phải chờ mạng; bản lưu quá hạn thì làm
// mới ngầm cho lần sau. Model đang được chọn luôn có mặt trong danh sách, kể cả
// khi nhà cung cấp đã gỡ nó đi.
func ListAIModels(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	provider := settingValue(tenantID, "ai_provider")
	if provider == "" {
		provider = "claude"
	}
	currentModel := settingValue(tenantID, "ai_model")

	cached, fetchedAt := readModelCache(tenantID, provider)
	if len(cached) > 0 {
		fresh := time.Since(fetchedAt) < modelCacheTTL
		if !fresh {
			// Làm mới ngầm, người dùng vẫn nhận danh sách cũ ngay lập tức.
			go refreshModelsInBackground(tenantID, provider)
		}
		c.JSON(http.StatusOK, modelListResponse{
			Provider:  provider,
			Models:    catalog.EnsureContains(cached, currentModel),
			Source:    "cache",
			FetchedAt: fetchedAt.Format(time.RFC3339),
		})
		return
	}

	// Chưa có bản lưu nào: thử lấy ngay, hỏng thì dùng danh sách dự phòng.
	fetched, err := fetchModels(c.Request.Context(), tenantID, provider)
	if err != nil {
		c.JSON(http.StatusOK, modelListResponse{
			Provider: provider,
			Models:   catalog.EnsureContains(staticModels(provider), currentModel),
			Source:   "static",
			Message:  "Chưa lấy được danh sách từ nhà cung cấp, đang hiển thị danh sách có sẵn",
		})
		return
	}

	saveModelCache(tenantID, provider, fetched)
	c.JSON(http.StatusOK, modelListResponse{
		Provider:  provider,
		Models:    catalog.EnsureContains(fetched, currentModel),
		Source:    "provider",
		FetchedAt: time.Now().Format(time.RFC3339),
	})
}

// RefreshAIModels ép lấy lại danh sách ngay, phục vụ nút Làm mới.
func RefreshAIModels(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	provider := settingValue(tenantID, "ai_provider")
	if provider == "" {
		provider = "claude"
	}
	currentModel := settingValue(tenantID, "ai_model")

	fetched, err := fetchModels(c.Request.Context(), tenantID, provider)
	if err != nil {
		code, message := classifyProviderError(err)
		// classifyProviderError viết cho việc thử key; với việc lấy danh sách thì
		// lỗi chung chung cần câu chữ đúng ngữ cảnh hơn.
		if code == "test_failed" {
			code = "model_list_failed"
			message = "Không lấy được danh sách model từ nhà cung cấp. Kiểm tra lại API key và kết nối mạng"
		}
		log.Printf("[ai] làm mới danh sách model thất bại: tenant=%s provider=%s reason=%s", tenantID, provider, code)
		c.JSON(http.StatusBadRequest, gin.H{"error": code, "message": message})
		return
	}

	saveModelCache(tenantID, provider, fetched)
	c.JSON(http.StatusOK, modelListResponse{
		Provider:  provider,
		Models:    catalog.EnsureContains(fetched, currentModel),
		Source:    "provider",
		FetchedAt: time.Now().Format(time.RFC3339),
	})
}

func fetchModels(ctx context.Context, tenantID, provider string) ([]catalog.Model, error) {
	cfg, err := config.Load()
	if err != nil {
		return nil, err
	}

	var setting models.AppSetting
	if err := db.DB.Where("tenant_id = ? AND setting_key = ?", tenantID, "ai_api_key").First(&setting).Error; err != nil {
		return nil, err
	}
	apiKey, err := pkg.Decrypt(setting.ValueEncrypted, cfg.EncryptionKey)
	if err != nil {
		return nil, err
	}

	baseURL := settingValue(tenantID, "ai_base_url")
	if provider == "gemini" {
		return catalog.FetchGemini(ctx, string(apiKey), baseURL)
	}
	return catalog.FetchClaude(ctx, string(apiKey), baseURL)
}

func refreshModelsInBackground(tenantID, provider string) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[security] panic recovered khi làm mới danh sách model: %v", r)
		}
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	fetched, err := fetchModels(ctx, tenantID, provider)
	if err != nil {
		log.Printf("[ai] làm mới ngầm danh sách model thất bại: tenant=%s provider=%s", tenantID, provider)
		return
	}
	saveModelCache(tenantID, provider, fetched)
}

func readModelCache(tenantID, provider string) ([]catalog.Model, time.Time) {
	raw := settingValue(tenantID, settingModelsCache)
	if raw == "" {
		return nil, time.Time{}
	}
	var stored struct {
		Provider string          `json:"provider"`
		Models   []catalog.Model `json:"models"`
	}
	if err := json.Unmarshal([]byte(raw), &stored); err != nil {
		return nil, time.Time{}
	}
	// Đổi nhà cung cấp thì bản lưu cũ không dùng được.
	if stored.Provider != provider {
		return nil, time.Time{}
	}
	fetchedAt, err := time.Parse(time.RFC3339, settingValue(tenantID, settingModelsFetched))
	if err != nil {
		return stored.Models, time.Time{}
	}
	return stored.Models, fetchedAt
}

func saveModelCache(tenantID, provider string, list []catalog.Model) {
	payload, err := json.Marshal(struct {
		Provider string          `json:"provider"`
		Models   []catalog.Model `json:"models"`
	}{provider, list})
	if err != nil {
		log.Printf("[ai] không lưu được danh sách model: %v", err)
		return
	}
	upsertSetting(tenantID, settingModelsCache, string(payload), nil)
	upsertSetting(tenantID, settingModelsFetched, time.Now().Format(time.RFC3339), nil)
}

func settingValue(tenantID, key string) string {
	var s models.AppSetting
	if err := db.DB.Where("tenant_id = ? AND setting_key = ?", tenantID, key).First(&s).Error; err != nil {
		return ""
	}
	return s.ValuePlain
}
