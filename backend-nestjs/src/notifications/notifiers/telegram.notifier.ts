import { Notifier } from './notifier.interface';

const TELEGRAM_API_BASE = 'https://api.telegram.org/bot%s/%s';
const MAX_MESSAGE_LENGTH = 4000;
const REQUEST_TIMEOUT_MS = 30_000;

function buildUrl(botToken: string, method: string): string {
  return TELEGRAM_API_BASE.replace('%s', botToken).replace('%s', method);
}

async function fetchWithTimeout(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export class TelegramNotifier implements Notifier {
  constructor(
    private readonly botToken: string,
    private readonly chatId: string,
  ) {}

  async send(subject: string, body: string): Promise<void> {
    let text = body;
    if (subject) {
      text = `<b>${subject}</b>\n\n${body}`;
    }

    if (text.length > MAX_MESSAGE_LENGTH) {
      text = text.slice(0, MAX_MESSAGE_LENGTH) + '\n\n<i>... (truncated)</i>';
    }

    const url = buildUrl(this.botToken, 'sendMessage');
    const resp = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: this.chatId,
        text,
        parse_mode: 'HTML',
      }),
    });

    const result = (await resp.json()) as { ok: boolean; description?: string };
    if (!result.ok) {
      throw new Error(`telegram api error: ${result.description}`);
    }
  }

  async healthCheck(): Promise<void> {
    const url = buildUrl(this.botToken, 'getMe');
    const resp = await fetchWithTimeout(url);
    const result = (await resp.json()) as { ok: boolean };
    if (!result.ok) {
      throw new Error('telegram bot not accessible');
    }
  }
}
