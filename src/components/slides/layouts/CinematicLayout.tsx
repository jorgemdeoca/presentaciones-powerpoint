import { InlineText } from "../InlineText";
import type { LayoutProps } from "./shared";

export function CinematicLayout({
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
      <div className="absolute inset-0 bg-black/50" />
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 z-10">
        <InlineText
          as="h1"
          value={slide.title ?? ""}
          editable={editable}
          onChange={onTitleChange}
          className="text-3xl md:text-5xl font-bold tracking-tight"
          style={{ color: pal.text }}
        />
        {slide.subtitle && (
          <InlineText
            as="p"
            value={slide.subtitle}
            editable={editable}
            onChange={onSubtitleChange}
            className="mt-4 text-lg max-w-xl"
            style={{ color: pal.muted }}
          />
        )}
      </div>
    </div>
  );
}
