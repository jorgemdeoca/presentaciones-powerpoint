import { resolvePaletteColors } from "@/lib/theme";

/**
 * Exportación nativa: cada slide se convierte en un blueprint con
 * coordenadas (en pulgadas) y cada bloque se dibuja como elemento real en
 * PPTX (textos editables, imágenes) y PDF (texto seleccionable). NO se
 * toman capturas del DOM — eso causaba slides negras y diseños
 * inconsistentes.
 */

type Slide = {
  position: number;
  layout: string;
  title: string | null;
  subtitle: string | null;
  bullets: unknown;
  notes: string | null;
  image_url: string | null;
  design?: Record<string, unknown> | null;
  id?: string;
};

type Presentation = {
  title: string;
  description: string | null;
  theme: { style?: string; palette?: string } | null;
};

/* ========================================================================
 * Canvas constants — pulgadas (PPTX widescreen 13.33 x 7.5)
 * ====================================================================== */
const W = 13.33;
const H = 7.5;

/* ========================================================================
 * Color helpers
 * ====================================================================== */

function normHex(c?: string | null): string {
  if (!c) return "#000000";
  const s = c.trim();
  if (s.startsWith("#")) {
    if (s.length === 4) {
      return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toUpperCase();
    }
    return s.slice(0, 7).toUpperCase();
  }
  const rgb = s.match(/rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/i);
  if (rgb) {
    const r = (+rgb[1]).toString(16).padStart(2, "0");
    const g = (+rgb[2]).toString(16).padStart(2, "0");
    const b = (+rgb[3]).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`.toUpperCase();
  }
  return "#000000";
}

function hex(c: string): string {
  return normHex(c).replace("#", "");
}

function luminance(hexStr: string): number {
  const c = normHex(hexStr).slice(1);
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Devuelve un color de texto con buen contraste sobre `bg`. */
function pickTextColor(bg: string, preferred?: string): string {
  const bgL = luminance(bg);
  if (preferred) {
    const pL = luminance(preferred);
    if (Math.abs(bgL - pL) > 0.35) return normHex(preferred);
  }
  return bgL < 0.45 ? "#FFFFFF" : "#0F172A";
}

/** Extrae los primeros colores hex/rgb desde un valor CSS de gradiente. */
function extractGradientColors(value?: string | null): string[] {
  if (!value) return [];
  const out: string[] = [];
  const re = /#[0-9a-f]{3,8}|rgba?\([^)]+\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value))) out.push(normHex(m[0]));
  return out;
}

/* ========================================================================
 * Image fetch → base64 (resuelve CORS antes de embeber)
 * ====================================================================== */
const imageCache = new Map<string, string | null>();

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  if (imageCache.has(url)) return imageCache.get(url)!;
  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
    imageCache.set(url, dataUrl);
    return dataUrl;
  } catch (err) {
    console.warn("[export] no se pudo descargar imagen", url, err);
    imageCache.set(url, null);
    return null;
  }
}

/* ========================================================================
 * Blueprint — describe cada slide como bloques con coordenadas en pulgadas
 * ====================================================================== */

type Palette = ReturnType<typeof resolvePaletteColors>;

type Block =
  | {
      kind: "rect";
      x: number; y: number; w: number; h: number;
      fill: string;
      alpha?: number; // 0-100, transparencia en %
    }
  | {
      kind: "image";
      x: number; y: number; w: number; h: number;
      src: string; // data url or remote
      cover?: boolean;
    }
  | {
      kind: "text";
      x: number; y: number; w: number; h: number;
      text: string;
      fontSize: number; // pt
      color: string;
      bold?: boolean;
      italic?: boolean;
      align?: "left" | "center" | "right";
      valign?: "top" | "middle" | "bottom";
      fontFace?: string;
    }
  | {
      kind: "bullets";
      x: number; y: number; w: number; h: number;
      items: string[];
      fontSize: number;
      color: string;
      accent: string;
      fontFace?: string;
    };

type SlideBlueprint = {
  bg: string; // hex
  bgAccent?: string; // hex (segundo color del gradiente)
  blocks: Block[];
  notes?: string;
};

function bulletsOf(s: Slide): string[] {
  return Array.isArray(s.bullets) ? (s.bullets as unknown[]).map((b) => String(b)) : [];
}

function fontsFor(_style?: string): { heading: string; body: string } {
  // pptx/pdf fonts deben ser estándar para máxima compatibilidad.
  return { heading: "Calibri", body: "Calibri" };
}

function buildBlueprint(s: Slide, pal: Palette, style?: string): SlideBlueprint {
  const bullets = bulletsOf(s);
  const designBg = (s.design as { background?: { value?: string } } | null)?.background?.value;
  const grad = extractGradientColors(designBg);
  const bg = grad[0] ?? pal.bg;
  const bgAccent = grad[1] ?? pal.surface;
  const fonts = fontsFor(style);

  // Colores derivados con contraste real frente al bg de ESTA slide.
  const textColor = pickTextColor(bg, pal.text);
  const surfaceColor = pal.surface;
  const onSurface = pickTextColor(surfaceColor, pal.text);
  const mutedOnBg = pickTextColor(bg, pal.muted);
  const accent = pal.accent;

  const blocks: Block[] = [];

  // Fondo base (PPTX background ya pinta esto, lo dejamos como rect para PDF)
  blocks.push({ kind: "rect", x: 0, y: 0, w: W, h: H, fill: bg });
  // Segundo color como semitransparente para sugerir gradiente sin romper PPTX
  if (bgAccent !== bg) {
    blocks.push({ kind: "rect", x: 0, y: H * 0.55, w: W, h: H * 0.45, fill: bgAccent, alpha: 60 });
  }

  switch (s.layout) {
    case "hero_minimal": {
      if (s.image_url) {
        blocks.push({ kind: "image", x: 0, y: 0, w: W, h: H, src: s.image_url, cover: true });
        blocks.push({ kind: "rect", x: 0, y: H * 0.45, w: W, h: H * 0.55, fill: "#000000", alpha: 35 });
      }
      const onHero = s.image_url ? "#FFFFFF" : textColor;
      blocks.push({
        kind: "text",
        x: 0.7, y: H - 2.6, w: W * 0.62, h: 1.6,
        text: s.title ?? "",
        fontSize: 44, bold: true, color: onHero, fontFace: fonts.heading,
        align: "left", valign: "bottom",
      });
      if (s.subtitle) {
        blocks.push({
          kind: "text",
          x: 0.7, y: H - 0.95, w: W * 0.62, h: 0.7,
          text: s.subtitle, fontSize: 18, color: s.image_url ? "#E5E7EB" : mutedOnBg,
          fontFace: fonts.body, align: "left", valign: "top",
        });
      }
      break;
    }

    case "cinematic": {
      if (s.image_url) {
        blocks.push({ kind: "image", x: 0, y: 0, w: W, h: H, src: s.image_url, cover: true });
        blocks.push({ kind: "rect", x: 0, y: 0, w: W, h: H, fill: "#000000", alpha: 50 });
      }
      blocks.push({
        kind: "text",
        x: 0.8, y: H / 2 - 1.1, w: W - 1.6, h: 1.8,
        text: s.title ?? "",
        fontSize: 54, bold: true, color: "#FFFFFF", fontFace: fonts.heading,
        align: "center", valign: "middle",
      });
      if (s.subtitle) {
        blocks.push({
          kind: "text",
          x: W * 0.15, y: H / 2 + 0.8, w: W * 0.7, h: 1.1,
          text: s.subtitle, fontSize: 20, color: "#E5E7EB",
          fontFace: fonts.body, align: "center", valign: "top",
        });
      }
      break;
    }

    case "split_left":
    case "split_right": {
      const imgLeft = s.layout === "split_left";
      const imgX = imgLeft ? 0 : W / 2;
      const txtX = imgLeft ? W / 2 + 0.5 : 0.6;
      const txtW = W / 2 - 1.1;
      if (s.image_url) {
        blocks.push({ kind: "image", x: imgX, y: 0, w: W / 2, h: H, src: s.image_url, cover: true });
      } else {
        blocks.push({ kind: "rect", x: imgX, y: 0, w: W / 2, h: H, fill: surfaceColor });
      }
      blocks.push({
        kind: "text",
        x: txtX, y: 0.9, w: txtW, h: 1.4,
        text: s.title ?? "",
        fontSize: 32, bold: true, color: textColor, fontFace: fonts.heading,
      });
      let cursorY = 2.3;
      if (s.subtitle) {
        blocks.push({
          kind: "text",
          x: txtX, y: cursorY, w: txtW, h: 0.7,
          text: s.subtitle, fontSize: 16, color: mutedOnBg, fontFace: fonts.body,
        });
        cursorY += 0.8;
      }
      if (bullets.length) {
        blocks.push({
          kind: "bullets",
          x: txtX, y: cursorY, w: txtW, h: H - cursorY - 0.6,
          items: bullets, fontSize: 16, color: textColor, accent, fontFace: fonts.body,
        });
      }
      break;
    }

    case "quote": {
      blocks.push({
        kind: "text",
        x: 1.0, y: H / 2 - 1.4, w: W - 2.0, h: 2.0,
        text: `“${s.title ?? ""}”`,
        fontSize: 36, italic: true, color: textColor, fontFace: "Georgia",
        align: "center", valign: "middle",
      });
      if (s.subtitle) {
        blocks.push({
          kind: "text",
          x: 1.0, y: H / 2 + 1.0, w: W - 2.0, h: 0.7,
          text: `— ${s.subtitle}`,
          fontSize: 18, color: accent, fontFace: fonts.body,
          align: "center", valign: "top",
        });
      }
      break;
    }

    case "metric_blocks": {
      blocks.push({
        kind: "text",
        x: 0.7, y: 0.5, w: W - 1.4, h: 1.0,
        text: s.title ?? "", fontSize: 28, bold: true, color: textColor, fontFace: fonts.heading,
      });
      const items = bullets.slice(0, 4);
      const cols = items.length <= 2 ? items.length : Math.min(4, items.length);
      const gap = 0.3;
      const totalW = W - 1.4;
      const boxW = (totalW - gap * (cols - 1)) / cols;
      const boxH = 3.6;
      const top = 2.0;
      items.forEach((b, i) => {
        const [val, ...rest] = b.split("—").map((t) => t.trim());
        const label = rest.join("—") || b;
        const x = 0.7 + i * (boxW + gap);
        blocks.push({ kind: "rect", x, y: top, w: boxW, h: boxH, fill: surfaceColor });
        blocks.push({
          kind: "text",
          x: x + 0.2, y: top + 0.5, w: boxW - 0.4, h: 1.6,
          text: val || b, fontSize: 44, bold: true, color: accent,
          fontFace: fonts.heading, align: "left", valign: "middle",
        });
        if (rest.length) {
          blocks.push({
            kind: "text",
            x: x + 0.2, y: top + 2.2, w: boxW - 0.4, h: 1.2,
            text: label, fontSize: 14, color: pickTextColor(surfaceColor, pal.muted),
            fontFace: fonts.body, valign: "top",
          });
        }
      });
      break;
    }

    case "bento_grid": {
      blocks.push({
        kind: "text",
        x: 0.7, y: 0.5, w: W - 1.4, h: 1.0,
        text: s.title ?? "", fontSize: 28, bold: true, color: textColor, fontFace: fonts.heading,
      });
      const items = bullets.slice(0, 3);
      const top = 1.9;
      const bottom = H - 0.5;
      const gridH = bottom - top;
      const left = 0.7;
      const right = W - 0.7;
      const gridW = right - left;
      const gap = 0.25;
      // Item 0 grande (izquierda), items 1 y 2 a la derecha apilados
      if (items[0]) {
        const w0 = (gridW - gap) * (2 / 3);
        blocks.push({ kind: "rect", x: left, y: top, w: w0, h: gridH, fill: surfaceColor });
        blocks.push({
          kind: "text",
          x: left + 0.3, y: top + 0.3, w: w0 - 0.6, h: gridH - 0.6,
          text: items[0], fontSize: 22, color: onSurface, fontFace: fonts.body,
          valign: "top",
        });
      }
      const rightX = left + (gridW - gap) * (2 / 3) + gap;
      const rightW = (gridW - gap) / 3;
      const cellH = (gridH - gap) / 2;
      for (let i = 1; i < items.length && i <= 2; i++) {
        const y = top + (i - 1) * (cellH + gap);
        blocks.push({ kind: "rect", x: rightX, y, w: rightW, h: cellH, fill: surfaceColor });
        blocks.push({
          kind: "text",
          x: rightX + 0.25, y: y + 0.25, w: rightW - 0.5, h: cellH - 0.5,
          text: items[i], fontSize: 16, color: onSurface, fontFace: fonts.body, valign: "top",
        });
      }
      break;
    }

    default: {
      // title_content
      blocks.push({
        kind: "text",
        x: 0.8, y: 0.7, w: W - 1.6, h: 1.4,
        text: s.title ?? "", fontSize: 36, bold: true, color: textColor, fontFace: fonts.heading,
      });
      let cursorY = 2.1;
      if (s.subtitle) {
        blocks.push({
          kind: "text",
          x: 0.8, y: cursorY, w: W - 1.6, h: 0.8,
          text: s.subtitle, fontSize: 18, color: mutedOnBg, fontFace: fonts.body,
        });
        cursorY += 0.9;
      }
      if (bullets.length) {
        blocks.push({
          kind: "bullets",
          x: 0.8, y: cursorY, w: W - 1.6, h: H - cursorY - 0.6,
          items: bullets, fontSize: 18, color: textColor, accent, fontFace: fonts.body,
        });
      }
    }
  }

  return { bg, bgAccent, blocks, notes: s.notes ?? undefined };
}

async function resolveImagesInBlueprint(bp: SlideBlueprint): Promise<SlideBlueprint> {
  const out: Block[] = [];
  for (const b of bp.blocks) {
    if (b.kind === "image") {
      const data = await fetchImageAsDataUrl(b.src);
      if (data) out.push({ ...b, src: data });
      // si la imagen no se pudo cargar, omitimos el bloque (queda el fondo)
    } else {
      out.push(b);
    }
  }
  return { ...bp, blocks: out };
}

/* ========================================================================
 * Utilities
 * ====================================================================== */

function safeFileName(title: string) {
  return title.replace(/[^\w\s-áéíóúñÁÉÍÓÚÑ]/gi, "").trim() || "presentacion";
}

/* ========================================================================
 * PPTX export — pptxgenjs native elements
 * ====================================================================== */

export async function exportPptx(pres: Presentation, slides: Slide[]) {
  const { default: pptxgen } = await import("pptxgenjs");
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = pres.title;

  const paletteId =
    (pres.theme as { palette?: string } | null)?.palette ?? "azul_electrico_grafito";
  const palette = resolvePaletteColors(paletteId);
  const style = (pres.theme as { style?: string } | null)?.style;

  for (const s of slides) {
    const bpRaw = buildBlueprint(s, palette, style);
    const bp = await resolveImagesInBlueprint(bpRaw);
    const slide = pptx.addSlide();
    slide.background = { color: hex(bp.bg) };

    for (const b of bp.blocks) {
      if (b.kind === "rect") {
        // El primer rect (fondo base) ya está cubierto por slide.background → saltarlo
        if (b.x === 0 && b.y === 0 && b.w === W && b.h === H && b.alpha === undefined) continue;
        slide.addShape(pptx.ShapeType.rect, {
          x: b.x, y: b.y, w: b.w, h: b.h,
          fill: { color: hex(b.fill), transparency: b.alpha ?? 0 },
          line: { type: "none" },
        });
      } else if (b.kind === "image") {
        try {
          slide.addImage({
            data: b.src,
            x: b.x, y: b.y, w: b.w, h: b.h,
            sizing: b.cover ? { type: "cover", w: b.w, h: b.h } : undefined,
          });
        } catch (err) {
          console.warn("[export] addImage falló", err);
        }
      } else if (b.kind === "text") {
        slide.addText(b.text, {
          x: b.x, y: b.y, w: b.w, h: b.h,
          fontSize: b.fontSize,
          color: hex(b.color),
          bold: b.bold,
          italic: b.italic,
          align: b.align ?? "left",
          valign: b.valign ?? "top",
          fontFace: b.fontFace ?? "Calibri",
          margin: 0,
        });
      } else if (b.kind === "bullets") {
        slide.addText(
          b.items.map((t) => ({ text: t, options: { bullet: { code: "2022" } } })),
          {
            x: b.x, y: b.y, w: b.w, h: b.h,
            fontSize: b.fontSize,
            color: hex(b.color),
            fontFace: b.fontFace ?? "Calibri",
            paraSpaceAfter: 6,
            valign: "top",
          },
        );
      }
    }

    if (bp.notes) slide.addNotes(bp.notes);
  }

  await pptx.writeFile({ fileName: `${safeFileName(pres.title)}.pptx` });
}

/* ========================================================================
 * PDF export — jsPDF native text + images
 * ====================================================================== */

export async function exportPdf(pres: Presentation, slides: Slide[]) {
  const { default: jsPDF } = await import("jspdf");
  const paletteId =
    (pres.theme as { palette?: string } | null)?.palette ?? "azul_electrico_grafito";
  const palette = resolvePaletteColors(paletteId);
  const style = (pres.theme as { style?: string } | null)?.style;

  const pdf = new jsPDF({ orientation: "landscape", unit: "in", format: [W, H] });

  for (let i = 0; i < slides.length; i++) {
    if (i > 0) pdf.addPage([W, H], "landscape");
    const bpRaw = buildBlueprint(slides[i], palette, style);
    const bp = await resolveImagesInBlueprint(bpRaw);

    for (const b of bp.blocks) {
      if (b.kind === "rect") {
        const rgb = hexToRgb(b.fill);
        if (b.alpha && b.alpha > 0) {
          // jsPDF alpha via GState
          const gs = pdf.GState ? pdf.GState({ opacity: 1 - b.alpha / 100 }) : null;
          if (gs) pdf.setGState(gs);
        }
        pdf.setFillColor(rgb.r, rgb.g, rgb.b);
        pdf.rect(b.x, b.y, b.w, b.h, "F");
        if (b.alpha && b.alpha > 0 && pdf.GState) {
          pdf.setGState(pdf.GState({ opacity: 1 }));
        }
      } else if (b.kind === "image") {
        try {
          const fmt = b.src.startsWith("data:image/png") ? "PNG" : "JPEG";
          pdf.addImage(b.src, fmt, b.x, b.y, b.w, b.h, undefined, "FAST");
        } catch (err) {
          console.warn("[pdf] addImage falló", err);
        }
      } else if (b.kind === "text") {
        drawText(pdf, b.text, b);
      } else if (b.kind === "bullets") {
        drawBullets(pdf, b);
      }
    }
  }

  pdf.save(`${safeFileName(pres.title)}.pdf`);
}

function hexToRgb(c: string) {
  const h = normHex(c).slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function drawText(
  pdf: import("jspdf").jsPDF,
  text: string,
  b: Extract<Block, { kind: "text" }>,
) {
  const { r, g, b: bl } = hexToRgb(b.color);
  pdf.setTextColor(r, g, bl);
  const style = b.bold && b.italic ? "bolditalic" : b.bold ? "bold" : b.italic ? "italic" : "normal";
  pdf.setFont("helvetica", style);
  pdf.setFontSize(b.fontSize);

  const lines = pdf.splitTextToSize(text, b.w) as string[];
  const lineHeightIn = (b.fontSize * 1.2) / 72; // pt → in
  const totalH = lines.length * lineHeightIn;

  let y = b.y + lineHeightIn * 0.85; // baseline del primer renglón
  if (b.valign === "middle") y = b.y + (b.h - totalH) / 2 + lineHeightIn * 0.85;
  else if (b.valign === "bottom") y = b.y + b.h - totalH + lineHeightIn * 0.85;

  let x = b.x;
  let align: "left" | "center" | "right" = b.align ?? "left";
  if (align === "center") x = b.x + b.w / 2;
  else if (align === "right") x = b.x + b.w;

  for (const line of lines) {
    pdf.text(line, x, y, { align });
    y += lineHeightIn;
  }
}

function drawBullets(pdf: import("jspdf").jsPDF, b: Extract<Block, { kind: "bullets" }>) {
  const { r, g, b: bl } = hexToRgb(b.color);
  const acc = hexToRgb(b.accent);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(b.fontSize);

  const lineH = (b.fontSize * 1.35) / 72;
  const bulletGap = 0.18;
  let y = b.y + lineH * 0.85;
  for (const item of b.items) {
    if (y > b.y + b.h) break;
    pdf.setTextColor(acc.r, acc.g, acc.b);
    pdf.text("•", b.x, y);
    pdf.setTextColor(r, g, bl);
    const lines = pdf.splitTextToSize(item, b.w - bulletGap) as string[];
    for (let i = 0; i < lines.length; i++) {
      if (y > b.y + b.h) break;
      pdf.text(lines[i], b.x + bulletGap, y);
      y += lineH;
    }
    y += lineH * 0.25;
  }
}
