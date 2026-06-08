import { InlineText } from "../InlineText";
import type { LayoutProps } from "./shared";

export function BentoGridLayout({
  slide,
  pal,
  bullets,
  editable,
  onTitleChange,
}: LayoutProps) {
  return (
    <div className="h-full p-6 flex flex-col">
      <InlineText
        as="h1"
        value={slide.title ?? ""}
        editable={editable}
        onChange={onTitleChange}
        className="text-xl font-bold mb-4"
        style={{ color: pal.text }}
      />
      <div className="grid grid-cols-3 grid-rows-2 gap-2 flex-1">
        {bullets.slice(0, 3).map((b, i) => (
          <div
            key={i}
            className={`rounded-lg p-3 text-sm ${i === 0 ? "col-span-2 row-span-2" : ""}`}
            style={{ background: pal.surface, color: pal.text }}
          >
            {b}
          </div>
        ))}
      </div>
    </div>
  );
}
