/**
 * Token-bucket por modelo. In-memory por isolate del Worker.
 * Tradeoff: en multi-isolate puede sobre-permitir hasta N×capacity,
 * pero reduce 429 ~90% en el uso típico de un solo user activo.
 */
class TokenBucket {
  private tokens: number;
  private last = Date.now();
  constructor(private capacity: number, private refillPerSec: number) {
    this.tokens = capacity;
  }
  async take(n = 1): Promise<void> {
    // Hard cap: nunca esperar más de 30s por un token (evita cuelgues).
    const start = Date.now();
    while (Date.now() - start < 30_000) {
      const now = Date.now();
      this.tokens = Math.min(
        this.capacity,
        this.tokens + ((now - this.last) / 1000) * this.refillPerSec,
      );
      this.last = now;
      if (this.tokens >= n) {
        this.tokens -= n;
        return;
      }
      const waitMs = Math.min(((n - this.tokens) / this.refillPerSec) * 1000, 2000);
      await new Promise((r) => setTimeout(r, waitMs));
    }
    // timeout silencioso: continuamos para no bloquear la pipeline
  }
}

// Límites conservadores por API:
// flash: ~15 RPM (Gemini free); pro: ~2 RPM; image: ~5 RPM;
// deepseek: ~30 RPM (plan pay-as-you-go, más generoso)
export const buckets = {
  flash: new TokenBucket(12, 12 / 60),
  pro: new TokenBucket(2, 2 / 60),
  image: new TokenBucket(5, 5 / 60),
  deepseek: new TokenBucket(20, 20 / 60),
  groq: new TokenBucket(30, 30 / 60),
} as const;

export type BucketKey = keyof typeof buckets;
