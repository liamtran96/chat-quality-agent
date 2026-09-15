// Package pricing giữ đơn giá token của các model AI.
//
// Đơn giá đến từ hai nguồn: bảng tĩnh biên dịch kèm chương trình (lưới an toàn,
// luôn có mặt) và bảng đồng bộ định kỳ từ nguồn ngoài (luôn mới hơn). Tra cứu
// ưu tiên bảng đồng bộ, thiếu thì mới dùng bảng tĩnh.
//
// Nguyên tắc: model chưa biết đơn giá thì báo là chưa biết, tuyệt đối không đoán
// bằng giá của model khác. Một con số sai trông như đúng còn tệ hơn không có số.
package pricing

import (
	"strings"
	"sync"
)

// Rate là đơn giá USD cho mỗi 1 triệu token.
type Rate struct {
	Input  float64
	Output float64
}

// staticRates là bảng đối chiếu tay theo giá công bố ngày 2026-09-15.
// Model thế hệ cũ giữ lại để nhật ký chi phí đã ghi vẫn tính đúng.
var staticRates = map[string]Rate{
	// Claude
	"claude-haiku-4-5-20251001":  {1.00, 5.00},
	"claude-haiku-4-5":           {1.00, 5.00},
	"claude-sonnet-5":            {2.00, 10.00},
	"claude-sonnet-4-6":          {3.00, 15.00},
	"claude-sonnet-4-20250514":   {3.00, 15.00},
	"claude-sonnet-4-5-20250929": {3.00, 15.00},
	"claude-opus-5":              {5.00, 25.00},
	"claude-opus-4-8":            {5.00, 25.00},
	"claude-opus-4-7":            {5.00, 25.00},
	"claude-opus-4-6":            {5.00, 25.00},
	"claude-opus-4":              {15.00, 75.00},
	"claude-fable-5-1":           {10.00, 50.00},
	"claude-fable-5":             {10.00, 50.00},

	// Gemini. Giá 3.8/3.7/3.6 Flash đang ưu đãi, tăng gấp đôi từ 2027-01-01.
	"gemini-3.8-flash":      {0.75, 3.75},
	"gemini-3.7-flash":      {0.75, 3.75},
	"gemini-3.6-flash":      {0.75, 3.75},
	"gemini-3.5-flash":      {1.50, 9.00},
	"gemini-3.5-flash-lite": {0.30, 2.50},
	"gemini-3.1-flash-lite": {0.25, 1.50},
	"gemini-2.5-pro":        {1.25, 10.00},
	"gemini-2.5-flash":      {0.30, 2.50},
	"gemini-2.5-flash-lite": {0.10, 0.40},
	"gemini-2.0-flash":      {0.075, 0.30}, // Google đã ngừng model này
}

var (
	mu          sync.RWMutex
	syncedRates map[string]Rate
)

// SetSynced thay toàn bộ bảng đơn giá đồng bộ được. Truyền nil để quay về chỉ
// dùng bảng tĩnh.
func SetSynced(rates map[string]Rate) {
	mu.Lock()
	defer mu.Unlock()
	syncedRates = rates
}

// SyncedCount cho biết bảng đồng bộ đang giữ bao nhiêu model.
func SyncedCount() int {
	mu.RLock()
	defer mu.RUnlock()
	return len(syncedRates)
}

// Lookup trả đơn giá của một model. known=false nghĩa là chưa biết giá — phía
// gọi phải xử lý như "chưa tính được", không được coi là 0 đồng.
func Lookup(model string) (rate Rate, known bool) {
	key := normalize(model)
	if key == "" {
		return Rate{}, false
	}

	mu.RLock()
	r, ok := syncedRates[key]
	mu.RUnlock()
	if ok {
		return r, true
	}

	r, ok = staticRates[key]
	return r, ok
}

// normalize đưa tên model về dạng tra cứu: bỏ khoảng trắng, hạ chữ thường và bỏ
// tiền tố nhà cung cấp mà một số nguồn gắn thêm (ví dụ "anthropic/", "xai/").
func normalize(model string) string {
	m := strings.ToLower(strings.TrimSpace(model))
	if i := strings.LastIndex(m, "/"); i >= 0 {
		m = m[i+1:]
	}
	return m
}

// StaticRates trả bản sao bảng tĩnh, dùng cho kiểm thử và chẩn đoán.
func StaticRates() map[string]Rate {
	out := make(map[string]Rate, len(staticRates))
	for k, v := range staticRates {
		out[k] = v
	}
	return out
}
