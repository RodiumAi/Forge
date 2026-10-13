import type { CaptureResult } from "posthog-js";
import { scrubUrl } from "./url-scrub";

/**
 * Properties that hold a page URL. PostHog copies several of them onto the
 * person (`$set_once`) and the session, so they are scrubbed everywhere.
 */
const URL_PROPERTY_KEYS = [
  "$current_url",
  "$referrer",
  "$initial_current_url",
  "$initial_referrer",
  "$session_entry_url",
  "$session_entry_referrer",
  "page_url",
  "page_path",
] as const;

/**
 * Browser noise that is not an application error: it cannot be fixed by us and
 * only hides real exceptions (and costs billed events).
 */
const BENIGN_EXCEPTION_PATTERNS: RegExp[] = [
  /ResizeObserver loop (completed with undelivered notifications|limit exceeded)/i,
  /^Script error\.?$/i,
  /AbortError|The user aborted a request|signal is aborted without reason|The operation was aborted/i,
  // Firebase Auth popup bookkeeping when the user closes the popup.
  /INTERNAL ASSERTION FAILED: Pending promise was never set/i,
  // Browser translation tools and extensions rewriting the DOM under React.
  /Failed to execute '(removeChild|insertBefore)' on 'Node'/i,
  // Storage blocked or wiped by the browser (private modes, "clear on exit").
  /Internal error opening backing store for indexedDB\.open|Database deleted by request of the user/i,
  // The analytics SDK reporting its own network problems.
  /PostHog request timed out/i,
];

type ExceptionEntry = { type?: unknown; value?: unknown };

function exceptionParts(properties: Record<string, unknown>): string[] {
  const parts: string[] = [];
  const list = properties.$exception_list;
  if (Array.isArray(list)) {
    for (const entry of list as ExceptionEntry[]) {
      if (typeof entry?.type === "string") parts.push(entry.type);
      if (typeof entry?.value === "string") parts.push(entry.value);
    }
  }
  for (const key of ["$exception_types", "$exception_values"] as const) {
    const value = properties[key];
    if (Array.isArray(value)) {
      parts.push(...value.filter((v): v is string => typeof v === "string"));
    }
  }
  return parts;
}

/** Each type and message is tested on its own so anchored patterns keep working. */
export function isBenignException(properties: Record<string, unknown>): boolean {
  const parts = exceptionParts(properties);
  return parts.some((part) =>
    BENIGN_EXCEPTION_PATTERNS.some((pattern) => pattern.test(part)),
  );
}

function scrubUrlProperties(bag: unknown): void {
  if (!bag || typeof bag !== "object") return;
  const record = bag as Record<string, unknown>;
  for (const key of URL_PROPERTY_KEYS) {
    const value = record[key];
    if (typeof value === "string" && value) record[key] = scrubUrl(value);
  }
}

/**
 * `before_send` hook shared by the web apps: drops benign exceptions and
 * removes secrets from every URL attached to an event.
 */
export function sanitizeCaptureResult(
  result: CaptureResult | null,
): CaptureResult | null {
  if (!result) return null;
  const properties = (result.properties ?? {}) as Record<string, unknown>;
  if (result.event === "$exception" && isBenignException(properties)) {
    return null;
  }
  scrubUrlProperties(result.properties);
  scrubUrlProperties(result.$set);
  scrubUrlProperties(result.$set_once);
  return result;
}
