export const MVP_LAYOUTS = [
  "hero_minimal",
  "split_left",
  "split_right",
  "quote",
  "metric_blocks",
  "bento_grid",
  "cinematic",
  "title_content",
  "image_cards",
  "timeline",
  "dashboard",
  "infographic",
  "collage_editorial",
  "comparison",
  "floating_image",
  "asymmetric",
  "visual_storytelling",
] as const;

export type MvpLayout = (typeof MVP_LAYOUTS)[number];

export function validateLayoutDiversity(layouts: string[]): { ok: boolean; message?: string } {
  if (layouts.length < 2) return { ok: true };

  let consecutive = 1;
  for (let i = 1; i < layouts.length; i++) {
    if (layouts[i] === layouts[i - 1]) {
      consecutive++;
      if (consecutive > 2) {
        return {
          ok: false,
          message: `Layout "${layouts[i]}" repetido más de 2 veces consecutivas en posición ${i}`,
        };
      }
    } else {
      consecutive = 1;
    }
  }

  if (layouts.length >= 8) {
    const unique = new Set(layouts);
    if (unique.size < 5) {
      return { ok: false, message: "Se requieren al menos 5 layouts distintos en presentaciones de 8+ slides" };
    }
  }

  return { ok: true };
}

export function enforceLayoutDiversity(layouts: string[]): string[] {
  const result = [...layouts];
  for (let i = 2; i < result.length; i++) {
    if (result[i] === result[i - 1] && result[i] === result[i - 2]) {
      const alt = MVP_LAYOUTS.find((l) => l !== result[i] && l !== result[i - 1]) ?? "title_content";
      result[i] = alt;
    }
  }
  return result;
}
