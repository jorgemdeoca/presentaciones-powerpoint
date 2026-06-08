import { InlineText } from "../InlineText";
import type { LayoutProps } from "./shared";

export function QuoteLayout({ slide, pal, editable, onTitleChange, onSubtitleChange }: LayoutProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-10 text-center">
      <InlineText
        as="h1"
        value={`"${slide.title ?? ""}"`}
        editable={editable}
        onChange={onTitleChange}
        className="text-2xl md:text-3xl font-serif italic max-w-[85%]"
        style={{ color: pal.text }}
      />
      {slide.subtitle && (
        <InlineText
          as="p"
          value={`— ${slide.subtitle}`}
          editable={editable}
          onChange={(v) => onSubtitleChange?.(v.replace(/^—\s*/, ""))}
          className="mt-6 text-base"
          style={{ color: pal.accent }}
        />
      )}
    </div>
  );
}
