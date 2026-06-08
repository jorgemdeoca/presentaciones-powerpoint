/**
 * Logger estructurado JSON-line para telemetría de IA.
 * Visible en server-function-logs / edge-function-logs.
 */
type AiLogPayload = {
  traceId?: string;
  presentationId?: string;
  slideIdx?: number;
  endpoint: string;
  model?: string;
  status: "ok" | "error" | "retry" | "fallback" | "breaker-open";
  latencyMs?: number;
  retries?: number;
  httpStatus?: number;
  error?: string;
  meta?: Record<string, unknown>;
};

export function logAi(p: AiLogPayload): void {
  try {
    // Una sola línea JSON por evento → grep/filter friendly.
    console.log(`[ai] ${JSON.stringify(p)}`);
  } catch {
    console.log(`[ai] ${p.endpoint} ${p.status}`);
  }
}

export function newTraceId(): string {
  return `tr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const t0 = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - t0 };
}
