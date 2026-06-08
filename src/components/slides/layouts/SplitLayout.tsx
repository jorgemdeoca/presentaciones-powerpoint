import { InlineText } from "../InlineText";
import type { LayoutProps } from "./shared";

export function SplitLayout({
  slide,
  pal,
  bullets,
  editable,
  onTitleChange,
  onSubtitleChange,
  onBulletsChange,
  imageSide,
}: LayoutProps & { imageSide: "left" | "right" }) {
  const textFirst = imageSide === "right";
  return (
    <div className={`flex h-full ${textFirst ? "" : "flex-row-reverse"}`}>
      <div className="w-1/2 p-6 flex flex-col justify-center z-10">
        <InlineText
          as="h1"
          value={slide.title ?? ""}
          editable={editable}
          onChange={onTitleChange}
          className="text-xl md:text-2xl font-bold"
          style={{ color: pal.text }}
        />
        {slide.subtitle && (
          <InlineText
            as="p"
            value={slide.subtitle}
            editable={editable}
            onChange={onSubtitleChange}
            className="mt-2 text-sm"
            style={{ color: pal.muted }}
          />
        )}
        <ul className="mt-4 space-y-2">
          {bullets.map((b, i) => (
            <li key={i} className="text-sm flex gap-2" style={{ color: pal.text }}>
              <span style={{ color: pal.accent }}>•</span>
              {editable ? (
                <span
                  contentEditable
                  suppressContentEditableWarning
                  className="outline-none flex-1"
                  onBlur={(e) => {
                    const next = [...bullets];
                    next[i] = e.currentTarget.textContent ?? "";
                    onBulletsChange?.(next);
                  }}
                >
                  {b}
                </span>
              ) : (
                b
              )}
            </li>
          ))}
        </ul>
      </div>
      <div className="w-1/2 relative bg-black/20">
        {slide.image_url ? (
          <img src={slide.image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full" style={{ background: pal.surface }} />
        )}
      </div>
    </div>
  );
}
