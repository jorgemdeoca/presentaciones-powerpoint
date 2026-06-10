import { getPaletteMeta, getVisualStyleMeta, type VisualStyleId } from "@/lib/theme";

export function buildImagePrompt(opts: {
  basePrompt: string;
  paletteId: string;
  visualStyle: string;
  cinematicLevel?: string;
  topic: string;
  layout?: string;
}): string {
  const palette = getPaletteMeta(opts.paletteId);
  const style = getVisualStyleMeta(opts.visualStyle as VisualStyleId);
  const colors = palette.colors.join(" ");
  const cinematic =
    opts.cinematicLevel === "ultra"
      ? "Iluminación dramática tipo A24, profundidad de campo muy shallow, color grading cinematográfico intenso."
      : opts.cinematicLevel === "alto"
        ? "Iluminación cinematográfica lateral, sombras profundas, grading premium."
        : opts.cinematicLevel === "medio"
          ? "Iluminación profesional suave, composición editorial."
          : "Iluminación natural limpia.";

  let composition = "Fondo panorámico expansivo, composición inmersiva dejando espacio limpio para texto.";
  if (opts.layout?.includes("split")) {
    composition = "Composición balanceada para mitad de pantalla. Sujeto principal bien enmarcado, fondo limpio y no distractor.";
  } else if (opts.layout === "floating_image" || opts.layout === "asymmetric") {
    composition = "Objeto principal aislado, render 3D creativo, objetos con relieve o fotografía de producto macro sobre fondo ultra limpio. Ideal para flotar asimétricamente sobre la diapositiva sin bordes duros.";
  } else if (opts.layout?.includes("metric") || opts.layout?.includes("bento") || opts.layout?.includes("dashboard") || opts.layout?.includes("infographic")) {
    composition = "Diseño isométrico 3D, elementos UI abstractos, texturas con relieve sutil, o iconos minimalistas hiperrealistas sobre fondo sólido.";
  } else if (opts.layout === "collage_editorial") {
    composition = "Composición creativa tipo collage, superposición de imágenes, texturas ricas, estilo moderno y muy artístico.";
  } else if (opts.layout === "image_cards") {
    composition = "Fotografía editorial de altísima calidad, enfoque centrado en el sujeto principal.";
  }

  return `TEMA OBLIGATORIO: ${opts.topic}.
Descripción específica del slide: ${opts.basePrompt}.
Estilo visual: ${style.label} — ${style.description}.
Composición y Forma requerida: ${composition}.
${cinematic} Color grading acorde a paleta "${palette.name}": ${colors}.
REGLA CRÍTICA DE TEXTO: Preferiblemente SIN texto. Si aparece texto (letreros, pantallas), DEBE estar en ESPAÑOL correcto, sin letras deformadas ni caracteres inventados.
No incluyas marcas de agua ni logos.`;
}

export function plannerWriterSystem(opts: {
  slideCount: number;
  language: string;
  tone: string;
  visualStyle: string;
  palette: string;
  purpose: string;
  audience?: string;
  imageSources?: { ai: boolean; web: boolean };
}): string {
  const style = getVisualStyleMeta(opts.visualStyle as VisualStyleId);
  const palette = getPaletteMeta(opts.palette);
  const sources = opts.imageSources ?? { ai: true, web: false };
  const sourceRule =
    sources.ai && sources.web
      ? `image_source: "web" para fotos reales/personas/lugares/productos; "ai" para abstractos/metáforas; "none" si es texto puro. image_query en español (3-6 palabras) cuando uses web.`
      : sources.web
        ? `image_source siempre "web". image_query en español, 3-6 palabras.`
        : `image_source siempre "ai". image_prompt detallado en inglés técnico.`;

  const colors = palette.colors.join(",");

  // Prompt comprimido (~58% menos tokens fijos).
  return `Director editorial premium (Gamma/Pitch/Keynote). Idioma=${opts.language}, tono=${opts.tone}, propósito=${opts.purpose}, audiencia=${opts.audience ?? "general"}.
Estilo=${style.label}. Paleta=${palette.name} [${colors}].

CONTENIDO: 1 idea/slide, 3-5 bullets ≤15 palabras, narrativa apertura→desarrollo→cierre.

LAYOUTS (solo estos IDs): hero_minimal, split_left, split_right, quote, metric_blocks, bento_grid, cinematic, title_content, image_cards, timeline, dashboard, infographic, collage_editorial, comparison, floating_image, asymmetric, visual_storytelling.
Slide 1 = hero_minimal|cinematic|collage_editorial|asymmetric. No repetir mismo layout >2 veces seguidas. En decks 8+ usa ≥5 layouts distintos.
Reglas: metric_blocks→bullets "valor — etiqueta" (2-4); quote→title=cita, subtitle=autor; comparativos→split_*; features→bento_grid; stats→metric_blocks.

IMÁGENES: image_prompt describe LITERAL el tema (sujeto+acción+entorno), varía composición (close-up/wide/top-down/abstract), estética ${style.label} con paleta ${colors}. Texto visible dentro de la imagen DEBE ir en español correcto, preferible sin texto. ${sourceRule}

BACKGROUND (obligatorio por slide): objeto { type: "gradient"|"color", value: CSS válido } usando SOLO colores de la paleta [${colors}]. Ej: { "type":"gradient", "value":"linear-gradient(135deg, ${palette.colors[0]} 0%, ${palette.colors[1] ?? palette.colors[0]} 100%)" }.

Genera EXACTAMENTE ${opts.slideCount} diapositivas.`;
}

export function artDirectorSystem(opts: {
  visualStyle: string;
  palette: string;
}): string {
  const style = getVisualStyleMeta(opts.visualStyle as VisualStyleId);
  const palette = getPaletteMeta(opts.palette);

  return `Eres director de arte. Para cada slide añade metadata de diseño coherente con estilo ${style.label} y paleta ${palette.name}.
Devuelve el mismo array de slides enriquecido con:
- design: { spacing, alignment, visualWeight, composition, textPosition }
- background: { type: "color"|"gradient", value: CSS válido usando colores ${palette.colors.join(", ")} }
Mantén title, subtitle, bullets, layout, image_prompt sin cambiar el significado.`;
}
