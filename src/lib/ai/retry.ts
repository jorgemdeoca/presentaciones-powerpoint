/**
 * Exponential backoff con full jitter (AWS Architecture Blog).
 * delay = random(0, min(cap, base * 2^attempt))
 */
export async function withBackoff<T>(
  fn: (attempt: number) => Promise<T>,
  opts: {
    retries?: number;
    baseMs?: number;
    capMs?: number;
    retryOn?: (err: unknown) => boolean;
    onRetry?: (attempt: number, delayMs: number, err: unknown) => void;
  } = {},
): Promise<T> {
  const retries = opts.retries ?? 3;
  const base = opts.baseMs ?? 800;
  const cap = opts.capMs ?? 15_000;
  const retryOn = opts.retryOn ?? (() => true);

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !retryOn(err)) throw err;
      const delay = Math.random() * Math.min(cap, base * 2 ** attempt);
      opts.onRetry?.(attempt + 1, delay, err);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

export function isRetriableHttpStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status < 600);
}
