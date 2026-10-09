import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type Props = { Icon: LucideIcon; title: string; sub: string; children: ReactNode };

/* Icon tile + title/subtitle + trailing slot (amount or link). Used by Home and Account. */
export default function ListRow({ Icon, title, sub, children }: Props) {
  return (
    <div className="tx">
      <span className="ava" aria-hidden><Icon size={18} strokeWidth={1.8} /></span>
      <span className="meta"><strong>{title}</strong><span>{sub}</span></span>
      {children}
    </div>
  );
}
