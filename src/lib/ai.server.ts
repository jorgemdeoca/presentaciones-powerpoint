import { Buffer } from "node:buffer";
import { buckets } from "@/lib/ai/rate-limiter";
import { breakers } from "@/lib/ai/circuit-breaker";
import { isRetriableHttpStatus, withBackoff } from "@/lib/ai/retry";
import { logAi } from "@/lib/ai/logger";

function requireGeminiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY no configurado en las variables de entorno");
  }
  return key;
}

// ------------------------------------------------------------------
// DeepSeek API (OpenAI-compatible) — Motor principal para análisis
// de texto, estructuración de slides y procesamiento de documentos.
// Gemini se usa exclusivamente para generación de imágenes.
// ------------------------------------------------------------------

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

function getGroqKey(): string | undefined {
  return process.env.GROQ_API_KEY?.trim() || undefined;
}

function getDeepSeekKey(): string | undefined {
  return process.env.DEEPSEEK_API_KEY?.trim() || undefined;
}

/**
 * Llama a APIs compatibles con OpenAI (DeepSeek, Groq) para generar JSON estructurado.
 */
async function chatJSONViaOpenAICompatible<T>(opts: {
  system: string;
  user: string;
  tool?: { name: string; description: string; parameters: Record<string, unknown> };
  apiKey: string;
  apiUrl: string;
  model: string;
  provider: "deepseek" | "groq";
}): Promise<T> {
  const breaker = breakers[opts.provider];
  if (!breaker.canRequest()) {
    logAi({ endpoint: opts.provider, status: "breaker-open" });
    throw new Error(`${opts.provider} en cooldown (circuit breaker abierto)`);
  }

  const body: Record<string, unknown> = {
    model: opts.model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    temperature: 0.7,
    max_tokens: 8192,
  };

  if (opts.tool) {
    body.tools = [
      {
        type: "function",
        function: {
          name: opts.tool.name,
          description: opts.tool.description,
          parameters: opts.tool.parameters,
        },
      },
    ];
    body.tool_choice = { type: "function", function: { name: opts.tool.name } };
  } else {
    // Groq requiere response_format
    body.response_format = { type: "json_object" };
  }

  try {
    const result = await withBackoff<T>(
      async (attempt) => {
        await buckets[opts.provider].take(1);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 90_000);
        const t0 = Date.now();
        try {
          const res = await fetch(opts.apiUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${opts.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          });

          if (!res.ok) {
            const txt = await res.text().catch(() => "");
            const err = new Error(`${opts.provider} ${res.status}: ${txt.slice(0, 200)}`);
            (err as Error & { httpStatus?: number }).httpStatus = res.status;
            throw err;
          }

          const json = await res.json();
          const choice = json?.choices?.[0];

          // Intentar extraer de tool_calls primero
          const toolCall = choice?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            const parsed = JSON.parse(toolCall.function.arguments) as T;
            logAi({
              endpoint: opts.provider,
              status: "ok",
              latencyMs: Date.now() - t0,
              meta: { attempt, tokens: json?.usage?.total_tokens },
            });
            return parsed;
          }

          // Si no hay tool_calls, extraer de content
          const content = choice?.message?.content;
          if (typeof content === "string" && content.trim()) {
            const parsed = JSON.parse(cleanJsonString(content)) as T;
            logAi({
              endpoint: opts.provider,
              status: "ok",
              latencyMs: Date.now() - t0,
              meta: { attempt, tokens: json?.usage?.total_tokens },
            });
            return parsed;
          }

          throw new Error(`Respuesta de ${opts.provider} vacía`);
        } finally {
          clearTimeout(timeout);
        }
      },
      {
        retries: 3,
        baseMs: 900,
        capMs: 12_000,
        retryOn: (err) => {
          const e = err as { httpStatus?: number };
          if (typeof e?.httpStatus === "number") return isRetriableHttpStatus(e.httpStatus);
          return true;
        },
        onRetry: (attempt, delayMs, err) => {
          const e = err as { httpStatus?: number; message?: string };
          logAi({
            endpoint: opts.provider,
            status: "retry",
            httpStatus: e?.httpStatus,
            error: e?.message?.slice(0, 160),
            meta: { attempt, delayMs: Math.round(delayMs) },
          });
        },
      },
    );
    breaker.recordSuccess();
    return result;
  } catch (err) {
    breaker.recordFailure();
    throw err;
  }
}

// ------------------------------------------------------------------
// Google Gemini — Usado como FALLBACK para texto si DeepSeek no está
// disponible, y como motor PRINCIPAL para generación de imágenes.
// ------------------------------------------------------------------

/** Modelos válidos en Google AI Studio. */
const GEMINI_FLASH_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"] as const;
const GEMINI_PRO_MODELS = ["gemini-2.5-pro", "gemini-2.0-flash"] as const;

function modelsToTryFor(tier: "flash" | "pro"): string[] {
  const fromEnv = process.env.GEMINI_MODEL?.trim();
  if (fromEnv) return [fromEnv];
  return tier === "pro" ? [...GEMINI_PRO_MODELS] : [...GEMINI_FLASH_MODELS];
}

function geminiUrl(modelName: string, apiKey: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
}

/** Gemini response_schema only supports a subset of JSON Schema — strip unsupported keys */
const GEMINI_SCHEMA_BLOCKLIST = new Set([
  "additionalProperties",
  "minItems",
  "maxItems",
  "minimum",
  "maximum",
  "minLength",
  "maxLength",
  "pattern",
  "$schema",
  "$id",
  "definitions",
  "default",
]);

function convertSchemaToGemini(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return { type: "STRING" };
  }

  const input = schema as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (GEMINI_SCHEMA_BLOCKLIST.has(key)) continue;

    if (key === "type" && typeof value === "string") {
      out.type = value.toUpperCase();
      continue;
    }

    if (key === "properties" && value && typeof value === "object" && !Array.isArray(value)) {
      const props: Record<string, unknown> = {};
      for (const [pk, pv] of Object.entries(value as Record<string, unknown>)) {
        props[pk] = convertSchemaToGemini(pv);
      }
      out.properties = props;
      continue;
    }

    if (key === "items") {
      out.items = convertSchemaToGemini(value);
      continue;
    }

    if (key === "required" || key === "enum" || key === "description") {
      out[key] = value;
    }
  }

  if (!out.type) out.type = "OBJECT";

  if (out.type === "OBJECT" && !out.properties) {
    out.properties = {};
  }

  return out;
}

function cleanJsonString(str: string): string {
  let cleaned = str.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  return cleaned.trim();
}

async function chatJSONViaGemini<T>(opts: {
  system: string;
  user: string;
  tool?: { name: string; description: string; parameters: Record<string, unknown> };
  model?: string;
}): Promise<T> {
  if (!breakers.geminiDirect.canRequest()) {
    logAi({ endpoint: "gemini:direct", status: "breaker-open" });
    throw new Error("Gemini temporalmente saturado");
  }

  const apiKey = requireGeminiKey();
  const tier = opts.model?.includes("pro") ? "pro" : "flash";
  await buckets[tier].take(1);
  const modelsToTry = modelsToTryFor(tier);

  const body: Record<string, unknown> = {
    contents: [
      { role: "user", parts: [{ text: opts.user }] },
    ],
    systemInstruction: { parts: [{ text: opts.system }] },
    generationConfig: {
      responseMimeType: "application/json",
    },
  };

  if (opts.tool?.parameters) {
    (body.generationConfig as Record<string, unknown>).responseSchema = convertSchemaToGemini(
      opts.tool.parameters,
    );
  }

  let response: Response | null = null;
  let lastError = "";

  for (const modelName of modelsToTry) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      response = await fetch(geminiUrl(modelName, apiKey), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (response.ok) break;

    lastError = await response.text();
    if (response.status === 404 || lastError.includes("not found")) {
      console.warn(`[gemini] modelo ${modelName} no disponible, probando siguiente…`);
      response = null;
      continue;
    }
    break;
  }

  if (!response?.ok) {
    const errText = lastError || "Error desconocido";
    breakers.geminiDirect.recordFailure();
    logAi({
      endpoint: "gemini:direct",
      status: "error",
      httpStatus: response?.status,
      error: errText.slice(0, 200),
    });
    if (response?.status === 429) {
      throw new Error("Límite de API de Gemini excedido, por favor espera unos segundos");
    }
    if (
      response?.status === 400 &&
      opts.tool?.parameters &&
      errText.includes("response_schema")
    ) {
      return chatJSONViaGemini<T>({
        ...opts,
        tool: undefined,
        user: `${opts.user}\n\nResponde ÚNICAMENTE con JSON válido, sin markdown.`,
      });
    }
    throw new Error(`Error de Gemini API (${response?.status ?? 0}): ${errText}`);
  }

  const data = await response.json();
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textResponse) {
    breakers.geminiDirect.recordFailure();
    throw new Error("La IA no devolvió un resultado válido o se activó un filtro de seguridad");
  }

  try {
    const parsed = JSON.parse(cleanJsonString(textResponse)) as T;
    breakers.geminiDirect.recordSuccess();
    logAi({ endpoint: "gemini:direct", status: "ok" });
    return parsed;
  } catch {
    breakers.geminiDirect.recordFailure();
    console.error("Failed to parse Gemini JSON output:", textResponse);
    throw new Error("La respuesta de la IA no pudo ser analizada como JSON estructurado");
  }
}

// ------------------------------------------------------------------
// FUNCIÓN PÚBLICA: chatJSON — orquesta multi-IA
// ------------------------------------------------------------------
// Prioridad: DeepSeek (análisis/estructura) → Gemini (fallback)
// ------------------------------------------------------------------

/**
 * Genera JSON estructurado usando múltiples IAs en cascada.
 * 
 * FLUJO:
 *   1. Si DEEPSEEK_API_KEY está configurada → usa DeepSeek (mejor para
 *      análisis de documentos, extracción de datos, estructuración)
 *   2. Si DeepSeek falla o no está configurado → cae a Google Gemini
 * 
 * NOTA: Para generación de IMÁGENES, usa generateImageBase64() que
 * siempre usa Gemini/Pollinations, nunca DeepSeek.
 */
export async function chatJSON<T>(opts: {
  system: string;
  user: string;
  tool?: { name: string; description: string; parameters: Record<string, unknown> };
  model?: string;
}): Promise<T> {
  const errors: string[] = [];

  // Camino 1: Groq (Gratis y ultra rápido, modelo Llama 3)
  const groqKey = getGroqKey();
  if (groqKey) {
    try {
      return await chatJSONViaOpenAICompatible<T>({
        ...opts,
        apiKey: groqKey,
        apiUrl: "https://api.groq.com/openai/v1/chat/completions",
        model: "llama-3.3-70b-versatile",
        provider: "groq",
      });
    } catch (err) {
      const e = err as { message?: string };
      logAi({ endpoint: "groq", status: "fallback", error: e?.message?.slice(0, 200) });
      errors.push(`Groq: ${e?.message || "Desconocido"}`);
    }
  }

  // Camino 2: DeepSeek
  const deepseekKey = getDeepSeekKey();
  if (deepseekKey) {
    try {
      return await chatJSONViaOpenAICompatible<T>({
        ...opts,
        apiKey: deepseekKey,
        apiUrl: DEEPSEEK_API_URL,
        model: "deepseek-chat",
        provider: "deepseek",
      });
    } catch (err) {
      const e = err as { message?: string };
      logAi({ endpoint: "deepseek", status: "fallback", error: e?.message?.slice(0, 200) });
      errors.push(`DeepSeek: ${e?.message || "Desconocido"}`);
    }
  }

  // Camino 3: Gemini como fallback final (o primario si no hay Groq/DeepSeek)
  try {
    return await chatJSONViaGemini<T>(opts);
  } catch (err) {
    const e = err as { message?: string };
    errors.push(`Gemini: ${e?.message || "Desconocido"}`);
    throw new Error(`Todas las IAs fallaron en cascada:\n${errors.join("\n")}`);
  }
}

// ------------------------------------------------------------------
// GENERACIÓN DE IMÁGENES — Siempre usa Gemini / Pollinations
// ------------------------------------------------------------------

export async function generateImageBase64(prompt: string): Promise<string> {
  // Intentar Gemini Image primero (si la API key está disponible)
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && breakers.geminiImage.canRequest()) {
    try {
      await buckets.image.take(1);
      const t0 = Date.now();
      const b64 = await generateImageViaGemini(prompt, geminiKey);
      breakers.geminiImage.recordSuccess();
      logAi({ endpoint: "gemini:image", status: "ok", latencyMs: Date.now() - t0 });
      return b64;
    } catch (err) {
      breakers.geminiImage.recordFailure();
      const e = err as { message?: string };
      logAi({
        endpoint: "gemini:image",
        status: "fallback-to-pollinations",
        error: e?.message?.slice(0, 200),
      });
    }
  }

  // Fallback: Pollinations (gratuito, sin API key)
  return await generateImageViaPollinations(prompt);
}

/**
 * Genera imagen vía Gemini Image Generation API.
 * Intenta múltiples modelos en cascada.
 */
async function generateImageViaGemini(prompt: string, apiKey: string): Promise<string> {
  const models = [
    "gemini-2.0-flash-preview-image-generation",
    "gemini-2.0-flash-exp",
  ];
  
  let lastError = "";
  for (const model of models) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt.slice(0, 2000) }] }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
          },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        lastError = `Gemini Image ${model} ${res.status}: ${text.slice(0, 200)}`;
        if (res.status === 404) {
          // Modelo no disponible, probar siguiente
          continue;
        }
        throw new Error(lastError);
      }

      const json = await res.json();
      const parts = json?.candidates?.[0]?.content?.parts;
      if (parts) {
        for (const part of parts) {
          if (part.inlineData?.data) {
            return part.inlineData.data;
          }
        }
      }
      lastError = `${model} no devolvió imagen en la respuesta`;
      continue;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        lastError = `Timeout generando imagen con ${model}`;
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(lastError || "Ningún modelo de Gemini pudo generar la imagen");
}

async function generateImageViaPollinations(prompt: string): Promise<string> {
  if (!breakers.pollinations.canRequest()) {
    logAi({ endpoint: "pollinations", status: "breaker-open" });
    throw new Error("Pollinations en cooldown");
  }
  const seed = Math.floor(Math.random() * 1_000_000);
  const cleanPrompt = encodeURIComponent(prompt.trim().slice(0, 800));
  const url = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=1280&height=720&seed=${seed}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  const t0 = Date.now();
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Pollinations status ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    breakers.pollinations.recordSuccess();
    logAi({ endpoint: "pollinations", status: "ok", latencyMs: Date.now() - t0 });
    return Buffer.from(arrayBuffer).toString("base64");
  } catch (err) {
    breakers.pollinations.recordFailure();
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Busca una imagen real en Unsplash (sin API key, vía source.unsplash.com).
 */
export async function searchWebImage(query: string): Promise<string | null> {
  if (!breakers.unsplash.canRequest()) {
    logAi({ endpoint: "unsplash", status: "breaker-open" });
    return null;
  }
  try {
    const clean = encodeURIComponent(query.trim().slice(0, 200));
    const url = `https://source.unsplash.com/1600x900/?${clean}`;
    const res = await fetch(url, { method: "GET", redirect: "follow" });
    if (!res.ok) {
      breakers.unsplash.recordFailure();
      return null;
    }
    breakers.unsplash.recordSuccess();
    return res.url || url;
  } catch (err) {
    breakers.unsplash.recordFailure();
    const e = err as { message?: string };
    logAi({ endpoint: "unsplash", status: "error", error: e?.message?.slice(0, 160) });
    return null;
  }
}

/**
 * Cascada para obtener una imagen para un slide. Devuelve:
 *  - { kind: "b64", data } cuando hay base64 (subir a storage)
 *  - { kind: "url", url } cuando se resolvió por web (usar URL directa)
 *  - null si todo falló (el caller usa placeholder)
 */
export async function getSlideImageCascade(opts: {
  prompt: string;
  query?: string;
  prefer: "ai" | "web";
  allowAi: boolean;
  allowWeb: boolean;
}): Promise<{ kind: "b64"; data: string } | { kind: "url"; url: string } | null> {
  const order: Array<"ai" | "web"> = [];
  if (opts.prefer === "ai") {
    if (opts.allowAi) order.push("ai");
    if (opts.allowWeb) order.push("web");
  } else {
    if (opts.allowWeb) order.push("web");
    if (opts.allowAi) order.push("ai");
  }

  for (const source of order) {
    try {
      if (source === "ai") {
        const b64 = await generateImageBase64(opts.prompt);
        if (b64) return { kind: "b64", data: b64 };
      } else {
        const url = await searchWebImage(opts.query || opts.prompt);
        if (url) return { kind: "url", url };
      }
    } catch (err) {
      const e = err as { message?: string };
      logAi({ endpoint: `cascade:${source}`, status: "fallback", error: e?.message?.slice(0, 160) });
    }
  }

  if (opts.allowWeb || opts.allowAi) {
    // Si llegamos hasta aquí y todo falló, retornamos una imagen de emergencia para que la diapositiva no se rompa
    const emergencyUrl = "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80";
    logAi({ endpoint: "cascade:emergency", status: "fallback" });
    return { kind: "url", url: emergencyUrl };
  }

  return null;
}

export async function chatText(opts: {
  system: string;
  user: string;
  model?: string;
}): Promise<string> {
  const apiKey = requireGeminiKey();
  const tier = opts.model?.includes("pro") ? "pro" : "flash";
  const modelsToTry = modelsToTryFor(tier);

  let response: Response | null = null;
  let lastStatus = 0;

  for (const modelName of modelsToTry) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      response = await fetch(geminiUrl(modelName, apiKey), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: opts.user }] }],
          systemInstruction: { parts: [{ text: opts.system }] },
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (response.ok) break;
    lastStatus = response.status;
    if (response.status === 404) continue;
    break;
  }

  if (!response?.ok) {
    throw new Error(`Error de Gemini API (${lastStatus})`);
  }

  const data = await response.json();
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return textResponse ?? "";
}