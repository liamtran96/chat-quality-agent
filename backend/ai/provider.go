package ai

import "context"

// AIResponse contains the AI response text and usage metrics.
type AIResponse struct {
	Content      string
	InputTokens  int
	OutputTokens int
	Model        string
	Provider     string // "claude" or "gemini"
}

// BatchItem represents one conversation in a batch request.
type BatchItem struct {
	ConversationID string
	Transcript     string
}

// AIProvider defines the interface for AI chat analysis.
type AIProvider interface {
	// AnalyzeChat sends a system prompt + chat transcript to the AI and returns the response with usage.
	AnalyzeChat(ctx context.Context, systemPrompt string, chatTranscript string) (AIResponse, error)

	// AnalyzeChatBatch sends multiple conversations in one prompt and returns a combined response.
	// The response Content will be a JSON array of results, one per conversation (in order).
	AnalyzeChatBatch(ctx context.Context, systemPrompt string, items []BatchItem) (AIResponse, error)
}

// CalculateCostUSD returns estimated cost in USD based on provider, model, and token counts.
func CalculateCostUSD(provider, model string, inputTokens, outputTokens int) float64 {
	var inputRate, outputRate float64 // per million tokens

	// Giá USD trên mỗi 1 triệu token, đối chiếu bảng giá chính thức ngày 2026-09-15.
	// Model cũ giữ lại để nhật ký chi phí đã ghi trước đây vẫn tính đúng.
	switch provider {
	case "claude":
		switch model {
		case "claude-haiku-4-5-20251001", "claude-haiku-4-5":
			inputRate, outputRate = 1.00, 5.00
		case "claude-sonnet-5":
			inputRate, outputRate = 2.00, 10.00
		case "claude-sonnet-4-6", "claude-sonnet-4-20250514", "claude-sonnet-4-5-20250929":
			inputRate, outputRate = 3.00, 15.00
		case "claude-opus-5", "claude-opus-4-8", "claude-opus-4-7", "claude-opus-4-6":
			inputRate, outputRate = 5.00, 25.00
		case "claude-fable-5-1", "claude-fable-5":
			inputRate, outputRate = 10.00, 50.00
		case "claude-opus-4":
			inputRate, outputRate = 15.00, 75.00 // thế hệ Opus 4 cũ
		default:
			inputRate, outputRate = 5.00, 25.00 // mặc định theo giá Opus hiện hành
		}
	case "gemini":
		switch model {
		// Gemini 3.8 / 3.7 / 3.6 Flash đang trong giai đoạn giá ưu đãi, từ
		// 2027-01-01 tăng lên 1.50 / 7.50 — cần cập nhật lại khi tới hạn.
		case "gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash":
			inputRate, outputRate = 0.75, 3.75
		case "gemini-3.5-flash":
			inputRate, outputRate = 1.50, 9.00
		case "gemini-3.5-flash-lite":
			inputRate, outputRate = 0.30, 2.50
		case "gemini-3.1-flash-lite":
			inputRate, outputRate = 0.25, 1.50
		case "gemini-2.5-pro":
			inputRate, outputRate = 1.25, 10.00
		case "gemini-2.5-flash":
			inputRate, outputRate = 0.30, 2.50
		case "gemini-2.5-flash-lite":
			inputRate, outputRate = 0.10, 0.40
		case "gemini-2.0-flash":
			inputRate, outputRate = 0.075, 0.30 // Google đã ngừng model này
		default:
			inputRate, outputRate = 0.75, 3.75 // mặc định theo giá Flash hiện hành
		}
	default:
		return 0
	}

	return (float64(inputTokens) * inputRate / 1_000_000) + (float64(outputTokens) * outputRate / 1_000_000)
}
