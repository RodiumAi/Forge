import type { ComponentType, ReactNode } from "react";

type IconProps = { size?: number; strokeWidth?: number; "aria-hidden"?: boolean };

type Props = {
  icon: ComponentType<IconProps>;
  title: string;
  sub: string;
  children: ReactNode;
};

/** One line of a list card: icon tile, title + subtitle, trailing slot. */
export default function ListRow({ icon: Icon, title, sub, children }: Props) {
  return (
    <div className="tx">
      <span className="ava" aria-hidden><Icon size={18} strokeWidth={1.9} aria-hidden /></span>
      <span className="meta"><strong>{title}</strong><span>{sub}</span></span>
      {children}
    </div>
  );
}
