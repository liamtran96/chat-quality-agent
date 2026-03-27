import { GoogleGenAI } from '@google/genai';
import {
  AIProvider,
  AIResponse,
  BatchItem,
} from './ai-provider.interface';
import { withRetry } from '../retry';
import { wrapBatchPrompt, formatBatchTranscript } from '../prompts';

const DEFAULT_MODEL = 'gemini-2.5-flash';

export class GeminiProvider implements AIProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseURL?: string;

  constructor(apiKey: string, model?: string, baseURL?: string) {
    this.apiKey = apiKey;
    this.model = model || DEFAULT_MODEL;
    this.baseURL = baseURL;
  }

  async analyzeChat(
    systemPrompt: string,
    chatTranscript: string,
  ): Promise<AIResponse> {
    return withRetry(async () => {
      const clientOpts: ConstructorParameters<typeof GoogleGenAI>[0] = {
        apiKey: this.apiKey,
      };
      if (this.baseURL) {
        clientOpts.httpOptions = { baseUrl: this.baseURL };
      }
      const client = new GoogleGenAI(clientOpts);

      const result = await client.models.generateContent({
        model: this.model,
        contents: chatTranscript,
        config: {
          systemInstruction: systemPrompt,
        },
      });

      const text = result.text ?? '';
      if (!text) {
        throw new Error('gemini api returned empty content');
      }

      const aiResp: AIResponse = {
        content: text,
        inputTokens: 0,
        outputTokens: 0,
        model: this.model,
        provider: 'gemini',
      };

      if (result.usageMetadata) {
        aiResp.inputTokens = result.usageMetadata.promptTokenCount ?? 0;
        aiResp.outputTokens = result.usageMetadata.candidatesTokenCount ?? 0;
      }

      return aiResp;
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
