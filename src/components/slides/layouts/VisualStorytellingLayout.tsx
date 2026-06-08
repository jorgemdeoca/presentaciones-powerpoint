import { InlineText } from "../InlineText";
import type { LayoutProps } from "./shared";

export function VisualStorytellingLayout({ slide, pal, bullets, editable, onTitleChange, onSubtitleChange }: LayoutProps) {
  return (
    <div className="relative w-full h-full flex items-center p-[5%]">
      {slide.image_url && (
        <img src={slide.image_url} alt="" className="absolute right-0 top-0 w-2/3 h-full object-cover mask-gradient-to-l" style={{ WebkitMaskImage: 'linear-gradient(to left, black 50%, transparent 100%)' }} />
      )}
      <div className="relative z-10 w-1/2 flex flex-col justify-center">
        <InlineText
          as="h2"
          value={slide.title ?? ""}
          editable={editable}
          onChange={onTitleChange}
          className="text-4xl md:text-6xl font-bold mb-4 leading-tight"
          style={{ color: pal.text }}
        />
        {slide.subtitle && (
          <InlineText
            as="p"
            value={slide.subtitle}
            editable={editable}
            onChange={onSubtitleChange}
            className="text-lg mb-8 font-light max-w-md"
            style={{ color: pal.muted }}
          />
        )}
        <div className="space-y-4 max-w-sm">
          {bullets.map((b, i) => (
            <p key={i} className="text-sm font-medium" style={{ color: pal.text }}>
              <span className="mr-2" style={{ color: pal.accent }}>—</span> {b}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
