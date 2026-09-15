package pricing

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// fetchFrom dựng một máy chủ giả trả về body cho trước rồi gọi Fetch.
// Fetch bắt buộc https nên test dùng máy chủ TLS.
func fetchFrom(t *testing.T, body string) (map[string]Rate, error) {
	t.Helper()
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, body)
	}))
	t.Cleanup(srv.Close)

	// Dùng client của máy chủ test để chấp nhận chứng chỉ tự ký.
	oldTransport := http.DefaultTransport
	http.DefaultTransport = srv.Client().Transport
	t.Cleanup(func() { http.DefaultTransport = oldTransport })

	return Fetch(context.Background(), srv.URL)
}

func TestFetchChanNguonKhongPhaiHTTPS(t *testing.T) {
	_, err := Fetch(context.Background(), "http://example.com/prices.json")
	if err == nil {
		t.Fatal("phải từ chối nguồn http")
	}
	if !strings.Contains(err.Error(), "https") {
		t.Errorf("thông báo lỗi nên nói về https, đang là: %v", err)
	}
}

func TestFetchLoaiDonGiaBatThuong(t *testing.T) {
	body := `{
		"claude-tot": {"input_cost_per_token": 0.000002, "output_cost_per_token": 0.00001},
		"claude-am": {"input_cost_per_token": -0.5, "output_cost_per_token": 0.00001},
		"claude-qua-lon": {"input_cost_per_token": 1.0, "output_cost_per_token": 0.00001},
		"claude-thieu-field": {"context_window": 200000},
		"gemini-tot": {"input_cost_per_token": 0.00000075, "output_cost_per_token": 0.00000375},
		"gpt-khong-quan-tam": {"input_cost_per_token": 0.000001, "output_cost_per_token": 0.000002},
		"claude-ten-co-ky-tu-la<script>": {"input_cost_per_token": 0.000001, "output_cost_per_token": 0.000002}
	}`
	// Gọi thẳng bộ lọc, không qua ngưỡng số lượng tối thiểu của Fetch.
	var raw map[string]entry
	if err := json.Unmarshal([]byte(body), &raw); err != nil {
		t.Fatalf("dữ liệu test hỏng: %v", err)
	}
	rates, _ := filterRates(raw)

	if _, ok := rates["claude-tot"]; !ok {
		t.Error("bản ghi hợp lệ phải được giữ")
	}
	if _, ok := rates["gemini-tot"]; !ok {
		t.Error("bản ghi gemini hợp lệ phải được giữ")
	}
	for _, bad := range []string{"claude-am", "claude-qua-lon", "gpt-khong-quan-tam", "claude-ten-co-ky-tu-la<script>"} {
		if _, ok := rates[bad]; ok {
			t.Errorf("bản ghi %q đáng lẽ bị loại", bad)
		}
	}
	// Thiếu trường giá thì coi như 0 đồng, vẫn hợp lệ vì có model miễn phí thật.
	if r, ok := rates["claude-thieu-field"]; ok && (r.Input != 0 || r.Output != 0) {
		t.Errorf("bản ghi thiếu trường giá phải ra 0, đang là %+v", r)
	}
}

func TestFetchTuChoiNguonQuaIt(t *testing.T) {
	_, err := fetchFrom(t, `{"claude-mot-minh": {"input_cost_per_token": 0.000002, "output_cost_per_token": 0.00001}}`)
	if err == nil {
		t.Fatal("nguồn chỉ có 1 model hợp lệ phải bị từ chối")
	}
	if !strings.Contains(err.Error(), "nghi nguồn hỏng") {
		t.Errorf("lỗi nên nói nghi nguồn hỏng, đang là: %v", err)
	}
}

func TestFetchTuChoiJSONHong(t *testing.T) {
	if _, err := fetchFrom(t, `{khong phai json`); err == nil {
		t.Fatal("JSON hỏng phải báo lỗi")
	}
}

func TestLookupUuTienBangDongBo(t *testing.T) {
	t.Cleanup(func() { SetSynced(nil) })

	before, ok := Lookup("claude-sonnet-5")
	if !ok || before.Input != 2.00 {
		t.Fatalf("bảng tĩnh phải có claude-sonnet-5, đang là %+v", before)
	}

	SetSynced(map[string]Rate{"claude-sonnet-5": {Input: 9.99, Output: 99.9}})
	after, ok := Lookup("claude-sonnet-5")
	if !ok || after.Input != 9.99 {
		t.Errorf("bảng đồng bộ phải được ưu tiên, đang là %+v", after)
	}

	// Model chỉ có trong bảng tĩnh vẫn tra được khi bảng đồng bộ thiếu.
	if _, ok := Lookup("claude-haiku-4-5"); !ok {
		t.Error("phải rơi về bảng tĩnh khi bảng đồng bộ không có model")
	}

	SetSynced(nil)
	back, ok := Lookup("claude-sonnet-5")
	if !ok || back.Input != 2.00 {
		t.Errorf("xoá bảng đồng bộ phải quay lại bảng tĩnh, đang là %+v", back)
	}
}

func TestLookupModelChuaBiet(t *testing.T) {
	if _, ok := Lookup("model-khong-ton-tai"); ok {
		t.Error("model lạ không được coi là đã biết giá")
	}
	if _, ok := Lookup(""); ok {
		t.Error("tên rỗng không được coi là đã biết giá")
	}
}

func TestLookupBoTienToNhaCungCap(t *testing.T) {
	withPrefix, ok := Lookup("anthropic/claude-sonnet-5")
	if !ok {
		t.Fatal("tên có tiền tố nhà cung cấp phải tra được")
	}
	plain, _ := Lookup("claude-sonnet-5")
	if withPrefix != plain {
		t.Errorf("có tiền tố %+v khác không tiền tố %+v", withPrefix, plain)
	}
}
