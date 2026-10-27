"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { cx } from "@/components/ui/cx";
import { useI18n } from "@/lib/i18n/I18nProvider";

const WIDTH_KEY = "forge.builder.chatWidth";
const OPEN_KEY = "forge.builder.chatOpen";
const DEFAULT_WIDTH = 400;
const MIN_WIDTH = 300;
const MAX_WIDTH = 720;

function clampWidth(raw: number): number {
  if (typeof window === "undefined") {
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, raw));
  }
  const cap = Math.min(MAX_WIDTH, Math.floor(window.innerWidth * 0.55));
  return Math.min(cap, Math.max(MIN_WIDTH, Math.round(raw)));
}

function readStoredWidth(): number {
  try {
    const raw = Number(window.localStorage.getItem(WIDTH_KEY));
    if (Number.isFinite(raw) && raw > 0) return clampWidth(raw);
  } catch {
    /* ignore */
  }
  return clampWidth(DEFAULT_WIDTH);
}

function readStoredOpen(): boolean {
  try {
    const raw = window.localStorage.getItem(OPEN_KEY);
    if (raw === "0") return false;
    if (raw === "1") return true;
  } catch {
    /* ignore */
  }
  return true;
}

export type ChatRail = {
  open: boolean;
  setOpen: (open: boolean) => void;
  width: number;
  dragging: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
};

/**
 * Desktop chat rail state: width (dragged, or arrow keys on the handle) and
 * open/closed (the assistant toggle in the top bar). Both persist in
 * localStorage. Phones ignore it: chat and stage are tabs there.
 */
export function useChatRail(): ChatRail {
  const [open, setOpenState] = useState(true);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [dragging, setDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(DEFAULT_WIDTH);

  useEffect(() => {
    setWidth(readStoredWidth());
    setOpenState(readStoredOpen());
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(WIDTH_KEY, String(width));
    } catch {
      /* ignore */
    }
  }, [width]);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    try {
      window.localStorage.setItem(OPEN_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      event.preventDefault();
      dragStartX.current = event.clientX;
      dragStartWidth.current = width;
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [width],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!dragging) return;
      setWidth(clampWidth(dragStartWidth.current + event.clientX - dragStartX.current));
    },
    [dragging],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!dragging) return;
      setDragging(false);
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
    },
    [dragging],
  );

  const onKeyDown = useCallback((event: ReactKeyboardEvent<HTMLElement>) => {
    const step = event.shiftKey ? 64 : 16;
    if (event.key === "ArrowLeft") setWidth((w) => clampWidth(w - step));
    else if (event.key === "ArrowRight") setWidth((w) => clampWidth(w + step));
    else if (event.key === "Home") setWidth(clampWidth(MIN_WIDTH));
    else if (event.key === "End") setWidth(clampWidth(MAX_WIDTH));
    else return;
    event.preventDefault();
  }, []);

  return { open, setOpen, width, dragging, onPointerDown, onPointerMove, onPointerUp, onKeyDown };
}

/** The draggable edge between the chat and the stage (focusable, arrow keys resize). */
export function ChatResizeHandle({ rail }: { rail: ChatRail }) {
  const { t } = useI18n();
  if (!rail.open) return null;
  return (
    <div
      className={cx("f-bd-resize", rail.dragging && "is-drag")}
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-valuenow={rail.width}
      aria-valuemin={MIN_WIDTH}
      aria-valuemax={MAX_WIDTH}
      aria-label={t("chatPanelResize")}
      title={t("chatPanelResizeHint")}
      onPointerDown={rail.onPointerDown}
      onPointerMove={rail.onPointerMove}
      onPointerUp={rail.onPointerUp}
      onPointerCancel={rail.onPointerUp}
      onKeyDown={rail.onKeyDown}
      onDoubleClick={() => rail.setOpen(false)}
    />
  );
}
