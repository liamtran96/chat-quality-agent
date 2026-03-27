import Anthropic from '@anthropic-ai/sdk';
import {
  AIProvider,
  AIResponse,
  BatchItem,
} from './ai-provider.interface';
import { withRetry } from '../retry';
import { wrapBatchPrompt, formatBatchTranscript } from '../prompts';

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_MAX_TOKENS = 16384;
const HTTP_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

export class ClaudeProvider implements AIProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly baseURL?: string;

  constructor(
    apiKey: string,
    model?: string,
    maxTokens?: number,
    baseURL?: string,
  ) {
    this.apiKey = apiKey;
    this.model = model || DEFAULT_MODEL;
    this.maxTokens = maxTokens && maxTokens > 0 ? maxTokens : DEFAULT_MAX_TOKENS;
    this.baseURL = baseURL;
  }

  async analyzeChat(
    systemPrompt: string,
    chatTranscript: string,
  ): Promise<AIResponse> {
    return withRetry(async () => {
      const clientOpts: ConstructorParameters<typeof Anthropic>[0] = {
        apiKey: this.apiKey,
        timeout: HTTP_TIMEOUT_MS,
      };
      if (this.baseURL) {
        clientOpts.baseURL = this.baseURL;
      }
      const client = new Anthropic(clientOpts);

      const message = await client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: [{ type: 'text', text: systemPrompt }],
        messages: [
          { role: 'user', content: [{ type: 'text', text: chatTranscript }] },
        ],
      });

      let text = '';
      for (const block of message.content) {
        if (block.type === 'text') {
          text = block.text;
          break;
        }
      }
      if (!text) {
        throw new Error('claude api returned empty content');
      }

      return {
        content: text,
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        model: message.model,
        provider: 'claude',
      };
    });
  }

  async analyzeChatBatch(
    systemPrompt: string,
    items: BatchItem[],
  ): Promise<AIResponse> {
    const batchPrompt = wrapBatchPrompt(systemPrompt, items.length);
    const batchTranscript = formatBatchTranscript(items);
    return this.analyzeChat(batchPrompt, batchTranscript);
  }
}
