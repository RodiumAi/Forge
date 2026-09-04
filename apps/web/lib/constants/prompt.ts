/**
 * Composer hard cap (chars) shared by every prompt/chat input.
 *
 * The API rejects `content` above 50 000 chars — and that budget also carries
 * attachment/selection markers plus inlined PDF/MD text (up to 40 000). 8 000
 * typed chars (≈2 000 tokens) is plenty for a request and keeps the total under
 * the server limit instead of surfacing a raw 422 / "trop volumineuse" error.
 */
export const PROMPT_MAX_CHARS = 8_000;

/**
 * Absolute payload guard (chars): the assembled message — typed text +
 * attachment/selection markers + inlined PDF/MD/TXT text — must stay under this.
 * Sits below the API's 50 000 char `content` cap so we fail with a clear
 * message instead of a raw 422 "trop volumineuse".
 */
export const PAYLOAD_MAX_CHARS = 48_000;

/** Thrown when an assembled prompt payload exceeds {@link PAYLOAD_MAX_CHARS}. */
export class PromptTooLongError extends Error {
  constructor() {
    super("prompt_too_long");
    this.name = "PromptTooLongError";
  }
}
