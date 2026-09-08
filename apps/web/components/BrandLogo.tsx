"use client";

import Image from "next/image";
import { useTheme } from "@/lib/theme/ThemeProvider";

type Props = {
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
  /** `mark` = favicon / icône carrée (sidebar réduite). */
  variant?: "wordmark" | "mark";
};

/** Theme-aware Forge brand: wordmark or compact mark. */
export function BrandLogo({
  alt,
  width,
  height,
  priority = false,
  className,
  variant = "wordmark",
}: Props) {
  const { theme } = useTheme();
  const src =
    variant === "mark"
      ? "/favicon.png"
      : theme === "light"
        ? "/logo-light.png"
        : "/logo-dark.png";
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
