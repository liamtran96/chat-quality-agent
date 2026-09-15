package catalog

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestEnsureContainsGiuModelDangDung(t *testing.T) {
	list := []Model{
		{ID: "claude-sonnet-5", Title: "Claude Sonnet 5"},
		{ID: "claude-opus-5", Title: "Claude Opus 5"},
	}

	// Người dùng đang chọn một model đời cũ mà nhà cung cấp không còn liệt kê.
	got := EnsureContains(list, "claude-sonnet-4-20250514")
	if len(got) != 3 {
		t.Fatalf("mong đợi 3 mục, nhận %d", len(got))
	}
	if got[0].ID != "claude-sonnet-4-20250514" {
		t.Errorf("model đang dùng phải nằm đầu danh sách, đang là %q", got[0].ID)
	}

	// Không nhân bản khi model đang dùng vốn đã có trong danh sách.
	same := EnsureContains(list, "claude-opus-5")
	if len(same) != 2 {
		t.Errorf("không được thêm trùng, nhận %d mục", len(same))
	}

	// Chưa chọn gì thì giữ nguyên.
	if len(EnsureContains(list, "")) != 2 {
		t.Error("chưa chọn model thì danh sách phải giữ nguyên")
	}
}

func TestFetchClaudeLocVaXepTheoNgay(t *testing.T) {
	body := `{"data":[
		{"id":"claude-sonnet-4-6","display_name":"Claude Sonnet 4.6","created_at":"2026-02-01T00:00:00Z"},
		{"id":"claude-sonnet-5","display_name":"Claude Sonnet 5","created_at":"2026-06-01T00:00:00Z"},
		{"id":"claude-embedding-v1","display_name":"Embedding","created_at":"2026-05-01T00:00:00Z"},
		{"id":"ten co khoang trang","display_name":"Xau","created_at":"2026-07-01T00:00:00Z"}
	]}`
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("x-api-key") == "" {
			t.Error("thiếu header x-api-key")
		}
		fmt.Fprint(w, body)
	}))
	defer srv.Close()

	got, err := FetchClaude(context.Background(), "key-test", srv.URL)
	if err != nil {
		t.Fatalf("FetchClaude: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("mong đợi 2 model sau khi lọc, nhận %d: %+v", len(got), got)
	}
	if got[0].ID != "claude-sonnet-5" {
		t.Errorf("model mới nhất phải đứng đầu, đang là %q", got[0].ID)
	}
	for _, m := range got {
		if m.ID == "claude-embedding-v1" {
			t.Error("model embedding phải bị loại")
		}
		if m.ID == "ten co khoang trang" {
			t.Error("tên model có ký tự lạ phải bị loại")
		}
	}
}

func TestFetchGeminiChiGiuModelSinhNoiDung(t *testing.T) {
	body := `{"models":[
		{"name":"models/gemini-3.8-flash","displayName":"Gemini 3.8 Flash","supportedGenerationMethods":["generateContent"]},
		{"name":"models/gemini-2.5-flash","displayName":"Gemini 2.5 Flash","supportedGenerationMethods":["generateContent"]},
		{"name":"models/text-embedding-004","displayName":"Embedding","supportedGenerationMethods":["embedContent"]},
		{"name":"models/imagen-3.0","displayName":"Imagen","supportedGenerationMethods":["predict"]}
	]}`
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("x-goog-api-key") == "" {
			t.Error("thiếu header x-goog-api-key")
		}
		if r.URL.Query().Get("key") != "" {
			t.Error("API key không được đặt trong query string")
		}
		fmt.Fprint(w, body)
	}))
	defer srv.Close()

	got, err := FetchGemini(context.Background(), "key-test", srv.URL)
	if err != nil {
		t.Fatalf("FetchGemini: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("mong đợi 2 model, nhận %d: %+v", len(got), got)
	}
	if got[0].ID != "gemini-3.8-flash" {
		t.Errorf("bản mới hơn phải đứng đầu, đang là %q", got[0].ID)
	}
}

func TestFetchBaoLoiKhiNhaCungCapTuChoi(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer srv.Close()

	if _, err := FetchClaude(context.Background(), "key-sai", srv.URL); err == nil {
		t.Error("key sai phải báo lỗi")
	}
	if _, err := FetchGemini(context.Background(), "key-sai", srv.URL); err == nil {
		t.Error("key sai phải báo lỗi")
	}
}
