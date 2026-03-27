import { TelegramNotifier } from './telegram.notifier';

describe('TelegramNotifier', () => {
  it('should create a notifier with correct properties', () => {
    const notifier = new TelegramNotifier('test-bot-token', '-1001234567890');
    expect(notifier).toBeDefined();
  });

  describe('message truncation', () => {
    it('should truncate messages longer than 4000 characters', async () => {
      const notifier = new TelegramNotifier('fake-token', '-100123');
      const longBody = 'x'.repeat(5000);

      // Mock global fetch
      const mockFetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ ok: true }),
      });
      global.fetch = mockFetch;

      await notifier.send('Subject', longBody);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);

      // The text should be truncated: <b>Subject</b>\n\n + body
      // Total should be <= 4000 + truncation suffix length
      expect(payload.text.length).toBeLessThanOrEqual(
        4000 + '\n\n<i>... (truncated)</i>'.length,
      );
      expect(payload.text).toContain('... (truncated)');
      expect(payload.parse_mode).toBe('HTML');
      expect(payload.chat_id).toBe('-100123');
    });

    it('should not truncate short messages', async () => {
      const notifier = new TelegramNotifier('fake-token', '-100123');
      const shortBody = 'Hello world';

      const mockFetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ ok: true }),
      });
      global.fetch = mockFetch;

      await notifier.send('Test', shortBody);

      const callArgs = mockFetch.mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);
      expect(payload.text).toBe('<b>Test</b>\n\nHello world');
      expect(payload.text).not.toContain('truncated');
    });

    it('should throw on telegram API error', async () => {
      const notifier = new TelegramNotifier('bad-token', '-100123');

      const mockFetch = jest.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({ ok: false, description: 'Unauthorized' }),
      });
      global.fetch = mockFetch;

      await expect(notifier.send('Test', 'body')).rejects.toThrow(
        'telegram api error: Unauthorized',
      );
    });
  });

  describe('healthCheck', () => {
    it('should succeed when bot is accessible', async () => {
      const notifier = new TelegramNotifier('good-token', '-100123');

      const mockFetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ ok: true }),
      });
      global.fetch = mockFetch;

      await expect(notifier.healthCheck()).resolves.not.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('getMe');
    });

    it('should throw when bot is not accessible', async () => {
      const notifier = new TelegramNotifier('bad-token', '-100123');

      const mockFetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ ok: false }),
      });
      global.fetch = mockFetch;

      await expect(notifier.healthCheck()).rejects.toThrow(
        'telegram bot not accessible',
      );
    });
  });
});
