"use client";

import Image from "next/image";
import { connectorLogoAlt, connectorLogoSrc } from "@/lib/connectors/logos";
import { useTheme } from "@/lib/theme/ThemeProvider";

type ConnectorLogoProps = {
  id: string;
  size?: number;
  className?: string;
};

export function ConnectorLogo({ id, size = 40, className = "" }: ConnectorLogoProps) {
  const { theme } = useTheme();
  const src = connectorLogoSrc(id, theme);
  const alt = connectorLogoAlt(id);

  if (!src) {
    return (
      <div
        className={`home-connector-logo home-connector-logo-fallback ${className}`.trim()}
        aria-hidden
      >
        {alt.slice(0, 1)}
      </div>
    );
  }

  return (
    <div
      className={`home-connector-logo ${className}`.trim()}
      style={{ width: size, height: size }}
    >
      <Image
        src={src}
        alt={alt}
        width={size}
        height={size}
        className="home-connector-logo-img"
      />
    </div>
  );
}
