"use client";

import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";

import { cx } from "./cx";

export type AvatarSize = "xs" | "sm" | "md" | "lg";

/** Two letters from a display name ("Parfait Toke" -> "PT"), or from an e-mail. */
export function initialsOf(label: string | null | undefined): string {
  const clean = (label || "").split("@")[0].replace(/[._-]+/g, " ").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0]?.slice(0, 2) || "?").toUpperCase();
}

type AvatarProps = {
  name: string | null | undefined;
  src?: string | null;
  size?: AvatarSize;
  /** `self` is flat orange (the signed-in user); `other` is neutral (teammates). */
  tone?: "self" | "other";
  /** The signed-in user's own avatar: a user icon instead of initials when there is no photo. */
  glyph?: boolean;
  className?: string;
};

/** Rounded-square avatar with a photo, initials, or (`glyph`) a user icon. */
export function Avatar({ name, src, size = "md", tone = "self", glyph, className }: AvatarProps) {
  const [broken, setBroken] = useState(false);
  const photo = src && !broken ? src : null;
  return (
    <span
      className={cx("f-avatar", size !== "md" && `f-avatar-${size}`, tone === "other" && "f-avatar-neutral", className)}
      aria-hidden
    >
      {photo ? <img src={photo} alt="" onError={() => setBroken(true)} /> : glyph ? <UserGlyph /> : initialsOf(name)}
    </span>
  );
}

/** Head and shoulders, shown on the account button when there is no photo. */
function UserGlyph() {
  return (
    <svg className="f-avatar-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
    </svg>
  );
}

/** The account button: the user's photo, or a user icon (opens the account menu). */
export function AvatarButton({
  // Kept in the props so callers stay the same; the button shows an icon, not initials.
  name: _name,
  glyph: _glyph,
  src,
  size = "md",
  className,
  ...rest
}: AvatarProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  const [broken, setBroken] = useState(false);
  const photo = src && !broken ? src : null;
  return (
    <button type="button" {...rest} className={cx("f-avatar", size !== "md" && `f-avatar-${size}`, className)}>
      {photo ? <img src={photo} alt="" onError={() => setBroken(true)} /> : <UserGlyph />}
    </button>
  );
}

/** Overlapping avatars (collaborators). */
export function AvatarStack({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("f-avatars", className)}>{children}</span>;
}
