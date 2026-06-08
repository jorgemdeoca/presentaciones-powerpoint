import type { ReactNode } from "react";
import { resolvePaletteColors } from "@/lib/theme";
import { HeroMinimalLayout } from "./layouts/HeroMinimalLayout";
import { SplitLayout } from "./layouts/SplitLayout";
import { QuoteLayout } from "./layouts/QuoteLayout";
import { MetricBlocksLayout } from "./layouts/MetricBlocksLayout";
import { BentoGridLayout } from "./layouts/BentoGridLayout";
import { CinematicLayout } from "./layouts/CinematicLayout";
import { TitleContentLayout } from "./layouts/TitleContentLayout";
import { ImageCardsLayout } from "./layouts/ImageCardsLayout";
import { TimelineLayout } from "./layouts/TimelineLayout";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { InfographicLayout } from "./layouts/InfographicLayout";
import { CollageEditorialLayout } from "./layouts/CollageEditorialLayout";
import { ComparisonLayout } from "./layouts/ComparisonLayout";
import { FloatingImageLayout } from "./layouts/FloatingImageLayout";
import { AsymmetricLayout } from "./layouts/AsymmetricLayout";
import { VisualStorytellingLayout } from "./layouts/VisualStorytellingLayout";

export type SlideData = {
  id?: string;
  layout: string;
  title: string | null;
  subtitle: string | null;
  bullets: unknown;
  image_url: string | null;
  design?: Record<string, unknown> | null;
};

type Props = {
  slide: SlideData;
  paletteId: string;
  editable?: boolean;
  onTitleChange?: (v: string) => void;
  onSubtitleChange?: (v: string) => void;
  onBulletsChange?: (v: string[]) => void;
  className?: string;
};

export function SlideRenderer({
  slide,
  paletteId,
  editable,
  onTitleChange,
  onSubtitleChange,
  onBulletsChange,
  className = "",
}: Props) {
  const pal = resolvePaletteColors(paletteId);
  const bullets = Array.isArray(slide.bullets) ? (slide.bullets as string[]) : [];
  const bg =
    (slide.design as { background?: { value?: string } })?.background?.value ??
    `linear-gradient(135deg, ${pal.bg} 0%, ${pal.surface} 100%)`;

  const common = {
    slide,
    pal,
    bullets,
    bg,
    editable,
    onTitleChange,
    onSubtitleChange,
    onBulletsChange,
  };

  let content: ReactNode;
  switch (slide.layout) {
    case "hero_minimal":
      content = <HeroMinimalLayout {...common} />;
      break;
    case "split_left":
      content = <SplitLayout {...common} imageSide="left" />;
      break;
    case "split_right":
      content = <SplitLayout {...common} imageSide="right" />;
      break;
    case "quote":
      content = <QuoteLayout {...common} />;
      break;
    case "metric_blocks":
      content = <MetricBlocksLayout {...common} />;
      break;
    case "bento_grid":
      content = <BentoGridLayout {...common} />;
      break;
    case "cinematic":
      content = <CinematicLayout {...common} />;
      break;
    case "image_cards":
      content = <ImageCardsLayout {...common} />;
      break;
    case "timeline":
      content = <TimelineLayout {...common} />;
      break;
    case "dashboard":
      content = <DashboardLayout {...common} />;
      break;
    case "infographic":
      content = <InfographicLayout {...common} />;
      break;
    case "collage_editorial":
      content = <CollageEditorialLayout {...common} />;
      break;
    case "comparison":
      content = <ComparisonLayout {...common} />;
      break;
    case "floating_image":
      content = <FloatingImageLayout {...common} />;
      break;
    case "asymmetric":
      content = <AsymmetricLayout {...common} />;
      break;
    case "visual_storytelling":
      content = <VisualStorytellingLayout {...common} />;
      break;
    default:
      content = <TitleContentLayout {...common} />;
  }

  return (
    <div
      className={`relative w-full aspect-video overflow-hidden rounded-xl ${className}`}
      style={{ background: bg }}
    >
      {content}
    </div>
  );
}
