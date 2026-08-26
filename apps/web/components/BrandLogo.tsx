"use client";

import Image from "next/image";
import { useTheme } from "@/lib/theme/ThemeProvider";

type Props = {
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
};

/** Theme-aware Forge wordmark: dark UI → logo-dark, light UI → logo-light. */
export function BrandLogo({ alt, width, height, priority = false, className }: Props) {
  const { theme } = useTheme();
  const src = theme === "light" ? "/logo-light.png" : "/logo-dark.png";
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      className={className}
    />
  );
}
