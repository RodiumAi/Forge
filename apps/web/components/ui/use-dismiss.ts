"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Closes a floating element on a pointer down outside `refs` and on Escape.
 * Escape also returns focus to `restore` when given.
 */
export function useDismiss(
  open: boolean,
  close: () => void,
  refs: ReadonlyArray<RefObject<HTMLElement | null>>,
  restore?: RefObject<HTMLElement | null>,
) {
  // Latest values in refs so the listeners never go stale.
  const latest = useRef({ close, refs, restore });
  latest.current = { close, refs, restore };

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && latest.current.refs.some((ref) => ref.current?.contains(target))) return;
      latest.current.close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      latest.current.close();
      latest.current.restore?.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
}
