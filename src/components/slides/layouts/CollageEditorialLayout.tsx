import { InlineText } from "../InlineText";
import type { LayoutProps } from "./shared";

export function CollageEditorialLayout({ slide, pal, bullets, editable, onTitleChange, onSubtitleChange }: LayoutProps) {
  return (
    <div className="w-full h-full p-[6%] flex gap-8">
      <div className="w-1/3 flex flex-col justify-end pb-8 relative z-10">
        <InlineText
          as="h2"
          value={slide.title ?? ""}
          editable={editable}
          onChange={onTitleChange}
          className="text-4xl md:text-6xl font-serif font-bold mb-4 leading-none"
          style={{ color: pal.text }}
        />
        {slide.subtitle && (
          <InlineText
            as="p"
            value={slide.subtitle}
            editable={editable}
            onChange={onSubtitleChange}
            className="text-lg uppercase tracking-widest opacity-80"
            style={{ color: pal.accent }}
          />
        )}
      </div>
      <div className="w-2/3 grid grid-cols-2 grid-rows-2 gap-4">
        {slide.image_url && (
          <div className="col-span-1 row-span-2 rounded-lg overflow-hidden shadow-xl" style={{ border: `1px solid ${pal.surface}` }}>
            <img src={slide.image_url} alt="" className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700" />
          </div>
        )}
        {bullets.slice(0, 2).map((b, i) => (
          <div key={i} className="col-span-1 p-6 flex items-center justify-center rounded-lg shadow-md" style={{ background: pal.surface }}>
            <p className="text-sm italic text-center" style={{ color: pal.muted }}>"{b}"</p>
          </div>
        ))}
      </div>
    </div>
  );
}
