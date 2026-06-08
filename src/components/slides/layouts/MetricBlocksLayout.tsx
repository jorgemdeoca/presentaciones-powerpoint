import { InlineText } from "../InlineText";
import type { LayoutProps } from "./shared";

export function MetricBlocksLayout({
  slide,
  pal,
  bullets,
  editable,
  onTitleChange,
  onBulletsChange,
}: LayoutProps) {
  return (
    <div className="h-full p-6 flex flex-col">
      <InlineText
        as="h1"
        value={slide.title ?? ""}
        editable={editable}
        onChange={onTitleChange}
        className="text-xl font-bold mb-6"
        style={{ color: pal.text }}
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
        {bullets.slice(0, 4).map((b, i) => {
          const [val, ...rest] = b.split("—").map((t) => t.trim());
          const label = rest.join("—") || b;
          return (
            <div
              key={i}
              className="rounded-lg p-4 flex flex-col justify-center"
              style={{ background: pal.surface }}
            >
              <div className="text-2xl md:text-3xl font-bold" style={{ color: pal.accent }}>
                {val}
              </div>
              <div className="text-xs mt-1" style={{ color: pal.muted }}>
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
