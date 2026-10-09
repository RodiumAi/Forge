import type { ReactNode } from "react";

type Props = { badge: ReactNode; title: string; sub: string; children: ReactNode };

/* Badge tile + title/subtitle + trailing slot. Used by Stats and Profile. */
export default function ListRow({ badge, title, sub, children }: Props) {
  return (
    <div className="tx">
      <span className="ava" aria-hidden>{badge}</span>
      <span className="meta"><strong>{title}</strong><span>{sub}</span></span>
      {children}
    </div>
  );
}
