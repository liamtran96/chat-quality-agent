package channels

import (
	"context"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Pancake (pages.fm) gom nhiều nền tảng chat — Facebook, Instagram, Zalo OA,
// TikTok, Shopee… — về một chỗ, nên một adapter đọc được hết các page mà
// khách đã kết nối vào Pancake. Tài liệu: https://developer.pancake.biz/
const (
	pancakePublicV1 = "https://pages.fm/api/public_api/v1"
	pancakePublicV2 = "https://pages.fm/api/public_api/v2"

	// Pancake trả tối đa 60 cuộc chat và 30 tin mỗi lần gọi.
	pancakeConversationPageSize = 60

	// Pancake giới hạn 5 lượt gọi mỗi giây cho mỗi page. Giữ khoảng cách 250ms
	// (4 lượt/giây) để còn dư chỗ cho lượt gọi của chính Pancake và bên khác.
	pancakeMinRequestInterval = 250 * time.Millisecond
	pancakeMaxRetries         = 3
	pancakeRetryBackoff       = time.Second

	// Chặn vòng lặp phân trang nếu API trả dữ liệu bất thường.
	pancakeMaxPages = 200
)

// PancakeCredentials là thông tin để đọc một page qua API công khai của Pancake.
// Page Access Token lấy trong Pancake: Cài đặt page → Công cụ. Token không hết
// hạn cho tới khi admin tạo token mới.
type PancakeCredentials struct {
	PageID          string `json:"page_id"`
	PageAccessToken string `json:"page_access_token"`
}

type PancakeAdapter struct {
	creds  PancakeCredentials
	client *http.Client
	v1Base string
	v2Base string

	// Giữ nhịp gọi API để không vượt giới hạn của Pancake.
	mu          sync.Mutex
	lastRequest time.Time
	minInterval time.Duration
	backoff     time.Duration
}

func NewPancakeAdapter(creds PancakeCredentials) *PancakeAdapter {
	return &PancakeAdapter{
		creds:       creds,
		client:      &http.Client{Timeout: 30 * time.Second},
		v1Base:      pancakePublicV1,
		v2Base:      pancakePublicV2,
		minInterval: pancakeMinRequestInterval,
		backoff:     pancakeRetryBackoff,
	}
}

// waitTurn chờ tới lượt gọi tiếp theo theo nhịp minInterval.
func (p *PancakeAdapter) waitTurn(ctx context.Context) error {
	p.mu.Lock()
	wait := p.minInterval - time.Since(p.lastRequest)
	if wait < 0 {
		wait = 0
	}
	p.lastRequest = time.Now().Add(wait)
	p.mu.Unlock()

	if wait == 0 {
		return nil
	}
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(wait):
		return nil
	}
}

// doRequest gọi một endpoint GET của Pancake và giải mã JSON vào out.
// Pancake báo lỗi bằng HTTP 200 kèm "success": false, nên phải xem cả thân trả về.
func (p *PancakeAdapter) doRequest(ctx context.Context, endpoint string, params url.Values, out interface{}) error {
	if params == nil {
		params = url.Values{}
	}
	params.Set("page_access_token", p.creds.PageAccessToken)
	fullURL := endpoint + "?" + params.Encode()

	for attempt := 0; ; attempt++ {
		if err := p.waitTurn(ctx); err != nil {
			return err
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, fullURL, nil)
		if err != nil {
			return fmt.Errorf("create pancake api request: %w", err)
		}
		resp, err := p.client.Do(req)
		if err != nil {
			// Không đưa URL vào lỗi vì URL chứa token.
			return fmt.Errorf("pancake api request failed: %w", scrubURLError(err))
		}
		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			return fmt.Errorf("pancake api read body failed: %w", err)
		}

		if resp.StatusCode == http.StatusTooManyRequests && attempt < pancakeMaxRetries {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(p.backoff * time.Duration(attempt+1)):
			}
			continue
		}
		if resp.StatusCode < 200 || resp.StatusCode > 299 {
			return fmt.Errorf("pancake api error: http %d", resp.StatusCode)
		}

		var status struct {
			Success   *bool  `json:"success"`
			Message   string `json:"message"`
			ErrorCode int    `json:"error_code"`
		}
		if err := json.Unmarshal(body, &status); err != nil {
			return fmt.Errorf("pancake api decode failed: %w", err)
		}
		if status.Success != nil && !*status.Success {
			return fmt.Errorf("pancake api error: (#%d) %s", status.ErrorCode, status.Message)
		}
		if err := json.Unmarshal(body, out); err != nil {
			return fmt.Errorf("pancake api decode failed: %w", err)
		}
		return nil
	}
}

// scrubURLError bỏ URL (có chứa token) khỏi lỗi của http.Client.
func scrubURLError(err error) error {
	if uerr, ok := err.(*url.Error); ok {
		return fmt.Errorf("%s: %w", uerr.Op, uerr.Err)
	}
	return err
}

type pancakeSender struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	UID         string `json:"uid"`
	AdminName   string `json:"admin_name"`
	IsAutomated *bool  `json:"is_automated"`
	AIGenerated *bool  `json:"ai_generated"`
}

type pancakeConversation struct {
	ID           string        `json:"id"`
	Type         string        `json:"type"`
	PageID       string        `json:"page_id"`
	MessageCount int           `json:"message_count"`
	UpdatedAt    string        `json:"updated_at"`
	InsertedAt   string        `json:"inserted_at"`
	From         pancakeSender `json:"from"`
	Tags         []interface{} `json:"tags"`
}

type pancakeAttachment struct {
	ID        string `json:"id"`
	Type      string `json:"type"`
	URL       string `json:"url"`
	FileURL   string `json:"file_url"`
	Name      string `json:"name"`
	MimeType  string `json:"mime_type"`
	Size      int64  `json:"size"`
	VideoData *struct {
		URL string `json:"url"`
	} `json:"video_data"`
}

type pancakeMessage struct {
	ID              string              `json:"id"`
	Type            string              `json:"type"`
	PageID          string              `json:"page_id"`
	Message         string              `json:"message"`
	OriginalMessage string              `json:"original_message"`
	From            pancakeSender       `json:"from"`
	InsertedAt      string              `json:"inserted_at"`
	IsRemoved       bool                `json:"is_removed"`
	Attachments     []pancakeAttachment `json:"attachments"`
}

func (p *PancakeAdapter) FetchRecentConversations(ctx context.Context, since time.Time, limit int) ([]SyncedConversation, error) {
	var conversations []SyncedConversation
	endpoint := fmt.Sprintf("%s/pages/%s/conversations", p.v2Base, url.PathEscape(p.creds.PageID))
	lastID := ""

	for page := 0; page < pancakeMaxPages; page++ {
		params := url.Values{}
		params.Set("type", "INBOX")
		params.Set("order_by", "updated_at")
		if !since.IsZero() {
			params.Set("since", strconv.FormatInt(since.Unix(), 10))
			params.Set("until", strconv.FormatInt(time.Now().Unix(), 10))
		}
		if lastID != "" {
			params.Set("last_conversation_id", lastID)
		}

		var result struct {
			Conversations []pancakeConversation `json:"conversations"`
		}
		if err := p.doRequest(ctx, endpoint, params, &result); err != nil {
			return conversations, err
		}
		if len(result.Conversations) == 0 {
			break
		}

		for _, conv := range result.Conversations {
			// Chỉ lấy hội thoại tin nhắn; bình luận dưới bài viết không thuộc
			// phạm vi đánh giá CSKH, kể cả khi API bỏ qua bộ lọc type.
			if conv.Type != "" && conv.Type != "INBOX" {
				continue
			}
			updatedAt := parsePancakeTime(conv.UpdatedAt)
			if !since.IsZero() && !updatedAt.IsZero() && updatedAt.Before(since) {
				continue
			}
			conversations = append(conversations, SyncedConversation{
				ExternalID:     conv.ID,
				ExternalUserID: conv.From.ID,
				CustomerName:   conv.From.Name,
				LastMessageAt:  updatedAt,
				// Chỉ giữ vài trường cần thiết. Bản gốc có số điện thoại, đơn
				// hàng của khách — không lưu những thứ đó.
				Metadata: map[string]interface{}{
					"type":          conv.Type,
					"message_count": conv.MessageCount,
					"inserted_at":   conv.InsertedAt,
					"updated_at":    conv.UpdatedAt,
					"tags":          conv.Tags,
				},
			})
			if limit > 0 && len(conversations) >= limit {
				return conversations, nil
			}
		}

		next := result.Conversations[len(result.Conversations)-1].ID
		if len(result.Conversations) < pancakeConversationPageSize || next == lastID {
			break
		}
		lastID = next
	}

	return conversations, nil
}

func (p *PancakeAdapter) FetchMessages(ctx context.Context, conversationID string, since time.Time) ([]SyncedMessage, error) {
	endpoint := fmt.Sprintf("%s/pages/%s/conversations/%s/messages",
		p.v1Base, url.PathEscape(p.creds.PageID), url.PathEscape(conversationID))

	// Pancake trả tin theo lô 30 tin, lô đầu là 30 tin mới nhất. current_count
	// là số tin đã lấy, lô sau là các tin cũ hơn nữa. Trong mỗi lô tin xếp từ
	// cũ đến mới — ngược với tài liệu của Pancake.
	var batches [][]SyncedMessage
	seen := make(map[string]bool)
	fetched := 0

	for page := 0; page < pancakeMaxPages; page++ {
		params := url.Values{}
		if fetched > 0 {
			params.Set("current_count", strconv.Itoa(fetched))
		}

		var result struct {
			Messages []pancakeMessage `json:"messages"`
		}
		if err := p.doRequest(ctx, endpoint, params, &result); err != nil {
			return flattenOldestFirst(batches), err
		}
		if len(result.Messages) == 0 {
			break
		}

		var batch []SyncedMessage
		reachedSince := false
		newCount := 0
		for _, m := range result.Messages {
			if seen[m.ID] {
				continue
			}
			seen[m.ID] = true
			newCount++

			msg := p.toSyncedMessage(m)
			if !since.IsZero() && msg.SentAt.Before(since) {
				reachedSince = true
				continue
			}
			batch = append(batch, msg)
		}
		batches = append(batches, batch)

		if reachedSince || newCount == 0 {
			break
		}
		fetched += len(result.Messages)
	}

	return flattenOldestFirst(batches), nil
}

// flattenOldestFirst ghép các lô (lô sau cũ hơn lô trước) thành một dãy từ cũ đến mới.
func flattenOldestFirst(batches [][]SyncedMessage) []SyncedMessage {
	var out []SyncedMessage
	for i := len(batches) - 1; i >= 0; i-- {
		out = append(out, batches[i]...)
	}
	return out
}

func (p *PancakeAdapter) toSyncedMessage(m pancakeMessage) SyncedMessage {
	senderType := "customer"
	senderName := m.From.Name
	pageID := m.PageID
	if pageID == "" {
		pageID = p.creds.PageID
	}
	if m.From.ID != "" && m.From.ID == pageID {
		senderType = "agent"
		// Pancake cho biết nhân viên nào trả lời; tên page thì ai cũng như nhau.
		if m.From.AdminName != "" {
			senderName = m.From.AdminName
		}
	}

	msg := SyncedMessage{
		ExternalID:  m.ID,
		SenderType:  senderType,
		SenderName:  senderName,
		Content:     pancakeContent(m),
		ContentType: "text",
		SentAt:      parsePancakeTime(m.InsertedAt),
	}

	isSticker := false
	for _, a := range m.Attachments {
		att, ok := toAttachment(a)
		if !ok {
			continue
		}
		if a.Type == "sticker" {
			isSticker = true
		}
		msg.Attachments = append(msg.Attachments, att)
	}
	if len(msg.Attachments) > 0 {
		msg.ContentType = "attachment"
	}
	if isSticker {
		msg.ContentType = "sticker"
	}

	// Giữ bản rút gọn của tin gốc để tra lại khi cần. Bỏ email và các thông
	// tin cá nhân khác của khách mà Pancake trả kèm.
	raw := map[string]interface{}{
		"id":          m.ID,
		"type":        m.Type,
		"inserted_at": m.InsertedAt,
		"from": map[string]interface{}{
			"id":         m.From.ID,
			"name":       m.From.Name,
			"admin_name": m.From.AdminName,
			"uid":        m.From.UID,
		},
		"attachments": m.Attachments,
	}
	if m.From.IsAutomated != nil {
		raw["is_automated"] = *m.From.IsAutomated
	}
	if m.From.AIGenerated != nil {
		raw["ai_generated"] = *m.From.AIGenerated
	}
	if m.IsRemoved {
		raw["is_removed"] = true
	}
	msg.RawData = raw

	return msg
}

// toAttachment chuyển một đính kèm của Pancake về dạng chung.
//
// Ảnh và sticker nằm trên máy chủ của Pancake. Video và file nằm trên máy chủ
// Facebook với link có hạn khoảng hai ngày, nên muốn xem lại lâu dài phải bật
// lưu file để lúc đồng bộ tải về luôn.
func toAttachment(a pancakeAttachment) (Attachment, bool) {
	attURL := a.URL
	switch {
	case a.FileURL != "":
		// File không có trường type, link nằm ở file_url.
		attURL = a.FileURL
	case a.VideoData != nil && a.VideoData.URL != "":
		// url của video chỉ là ảnh đại diện; video thật ở video_data.url.
		attURL = a.VideoData.URL
	}
	if attURL == "" {
		return Attachment{}, false
	}

	attType := a.MimeType
	if attType == "" {
		attType = a.Type
	}
	if attType == "" {
		attType = "file"
	}

	name := a.Name
	if name == "" {
		// Không có tên thì lấy tên file trong link (thường là mã băm, không trùng).
		if u, err := url.Parse(attURL); err == nil {
			name = path.Base(u.Path)
		}
	}

	return Attachment{Type: attType, URL: attURL, Name: name}, true
}

var htmlTagPattern = regexp.MustCompile(`<[^>]*>`)

// pancakeContent lấy nội dung chữ của tin. original_message là chữ gốc; trường
// message đã bọc HTML (<div>…</div>) và mã hoá ký tự (&lt;3), chỉ dùng khi
// original_message rỗng.
func pancakeContent(m pancakeMessage) string {
	if m.OriginalMessage != "" {
		return m.OriginalMessage
	}
	text := htmlTagPattern.ReplaceAllString(m.Message, "")
	return strings.TrimSpace(html.UnescapeString(text))
}

// parsePancakeTime đọc thời gian Pancake trả về, ví dụ "2026-09-24T15:18:30.428000".
// Pancake dùng giờ UTC nhưng không ghi múi giờ.
func parsePancakeTime(s string) time.Time {
	if s == "" {
		return time.Time{}
	}
	if t, err := time.Parse(time.RFC3339Nano, s); err == nil {
		return t
	}
	if t, err := time.ParseInLocation("2006-01-02T15:04:05.999999999", s, time.UTC); err == nil {
		return t
	}
	return time.Time{}
}

func (p *PancakeAdapter) HealthCheck(ctx context.Context) error {
	// Danh sách thẻ là endpoint nhẹ nhất cần page token.
	endpoint := fmt.Sprintf("%s/pages/%s/tags", p.v1Base, url.PathEscape(p.creds.PageID))
	var result map[string]interface{}
	return p.doRequest(ctx, endpoint, nil, &result)
}
