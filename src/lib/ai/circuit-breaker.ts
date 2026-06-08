/**
 * Circuit breaker per endpoint.
 * closed → open (tras failureThreshold fallos en windowMs)
 * open  → half-open (tras cooldownMs) — 1 probe permitido
 * half-open → closed (probe ok) | open (probe falló)
 */
type State = "closed" | "open" | "half-open";

export class CircuitBreaker {
  private state: State = "closed";
  private failures: number[] = [];
  private openedAt = 0;
  constructor(
    private name: string,
    private opts: {
      failureThreshold?: number;
      windowMs?: number;
      cooldownMs?: number;
    } = {},
  ) {}

  canRequest(): boolean {
    if (this.state === "closed") return true;
    if (this.state === "open") {
      const cooldown = this.opts.cooldownMs ?? 60_000;
      if (Date.now() - this.openedAt >= cooldown) {
        this.state = "half-open";
        return true;
      }
      return false;
    }
    return true; // half-open allows 1 probe
  }

  recordSuccess() {
    this.failures = [];
    if (this.state !== "closed") {
      console.log(`[breaker:${this.name}] → closed`);
    }
    this.state = "closed";
  }

  recordFailure() {
    const now = Date.now();
    const window = this.opts.windowMs ?? 30_000;
    this.failures = this.failures.filter((t) => now - t < window);
    this.failures.push(now);
    const threshold = this.opts.failureThreshold ?? 5;
    if (this.state === "half-open" || this.failures.length >= threshold) {
      if (this.state !== "open") {
        console.warn(`[breaker:${this.name}] → open (${this.failures.length} fallos)`);
      }
      this.state = "open";
      this.openedAt = now;
    }
  }

  getState(): State {
    return this.state;
  }
}

export const breakers = {
  deepseek: new CircuitBreaker("deepseek", { failureThreshold: 4, cooldownMs: 45_000 }),
  geminiDirect: new CircuitBreaker("gemini:direct", { failureThreshold: 4, cooldownMs: 60_000 }),
  geminiImage: new CircuitBreaker("gemini:image", { failureThreshold: 3, cooldownMs: 45_000 }),
  pollinations: new CircuitBreaker("pollinations", { failureThreshold: 3, cooldownMs: 30_000 }),
  unsplash: new CircuitBreaker("unsplash", { failureThreshold: 3, cooldownMs: 30_000 }),
};
