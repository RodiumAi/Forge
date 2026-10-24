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
  className?: string;
};

/** Rounded-square avatar with a photo or initials. */
export function Avatar({ name, src, size = "md", tone = "self", className }: AvatarProps) {
  const [broken, setBroken] = useState(false);
  const photo = src && !broken ? src : null;
  return (
    <span
      className={cx("f-avatar", size !== "md" && `f-avatar-${size}`, tone === "other" && "f-avatar-neutral", className)}
      aria-hidden
    >
      {photo ? <img src={photo} alt="" onError={() => setBroken(true)} /> : initialsOf(name)}
    </span>
  );
}

/** The same avatar as a button (opens the account menu). */
export function AvatarButton({
  name,
  src,
  size = "md",
  className,
  ...rest
}: AvatarProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  const [broken, setBroken] = useState(false);
  const photo = src && !broken ? src : null;
  return (
    <button type="button" {...rest} className={cx("f-avatar", size !== "md" && `f-avatar-${size}`, className)}>
      {photo ? <img src={photo} alt="" onError={() => setBroken(true)} /> : initialsOf(name)}
    </button>
  );
}

/** Overlapping avatars (collaborators). */
export function AvatarStack({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("f-avatars", className)}>{children}</span>;
}
