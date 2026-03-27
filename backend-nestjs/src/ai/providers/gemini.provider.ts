import { GoogleGenAI } from '@google/genai';
import { AIResponse } from './ai-provider.interface';
import { BaseProvider } from './base.provider';
import { withRetry } from '../retry';

const DEFAULT_MODEL = 'gemini-2.5-flash';

export class GeminiProvider extends BaseProvider {
  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor(apiKey: string, model?: string, baseURL?: string) {
    super();
    const clientOpts: ConstructorParameters<typeof GoogleGenAI>[0] = {
      apiKey,
    };
    if (baseURL) {
      clientOpts.httpOptions = { baseUrl: baseURL };
    }
    this.client = new GoogleGenAI(clientOpts);
    this.model = model || DEFAULT_MODEL;
  }

  async analyzeChat(
    systemPrompt: string,
    chatTranscript: string,
  ): Promise<AIResponse> {
    return withRetry(async () => {
      const result = await this.client.models.generateContent({
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

      return {
        content: text,
        inputTokens: result.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: result.usageMetadata?.candidatesTokenCount ?? 0,
        model: this.model,
        provider: 'gemini',
      };
    });
  }
}
