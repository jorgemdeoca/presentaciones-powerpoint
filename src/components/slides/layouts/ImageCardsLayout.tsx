import { InlineText } from "../InlineText";
import type { LayoutProps } from "./shared";

export function ImageCardsLayout({ slide, pal, bullets, editable, onTitleChange, onSubtitleChange }: LayoutProps) {
  return (
    <div className="w-full h-full p-[6%] flex flex-col">
      <div className="mb-6 max-w-3xl">
        <InlineText
          as="h2"
          value={slide.title ?? ""}
          editable={editable}
          onChange={onTitleChange}
          className="text-3xl md:text-5xl font-bold mb-2"
          style={{ color: pal.text }}
        />
        {slide.subtitle && (
          <InlineText
            as="p"
            value={slide.subtitle}
            editable={editable}
            onChange={onSubtitleChange}
            className="text-lg opacity-80"
            style={{ color: pal.muted }}
          />
        )}
      </div>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
        {bullets.slice(0, 3).map((b, i) => (
          <div key={i} className="flex flex-col rounded-xl overflow-hidden shadow-lg" style={{ background: pal.surface }}>
            {slide.image_url && i === 0 && (
              <img src={slide.image_url} alt="" className="w-full h-40 object-cover" />
            )}
            <div className="p-5 flex-1 flex items-center">
              <p className="text-sm font-medium leading-relaxed" style={{ color: pal.text }}>
                {b}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
