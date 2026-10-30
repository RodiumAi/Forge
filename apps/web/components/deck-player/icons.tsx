/**
 * Lucide icons by kebab-case name ("trending-up"). The whole lucide set is
 * looked up by name, since slides choose icons at runtime.
 */

import { icons, type LucideIcon } from "lucide-react";

export function pascalIconName(name: string): string {
  return name
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

export function lucideIcon(name: string): LucideIcon | null {
  const table = icons as Record<string, LucideIcon>;
  return table[pascalIconName(name)] ?? null;
}

let names: string[] | null = null;

/** Every lucide icon as a kebab-case name ("ChartBar" -> "chart-bar"), sorted. */
export function lucideIconNames(): string[] {
  if (!names) {
    names = Object.keys(icons)
      .map((key) => key.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase())
      .filter((name) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) && lucideIcon(name))
      .sort();
  }
  return names;
}

/** Drawn when the icon name is unknown: a neutral circle, never a crash. */
export function FallbackIcon({ color, strokeWidth }: { color: string; strokeWidth: number }) {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke={color} strokeWidth={strokeWidth} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}
