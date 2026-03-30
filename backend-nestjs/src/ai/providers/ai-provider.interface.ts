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
  /**
   * Sends a system prompt + chat transcript to the AI and returns the response with usage.
   */
  analyzeChat(
    systemPrompt: string,
    chatTranscript: string,
  ): Promise<AIResponse>;

  /**
   * Sends multiple conversations in one prompt and returns a combined response.
   * The response content will be a JSON array of results, one per conversation (in order).
   */
  analyzeChatBatch(
    systemPrompt: string,
    items: BatchItem[],
  ): Promise<AIResponse>;
}
