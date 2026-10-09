import type { ComponentType, CSSProperties, ReactNode } from "react";

type IconProps = { size?: number; strokeWidth?: number; "aria-hidden"?: boolean };

type Props = {
  icon: ComponentType<IconProps>;
  title: string;
  titleStyle?: CSSProperties;
  sub: ReactNode;
  children: ReactNode;
};

/** One line of a list card: leafy icon tile, title + subtitle, trailing slot. */
export default function ListRow({ icon: Icon, title, titleStyle, sub, children }: Props) {
  return (
    <div className="tx">
      <span className="ava" aria-hidden><Icon size={20} strokeWidth={1.8} aria-hidden /></span>
      <span className="meta"><strong style={titleStyle}>{title}</strong><span>{sub}</span></span>
      {children}
    </div>
  );
}
