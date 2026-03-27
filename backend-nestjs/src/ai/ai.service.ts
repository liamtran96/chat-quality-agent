import { Injectable } from '@nestjs/common';
import { AIProvider } from './providers/ai-provider.interface';
import { ClaudeProvider } from './providers/claude.provider';
import { GeminiProvider } from './providers/gemini.provider';

@Injectable()
export class AIService {
  createProvider(
    provider: string,
    apiKey: string,
    model: string,
    baseURL?: string,
    maxTokens?: number,
  ): AIProvider {
    switch (provider) {
      case 'claude':
        return new ClaudeProvider(apiKey, model, maxTokens, baseURL);
      case 'gemini':
        return new GeminiProvider(apiKey, model, baseURL);
      default:
        throw new Error(`unsupported AI provider: ${provider}`);
    }
  }
}
