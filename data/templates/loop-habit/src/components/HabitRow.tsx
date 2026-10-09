import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type Props = {
  Icon: LucideIcon;
  title: string;
  sub: ReactNode;
  className?: string;
  children?: ReactNode;
};

/* Icon tile + title/subtitle + trailing slot. Used by Today, Habits and Profile. */
export default function HabitRow({ Icon, title, sub, className, children }: Props) {
  return (
    <div className={className ? `habit ${className}` : "habit"}>
      <span className="ava" aria-hidden><Icon size={18} strokeWidth={1.8} /></span>
      <span className="meta">
        <strong>{title}</strong>
        {sub}
      </span>
      {children}
    </div>
  );
}
