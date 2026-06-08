import { InlineText } from "../InlineText";
import type { LayoutProps } from "./shared";

export function TitleContentLayout({
  slide,
  pal,
  bullets,
  editable,
  onTitleChange,
  onSubtitleChange,
  onBulletsChange,
}: LayoutProps) {
  return (
    <div className="h-full p-8 flex flex-col justify-center">
      <InlineText
        as="h1"
        value={slide.title ?? ""}
        editable={editable}
        onChange={onTitleChange}
        className="text-2xl md:text-3xl font-bold"
        style={{ color: pal.text }}
      />
      {slide.subtitle && (
        <InlineText
          as="p"
          value={slide.subtitle}
          editable={editable}
          onChange={onSubtitleChange}
          className="mt-2 text-base"
          style={{ color: pal.muted }}
        />
      )}
      <ul className="mt-6 space-y-2">
        {bullets.map((b, i) => (
          <li key={i} className="text-sm md:text-base flex gap-2" style={{ color: pal.text }}>
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
  );
}
