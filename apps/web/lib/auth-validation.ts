/**
 * Inline validation for the auth forms.
 *
 * A field only shows its error once the person has left it or tried to
 * submit, so nobody is scolded mid-word. The server stays the source of
 * truth: these checks only catch what we can tell before a round-trip.
 */

import { useCallback, useState } from "react";

import type { MessageKey } from "@/lib/i18n/dictionaries";

export const MIN_PASSWORD = 8;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function emailError(value: string): MessageKey | null {
  if (!value.trim()) return "lndAuthEmailRequired";
  if (!isEmail(value)) return "lndAuthEmailInvalid";
  return null;
}

/** `minLength` 0 only checks presence (sign in), otherwise the length rule. */
export function passwordError(value: string, minLength = 0): MessageKey | null {
  if (!value) return minLength ? "authPasswordTooShort" : "lndAuthPassRequired";
  if (minLength && value.length < minLength) return "authPasswordTooShort";
  return null;
}

export function requiredError(value: string, key: MessageKey): MessageKey | null {
  return value.trim() ? null : key;
}

/**
 * Which fields have been left (blurred) or submitted. `show(name)` says
 * whether that field's message may appear yet.
 */
export function useTouched<T extends string>() {
  const [touched, setTouched] = useState<Partial<Record<T, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const touch = useCallback((name: T) => setTouched((prev) => (prev[name] ? prev : { ...prev, [name]: true })), []);
  const show = useCallback((name: T) => submitted || Boolean(touched[name]), [submitted, touched]);
  return { touch, show, submitted, markSubmitted: () => setSubmitted(true) };
}

/** Focus the first field (by id) whose error is set. */
export function focusFirstInvalid(entries: [string, unknown][]): void {
  const hit = entries.find(([, err]) => Boolean(err));
  if (!hit) return;
  const el = document.getElementById(hit[0]);
  if (el instanceof HTMLElement) el.focus();
}
