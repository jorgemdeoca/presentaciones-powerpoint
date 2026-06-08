import { chatJSON } from "@/lib/ai.server";
import { buildImagePrompt, plannerWriterSystem } from "@/lib/ai/prompts";
import { enforceLayoutDiversity, MVP_LAYOUTS, validateLayoutDiversity } from "@/lib/ai/validators";
import { getPaletteMeta } from "@/lib/theme";

export type SlideSpec = {
  title: string;
  subtitle?: string;
  bullets: string[];
  notes?: string;
  layout: string;
  image_prompt?: string;
  image_source?: "ai" | "web" | "none";
  image_query?: string;
  design?: Record<string, unknown>;
  background?: { type: string; value: string };
};

export type DeckSpec = {
  title: string;
  description: string;
  slides: SlideSpec[];
};

const slideSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    subtitle: { type: "string" },
    bullets: { type: "array", items: { type: "string" }, maxItems: 6 },
    notes: { type: "string" },
    layout: { type: "string", enum: [...MVP_LAYOUTS] },
    image_prompt: { type: "string" },
    image_source: { type: "string", enum: ["ai", "web", "none"] },
    image_query: { type: "string" },
    background: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["color", "gradient"] },
        value: { type: "string" },
      },
      required: ["type", "value"],
    },
  },
  required: ["title", "layout", "image_prompt", "bullets"],
};

export async function runPlannerWriter(opts: {
  prompt: string;
  referenceText: string;
  slideCount: number;
  language: string;
  tone: string;
  visualStyle: string;
  palette: string;
  purpose: string;
  audience?: string;
  imageSources?: { ai: boolean; web: boolean };
}): Promise<DeckSpec> {
  const deck = await chatJSON<DeckSpec>({
    system: plannerWriterSystem(opts),
    user: `Tema: ${opts.prompt}${opts.referenceText}`,
    model: "google/gemini-2.5-pro",
    tool: {
      name: "build_deck",
      description: "Construye presentación",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          slides: {
            type: "array",
            minItems: opts.slideCount,
            maxItems: opts.slideCount,
            items: slideSchema,
          },
        },
        required: ["title", "description", "slides"],
      },
    },
  });

  const layouts = enforceLayoutDiversity(deck.slides.map((s) => s.layout));
  deck.slides = deck.slides.map((s, i) => ({ ...s, layout: layouts[i] }));

  const check = validateLayoutDiversity(layouts);
  if (!check.ok) {
    console.warn("[pipeline] layout diversity:", check.message);
  }

  return deck;
}

import { artDirectorSystem } from "@/lib/ai/prompts";

export async function runArtDirector(deck: DeckSpec, opts: { visualStyle: string; palette: string }): Promise<DeckSpec> {
  // To avoid hitting schema limits or token limits for very large decks, we map slides
  // We can ask Gemini to enrich the background and design of the deck.
  const enriched = await chatJSON<DeckSpec>({
    system: artDirectorSystem(opts),
    user: JSON.stringify(deck),
    model: "google/gemini-2.5-flash", // Use flash for speed since it's just formatting
    tool: {
      name: "apply_art_direction",
      description: "Aplica la dirección de arte a la presentación",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          slides: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                subtitle: { type: "string" },
                bullets: { type: "array", items: { type: "string" } },
                notes: { type: "string" },
                layout: { type: "string" },
                image_prompt: { type: "string" },
                image_source: { type: "string" },
                image_query: { type: "string" },
                design: { type: "object" },
                background: {
                  type: "object",
                  properties: {
                    type: { type: "string", enum: ["color", "gradient"] },
                    value: { type: "string" },
                  },
                  required: ["type", "value"],
                },
              },
              required: ["title", "layout", "background"],
            },
          },
        },
        required: ["slides"],
      },
    },
  });

  return { ...deck, slides: enriched.slides };
}

export function enrichImagePrompts(
  deck: DeckSpec,
  opts: {
    palette: string;
    visualStyle: string;
    topic: string;
    cinematicLevel?: string;
  },
): SlideSpec[] {
  return deck.slides.map((s) => {
    if (!s.image_prompt || s.image_prompt.trim().length < 3) return s;
    return {
      ...s,
      image_prompt: buildImagePrompt({
        basePrompt: s.image_prompt,
        paletteId: opts.palette,
        visualStyle: opts.visualStyle,
        cinematicLevel: opts.cinematicLevel,
        topic: opts.topic,
      }),
    };
  });
}
