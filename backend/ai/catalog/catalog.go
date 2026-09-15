// Package catalog lấy danh sách model đang khả dụng từ nhà cung cấp AI.
//
// Danh sách trả về từ nhà cung cấp cũng là dữ liệu ngoài: tên model được kiểm
// tra dạng thức, số lượng bị giới hạn, và model không dùng được cho việc chấm
// chat (embedding, sinh ảnh, đọc/ghi âm thanh) bị loại bỏ.
package catalog

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"time"
)

const (
	fetchTimeout    = 20 * time.Second
	maxResponseSize = 2 << 20 // 2MB, danh sách model không bao giờ lớn hơn thế
	maxModels       = 200
	maxModelNameLen = 100
)

var validModelID = regexp.MustCompile(`^[a-zA-Z0-9._\-]+$`)

// Model là một lựa chọn hiển thị trong phần cấu hình.
type Model struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

// Những dòng model không phục vụ việc chấm chat.
var excludedKeywords = []string{
	"embedding", "embed", "imagen", "image-generation", "veo", "aqa",
	"tts", "text-to-speech", "audio", "vision-only", "learnlm",
}

func usableForChat(id string) bool {
	lower := strings.ToLower(id)
	for _, kw := range excludedKeywords {
		if strings.Contains(lower, kw) {
			return false
		}
	}
	return true
}

func validID(id string) bool {
	return id != "" && len(id) <= maxModelNameLen && validModelID.MatchString(id)
}

func httpClient() *http.Client {
	return &http.Client{Timeout: fetchTimeout}
}

func readLimited(resp *http.Response) ([]byte, error) {
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseSize))
	if err != nil {
		return nil, fmt.Errorf("reading model list: %w", err)
	}
	return body, nil
}

// FetchClaude lấy danh sách model Claude khả dụng với API key đã cho.
func FetchClaude(ctx context.Context, apiKey, baseURL string) ([]Model, error) {
	endpoint := strings.TrimSuffix(baseURL, "/")
	if endpoint == "" {
		endpoint = "https://api.anthropic.com"
	}
	endpoint += "/v1/models?limit=100"

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("creating claude models request: %w", err)
	}
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := httpClient().Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetching claude models: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("nhà cung cấp trả mã %d", resp.StatusCode)
	}

	body, err := readLimited(resp)
	if err != nil {
		return nil, err
	}

	var payload struct {
		Data []struct {
			ID          string    `json:"id"`
			DisplayName string    `json:"display_name"`
			CreatedAt   time.Time `json:"created_at"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("parsing claude models: %w", err)
	}

	type dated struct {
		Model
		created time.Time
	}
	var items []dated
	for _, m := range payload.Data {
		if !validID(m.ID) || !usableForChat(m.ID) {
			continue
		}
		title := strings.TrimSpace(m.DisplayName)
		if title == "" || len(title) > maxModelNameLen {
			title = m.ID
		}
		items = append(items, dated{Model{ID: m.ID, Title: title}, m.CreatedAt})
		if len(items) >= maxModels {
			break
		}
	}
	// Model mới nhất lên đầu.
	sort.SliceStable(items, func(i, j int) bool { return items[i].created.After(items[j].created) })

	out := make([]Model, 0, len(items))
	for _, it := range items {
		out = append(out, it.Model)
	}
	return out, nil
}

// FetchGemini lấy danh sách model Gemini khả dụng với API key đã cho.
func FetchGemini(ctx context.Context, apiKey, baseURL string) ([]Model, error) {
	endpoint := strings.TrimSuffix(baseURL, "/")
	if endpoint == "" {
		endpoint = "https://generativelanguage.googleapis.com"
	}
	endpoint += "/v1beta/models?pageSize=200"

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("creating gemini models request: %w", err)
	}
	// Key đặt ở header, không nhét vào query để không lọt vào log máy chủ.
	req.Header.Set("x-goog-api-key", apiKey)

	resp, err := httpClient().Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetching gemini models: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("nhà cung cấp trả mã %d", resp.StatusCode)
	}

	body, err := readLimited(resp)
	if err != nil {
		return nil, err
	}

	var payload struct {
		Models []struct {
			Name                       string   `json:"name"`
			DisplayName                string   `json:"displayName"`
			SupportedGenerationMethods []string `json:"supportedGenerationMethods"`
		} `json:"models"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("parsing gemini models: %w", err)
	}

	var out []Model
	for _, m := range payload.Models {
		id := strings.TrimPrefix(m.Name, "models/")
		if !validID(id) || !usableForChat(id) {
			continue
		}
		// Chỉ giữ model sinh nội dung; bỏ embedding và các loại khác.
		if !supports(m.SupportedGenerationMethods, "generateContent") {
			continue
		}
		title := strings.TrimSpace(m.DisplayName)
		if title == "" || len(title) > maxModelNameLen {
			title = id
		}
		out = append(out, Model{ID: id, Title: title})
		if len(out) >= maxModels {
			break
		}
	}
	// Google không trả ngày tạo; xếp theo tên giảm dần để bản mới lên trước.
	sort.SliceStable(out, func(i, j int) bool { return out[i].ID > out[j].ID })
	return out, nil
}

func supports(methods []string, want string) bool {
	for _, m := range methods {
		if m == want {
			return true
		}
	}
	return false
}

// EnsureContains đảm bảo model đang được chọn luôn có mặt trong danh sách.
//
// Nhà cung cấp gỡ model cũ khỏi danh sách, hoặc bộ lọc loại nó ra, đều khiến ô
// chọn model hiện trống và người đang dùng model đó mất lựa chọn của mình.
func EnsureContains(models []Model, currentID string) []Model {
	if currentID == "" {
		return models
	}
	for _, m := range models {
		if m.ID == currentID {
			return models
		}
	}
	// Đặt lên đầu để người dùng thấy ngay model mình đang dùng.
	return append([]Model{{ID: currentID, Title: currentID + " (đang dùng)"}}, models...)
}
