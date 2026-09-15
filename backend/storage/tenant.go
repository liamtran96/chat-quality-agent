package storage

import (
	"fmt"
	"sync"
	"time"
)

// ConfigLoader đọc cấu hình nơi cất file của một công ty. Tách thành hàm tiêm
// vào để package này không phải biết tới database.
type ConfigLoader func(tenantID string) (Config, error)

var (
	loaderMu sync.RWMutex
	loader   ConfigLoader

	cacheMu sync.Mutex
	cache   = map[string]cacheEntry{}
)

type cacheEntry struct {
	store   Store
	hetHan  time.Time
	backend string
}

// cacheTTL là lưới an toàn cho trường hợp chạy nhiều bản ứng dụng: bản này đổi
// cấu hình thì bản kia trễ nhất chừng này sẽ nhận ra. Đổi cấu hình trên cùng
// một bản thì xoá cache ngay, không phải chờ.
const cacheTTL = 5 * time.Minute

// SetConfigLoader đặt hàm đọc cấu hình, gọi một lần lúc khởi động.
func SetConfigLoader(l ConfigLoader) {
	loaderMu.Lock()
	defer loaderMu.Unlock()
	loader = l

	cacheMu.Lock()
	defer cacheMu.Unlock()
	cache = map[string]cacheEntry{}
}

// ForTenant trả về nơi cất file của một công ty.
//
// Mỗi công ty tự cấu hình kho của mình: công ty này để trên S3, công ty kia vẫn
// trên đĩa máy chủ, không ảnh hưởng nhau.
func ForTenant(tenantID string) (Store, error) {
	if tenantID == "" {
		return nil, fmt.Errorf("storage: thiếu mã công ty")
	}

	cacheMu.Lock()
	if e, ok := cache[tenantID]; ok && time.Now().Before(e.hetHan) {
		cacheMu.Unlock()
		return e.store, nil
	}
	cacheMu.Unlock()

	loaderMu.RLock()
	l := loader
	loaderMu.RUnlock()
	if l == nil {
		return nil, fmt.Errorf("storage: chưa đặt hàm đọc cấu hình")
	}

	cfg, err := l(tenantID)
	if err != nil {
		return nil, err
	}
	store, err := New(cfg)
	if err != nil {
		return nil, err
	}

	cacheMu.Lock()
	cache[tenantID] = cacheEntry{store: store, hetHan: time.Now().Add(cacheTTL), backend: store.Kind()}
	cacheMu.Unlock()
	return store, nil
}

// InvalidateTenant xoá cache sau khi công ty đổi cấu hình, để lần dùng kế tiếp
// đọc lại từ đầu.
func InvalidateTenant(tenantID string) {
	cacheMu.Lock()
	defer cacheMu.Unlock()
	delete(cache, tenantID)
}
