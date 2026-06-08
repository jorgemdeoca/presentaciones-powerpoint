import { InlineText } from "../InlineText";
import type { LayoutProps } from "./shared";

export function HeroMinimalLayout({
  slide,
  pal,
  editable,
  onTitleChange,
  onSubtitleChange,
}: LayoutProps) {
  return (
    <div className="relative w-full h-full">
      {slide.image_url && (
        <img src={slide.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 55%)" }}
      />
      <div className="absolute bottom-0 left-0 p-[8%] max-w-[60%] z-10">
        <InlineText
          as="h1"
          value={slide.title ?? ""}
          editable={editable}
          onChange={onTitleChange}
          className="text-2xl md:text-4xl font-bold leading-tight"
          style={{ color: pal.text }}
        />
        {slide.subtitle && (
          <InlineText
            as="p"
            value={slide.subtitle}
            editable={editable}
            onChange={onSubtitleChange}
            className="mt-2 text-sm md:text-lg opacity-90"
            style={{ color: pal.muted }}
          />
        )}
      </div>
    </div>
  );
}
