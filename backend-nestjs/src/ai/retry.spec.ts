import { withRetry } from './retry';

const FAST_BACKOFF = 10; // ms, to keep tests fast

describe('withRetry', () => {
  it('should return result on first success', async () => {
    const result = await withRetry(async () => 'hello');
    expect(result).toBe('hello');
  });

  it('should retry on retryable errors and eventually succeed', async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('status 429 rate limit exceeded');
        }
        return 'success';
      },
      3,
      undefined,
      FAST_BACKOFF,
    );

    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('should fail immediately on non-retryable errors', async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts++;
          throw new Error('invalid api key');
        },
        3,
        undefined,
        FAST_BACKOFF,
      ),
    ).rejects.toThrow('invalid api key');

    expect(attempts).toBe(1);
  });

  it.each([
    ['429 rate limit', 'status 429 rate limit exceeded'],
    ['500 server error', 'server error 500'],
    ['502 bad gateway', 'bad gateway 502'],
    ['503 unavailable', 'service unavailable 503'],
    ['529 overloaded', 'overloaded 529'],
    ['timeout', 'request timeout'],
    ['connection', 'connection refused'],
    ['RESOURCE_EXHAUSTED', 'RESOURCE_EXHAUSTED'],
    ['quota', 'quota exceeded'],
    ['EOF', 'unexpected EOF'],
    ['reset', 'connection reset'],
    ['rate (lowercase)', 'rate limit hit'],
    ['Rate (capitalized)', 'Rate limit exceeded'],
  ])('should retry on %s errors', async (_label, errorMessage) => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts++;
        if (attempts === 1) {
          throw new Error(errorMessage);
        }
        return 'ok';
      },
      3,
      undefined,
      FAST_BACKOFF,
    );

    expect(result).toBe('ok');
    expect(attempts).toBe(2);
  });

  it('should fail after max retries exhausted', async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts++;
          throw new Error('status 429 rate limited');
        },
        2,
        undefined,
        FAST_BACKOFF,
      ),
    ).rejects.toThrow('failed after 2 retries');

    expect(attempts).toBe(3); // initial + 2 retries
  });

  it('should respect abort signal', async () => {
    const controller = new AbortController();
    controller.abort('test cancel');

    await expect(
      withRetry(
        async () => {
          throw new Error('status 429 rate limited');
        },
        3,
        controller.signal,
        FAST_BACKOFF,
      ),
    ).rejects.toThrow('retry cancelled');
  });
});
