package channels

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

// Dữ liệu mẫu chép theo đúng cấu trúc API Pancake trả về cho một page thật,
// đã thay tên, ID và link bằng giá trị giả.
const pancakeTestPageID = "1000001"

const pancakeMessagesFixture = `{
  "success": true,
  "conversation_id": "1000001_2000002",
  "conv_from": {"id": "2000002", "name": "Khach Test"},
  "recent_phone_numbers": [{"phone_number": "0900000000"}],
  "messages": [
    {"id": "m_text_customer", "page_id": "1000001", "type": "INBOX",
     "message": "<div>xin chào</div>", "original_message": "xin chào",
     "from": {"id": "2000002", "name": "Khach Test", "email": "khach@example.com", "ai_generated": false},
     "inserted_at": "2026-09-24T15:18:18.000000", "attachments": []},
    {"id": "m_text_agent", "page_id": "1000001", "type": "INBOX",
     "message": "<div>chào bạn nhé</div>", "original_message": "chào bạn nhé",
     "from": {"id": "1000001", "name": "Page Test", "admin_name": "Nhan Vien A", "uid": "uid-1"},
     "inserted_at": "2026-09-24T15:18:30.428000", "attachments": []},
    {"id": "m_escaped", "page_id": "1000001", "type": "INBOX",
     "message": "<div>&lt;3</div>", "original_message": "<3",
     "from": {"id": "2000002", "name": "Khach Test"},
     "inserted_at": "2026-09-24T15:48:04.000000", "attachments": []},
    {"id": "m_sticker", "page_id": "1000001", "type": "INBOX",
     "message": "<div></div>", "original_message": "",
     "from": {"id": "2000002", "name": "Khach Test"},
     "inserted_at": "2026-09-24T15:47:59.000000",
     "attachments": [{"id": "767", "type": "sticker", "url": "https://content.pancake.vn/2.1/stickers/767", "link": "https://content.pancake.vn/2.1/stickers/767"}]},
    {"id": "m_photo", "page_id": "1000001", "type": "INBOX",
     "message": "<div></div>", "original_message": "",
     "from": {"id": "2000002", "name": "Khach Test"},
     "inserted_at": "2026-09-24T15:49:05.000000",
     "attachments": [{"type": "photo", "url": "https://content.pancake.vn/2-2609/2026/9/24/abc123.png", "image_data": {"width": 943, "height": 2048}}]},
    {"id": "m_video", "page_id": "1000001", "type": "INBOX",
     "message": "<div></div>", "original_message": "",
     "from": {"id": "2000002", "name": "Khach Test"},
     "inserted_at": "2026-09-24T15:49:27.000000",
     "attachments": [{"id": "106", "type": "video", "mime_type": "video/mp4", "url": "https://content.pancake.vn/2-2609/2026/9/24/thumb.jpg", "video_data": {"url": "https://video.example.com/v/clip.mp4?oe=6AB71DFD", "width": 1920, "height": 1080}}]},
    {"id": "m_file", "page_id": "1000001", "type": "INBOX",
     "message": "<div></div>", "original_message": "",
     "from": {"id": "2000002", "name": "Khach Test"},
     "inserted_at": "2026-09-24T15:50:49.000000",
     "attachments": [{"id": "105", "file_url": "https://cdn.example.com/f/bao-gia.pdf?dl=1", "mime_type": "application/pdf", "name": "Bao gia (1).pdf", "size": 2698694}]}
  ]
}`

func newTestPancakeAdapter(baseURL string) *PancakeAdapter {
	a := NewPancakeAdapter(PancakeCredentials{PageID: pancakeTestPageID, PageAccessToken: "test-token"})
	a.v1Base = baseURL + "/v1"
	a.v2Base = baseURL + "/v2"
	a.minInterval = 0
	a.backoff = time.Millisecond
	return a
}

func TestNewAdapterPancake(t *testing.T) {
	adapter, err := NewAdapter("pancake", []byte(`{"page_id":"1","page_access_token":"tok"}`))
	if err != nil {
		t.Fatalf("NewAdapter pancake failed: %v", err)
	}
	if _, ok := adapter.(*PancakeAdapter); !ok {
		t.Fatalf("expected *PancakeAdapter, got %T", adapter)
	}
}

func TestPancakeFetchMessagesMapsRealPayload(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("page_access_token") != "test-token" {
			t.Errorf("missing page_access_token")
		}
		if r.URL.Query().Get("current_count") != "" {
			fmt.Fprint(w, `{"success": true, "messages": []}`)
			return
		}
		fmt.Fprint(w, pancakeMessagesFixture)
	}))
	defer srv.Close()

	msgs, err := newTestPancakeAdapter(srv.URL).FetchMessages(context.Background(), "1000001_2000002", time.Time{})
	if err != nil {
		t.Fatalf("FetchMessages: %v", err)
	}
	if len(msgs) != 7 {
		t.Fatalf("expected 7 messages, got %d", len(msgs))
	}
	byID := map[string]SyncedMessage{}
	for _, m := range msgs {
		byID[m.ExternalID] = m
	}

	cust := byID["m_text_customer"]
	if cust.SenderType != "customer" || cust.SenderName != "Khach Test" || cust.Content != "xin chào" {
		t.Errorf("customer message mapped wrong: %+v", cust)
	}
	wantTime := time.Date(2026, 9, 24, 15, 18, 18, 0, time.UTC)
	if !cust.SentAt.Equal(wantTime) {
		t.Errorf("SentAt = %v, want %v (UTC)", cust.SentAt, wantTime)
	}

	agent := byID["m_text_agent"]
	if agent.SenderType != "agent" || agent.SenderName != "Nhan Vien A" {
		t.Errorf("agent message should use staff name: %+v", agent)
	}

	if got := byID["m_escaped"].Content; got != "<3" {
		t.Errorf("content should come from original_message, got %q", got)
	}

	sticker := byID["m_sticker"]
	if sticker.ContentType != "sticker" || len(sticker.Attachments) != 1 || sticker.Attachments[0].Type != "sticker" {
		t.Errorf("sticker mapped wrong: %+v", sticker)
	}
	if sticker.Content != "" {
		t.Errorf("attachment-only message should have empty content, got %q", sticker.Content)
	}

	photo := byID["m_photo"]
	if photo.ContentType != "attachment" || photo.Attachments[0].Type != "photo" || photo.Attachments[0].Name != "abc123.png" {
		t.Errorf("photo mapped wrong: %+v", photo.Attachments)
	}

	video := byID["m_video"].Attachments[0]
	if video.Type != "video/mp4" || !strings.Contains(video.URL, "clip.mp4") {
		t.Errorf("video should use video_data.url, got %+v", video)
	}

	file := byID["m_file"].Attachments[0]
	if file.Type != "application/pdf" || file.Name != "Bao gia (1).pdf" || !strings.Contains(file.URL, "bao-gia.pdf") {
		t.Errorf("file should use file_url and name, got %+v", file)
	}

	// Không lưu thông tin cá nhân Pancake trả kèm.
	raw, _ := json.Marshal(cust.RawData)
	if strings.Contains(string(raw), "khach@example.com") || strings.Contains(string(raw), "0900000000") {
		t.Errorf("raw data leaks personal info: %s", raw)
	}
}

func TestPancakeFetchMessagesPaginatesUntilSince(t *testing.T) {
	// 70 tin, mỗi phút một tin. Pancake trả 30 tin mới nhất trước, lô sau cũ
	// hơn; trong mỗi lô tin xếp từ cũ đến mới.
	base := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
	const total = 70
	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		fetched, _ := strconv.Atoi(r.URL.Query().Get("current_count"))
		end := total - fetched
		start := end - 30
		if start < 0 {
			start = 0
		}
		var items []string
		for i := start; i < end; i++ {
			items = append(items, fmt.Sprintf(`{"id":"m%d","page_id":"1000001","original_message":"tin %d","from":{"id":"2000002","name":"Khach"},"inserted_at":%q}`,
				i, i, base.Add(time.Duration(i)*time.Minute).Format("2006-01-02T15:04:05.000000")))
		}
		fmt.Fprintf(w, `{"success":true,"messages":[%s]}`, strings.Join(items, ","))
	}))
	defer srv.Close()

	a := newTestPancakeAdapter(srv.URL)

	all, err := a.FetchMessages(context.Background(), "c1", time.Time{})
	if err != nil {
		t.Fatalf("FetchMessages: %v", err)
	}
	if len(all) != total {
		t.Fatalf("expected %d messages, got %d", total, len(all))
	}
	for i, m := range all {
		if m.ExternalID != fmt.Sprintf("m%d", i) {
			t.Fatalf("messages not ordered oldest first at %d: %s", i, m.ExternalID)
		}
	}

	// Chỉ lấy tin từ phút thứ 50: dừng ngay ở lô chạm mốc, không gọi thêm.
	atomic.StoreInt32(&calls, 0)
	recent, err := a.FetchMessages(context.Background(), "c1", base.Add(50*time.Minute))
	if err != nil {
		t.Fatalf("FetchMessages since: %v", err)
	}
	if len(recent) != 20 || recent[0].ExternalID != "m50" {
		t.Fatalf("expected 20 messages from m50, got %d (first %v)", len(recent), recent)
	}
	if c := atomic.LoadInt32(&calls); c != 1 {
		t.Errorf("expected 1 call when since falls in first batch, got %d", c)
	}
}

func TestPancakeFetchRecentConversationsPaginates(t *testing.T) {
	since := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if q.Get("type") != "INBOX" || q.Get("since") != strconv.FormatInt(since.Unix(), 10) {
			t.Errorf("unexpected filters: %s", r.URL.RawQuery)
		}
		var items []string
		if q.Get("last_conversation_id") == "" {
			for i := 0; i < 60; i++ {
				items = append(items, fmt.Sprintf(`{"id":"1000001_%d","type":"INBOX","updated_at":"2026-09-20T10:00:00.000000","from":{"id":"%d","name":"Khach %d"},"recent_phone_numbers":["0900000000"]}`, i, i, i))
			}
		} else if q.Get("last_conversation_id") == "1000001_59" {
			items = append(items,
				`{"id":"1000001_60","type":"INBOX","updated_at":"2026-09-19T10:00:00.000000","from":{"id":"60","name":"Khach 60"}}`,
				`{"id":"post_1","type":"COMMENT","updated_at":"2026-09-19T09:00:00.000000","from":{"id":"61","name":"Binh luan"}}`)
		}
		fmt.Fprintf(w, `{"success":true,"conversations":[%s]}`, strings.Join(items, ","))
	}))
	defer srv.Close()

	a := newTestPancakeAdapter(srv.URL)
	convs, err := a.FetchRecentConversations(context.Background(), since, 100)
	if err != nil {
		t.Fatalf("FetchRecentConversations: %v", err)
	}
	if len(convs) != 61 {
		t.Fatalf("expected 61 inbox conversations, got %d", len(convs))
	}
	first := convs[0]
	if first.ExternalID != "1000001_0" || first.ExternalUserID != "0" || first.CustomerName != "Khach 0" {
		t.Errorf("conversation mapped wrong: %+v", first)
	}
	if meta, _ := json.Marshal(first.Metadata); strings.Contains(string(meta), "0900000000") {
		t.Errorf("metadata leaks phone numbers: %s", meta)
	}

	limited, err := a.FetchRecentConversations(context.Background(), since, 10)
	if err != nil {
		t.Fatalf("FetchRecentConversations limit: %v", err)
	}
	if len(limited) != 10 {
		t.Errorf("expected limit 10, got %d", len(limited))
	}
}

func TestPancakeAPIErrors(t *testing.T) {
	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/pages/1000001/tags":
			// Pancake báo token sai bằng HTTP 200 kèm success=false.
			fmt.Fprint(w, `{"message":"Invalid access_token","success":false,"error_code":102}`)
		case "/v2/pages/1000001/conversations":
			if atomic.AddInt32(&calls, 1) == 1 {
				w.WriteHeader(http.StatusTooManyRequests)
				return
			}
			fmt.Fprint(w, `{"success":true,"conversations":[]}`)
		}
	}))
	defer srv.Close()

	a := newTestPancakeAdapter(srv.URL)
	err := a.HealthCheck(context.Background())
	if err == nil || !strings.Contains(err.Error(), "Invalid access_token") {
		t.Errorf("expected invalid token error, got %v", err)
	}
	if err != nil && strings.Contains(err.Error(), "test-token") {
		t.Errorf("error must not contain the token: %v", err)
	}

	if _, err := a.FetchRecentConversations(context.Background(), time.Time{}, 10); err != nil {
		t.Errorf("should retry after 429, got %v", err)
	}
	if c := atomic.LoadInt32(&calls); c != 2 {
		t.Errorf("expected 2 calls (429 then ok), got %d", c)
	}
}
