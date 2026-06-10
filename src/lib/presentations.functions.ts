import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Buffer } from "node:buffer";
import { getAuth } from "@/lib/auth-helpers";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateImageBase64, getSlideImageCascade } from "./ai.server";
import {
  runArtDirector,
  enrichImagePrompts,
  runPlannerWriter,
} from "./ai/pipeline";
import { logAi, newTraceId } from "./ai/logger";
import {
  deletePresentationStorage,
  slideImagePath,
} from "./storage.server";

const generateSchema = z.object({
  prompt: z.string().min(3).max(200_000),
  slideCount: z.number().int().min(3).max(40).default(8),
  slideCountMode: z.enum(["manual", "range", "auto"]).default("manual"),
  slideCountRange: z.tuple([z.number().int(), z.number().int()]).optional(),
  language: z.string().default("es"),
  tone: z.string().default("professional"),
  visualStyle: z.string().default("minimalista"),
  palette: z.string().default("azul_electrico_grafito"),
  purpose: z.string().default("work"),
  audience: z.string().optional(),
  referenceIds: z.array(z.string().uuid()).default([]),
  withImages: z.boolean().default(true),
  imageSources: z
    .object({ ai: z.boolean().default(true), web: z.boolean().default(false) })
    .default({ ai: true, web: false }),
  cinematicLevel: z.enum(["bajo", "medio", "alto", "ultra"]).default("medio"),
});

type GenerationConfig = z.infer<typeof generateSchema>;

function buildPresentationTheme(data: GenerationConfig) {
  return {
    style: data.visualStyle,
    palette: data.palette,
    cinematicLevel: data.cinematicLevel,
    generationConfig: data,
  };
}

function readStoredGenerationConfig(theme: unknown, fallback?: GenerationConfig): GenerationConfig {
  const candidate =
    theme && typeof theme === "object" && "generationConfig" in (theme as Record<string, unknown>)
      ? (theme as { generationConfig?: unknown }).generationConfig
      : fallback;
  return generateSchema.parse(candidate ?? fallback ?? {});
}

async function setPresentationStep(
  supabase: ReturnType<typeof getAuth>["supabase"],
  userId: string,
  presentationId: string,
  step: string,
  status?: string,
) {
  await supabase
    .from("presentations")
    .update({
      generation_step: step,
      ...(status ? { status } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", presentationId)
    .eq("user_id", userId);
}

async function loadReferenceText(
  supabase: ReturnType<typeof getAuth>["supabase"],
  userId: string,
  referenceIds: string[],
) {
  if (!referenceIds.length) return "";
  const { data: refs } = await supabase
    .from("references")
    .select("name, summary, extracted_text")
    .eq("user_id", userId)
    .in("id", referenceIds);
  if (!refs?.length) return "";
  return (
    "\n\nReferencias del usuario:\n" +
    refs
      .map(
        (r, i) =>
          `[${i + 1}] ${r.name}\nResumen: ${r.summary ?? ""}\nExtracto: ${(r.extracted_text ?? "").slice(0, 20000)}`,
      )
      .join("\n---\n")
  );
}

async function executeGeneration(
  supabase: ReturnType<typeof getAuth>["supabase"],
  userId: string,
  presentationId: string,
  data: GenerationConfig,
) {
  for (let i = 0; i < 64; i++) {
    const state = await advanceGenerationStep(supabase, userId, presentationId, data);
    if (state.status === "ready" || state.status === "failed") return;
  }
  throw new Error("La generación tardó más de lo esperado");
}

async function advanceGenerationStep(
  supabase: ReturnType<typeof getAuth>["supabase"],
  userId: string,
  presentationId: string,
  fallbackConfig: GenerationConfig,
): Promise<{ status: "ready" | "failed" | "pending" }> {
  const traceId = newTraceId();
  const t0 = Date.now();
  const { data: presentation, error: pErr } = await supabase
    .from("presentations")
    .select("id, status, generation_step, theme")
    .eq("id", presentationId)
    .eq("user_id", userId)
    .single();
  if (pErr || !presentation) throw new Error(pErr?.message ?? "Presentación no encontrada");
  if (presentation.status === "ready") return { status: "ready" };
  if (presentation.status === "failed") return { status: "failed" };

  const data = readStoredGenerationConfig(presentation.theme, fallbackConfig);
  logAi({ traceId, presentationId, endpoint: "pipeline:start", status: "ok" });
  const referenceText = await loadReferenceText(supabase, userId, data.referenceIds);

  try {
    await setPresentationStep(supabase, userId, presentationId, "analyzing", "generating");

    const deck = await runPlannerWriter({
      prompt: data.prompt,
      referenceText,
      slideCount: data.slideCount,
      language: data.language,
      tone: data.tone,
      visualStyle: data.visualStyle,
      palette: data.palette,
      purpose: data.purpose,
      audience: data.audience,
      imageSources: data.imageSources,
    });

    await setPresentationStep(supabase, userId, presentationId, "structuring");
    await supabase
      .from("presentations")
      .update({ title: deck.title, description: deck.description, updated_at: new Date().toISOString() })
      .eq("id", presentationId)
      .eq("user_id", userId);

    const slidesPayload = deck.slides.map((s, i) => ({
      presentation_id: presentationId,
      user_id: userId,
      position: i,
      layout: s.layout,
      title: s.title,
      subtitle: s.subtitle ?? null,
      bullets: s.bullets ?? [],
      notes: s.notes ?? null,
      image_prompt: s.image_prompt ?? null,
      design: {},
    }));

    await supabase.from("slides").delete().eq("presentation_id", presentationId);
    const { data: insertedSlides, error: sErr } = await supabase.from("slides").insert(slidesPayload).select();
    if (sErr) throw new Error(sErr.message);

    await setPresentationStep(supabase, userId, presentationId, "designing");
    const enriched = await runArtDirector(deck, { visualStyle: data.visualStyle, palette: data.palette });
    enriched.slides = enrichImagePrompts(enriched, {
      palette: data.palette,
      visualStyle: data.visualStyle,
      topic: data.prompt,
      cinematicLevel: data.cinematicLevel,
    });

    for (let i = 0; i < enriched.slides.length; i++) {
      const slide = enriched.slides[i];
      const row = insertedSlides?.[i];
      if (!row) continue;
      await supabase
        .from("slides")
        .update({
          design: { ...(slide.design ?? {}), background: slide.background },
          image_prompt: slide.image_prompt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    }

    if (data.withImages && (data.imageSources.ai || data.imageSources.web)) {
      const slides = insertedSlides ?? [];
      const total = slides.length;
      for (let idx = 0; idx < total; idx++) {
        const slide = slides[idx];
        const spec = enriched.slides[idx];
        if (!slide || !spec) continue;
        const declared =
          (spec as { image_source?: "ai" | "web" | "none" }).image_source ??
          (data.imageSources.ai ? "ai" : data.imageSources.web ? "web" : "none");
        if (declared !== "none") {
          const prefer: "ai" | "web" = declared === "web" ? "web" : "ai";
          try {
            const result = await getSlideImageCascade({
              prompt: spec.image_prompt ?? spec.title ?? "abstract premium background",
              query: (spec as { image_query?: string }).image_query || spec.title || spec.image_prompt,
              prefer,
              allowAi: data.imageSources.ai,
              allowWeb: data.imageSources.web,
            });
            if (result?.kind === "url") {
              await supabase.from("slides").update({ image_url: result.url }).eq("id", slide.id);
              if (slide.position === 0) {
                await supabase.from("presentations").update({ thumbnail_url: result.url }).eq("id", presentationId);
              }
            } else if (result?.kind === "b64") {
              const buffer = Buffer.from(result.data, "base64");
              const path = slideImagePath(userId, presentationId, slide.id);
              const up = await supabase.storage.from("slide-images").upload(path, buffer, { contentType: "image/png", upsert: true });
              if (!up.error) {
                const { data: pub } = supabase.storage.from("slide-images").getPublicUrl(path);
                await supabase.from("slides").update({ image_url: pub.publicUrl }).eq("id", slide.id);
                if (slide.position === 0) {
                  await supabase.from("presentations").update({ thumbnail_url: pub.publicUrl }).eq("id", presentationId);
                }
              }
            }
          } catch (e) {
            const err = e as { message?: string };
            logAi({ traceId, presentationId, slideIdx: idx, endpoint: "image:slide", status: "error", error: err?.message?.slice(0, 160) });
          }
        }
        await setPresentationStep(supabase, userId, presentationId, `images:${idx + 1}/${total}`);
        // Delay entre imágenes para evitar rate limiting de Gemini
        if (idx < total - 1) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }

    await setPresentationStep(supabase, userId, presentationId, "assembling");
    await supabase
      .from("presentations")
      .update({ status: "ready", generation_step: "ready", generation_error: null, updated_at: new Date().toISOString() })
      .eq("id", presentationId)
      .eq("user_id", userId);

    logAi({ traceId, presentationId, endpoint: "pipeline:done", status: "ok", latencyMs: Date.now() - t0 });
    return { status: "ready" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    logAi({ traceId, presentationId, endpoint: "pipeline:fail", status: "error", latencyMs: Date.now() - t0, error: message.slice(0, 200) });
    await supabase
      .from("presentations")
      .update({ status: "failed", generation_step: "failed", generation_error: `[${traceId}] ${message}`, updated_at: new Date().toISOString() })
      .eq("id", presentationId)
      .eq("user_id", userId);
    return { status: "failed" };
  }
}

/** Creates presentation and returns id immediately; client calls processGeneration next */
export const initPresentationGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => generateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = getAuth({ context });

    const theme = {
      style: data.visualStyle,
      palette: data.palette,
      cinematicLevel: data.cinematicLevel,
    };

    const { data: pres, error } = await supabase
      .from("presentations")
      .insert({
        user_id: userId,
        title: "Generando…",
        description: "",
        prompt: data.prompt,
        theme,
        status: "generating",
        generation_step: "planning",
      })
      .select("id")
      .single();

    if (error || !pres) throw new Error(error?.message ?? "No se pudo crear la presentación");
    return { id: pres.id };
  });

/** Runs full AI pipeline with status updates (client-orchestrated to avoid serverless timeout issues) */
export const processPresentationGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ presentationId: z.string().uuid(), config: generateSchema }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = getAuth({ context });
    const { presentationId, config } = data;
    try {
      await executeGeneration(supabase, userId, presentationId, config);
      return { id: presentationId, status: "ready" as const };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      return { id: presentationId, status: "failed" as const, error: message };
    }
  });

/** Backward-compatible alias: init + process in one call from client */
export const generatePresentation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => generateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = getAuth({ context });

    const theme = {
      style: data.visualStyle,
      palette: data.palette,
      cinematicLevel: data.cinematicLevel,
    };

    const { data: pres, error } = await supabase
      .from("presentations")
      .insert({
        user_id: userId,
        title: "Generando…",
        description: "",
        prompt: data.prompt,
        theme,
        status: "generating",
        generation_step: "planning",
      })
      .select("id")
      .single();

    if (error || !pres) throw new Error(error?.message ?? "No se pudo crear");
    await executeGeneration(supabase, userId, pres.id, data);
    return { id: pres.id };
  });

export const getGenerationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = getAuth({ context });
    const { data: row, error } = await supabase
      .from("presentations")
      .select("id, status, generation_step, generation_error, title, thumbnail_url")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listPresentations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = getAuth({ context });
    const { data, error } = await supabase
      .from("presentations")
      .select("id, title, description, thumbnail_url, status, generation_step, created_at, updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getPresentation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = getAuth({ context });
    const [{ data: pres, error: pErr }, { data: slides, error: sErr }] = await Promise.all([
      supabase.from("presentations").select("*").eq("id", data.id).eq("user_id", userId).single(),
      supabase
        .from("slides")
        .select("*")
        .eq("presentation_id", data.id)
        .eq("user_id", userId)
        .order("position"),
    ]);
    if (pErr) throw new Error(pErr.message);
    if (sErr) throw new Error(sErr.message);
    return { presentation: pres, slides: slides ?? [] };
  });

export const deletePresentation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = getAuth({ context });
    await deletePresentationStorage(supabase, userId, data.id);
    const { error } = await supabase
      .from("presentations")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateSlide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().optional(),
        subtitle: z.string().optional(),
        bullets: z.array(z.string()).optional(),
        notes: z.string().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = getAuth({ context });
    const { id, ...rest } = data;
    const { error } = await supabase
      .from("slides")
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const regenerateSlideImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ slideId: z.string().uuid(), prompt: z.string().optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = getAuth({ context });
    const { data: slide, error: sErr } = await supabase
      .from("slides")
      .select("id, presentation_id, image_prompt, position")
      .eq("id", data.slideId)
      .eq("user_id", userId)
      .single();
    if (sErr || !slide) throw new Error("Slide no encontrado");

    const prompt = data.prompt || slide.image_prompt || "modern abstract premium background";

    let b64: string;
    try {
      b64 = await generateImageBase64(prompt);
    } catch (err) {
      // 1 retry on transient errors
      try {
        b64 = await generateImageBase64(prompt);
      } catch (err2) {
        const msg = err2 instanceof Error ? err2.message : "Error generando imagen";
        throw new Error(`No se pudo generar la imagen: ${msg}`);
      }
    }

    const buffer = Buffer.from(b64, "base64");
    const path = slideImagePath(userId, slide.presentation_id, slide.id);
    const up = await supabase.storage
      .from("slide-images")
      .upload(path, buffer, { contentType: "image/png", upsert: true });
    if (up.error) throw new Error(`Error subiendo imagen: ${up.error.message}`);
    const { data: pub } = supabase.storage.from("slide-images").getPublicUrl(path);
    const url = `${pub.publicUrl}?v=${Date.now()}`;
    await supabase.from("slides").update({ image_url: url }).eq("id", slide.id);
    if (slide.position === 0) {
      await supabase
        .from("presentations")
        .update({ thumbnail_url: url })
        .eq("id", slide.presentation_id);
    }
    return { url };
  });
