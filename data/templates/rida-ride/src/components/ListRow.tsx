import type { ReactNode } from "react";

type Props = { icon: ReactNode; title: string; sub: string; avaClass?: string; children: ReactNode };

/** One line of a list card: icon tile, title + subtitle, trailing slot. */
export default function ListRow({ icon, title, sub, avaClass, children }: Props) {
  return (
    <div className="tx">
      <span className={avaClass ? `ava ${avaClass}` : "ava"} aria-hidden>{icon}</span>
      <span className="meta"><strong>{title}</strong><span>{sub}</span></span>
      {children}
    </div>
  );
}
