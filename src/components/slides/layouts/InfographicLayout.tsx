import { InlineText } from "../InlineText";
import type { LayoutProps } from "./shared";

export function InfographicLayout({ slide, pal, bullets, editable, onTitleChange }: LayoutProps) {
  return (
    <div className="w-full h-full p-[6%] flex items-center gap-10">
      <div className="flex-1 flex flex-col justify-center gap-8">
        <InlineText
          as="h2"
          value={slide.title ?? ""}
          editable={editable}
          onChange={onTitleChange}
          className="text-3xl md:text-5xl font-bold"
          style={{ color: pal.text }}
        />
        <div className="space-y-6">
          {bullets.slice(0, 4).map((b, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold" style={{ background: pal.accent, color: pal.bg }}>
                {i + 1}
              </div>
              <p className="text-base pt-1.5" style={{ color: pal.text }}>{b}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="w-5/12 h-full flex items-center justify-center">
        {slide.image_url ? (
          <img src={slide.image_url} alt="" className="w-full max-h-full object-contain rounded-2xl drop-shadow-2xl" />
        ) : (
          <div className="w-64 h-64 rounded-full" style={{ background: `radial-gradient(circle, ${pal.accent} 0%, transparent 70%)` }} />
        )}
      </div>
    </div>
  );
}
