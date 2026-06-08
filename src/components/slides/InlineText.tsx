type Props = {
  value: string;
  editable?: boolean;
  onChange?: (v: string) => void;
  onBlur?: () => void;
  className?: string;
  as?: "h1" | "h2" | "p" | "span";
  style?: React.CSSProperties;
};

export function InlineText({
  value,
  editable,
  onChange,
  onBlur,
  className = "",
  as: Tag = "p",
  style,
}: Props) {
  if (!editable) {
    return (
      <Tag className={className} style={style}>
        {value}
      </Tag>
    );
  }

  return (
    <Tag
      contentEditable
      suppressContentEditableWarning
      className={`outline-none focus:ring-2 focus:ring-primary/40 rounded px-1 ${className}`}
      style={style}
      onBlur={(e) => {
        onChange?.(e.currentTarget.textContent ?? "");
        onBlur?.();
      }}
      dangerouslySetInnerHTML={{ __html: value }}
    />
  );
}
