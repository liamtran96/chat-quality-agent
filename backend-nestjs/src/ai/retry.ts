import { sleepWithSignal } from '../common/helpers';

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 5000; // 5 seconds

/**
 * Check if an error is retryable (rate limit, server error, network).
 */
function isRetryableError(err: unknown): boolean {
  if (!err) return false;

  const msg = err instanceof Error ? err.message : String(err);

  // Rate limit
  if (
    msg.includes('429') ||
    msg.includes('rate') ||
    msg.includes('Rate') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('quota')
  ) {
    return true;
  }

  // Server errors
  if (
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('529')
  ) {
    return true;
  }

  // Network errors
  if (
    msg.includes('timeout') ||
    msg.includes('connection') ||
    msg.includes('EOF') ||
    msg.includes('reset')
  ) {
    return true;
  }

  return false;
}

/**
 * Wraps an async function with exponential backoff retry for transient errors.
 * Backoff schedule: 5s -> 15s -> 45s (multiply by 3 each time).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  signal?: AbortSignal,
  initialBackoffMs: number = INITIAL_BACKOFF_MS,
): Promise<T> {
  let lastErr: unknown;
  let backoff = initialBackoffMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      console.log(
        `[retry] attempt ${attempt}/${maxRetries} after error: ${lastErr} (backoff: ${backoff}ms)`,
      );

      if (signal?.aborted) {
        throw new Error(`retry cancelled: ${signal.reason || 'aborted'}`);
      }

      await sleepWithSignal(backoff, signal);

      if (signal?.aborted) {
        throw new Error(`retry cancelled: ${signal.reason || 'aborted'}`);
      }

      backoff *= 3; // exponential: 5s -> 15s -> 45s
    }

    try {
      return await fn();
    } catch (err) {
      lastErr = err;

      if (!isRetryableError(err)) {
        throw err; // non-retryable, fail immediately
      }
    }
  }

  throw new Error(
    `failed after ${maxRetries} retries: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
  );
}
