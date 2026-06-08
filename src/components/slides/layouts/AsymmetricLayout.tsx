import { InlineText } from "../InlineText";
import type { LayoutProps } from "./shared";

export function AsymmetricLayout({ slide, pal, bullets, editable, onTitleChange }: LayoutProps) {
  return (
    <div className="w-full h-full flex">
      <div className="w-5/12 h-full flex items-end p-[5%] pb-[10%]" style={{ background: pal.surface }}>
        <div className="w-full">
          <InlineText
            as="h2"
            value={slide.title ?? ""}
            editable={editable}
            onChange={onTitleChange}
            className="text-3xl md:text-5xl font-bold leading-tight"
            style={{ color: pal.text }}
          />
        </div>
      </div>
      <div className="w-7/12 h-full relative">
        {slide.image_url && (
          <img src={slide.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 p-[8%] pt-[15%] flex flex-col justify-start">
          <div className="space-y-6 w-4/5 max-w-md ml-auto">
            {bullets.map((b, i) => (
              <div key={i} className="p-4 rounded-lg backdrop-blur-sm shadow-xl" style={{ background: 'rgba(255,255,255,0.1)', borderLeft: `4px solid ${pal.accent}` }}>
                <p className="text-sm md:text-base text-white">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
