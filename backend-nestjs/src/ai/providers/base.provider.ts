import { AIProvider, AIResponse, BatchItem } from './ai-provider.interface';
import { wrapBatchPrompt, formatBatchTranscript } from '../prompts';

/**
 * Base class that provides the shared analyzeChatBatch implementation.
 * Subclasses only need to implement analyzeChat.
 */
export abstract class BaseProvider implements AIProvider {
  abstract analyzeChat(
    systemPrompt: string,
    chatTranscript: string,
  ): Promise<AIResponse>;

  async analyzeChatBatch(
    systemPrompt: string,
    items: BatchItem[],
  ): Promise<AIResponse> {
    const batchPrompt = wrapBatchPrompt(systemPrompt, items.length);
    const batchTranscript = formatBatchTranscript(items);
    return this.analyzeChat(batchPrompt, batchTranscript);
  }
}
