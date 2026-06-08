import { InlineText } from "../InlineText";
import type { LayoutProps } from "./shared";

export function TimelineLayout({ slide, pal, bullets, editable, onTitleChange }: LayoutProps) {
  return (
    <div className="w-full h-full p-[6%] flex flex-col justify-center">
      <div className="mb-12 text-center">
        <InlineText
          as="h2"
          value={slide.title ?? ""}
          editable={editable}
          onChange={onTitleChange}
          className="text-3xl md:text-5xl font-bold"
          style={{ color: pal.text }}
        />
      </div>
      <div className="relative flex items-center justify-between px-8">
        <div className="absolute left-[10%] right-[10%] h-1 top-1/2 -translate-y-1/2" style={{ background: pal.muted, opacity: 0.3 }} />
        {bullets.slice(0, 4).map((b, i) => (
          <div key={i} className="relative z-10 flex flex-col items-center w-1/4 px-4 text-center">
            <div className="w-4 h-4 rounded-full mb-4 shadow-[0_0_15px_rgba(0,0,0,0.5)]" style={{ background: pal.accent }} />
            <p className="text-sm font-medium leading-relaxed" style={{ color: pal.text }}>{b}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
