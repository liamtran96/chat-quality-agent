/**
 * AIResponse contains the AI response text and usage metrics.
 */
export interface AIResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  provider: string; // "claude" or "gemini"
}

/**
 * BatchItem represents one conversation in a batch request.
 */
export interface BatchItem {
  conversationId: string;
  transcript: string;
}

/**
 * ChatMessage is a simplified message for transcript formatting.
 */
export interface ChatMessage {
  senderType: string;
  senderName: string;
  content: string;
  sentAt: string;
}

/**
 * AIProvider defines the interface for AI chat analysis.
 */
export interface AIProvider {
  analyzeChat(
    signal: AbortSignal | undefined,
    systemPrompt: string,
    chatTranscript: string,
  ): Promise<AIResponse>;

  analyzeChatBatch(
    signal: AbortSignal | undefined,
    systemPrompt: string,
    items: BatchItem[],
  ): Promise<AIResponse>;
}

/**
 * Format messages into a readable transcript for AI analysis.
 */
export function formatChatTranscript(messages: ChatMessage[]): string {
  let result = '';
  for (const msg of messages) {
    const label = msg.senderName || msg.senderType;
    result += `[${msg.sentAt}] ${label}: ${msg.content}\n`;
  }
  return result;
}

/**
 * Build the QC analysis system prompt.
 */
export function buildQCPrompt(
  rulesContent: string,
  skipConditions: string,
): string {
  let skipSection = '';
  if (skipConditions) {
    skipSection = `
## Điều kiện bỏ qua (không đánh giá):
${skipConditions}

Nếu cuộc chat thỏa mãn bất kỳ điều kiện nào trên, trả về verdict="SKIP", violations=[], score=0, review=lý do bỏ qua ngắn gọn.
`;
  }

  return `Bạn là chuyên gia đánh giá chất lượng chăm sóc khách hàng (CSKH).

## Quy định CSKH cần tuân thủ:
${rulesContent}
${skipSection}
## Nhiệm vụ:
Phân tích đoạn chat CSKH dưới đây và tìm các vi phạm quy định.

## Yêu cầu output:
Trả về JSON với cấu trúc sau:
{
  "verdict": "PASS", "FAIL" hoặc "SKIP",
  "score": 0-100,
  "review": "Nhận xét tổng quan cuộc chat: chat tốt hay chưa tốt, cần cải thiện điều gì",
  "violations": [
    {
      "severity": "NGHIEM_TRONG" hoặc "CAN_CAI_THIEN",
      "rule": "Tên quy tắc bị vi phạm",
      "evidence": "Trích dẫn chính xác đoạn chat vi phạm",
      "explanation": "Giải thích ngắn gọn tại sao đây là vi phạm",
      "suggestion": "Gợi ý cách trả lời đúng"
    }
  ],
  "summary": "Tổng quan ngắn gọn về chất lượng chat"
}

- "verdict": "PASS" nếu cuộc chat đạt yêu cầu chất lượng, "FAIL" nếu có vấn đề cần khắc phục, "SKIP" nếu thỏa điều kiện bỏ qua
- "review": Nhận xét chi tiết về cuộc chat (2-3 câu), đánh giá chất lượng chăm sóc khách hàng
- Nếu không có vi phạm: verdict="PASS", violations=[], score gần 100
- Nếu có vi phạm nghiêm trọng: verdict="FAIL"
CHỈ trả về JSON, không thêm text khác.`;
}

/**
 * Build the classification system prompt.
 */
export function buildClassificationPrompt(rulesConfigJSON: string): string {
  return `Bạn là hệ thống phân loại nội dung hội thoại CSKH/Sales.

## Các quy tắc phân loại:
${rulesConfigJSON}

## Nhiệm vụ:
Phân tích đoạn chat dưới đây và gán các nhãn phân loại phù hợp.

## Yêu cầu output:
Trả về JSON:
{
  "tags": [
    {
      "rule_name": "Tên rule đã match",
      "confidence": 0.0-1.0,
      "evidence": "Trích dẫn đoạn chat liên quan",
      "explanation": "Giải thích ngắn gọn tại sao"
    }
  ],
  "summary": "Mô tả chi tiết nội dung cuộc chat: khách hàng nói gì, nhân viên xử lý ra sao, kết quả thế nào (2-3 câu, KHÔNG lặp lại tên nhãn phân loại)"
}

- "summary" phải mô tả CỤ THỂ nội dung cuộc chat, không được viết chung chung như "Cuộc chat được phân loại: X"
- Ví dụ tốt: "Khách hàng hỏi về tính năng webhook nhưng nhân viên không nắm rõ, hướng dẫn sai cách cấu hình. Khách phản hồi tiêu cực."
- Ví dụ xấu: "Cuộc chat được phân loại: Góp ý tính năng"
CHỈ trả về JSON, không thêm text khác.`;
}

/**
 * Format batch transcript with conversation IDs.
 */
export function formatBatchTranscript(items: BatchItem[]): string {
  let result = '';
  for (let i = 0; i < items.length; i++) {
    result += `=== CUỘC HỘI THOẠI ${i + 1} (ID: ${items[i].conversationId}) ===\n${items[i].transcript}\n\n`;
  }
  return result;
}

/**
 * Wrap a single-conversation system prompt into a batch prompt.
 */
export function wrapBatchPrompt(basePrompt: string, count: number): string {
  return `${basePrompt}

QUAN TRỌNG: Bạn sẽ nhận được ${count} cuộc hội thoại, mỗi cuộc được đánh dấu "=== CUỘC HỘI THOẠI N (ID: xxx) ===".
Trả về JSON ARRAY chứa ${count} phần tử, mỗi phần tử là kết quả đánh giá cho 1 cuộc hội thoại theo đúng thứ tự.
Format: [{"conversation_id": "xxx", ...kết quả...}, ...]
CHỈ trả về JSON array, không thêm text khác.`;
}

/**
 * Strip markdown code fences (```json ... ```) that AI sometimes wraps around JSON.
 */
export function stripMarkdownFences(text: string): string {
  let result = text.trim();
  if (result.startsWith('```')) {
    const firstNewline = result.indexOf('\n');
    if (firstNewline !== -1) {
      result = result.substring(firstNewline + 1);
    }
    const lastFence = result.lastIndexOf('```');
    if (lastFence !== -1) {
      result = result.substring(0, lastFence);
    }
    result = result.trim();
  }
  return result;
}

/**
 * Calculate estimated cost in USD based on provider, model, and token counts.
 */
export function calculateCostUSD(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  let inputRate = 0;
  let outputRate = 0; // per million tokens

  switch (provider) {
    case 'claude':
      switch (model) {
        case 'claude-haiku-4-5-20251001':
        case 'claude-haiku-4-5':
          inputRate = 0.8;
          outputRate = 4.0;
          break;
        case 'claude-sonnet-4-6':
        case 'claude-sonnet-4-20250514':
        case 'claude-sonnet-4-5-20250929':
          inputRate = 3.0;
          outputRate = 15.0;
          break;
        case 'claude-opus-4':
        case 'claude-opus-4-6':
          inputRate = 15.0;
          outputRate = 75.0;
          break;
        default:
          inputRate = 3.0;
          outputRate = 15.0;
          break;
      }
      break;
    case 'gemini':
      switch (model) {
        case 'gemini-2.0-flash':
          inputRate = 0.075;
          outputRate = 0.3;
          break;
        case 'gemini-2.5-pro':
          inputRate = 1.25;
          outputRate = 10.0;
          break;
        default:
          inputRate = 0.075;
          outputRate = 0.3;
          break;
      }
      break;
    default:
      return 0;
  }

  return (
    (inputTokens * inputRate) / 1_000_000 +
    (outputTokens * outputRate) / 1_000_000
  );
}
