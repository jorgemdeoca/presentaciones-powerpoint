import { InlineText } from "../InlineText";
import type { LayoutProps } from "./shared";

export function DashboardLayout({ slide, pal, bullets, editable, onTitleChange }: LayoutProps) {
  return (
    <div className="w-full h-full p-[5%] flex flex-col gap-6">
      <InlineText
        as="h2"
        value={slide.title ?? ""}
        editable={editable}
        onChange={onTitleChange}
        className="text-2xl md:text-4xl font-bold"
        style={{ color: pal.text }}
      />
      <div className="flex-1 grid grid-cols-3 grid-rows-2 gap-4">
        <div className="col-span-2 row-span-2 rounded-xl p-6 shadow-md border border-white/5" style={{ background: pal.surface }}>
          {slide.image_url ? (
            <img src={slide.image_url} alt="" className="w-full h-full object-cover rounded-lg" />
          ) : (
            <div className="w-full h-full rounded-lg" style={{ background: `linear-gradient(45deg, ${pal.bg}, ${pal.accent}20)` }} />
          )}
        </div>
        {bullets.slice(0, 2).map((b, i) => (
          <div key={i} className="rounded-xl p-5 flex items-center shadow-md border border-white/5" style={{ background: pal.surface }}>
            <p className="text-sm font-medium" style={{ color: pal.text }}>{b}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
