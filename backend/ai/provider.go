package ai

import (
	"context"

	"github.com/vietbui/chat-quality-agent/ai/pricing"
)

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

// CalculateCost tính chi phí USD cho một lượt gọi. known=false nghĩa là chưa có
// đơn giá cho model này — chi phí trả về là 0 và phía gọi phải hiểu đó là "chưa
// tính được", không phải "miễn phí".
//
// Cố ý không đoán giá theo model khác: chính việc đoán đã khiến Gemini 2.5 Flash
// bị tính theo giá của một model đã ngừng hoạt động, thấp hơn thực tế nhiều lần
// mà không ai biết.
func CalculateCost(model string, inputTokens, outputTokens int) (cost float64, known bool) {
	rate, ok := pricing.Lookup(model)
	if !ok {
		return 0, false
	}
	return (float64(inputTokens) * rate.Input / 1_000_000) +
		(float64(outputTokens) * rate.Output / 1_000_000), true
}

// CalculateCostUSD giữ lại cho các chỗ gọi cũ. Model chưa biết giá trả về 0.
func CalculateCostUSD(provider, model string, inputTokens, outputTokens int) float64 {
	cost, _ := CalculateCost(model, inputTokens, outputTokens)
	return cost
}
