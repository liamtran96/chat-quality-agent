package pricing

import (
	"context"
	"os"
	"testing"
	"time"
)

func TestFetchThatTuNguonNgoai(t *testing.T) {
	if os.Getenv("CQA_LIVE_FETCH") == "" {
		t.Skip("đặt CQA_LIVE_FETCH=1 để gọi mạng thật")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()

	rates, err := Fetch(ctx, "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json")
	if err != nil {
		t.Fatalf("Fetch: %v", err)
	}
	t.Logf("nhận %d model sau khi lọc", len(rates))

	for _, m := range []string{"claude-sonnet-5", "claude-opus-5", "claude-haiku-4-5", "gemini-3.8-flash", "gemini-2.5-flash"} {
		r, ok := rates[m]
		if !ok {
			t.Errorf("thiếu %s", m)
			continue
		}
		t.Logf("%-22s in=%.4f out=%.4f", m, r.Input, r.Output)
	}

	// Đối chiếu với bảng tĩnh để phát hiện lệch giá
	for m, static := range StaticRates() {
		if live, ok := rates[m]; ok {
			if diff := live.Input - static.Input; diff > 0.0001 || diff < -0.0001 {
				t.Logf("LỆCH %s: tĩnh in=%.4f, nguồn in=%.4f", m, static.Input, live.Input)
			}
			if diff := live.Output - static.Output; diff > 0.0001 || diff < -0.0001 {
				t.Logf("LỆCH %s: tĩnh out=%.4f, nguồn out=%.4f", m, static.Output, live.Output)
			}
		}
	}
}
