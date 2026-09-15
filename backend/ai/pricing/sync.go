package pricing

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

// Giới hạn khi lấy bảng giá từ nguồn ngoài. Dữ liệu tải về là dữ liệu không tin
// cậy: chỉ đọc số, không thực thi, và mọi bản ghi phải qua kiểm tra bên dưới.
const (
	// File nguồn hiện khoảng 2.4MB; chặn ở 16MB để một nguồn bị thay đổi hay bị
	// chiếm quyền không thể bơm dữ liệu vô hạn vào bộ nhớ.
	maxDownloadBytes = 16 << 20
	maxModelNameLen  = 100
	// Không nhà cung cấp nào bán trên 1000 USD/1 triệu token. Vượt ngưỡng này
	// gần như chắc chắn là dữ liệu hỏng hoặc bị sửa.
	maxRatePerMillion = 1000.0
	// Đồng bộ mà thu được quá ít model thì coi như nguồn hỏng, giữ bảng đang dùng.
	minAcceptedModels = 10
	downloadTimeout   = 60 * time.Second
)

// Chỉ nhận model của những dòng CQA thực sự dùng, để không nuốt cả nghìn model
// không liên quan vào bộ nhớ.
var wantedPrefixes = []string{"claude-", "gemini-"}

// Tên model hợp lệ: chữ thường, số, và một vài dấu phân cách. Chặn mọi thứ khác
// để dữ liệu ngoài không lọt được ký tự lạ vào khoá tra cứu.
var validModelName = regexp.MustCompile(`^[a-z0-9._\-]+$`)

// entry là phần duy nhất của mỗi bản ghi mà chương trình đọc tới.
type entry struct {
	InputCostPerToken  float64 `json:"input_cost_per_token"`
	OutputCostPerToken float64 `json:"output_cost_per_token"`
}

// Fetch tải và lọc bảng giá từ sourceURL. Trả về bảng đơn giá theo 1 triệu token.
func Fetch(ctx context.Context, sourceURL string) (map[string]Rate, error) {
	parsed, err := url.Parse(sourceURL)
	if err != nil {
		return nil, fmt.Errorf("parsing pricing url: %w", err)
	}
	if parsed.Scheme != "https" {
		return nil, fmt.Errorf("pricing url phải dùng https, đang là %q", parsed.Scheme)
	}
	host := parsed.Hostname()

	client := &http.Client{
		Timeout: downloadTimeout,
		// Chỉ cho chuyển hướng trong cùng host, tránh bị dẫn sang nơi khác.
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if req.URL.Hostname() != host {
				return fmt.Errorf("từ chối chuyển hướng sang host khác: %s", req.URL.Hostname())
			}
			if len(via) >= 5 {
				return fmt.Errorf("quá nhiều lần chuyển hướng")
			}
			return nil
		},
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, sourceURL, nil)
	if err != nil {
		return nil, fmt.Errorf("creating pricing request: %w", err)
	}
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetching pricing: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("nguồn giá trả mã %d", resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, maxDownloadBytes))
	if err != nil {
		return nil, fmt.Errorf("reading pricing body: %w", err)
	}
	if len(body) >= maxDownloadBytes {
		return nil, fmt.Errorf("dữ liệu giá vượt giới hạn %d byte", maxDownloadBytes)
	}

	var raw map[string]entry
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("parsing pricing json: %w", err)
	}

	rates, rejected := filterRates(raw)

	if len(rates) < minAcceptedModels {
		return nil, fmt.Errorf("chỉ nhận được %d model hợp lệ, nghi nguồn hỏng", len(rates))
	}
	if rejected > 0 {
		log.Printf("[pricing] bỏ qua %d bản ghi có đơn giá không hợp lệ", rejected)
	}
	return rates, nil
}

// filterRates giữ lại những bản ghi hợp lệ và quy đổi sang giá cho mỗi 1 triệu
// token. Tách riêng để kiểm thử được phần lọc mà không cần dựng máy chủ.
func filterRates(raw map[string]entry) (map[string]Rate, int) {
	rates := make(map[string]Rate)
	var rejected int
	for name, e := range raw {
		key := normalize(name)
		if !accept(key) {
			continue
		}
		in := e.InputCostPerToken * 1_000_000
		out := e.OutputCostPerToken * 1_000_000
		if !validRate(in) || !validRate(out) {
			rejected++
			continue
		}
		// Tên rút gọn có thể trùng nhau giữa các bản ghi; giữ bản đầu tiên hợp lệ.
		if _, seen := rates[key]; !seen {
			rates[key] = Rate{Input: in, Output: out}
		}
	}
	return rates, rejected
}

func accept(key string) bool {
	if key == "" || len(key) > maxModelNameLen {
		return false
	}
	if !validModelName.MatchString(key) {
		return false
	}
	for _, p := range wantedPrefixes {
		if strings.HasPrefix(key, p) {
			return true
		}
	}
	return false
}

func validRate(v float64) bool {
	// Giá âm, NaN, vô cực hoặc lớn bất thường đều bị loại. Giá 0 được chấp nhận
	// vì một số model thật sự miễn phí.
	if v != v || v < 0 || v > maxRatePerMillion {
		return false
	}
	return true
}

// StartSync chạy nền: đồng bộ một lần sau delay ngắn rồi lặp lại theo interval.
// Lỗi không làm chương trình dừng — bảng tĩnh vẫn phục vụ bình thường.
func StartSync(ctx context.Context, sourceURL string, interval time.Duration) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("[security] panic recovered trong đồng bộ giá: %v", r)
			}
		}()

		// Chờ một chút để không tranh tài nguyên lúc khởi động.
		select {
		case <-ctx.Done():
			return
		case <-time.After(15 * time.Second):
		}

		for {
			syncOnce(ctx, sourceURL)
			select {
			case <-ctx.Done():
				return
			case <-time.After(interval):
			}
		}
	}()
}

func syncOnce(ctx context.Context, sourceURL string) {
	rates, err := Fetch(ctx, sourceURL)
	if err != nil {
		log.Printf("[pricing] đồng bộ bảng giá thất bại, tiếp tục dùng bảng tĩnh: %v", err)
		return
	}
	SetSynced(rates)
	log.Printf("[pricing] đã đồng bộ đơn giá cho %d model", len(rates))
}
