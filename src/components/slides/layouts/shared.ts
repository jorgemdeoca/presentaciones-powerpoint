import type { SlideData } from "../SlideRenderer";
import type { resolvePaletteColors } from "@/lib/theme";

export type LayoutProps = {
  slide: SlideData;
  pal: ReturnType<typeof resolvePaletteColors>;
  bullets: string[];
  bg: string;
  editable?: boolean;
  onTitleChange?: (v: string) => void;
  onSubtitleChange?: (v: string) => void;
  onBulletsChange?: (v: string[]) => void;
};
