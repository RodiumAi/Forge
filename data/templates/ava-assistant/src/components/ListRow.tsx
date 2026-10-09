import type { ReactNode } from "react";

type Props = { icon: ReactNode; title: string; sub: string; children: ReactNode };

/** One settings line of a card: icon tile, title + subtitle, trailing slot. */
export default function ListRow({ icon, title, sub, children }: Props) {
  return (
    <div className="tx">
      <span className="ava" aria-hidden>{icon}</span>
      <span className="meta"><strong>{title}</strong><span>{sub}</span></span>
      {children}
    </div>
  );
}
