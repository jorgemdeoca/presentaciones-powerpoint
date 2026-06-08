import { InlineText } from "../InlineText";
import type { LayoutProps } from "./shared";

export function FloatingImageLayout({ slide, pal, bullets, editable, onTitleChange, onSubtitleChange }: LayoutProps) {
  return (
    <div className="relative w-full h-full p-[8%] flex items-center justify-center">
      {slide.image_url && (
        <div className="absolute inset-0 opacity-20 blur-sm mix-blend-overlay">
          <img src={slide.image_url} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="relative z-10 max-w-2xl text-center flex flex-col items-center">
        {slide.image_url && (
          <img src={slide.image_url} alt="" className="w-48 h-48 rounded-full object-cover mb-8 shadow-2xl border-4" style={{ borderColor: pal.surface }} />
        )}
        <InlineText
          as="h2"
          value={slide.title ?? ""}
          editable={editable}
          onChange={onTitleChange}
          className="text-4xl md:text-5xl font-bold mb-4"
          style={{ color: pal.text }}
        />
        {slide.subtitle && (
          <InlineText
            as="p"
            value={slide.subtitle}
            editable={editable}
            onChange={onSubtitleChange}
            className="text-xl mb-6 font-light"
            style={{ color: pal.muted }}
          />
        )}
        <div className="flex flex-wrap justify-center gap-3">
          {bullets.map((b, i) => (
            <span key={i} className="px-4 py-1.5 rounded-full text-sm backdrop-blur-md bg-white/10" style={{ color: pal.text, border: `1px solid ${pal.accent}40` }}>
              {b}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
