package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestOpenAICompatibleGoiVaDocPhanHoi(t *testing.T) {
	var gotBody map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if auth := r.Header.Get("Authorization"); auth != "Bearer key-test" {
			t.Errorf("header Authorization sai: %q", auth)
		}
		if !strings.HasSuffix(r.URL.Path, "/chat/completions") {
			t.Errorf("đường dẫn sai: %s", r.URL.Path)
		}
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		fmt.Fprint(w, `{"choices":[{"message":{"content":"ket qua"},"finish_reason":"stop"}],"usage":{"prompt_tokens":120,"completion_tokens":30}}`)
	}))
	defer srv.Close()

	p := NewOpenAIProvider("key-test", "gpt-5", 256, srv.URL)
	resp, err := p.AnalyzeChat(context.Background(), "hệ thống", "nội dung chat")
	if err != nil {
		t.Fatalf("AnalyzeChat: %v", err)
	}
	if resp.Content != "ket qua" {
		t.Errorf("nội dung = %q", resp.Content)
	}
	if resp.InputTokens != 120 || resp.OutputTokens != 30 {
		t.Errorf("token = %d/%d, mong đợi 120/30", resp.InputTokens, resp.OutputTokens)
	}
	if resp.Provider != "openai" {
		t.Errorf("provider = %q", resp.Provider)
	}
	// OpenAI đã bỏ max_tokens trên model đời mới.
	if _, dung := gotBody["max_completion_tokens"]; !dung {
		t.Error("OpenAI phải gửi max_completion_tokens")
	}
	if _, saiTen := gotBody["max_tokens"]; saiTen {
		t.Error("OpenAI không được gửi max_tokens")
	}
}

func TestXAIDungTenThamSoCu(t *testing.T) {
	var gotBody map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		fmt.Fprint(w, `{"choices":[{"message":{"content":"ok"}}],"usage":{"prompt_tokens":1,"completion_tokens":1}}`)
	}))
	defer srv.Close()

	p := NewXAIProvider("key-test", "grok-4", 256, srv.URL)
	resp, err := p.AnalyzeChat(context.Background(), "hệ thống", "chat")
	if err != nil {
		t.Fatalf("AnalyzeChat: %v", err)
	}
	if resp.Provider != "xai" {
		t.Errorf("provider = %q", resp.Provider)
	}
	if _, dung := gotBody["max_tokens"]; !dung {
		t.Error("xAI phải gửi max_tokens")
	}
}

func TestOpenAICompatibleBaoLoiRoRang(t *testing.T) {
	cases := []struct {
		name   string
		status int
		body   string
		mong   string
	}{
		{"key sai", http.StatusUnauthorized, `{"error":{"message":"Invalid API key"}}`, "401"},
		{"khong co choices", http.StatusOK, `{"choices":[]}`, "no choices"},
		{"noi dung rong", http.StatusOK, `{"choices":[{"message":{"content":"  "}}]}`, "empty content"},
		{"bi tu choi", http.StatusOK, `{"choices":[{"message":{"content":"","refusal":"khong the tra loi"}}]}`, "từ chối"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tc.status)
				fmt.Fprint(w, tc.body)
			}))
			defer srv.Close()

			p := NewOpenAIProvider("key", "gpt-5", 64, srv.URL)
			_, err := p.AnalyzeChat(context.Background(), "s", "u")
			if err == nil {
				t.Fatal("phải báo lỗi")
			}
			if !strings.Contains(err.Error(), tc.mong) {
				t.Errorf("lỗi %q không chứa %q", err.Error(), tc.mong)
			}
		})
	}
}
