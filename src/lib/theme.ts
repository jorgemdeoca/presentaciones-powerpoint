export const PALETTES: Record<
  string,
  { bg: string; surface: string; text: string; accent: string; muted: string }
> = {
  azul_electrico_grafito: { bg: "#0f172a", surface: "#1e293b", text: "#f8fafc", accent: "#2563eb", muted: "#94a3b8" },
  marfil_oro_elegante: { bg: "#2d2d2d", surface: "#3d3a35", text: "#f8f5f0", accent: "#c6a15b", muted: "#a39e8e" },
  negro_cinematografico: { bg: "#050505", surface: "#111827", text: "#f9fafb", accent: "#374151", muted: "#9ca3af" },
  violeta_creativo: { bg: "#1f1b2e", surface: "#2d2450", text: "#ede9fe", accent: "#7c3aed", muted: "#a78bfa" },
  verde_editorial: { bg: "#022c22", surface: "#064e3b", text: "#ecfdf5", accent: "#10b981", muted: "#6ee7b7" },
  coral_arena: { bg: "#1c1917", surface: "#292524", text: "#fef3c7", accent: "#f97316", muted: "#fdba74" },
  rosa_moderno: { bg: "#831843", surface: "#9d174d", text: "#fdf2f8", accent: "#ec4899", muted: "#f9a8d4" },
  oceano_profundo: { bg: "#082f49", surface: "#0c4a6e", text: "#e0f2fe", accent: "#0284c7", muted: "#7dd3fc" },
  fuego_carbon: { bg: "#1c1917", surface: "#292524", text: "#fef2f2", accent: "#dc2626", muted: "#fca5a5" },
  menta_digital: { bg: "#042f2e", surface: "#0d9488", text: "#ccfbf1", accent: "#14b8a6", muted: "#5eead4" },
  ambar_obsidiana: { bg: "#0c0a09", surface: "#1c1917", text: "#fffbeb", accent: "#d97706", muted: "#fcd34d" },
  indigo_nocturno: { bg: "#1e1b4b", surface: "#312e81", text: "#e0e7ff", accent: "#4f46e5", muted: "#a5b4fc" },
  lima_carbon: { bg: "#1a2e05", surface: "#365314", text: "#ecfccb", accent: "#84cc16", muted: "#bef264" },
  lavanda_suave: { bg: "#2e1065", surface: "#4c1d95", text: "#f5f3ff", accent: "#a78bfa", muted: "#c4b5fd" },
  acero_neon: { bg: "#0f172a", surface: "#164e63", text: "#cffafe", accent: "#06b6d4", muted: "#67e8f9" },
  // Legacy keys
  midnight_blue: { bg: "#0A0F1E", surface: "#141B33", text: "#F5F7FF", accent: "#3B82F6", muted: "#9CA8C4" },
  noir_gold: { bg: "#0D0D0D", surface: "#1A1A1A", text: "#F0E9D6", accent: "#C9A84C", muted: "#A39E8E" },
  ocean_deep: { bg: "#0C2340", surface: "#163E5F", text: "#E6F1F9", accent: "#5CBDB9", muted: "#9FB5C5" },
  neon_mint: { bg: "#0D1B2A", surface: "#163A2E", text: "#E8FFF5", accent: "#2DD4A8", muted: "#8FB0A2" },
  cherry_bold: { bg: "#1A0508", surface: "#2A0A0E", text: "#FCF6F5", accent: "#E63946", muted: "#B89B9E" },
};

export const PALETTE_META: Record<
  string,
  { name: string; colors: string[]; purpose: string; emotion: string }
> = {
  azul_electrico_grafito: {
    name: "Azul Eléctrico y Grafito",
    colors: ["#2563eb", "#0f172a", "#1e293b", "#dbeafe"],
    purpose: "Tecnología, SaaS, startups",
    emotion: "Confianza, innovación",
  },
  marfil_oro_elegante: {
    name: "Marfil y Oro Elegante",
    colors: ["#f8f5f0", "#c6a15b", "#2d2d2d", "#efe6d8"],
    purpose: "Lujo, editorial, moda",
    emotion: "Sofisticación",
  },
  negro_cinematografico: {
    name: "Negro Cinematográfico",
    colors: ["#050505", "#111827", "#374151", "#f9fafb"],
    purpose: "Cine, fotografía, arte",
    emotion: "Drama, impacto",
  },
  violeta_creativo: {
    name: "Violeta Creativo",
    colors: ["#7c3aed", "#4c1d95", "#ede9fe", "#1f1b2e"],
    purpose: "Creatividad, gaming, diseño",
    emotion: "Energía, imaginación",
  },
  verde_editorial: {
    name: "Verde Editorial",
    colors: ["#064e3b", "#10b981", "#ecfdf5", "#022c22"],
    purpose: "Naturaleza, sostenibilidad",
    emotion: "Calma, crecimiento",
  },
  coral_arena: {
    name: "Coral y Arena",
    colors: ["#f97316", "#fef3c7", "#1c1917", "#fed7aa"],
    purpose: "Gastronomía, viajes, lifestyle",
    emotion: "Calidez",
  },
  rosa_moderno: {
    name: "Rosa Moderno",
    colors: ["#ec4899", "#fdf2f8", "#831843", "#fbcfe8"],
    purpose: "Branding, belleza, moda",
    emotion: "Frescura",
  },
  oceano_profundo: {
    name: "Océano Profundo",
    colors: ["#0c4a6e", "#0284c7", "#e0f2fe", "#082f49"],
    purpose: "Ciencia, investigación",
    emotion: "Profundidad",
  },
  fuego_carbon: {
    name: "Fuego y Carbón",
    colors: ["#dc2626", "#1c1917", "#292524", "#fef2f2"],
    purpose: "Deportes, impacto",
    emotion: "Pasión",
  },
  menta_digital: {
    name: "Menta Digital",
    colors: ["#14b8a6", "#042f2e", "#0d9488", "#ccfbf1"],
    purpose: "Fintech, salud digital",
    emotion: "Frescura tecnológica",
  },
  ambar_obsidiana: {
    name: "Ámbar y Obsidiana",
    colors: ["#d97706", "#0c0a09", "#78350f", "#fffbeb"],
    purpose: "Arquitectura, premium",
    emotion: "Tradición, valor",
  },
  indigo_nocturno: {
    name: "Índigo Nocturno",
    colors: ["#4f46e5", "#1e1b4b", "#312e81", "#e0e7ff"],
    purpose: "IA, futuro",
    emotion: "Innovación",
  },
  lima_carbon: {
    name: "Lima y Carbono",
    colors: ["#84cc16", "#1a2e05", "#365314", "#ecfccb"],
    purpose: "Ecología, startups verdes",
    emotion: "Energía natural",
  },
  lavanda_suave: {
    name: "Lavanda Suave",
    colors: ["#a78bfa", "#2e1065", "#7c3aed", "#f5f3ff"],
    purpose: "Bienestar, educación",
    emotion: "Serenidad",
  },
  acero_neon: {
    name: "Acero y Neón",
    colors: ["#06b6d4", "#0f172a", "#164e63", "#cffafe"],
    purpose: "Cyberpunk, tech",
    emotion: "Futurista",
  },
};

export const VISUAL_STYLES = {
  minimalista: {
    label: "Minimalista",
    description: "Espacio negativo, tipografía limpia, blanco y negro",
    defaultPalette: "azul_electrico_grafito",
    fonts: { heading: "Inter", body: "Inter" },
  },
  corporativo_premium: {
    label: "Corporativo Premium",
    description: "Navy, glassmorphism, dashboards elegantes",
    defaultPalette: "azul_electrico_grafito",
    fonts: { heading: "Manrope", body: "Manrope" },
  },
  creativo: {
    label: "Creativo",
    description: "Gradientes vibrantes, composiciones atrevidas",
    defaultPalette: "violeta_creativo",
    fonts: { heading: "Clash Display", body: "General Sans" },
  },
  editorial: {
    label: "Editorial",
    description: "Estética revista, serif elegante",
    defaultPalette: "marfil_oro_elegante",
    fonts: { heading: "Playfair Display", body: "Plus Jakarta Sans" },
  },
  cinematografico: {
    label: "Cinematográfico",
    description: "Iluminación dramática, full-bleed",
    defaultPalette: "negro_cinematografico",
    fonts: { heading: "DM Serif Display", body: "Manrope" },
  },
  tecnologico: {
    label: "Tecnológico",
    description: "SaaS dark mode, grids, cards",
    defaultPalette: "indigo_nocturno",
    fonts: { heading: "Cabinet Grotesk", body: "Satoshi" },
  },
  academico_moderno: {
    label: "Académico Moderno",
    description: "Profesional, limpio, educativo elegante",
    defaultPalette: "oceano_profundo",
    fonts: { heading: "Cormorant Garamond", body: "Inter" },
  },
} as const;

export type VisualStyleId = keyof typeof VISUAL_STYLES;

export const VISUAL_STYLE_OPTIONS = Object.keys(VISUAL_STYLES) as VisualStyleId[];
export const PALETTE_OPTIONS = Object.keys(PALETTE_META);

export function getPaletteMeta(id: string) {
  return PALETTE_META[id] ?? PALETTE_META.azul_electrico_grafito;
}

export function getVisualStyleMeta(id: VisualStyleId) {
  return VISUAL_STYLES[id] ?? VISUAL_STYLES.minimalista;
}

export function resolvePaletteColors(id: string) {
  return PALETTES[id] ?? PALETTES.azul_electrico_grafito;
}
