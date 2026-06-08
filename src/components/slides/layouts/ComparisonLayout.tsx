import { InlineText } from "../InlineText";
import type { LayoutProps } from "./shared";

export function ComparisonLayout({ slide, pal, bullets, editable, onTitleChange, onSubtitleChange }: LayoutProps) {
  return (
    <div className="w-full h-full flex flex-col p-[5%]">
      <div className="text-center mb-8">
        <InlineText
          as="h2"
          value={slide.title ?? ""}
          editable={editable}
          onChange={onTitleChange}
          className="text-3xl md:text-4xl font-bold mb-2"
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
      <div className="flex-1 flex gap-4">
        <div className="flex-1 rounded-xl p-8 shadow-inner border" style={{ background: `${pal.surface}80`, borderColor: `${pal.muted}40` }}>
          <ul className="space-y-4">
            {bullets.slice(0, Math.ceil(bullets.length / 2)).map((b, i) => (
              <li key={i} className="flex gap-3 text-sm" style={{ color: pal.text }}>
                <span style={{ color: pal.accent }}>✓</span> {b}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex-1 rounded-xl p-8 shadow-lg border" style={{ background: pal.surface, borderColor: `${pal.accent}40` }}>
          <ul className="space-y-4">
            {bullets.slice(Math.ceil(bullets.length / 2)).map((b, i) => (
              <li key={i} className="flex gap-3 text-sm" style={{ color: pal.text }}>
                <span style={{ color: pal.accent }}>★</span> {b}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
