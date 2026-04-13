import Anthropic from '@anthropic-ai/sdk';
import {
  AIResponse,
} from './ai-provider.interface';
import { BaseProvider } from './base.provider';
import { withRetry } from '../retry';

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_MAX_TOKENS = 16384;
const HTTP_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

export class ClaudeProvider extends BaseProvider {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(
    apiKey: string,
    model?: string,
    maxTokens?: number,
    baseURL?: string,
  ) {
    super();
    const clientOpts: ConstructorParameters<typeof Anthropic>[0] = {
      apiKey,
      timeout: HTTP_TIMEOUT_MS,
    };
    if (baseURL) {
      clientOpts.baseURL = baseURL;
    }
    this.client = new Anthropic(clientOpts);
    this.model = model || DEFAULT_MODEL;
    this.maxTokens = maxTokens && maxTokens > 0 ? maxTokens : DEFAULT_MAX_TOKENS;
  }

  async analyzeChat(
    systemPrompt: string,
    chatTranscript: string,
  ): Promise<AIResponse> {
    return withRetry(async () => {
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: [{ type: 'text', text: systemPrompt }],
        messages: [
          { role: 'user', content: [{ type: 'text', text: chatTranscript }] },
        ],
      });

      const textBlock = message.content.find((b) => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text' || !textBlock.text) {
        throw new Error('claude api returned empty content');
      }

      return {
        content: textBlock.text,
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        model: message.model,
        provider: 'claude',
      };
    });
  }
}
