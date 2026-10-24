/**
 * Keyboard and presentation remote mapping (plan 5.4). Remotes (Logitech
 * Spotlight or R400, Kensington...) present themselves as keyboards and send
 * the keys below, so one table serves both.
 */

export type PlayerAction =
  | { type: "next" }
  | { type: "prev" }
  | { type: "first" }
  | { type: "last" }
  | { type: "start"; fromCurrent: boolean }
  | { type: "exit" }
  | { type: "black" }
  | { type: "white" }
  | { type: "digit"; digit: number }
  | { type: "enter" }
  | { type: "backspace" };

export type KeyLike = {
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
};

const NEXT = new Set(["ArrowRight", "ArrowDown", "PageDown", " ", "Spacebar", "n", "N", "MediaTrackNext"]);
const PREV = new Set(["ArrowLeft", "ArrowUp", "PageUp", "p", "P", "MediaTrackPrevious"]);

/**
 * Key event to player action; null for keys the player ignores. Enter and
 * Backspace are reported as such because they also edit the "go to slide N"
 * number being typed; `resolveKey` turns them into next/prev otherwise.
 */
export function mapKey(event: KeyLike): PlayerAction | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  const { key } = event;
  if (NEXT.has(key)) return { type: "next" };
  if (PREV.has(key)) return { type: "prev" };
  if (key === "Enter") return { type: "enter" };
  if (key === "Backspace") return { type: "backspace" };
  if (key === "Home") return { type: "first" };
  if (key === "End") return { type: "last" };
  if (key === "F5") return { type: "start", fromCurrent: !!event.shiftKey };
  if (key === "Escape" || key === "Esc") return { type: "exit" };
  if (key === "b" || key === "B" || key === ".") return { type: "black" };
  if (key === "w" || key === "W" || key === ",") return { type: "white" };
  if (/^[0-9]$/.test(key)) return { type: "digit", digit: Number(key) };
  return null;
}

export type DigitBuffer = string;

export type Resolved =
  | { kind: "action"; action: Exclude<PlayerAction, { type: "digit" } | { type: "enter" } | { type: "backspace" }> }
  | { kind: "goto"; slide: number }
  | { kind: "buffer"; buffer: DigitBuffer };

/**
 * Applies an action to the "digits then Enter" buffer. Digits accumulate,
 * Enter jumps to that slide (1 based) when digits were typed and moves to the
 * next step otherwise, Backspace erases a digit or goes back. Any other action
 * clears the buffer.
 */
export function resolveKey(action: PlayerAction, buffer: DigitBuffer): { result: Resolved; buffer: DigitBuffer } {
  switch (action.type) {
    case "digit": {
      const next = (buffer + String(action.digit)).slice(-4);
      return { result: { kind: "buffer", buffer: next }, buffer: next };
    }
    case "enter":
      if (buffer) return { result: { kind: "goto", slide: Number(buffer) }, buffer: "" };
      return { result: { kind: "action", action: { type: "next" } }, buffer: "" };
    case "backspace":
      if (buffer) {
        const next = buffer.slice(0, -1);
        return { result: { kind: "buffer", buffer: next }, buffer: next };
      }
      return { result: { kind: "action", action: { type: "prev" } }, buffer: "" };
    default:
      return { result: { kind: "action", action }, buffer: "" };
  }
}

/** True when keys typed in this element belong to the page, not the player. */
export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el !== "object" || !("tagName" in el)) return false;
  const tag = String(el.tagName).toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return !!el.isContentEditable;
}
