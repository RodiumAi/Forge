import type { LucideIcon } from "lucide-react";

type IconProps = {
  icon: LucideIcon;
  size?: number;
  className?: string;
  strokeWidth?: number;
};

export function Icon({ icon: Component, size = 18, className = "ui-icon", strokeWidth = 2 }: IconProps) {
  return <Component size={size} strokeWidth={strokeWidth} className={className} aria-hidden />;
}
