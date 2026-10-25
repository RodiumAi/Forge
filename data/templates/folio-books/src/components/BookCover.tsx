import type { Book } from "../data";

type Props = { book: Book; size?: "xs" | "sm" | "md" | "lg" | "xl"; className?: string };

/** A book cover with a spine crease, page edge and soft shadow.
 *  Photo covers get the title set over the image; type covers are drawn in CSS. */
export default function BookCover({ book, size = "md", className = "" }: Props) {
  const c = book.cover;
  const style = c.kind === "photo"
    ? { backgroundImage: `linear-gradient(180deg, transparent 12%, ${c.tint}99 42%, ${c.tint}f2 82%), url(${c.src})` }
    : { background: c.bg, color: c.ink };
  return (
    <span className={`cover cover-${size} ${c.kind === "type" ? `type motif-${c.motif}` : "photo"} ${className}`} style={style} aria-label={`${book.title} by ${book.author}`} role="img">
      {c.kind === "type" && <i className="motif" aria-hidden />}
      <span className="cover-text">
        <b>{book.title}</b>
        <small>{book.author}</small>
      </span>
    </span>
  );
}
