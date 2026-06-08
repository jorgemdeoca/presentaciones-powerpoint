# Auditoría de Resiliencia & Plan de Optimización del Motor de IA

## 1. Diagnóstico técnico (puntos de fallo actuales)

Tras revisar `src/lib/ai.server.ts`, `src/lib/ai/pipeline.ts`, `src/lib/ai/prompts.ts` y `src/lib/presentations.functions.ts`:

### 1.1 Concurrencia y rate limits
- **Sin control global de RPS/RPM.** `chatJSONViaGateway` reintenta con backoff *por-llamada*, pero múltiples slides/usuarios disparan llamadas en paralelo sin coordinación. El plan free de Gemini (~15 RPM, 1500 RPD) colapsa fácilmente.
- **Doble llamada planner + artDirector** por cada deck (≈2 llamadas pesadas) más **N llamadas de imagen secuenciales**. En un deck de 10 slides son 2 + 10 = 12 llamadas en ~2 minutos → riesgo alto de 429.
- **Fallback a Gemini directo** dentro del mismo request: si el Gateway falla por rate-limit, inmediatamente se golpea la API directa con la misma carga, multiplicando el problema.

### 1.2 Bloqueos del event loop y timeouts
- `executeGeneration` corre **dentro del request HTTP** (`processPresentationGeneration` espera el `await`). En Cloudflare Workers el límite de CPU/wall-time mata el proceso si el deck tarda > ~30s, dejando la presentación en `generating` para siempre → "se queda cargando indefinidamente".
- Cada `generateImageBase64` tiene `timeout 60s`; 10 imágenes secuenciales = hasta 10 min, imposible dentro de una serverless request.
- Los `setStep` son writes Postgres bloqueantes en serie (latencia acumulada ~200ms × 15 = 3s desperdiciados).

### 1.3 Manejo de errores
- `try/catch` por slide en imágenes **swallowea** errores sin registrar tipo (`429` vs `5xx` vs timeout) → no hay forma de diferenciar rate-limit de fallo real.
- No hay **Circuit Breaker**: si Gemini está caído, seguimos golpeando 12 veces por deck.
- Backoff actual es lineal (`1500ms × (n+1)`) sin **jitter**, lo que provoca *thundering herd* cuando varios users reintentan a la vez.

### 1.4 Payload / tokens
- `referenceText` envía hasta **20 000 chars por referencia** sin truncado inteligente → consume ~5k tokens de input por referencia.
- `plannerWriterSystem` repite paleta/colors/style 4 veces en el system prompt (~600 tokens fijos malgastados).
- **Sin caché**: regenerar el mismo deck cuesta exactamente lo mismo que la primera vez. No hay caché semántica ni hash-based.
- `artDirector` recibe `JSON.stringify(deck.slides)` completo solo para añadir `background` — pura redundancia, podría inferirse en cliente o en el planner mismo.

### 1.5 Observabilidad
- Solo `console.error` esporádico. No hay:
  - Métricas de latencia por modelo / endpoint.
  - Counter de 429/402/5xx.
  - Distribución de tokens consumidos.
  - Trace ID por presentación para correlacionar fases.

---

## 2. Plan de optimización (orden de impacto)

### Fase A — Resiliencia (alta prioridad, bajo riesgo)

**A1. Token-bucket global por modelo** (`src/lib/ai/rate-limiter.ts`)
Limitador en memoria del Worker (por isolate) con buckets independientes para `flash`, `pro`, `image`. Tradeoff: en multi-isolate puede sobre-permitir hasta `N_isolates × bucket`, pero reduce 429 en ~90% para el uso típico de un solo user activo. Si se necesita global real → mover a Durable Object o tabla Postgres `ai_quota` con `SELECT ... FOR UPDATE`.

```ts
// rate-limiter.ts
class TokenBucket {
  constructor(private capacity: number, private refillPerSec: number) {}
  private tokens = this.capacity;
  private last = Date.now();
  async take(n = 1): Promise<void> {
    while (true) {
      const now = Date.now();
      this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) / 1000) * this.refillPerSec);
      this.last = now;
      if (this.tokens >= n) { this.tokens -= n; return; }
      const wait = ((n - this.tokens) / this.refillPerSec) * 1000;
      await new Promise(r => setTimeout(r, Math.min(wait, 2000)));
    }
  }
}
export const buckets = {
  flash: new TokenBucket(10, 10/60),  // 10 RPM
  pro:   new TokenBucket(2, 2/60),    // 2 RPM (free)
  image: new TokenBucket(5, 5/60),
};
```

**A2. Exponential backoff con full jitter**
Reemplazar el `1500 * (attempt+1)` actual por:
```ts
const base = 800, cap = 15_000;
const delay = Math.random() * Math.min(cap, base * 2 ** attempt);
```
Diferencia los reintentos entre slides paralelos y elimina *thundering herd*.

**A3. Circuit Breaker por endpoint**
Estados: `closed → open (tras 5 fallos en 30s) → half-open (1 probe tras 60s)`.
Cuando está `open`, las llamadas saltan directo al fallback (Pollinations / Unsplash) sin tocar Gemini → protege la API y mantiene UX viva.

**A4. Sacar `executeGeneration` del request HTTP**
Patrón "Init + poll" ya parcialmente implementado, pero **el cliente sigue esperando** `processPresentationGeneration`. Opciones:
- Mover a un **server route** `POST /api/internal/generate/:id` que se invoca con `fetch` *sin await* desde `initPresentationGeneration` (fire-and-forget), o
- Usar `ctx.waitUntil(executeGeneration(...))` en Cloudflare Workers para dejar la tarea corriendo tras la respuesta.
Tradeoff: en Workers `waitUntil` tiene su propio CPU cap (30s); para decks grandes la solución correcta es **trocear** la fase 4 (imágenes) en N invocaciones de `pg_cron` o `setTimeout` recursivo vía polling.

### Fase B — Optimización del payload (media prioridad)

**B1. Caché semántica de respuestas** (`src/lib/ai/cache.ts`)
Hash SHA-256 de `(system + user + model + tool.name)` → tabla `ai_cache(hash text pk, response jsonb, created_at)` con TTL 24h. Hit ratio esperado en regeneraciones del mismo deck: 100%.

**B2. Truncado inteligente de referencias**
Pasar referencias por un *mini-resumen* (Flash-lite) la primera vez que se suben, guardar `summary` (ya existe la columna) y enviar **solo el summary** al planner. Reduce input de ~20k a ~1k chars por ref.

**B3. Fusionar Planner + Art Director**
El art director sólo añade `background` CSS; mover esa responsabilidad al planner mismo o calcular el gradient en código a partir de la paleta. **Elimina 1 llamada por deck (50% de reducción en fase texto).**

**B4. Comprimir system prompt**
Refactor de `plannerWriterSystem`: paleta y estilo se mencionan 1 vez, layouts en lista compacta. Reducción estimada: 600 → 250 tokens (~58% menos input fijo).

### Fase C — Imágenes (alta prioridad para UX)

**C1. Fallback en cascada por slide**
```
Gateway image → (429/5xx) → Pollinations → (timeout) → Unsplash by query → placeholder oklch gradient
```
Nunca un slide se queda sin imagen.

**C2. Paralelizar con concurrencia limitada (p-limit 2)**
Actualmente secuencial (lento) o paralelo (rate-limit). El sweet-spot es `concurrency = 2` con el token bucket de A1 encima.

**C3. Deduplicar prompts**
Si dos slides comparten `image_prompt` (raro pero ocurre con metric_blocks), reutilizar resultado.

### Fase D — Observabilidad (media prioridad)

**D1. Logger estructurado** (`src/lib/ai/logger.ts`)
```ts
log.ai({ traceId, presentationId, slideIdx, model, latencyMs, status, tokensIn, tokensOut, retries });
```
Salida JSON-line a `console.log` → visible en `supabase--edge_function_logs` o `stack_modern--server-function-logs`.

**D2. Tabla `ai_telemetry`** opcional para dashboards posteriores (p99 latency, fallo por modelo, costo estimado).

**D3. Trace ID propagado** desde `initPresentationGeneration` y guardado en `presentations.generation_error` (cuando falla) para correlación rápida.

---

## 3. Refactor arquitectónico recomendado

```text
                ┌──────────────────────┐
   Cliente ───▶ │ initPresentation     │  ── insert + return id (≤200ms)
                └────────┬─────────────┘
                         │ ctx.waitUntil
                ┌────────▼─────────────┐
                │ executeGeneration    │
                │  ┌────────────────┐  │
                │  │ AIGateway      │  │  ◀── TokenBucket + CircuitBreaker
                │  │  - chatJSON    │  │       + Backoff(jitter)
                │  │  - image       │  │       + SemanticCache
                │  └────────────────┘  │
                └────────┬─────────────┘
                         │ writes progress to presentations.generation_step
   Cliente polling ──────┘
```

Capas nuevas (todas en `src/lib/ai/`):
- `rate-limiter.ts` — TokenBucket
- `circuit-breaker.ts` — Breaker per endpoint
- `retry.ts` — backoff + jitter genérico
- `cache.ts` — caché semántica (Postgres)
- `logger.ts` — telemetría estructurada
- `gateway.ts` — fachada que compone todo lo anterior; `ai.server.ts` se vuelve un thin wrapper.

---

## 4. Tradeoffs

| Decisión | Pro | Contra |
|---|---|---|
| Token-bucket en memoria | Cero infra extra, rápido | No es global entre isolates |
| `ctx.waitUntil` | Sin cola externa | CPU cap 30s en Worker free |
| Caché semántica por hash exacto | Simple, 100% hit en regen | No detecta paráfrasis (semántica real requiere embeddings) |
| Fusionar planner+artDirector | -50% llamadas texto | Pierde un poco de control fino del background |
| Fallback Pollinations/Unsplash | UX nunca rota | Estética menos coherente |

---

## 5. Entregables (qué archivos toco)

**Nuevos:**
- `src/lib/ai/rate-limiter.ts`
- `src/lib/ai/circuit-breaker.ts`
- `src/lib/ai/retry.ts`
- `src/lib/ai/cache.ts`
- `src/lib/ai/logger.ts`
- `src/lib/ai/gateway.ts`
- migración: tabla `ai_cache(hash, response, created_at)` + índice + RLS service_role

**Modificados:**
- `src/lib/ai.server.ts` → delega en `gateway.ts`
- `src/lib/ai/pipeline.ts` → elimina runArtDirector (lo fusiona en planner), añade `concurrency = 2` en imágenes
- `src/lib/ai/prompts.ts` → prompt comprimido, planner devuelve `background`
- `src/lib/presentations.functions.ts` → `executeGeneration` vía `waitUntil`, trace ID, logger
- `src/routes/generating.$id.tsx` → muestra estado del breaker si está `open` ("IA saturada, reintentando…")

---

## 6. Orden de implementación sugerido

1. **A1+A2+A3** (rate-limiter, retry con jitter, breaker) — protege inmediatamente contra 429
2. **D1** (logger) — visibilidad antes de cualquier cambio mayor
3. **C1+C2** (cascada imágenes + concurrencia 2) — arregla el cuelgue de fase 4
4. **B3+B4** (fusionar planner/art, comprimir prompt) — reduce 50% del costo texto
5. **A4** (`waitUntil`) — desacopla del request HTTP
6. **B1** (caché semántica) — reduce costo en regeneraciones
7. **D2** (telemetría persistida) — opcional, para dashboard

¿Procedo con la Fase A (1–3) en este turno, o quieres que ejecute el plan completo de una sola vez?
