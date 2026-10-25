"use client";

/**
 * Forge's own right-click menu, shared by the editors (slides first). It opens
 * at a point on right-click, on a long press on touch screens (Android fires
 * `contextmenu` itself, iOS does not, so `useLongPress` covers both) and from
 * the keyboard (Menu key or Shift+F10, wired by each editor).
 *
 * Rows can hold a shortcut, a check, a danger tone or a submenu. Submenus open
 * to the side on a mouse, and inline on touch and narrow screens. Arrow keys,
 * Home, End and the first letter move between rows; Escape and Tab close.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { cx } from "./cx";
import { Glyph } from "./glyph";

export type ContextMenuItem = {
  type?: "item";
  id: string;
  label: string;
  icon?: ReactNode;
  /** Shown at the right, e.g. "Ctrl+D". */
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  /** A toggle or a choice: shows a check when true. */
  checked?: boolean;
  onSelect: () => void;
};

export type ContextMenuEntry =
  | ContextMenuItem
  | { type: "submenu"; id: string; label: string; icon?: ReactNode; disabled?: boolean; items: ContextMenuEntry[] }
  | { type: "separator" }
  | { type: "label"; label: string };

export type ContextMenuRequest = {
  x: number;
  y: number;
  items: ContextMenuEntry[];
  /** Accessible name of the menu. */
  label?: string;
};

export type Point = { x: number; y: number };

/** State of one menu: `open` at a point with rows, `close`. */
export function useContextMenu() {
  const [request, setRequest] = useState<ContextMenuRequest | null>(null);
  const open = useCallback((point: Point, items: ContextMenuEntry[], label?: string) => {
    // Rows that would sit next to each other as separators (or at the ends) are dropped.
    const clean = tidy(items);
    if (clean.length) setRequest({ x: point.x, y: point.y, items: clean, label });
  }, []);
  const close = useCallback(() => setRequest(null), []);
  return { request, open, close };
}

function tidy(items: ContextMenuEntry[]): ContextMenuEntry[] {
  const out: ContextMenuEntry[] = [];
  for (const item of items) {
    if (item.type === "separator" && (!out.length || out[out.length - 1].type === "separator")) continue;
    if (item.type === "submenu") {
      const sub = tidy(item.items);
      if (sub.length) out.push({ ...item, items: sub });
      continue;
    }
    out.push(item);
  }
  while (out.length && out[out.length - 1].type === "separator") out.pop();
  return out;
}

/**
 * Long press for touch pointers: hold still about half a second. A move of a
 * few pixels (a scroll, a drag) cancels it. Wire the four pointer handlers on
 * the target, and call `cancel()` from its `onContextMenu` so Android's own
 * long-press event and this timer don't both open a menu.
 */
export function useLongPress(onLongPress: (point: Point) => void, delay = 520) {
  const timer = useRef<number | null>(null);
  const origin = useRef<Point | null>(null);
  const firedAt = useRef(0);
  const callback = useRef(onLongPress);
  callback.current = onLongPress;

  const cancel = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  return {
    cancel,
    /** True just after a long press opened a menu: ignore the native menu and click that follow. */
    justFired: () => Date.now() - firedAt.current < 900,
    onPointerDown: (e: ReactPointerEvent) => {
      if (e.pointerType !== "touch") return;
      cancel();
      const point = { x: e.clientX, y: e.clientY };
      origin.current = point;
      timer.current = window.setTimeout(() => {
        timer.current = null;
        origin.current = null;
        firedAt.current = Date.now();
        navigator.vibrate?.(8);
        callback.current(point);
      }, delay);
    },
    onPointerMove: (e: ReactPointerEvent) => {
      const o = origin.current;
      if (o && Math.hypot(e.clientX - o.x, e.clientY - o.y) > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
  };
}

/** Whether a key event asks for the context menu (Menu key, Shift+F10). */
export function isContextMenuKey(e: { key: string; shiftKey: boolean }): boolean {
  return e.key === "ContextMenu" || (e.shiftKey && e.key === "F10");
}

/** Centre of an element's box, to open a keyboard menu over it. */
export function centerOf(el: Element | null | undefined): Point | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + Math.min(r.height / 2, 40)) };
}

const ROW = ".f-menu-item:not([aria-disabled='true'])";

function useInlineSubmenus(): boolean {
  const [inline, setInline] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 560px), (pointer: coarse)");
    const read = () => setInline(query.matches);
    read();
    query.addEventListener?.("change", read);
    return () => query.removeEventListener?.("change", read);
  }, []);
  return inline;
}

export function ContextMenu({ request, onClose }: { request: ContextMenuRequest | null; onClose: () => void }) {
  const inline = useInlineSubmenus();
  const returnFocus = useRef<HTMLElement | null>(null);
  const openedAt = useRef(0);

  useEffect(() => {
    if (!request) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    openedAt.current = Date.now();
    const outside = (e: PointerEvent) => {
      if (!(e.target as Element | null)?.closest?.("[data-ctx-menu]")) onClose();
    };
    // The user scrolling elsewhere closes it; a panel scrolled by the app
    // (a tab change after the selection moved) must not.
    const scroll = (e: Event) => {
      if (!(e.target as Element | null)?.closest?.("[data-ctx-menu]")) onClose();
    };
    window.addEventListener("pointerdown", outside, true);
    window.addEventListener("wheel", scroll, { capture: true, passive: true });
    window.addEventListener("touchmove", scroll, { capture: true, passive: true });
    window.addEventListener("resize", onClose);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("wheel", scroll, true);
      window.removeEventListener("touchmove", scroll, true);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("blur", onClose);
    };
  }, [request, onClose]);

  if (!request || typeof document === "undefined") return null;

  const dismiss = (restore: boolean) => {
    onClose();
    if (restore) returnFocus.current?.focus?.({ preventScroll: true });
  };

  return createPortal(
    <Panel
      key={`${request.x}:${request.y}`}
      entries={request.items}
      at={{ x: request.x, y: request.y }}
      label={request.label}
      inline={inline}
      onDismiss={dismiss}
      // A finger lifted right after a long press must not pick the row under it.
      tooEarly={() => Date.now() - openedAt.current < 350}
    />,
    document.body,
  );
}

type PanelProps = {
  entries: ContextMenuEntry[];
  /** Top-left wish for the root menu. */
  at?: Point;
  /** Row a submenu flies out of. */
  anchor?: DOMRect;
  label?: string;
  inline: boolean;
  onDismiss: (restoreFocus: boolean) => void;
  /** Submenu only: back to the parent row (ArrowLeft, Escape). */
  onBack?: () => void;
  tooEarly: () => boolean;
};

function Panel({ entries, at, anchor, label, inline, onDismiss, onBack, tooEarly }: PanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Point | null>(null);
  const [openSub, setOpenSub] = useState<string | null>(null);
  const [subAnchor, setSubAnchor] = useState<DOMRect | null>(null);
  const hoverTimer = useRef<number | null>(null);

  // Place it in the viewport: flip to the left or up when it would overflow.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x: number;
    let y: number;
    if (anchor) {
      x = anchor.right + 4;
      if (x + w > vw - 8) x = anchor.left - w - 4;
      y = anchor.top - 6;
    } else {
      x = at?.x ?? 8;
      y = at?.y ?? 8;
      if (x + w > vw - 8) x = x - w;
    }
    if (y + h > vh - 8) y = vh - 8 - h;
    setPos({ x: Math.max(8, x), y: Math.max(8, y) });
  }, [anchor, at]);

  // Focus the first row once placed.
  useEffect(() => {
    if (pos) ref.current?.querySelector<HTMLElement>(ROW)?.focus({ preventScroll: true });
  }, [pos]);

  useEffect(
    () => () => {
      if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
    },
    [],
  );

  function rows(): HTMLElement[] {
    // Only this panel's own rows (an inline submenu's rows belong to it too).
    return Array.from(ref.current?.querySelectorAll<HTMLElement>(ROW) ?? []).filter((el) => el.closest("[data-ctx-menu]") === ref.current);
  }

  function move(delta: number | "first" | "last") {
    const list = rows();
    if (!list.length) return;
    const current = list.indexOf(document.activeElement as HTMLElement);
    const next = delta === "first" ? 0 : delta === "last" ? list.length - 1 : current < 0 ? 0 : (current + delta + list.length) % list.length;
    list[next].focus();
  }

  function onKeyDown(e: ReactKeyboardEvent) {
    // Keys typed in a nested flyout are handled there.
    if ((e.target as Element).closest("[data-ctx-menu]") !== ref.current) return;
    const key = e.key;
    if (key === "ArrowDown") move(1);
    else if (key === "ArrowUp") move(-1);
    else if (key === "Home") move("first");
    else if (key === "End") move("last");
    else if (key === "Escape") {
      if (onBack) onBack();
      else onDismiss(true);
    } else if (key === "ArrowLeft" && onBack) onBack();
    else if (key === "Tab") onDismiss(true);
    else if (key.length === 1 && /\S/.test(key)) {
      const list = rows();
      const start = list.indexOf(document.activeElement as HTMLElement);
      const letter = key.toLocaleLowerCase();
      for (let i = 1; i <= list.length; i += 1) {
        const row = list[(start + i) % list.length];
        if ((row.dataset.label ?? "").toLocaleLowerCase().startsWith(letter)) {
          row.focus();
          break;
        }
      }
    } else return;
    e.preventDefault();
    e.stopPropagation();
  }

  const openSubmenu = (id: string, row: HTMLElement | null) => {
    setOpenSub(id);
    setSubAnchor(row ? row.getBoundingClientRect() : null);
  };

  const body = (
    <>
      {entries.map((entry, i) => {
        if (entry.type === "separator") return <div key={`sep-${i}`} className="f-menu-sep" role="separator" />;
        if (entry.type === "label") return <div key={`label-${i}`} className="f-menu-label">{entry.label}</div>;
        if (entry.type === "submenu") {
          const expanded = openSub === entry.id;
          return (
            <div key={entry.id} className="f-ctx-subwrap">
              <button
                type="button"
                role="menuitem"
                className={cx("f-menu-item", expanded && "is-active")}
                data-label={entry.label}
                aria-haspopup="menu"
                aria-expanded={expanded}
                aria-disabled={entry.disabled || undefined}
                onClick={(e) => {
                  if (entry.disabled) return;
                  if (expanded) setOpenSub(null);
                  else openSubmenu(entry.id, e.currentTarget);
                }}
                onPointerEnter={(e) => {
                  if (inline || entry.disabled || e.pointerType !== "mouse") return;
                  const row = e.currentTarget;
                  if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
                  hoverTimer.current = window.setTimeout(() => openSubmenu(entry.id, row), 110);
                }}
                onKeyDown={(e) => {
                  if (entry.disabled) return;
                  if (e.key === "ArrowRight" || (inline && (e.key === "Enter" || e.key === " "))) {
                    e.preventDefault();
                    e.stopPropagation();
                    openSubmenu(entry.id, e.currentTarget);
                  }
                }}
              >
                <span className="f-ctx-ico">{entry.icon}</span>
                <span>{entry.label}</span>
                <span className="f-menu-meta">
                  <Glyph name={inline && expanded ? "chevron-down" : "chevron-right"} size="xs" />
                </span>
              </button>
              {expanded && inline ? (
                <div className="f-ctx-inline" role="group" aria-label={entry.label}>
                  <Rows entries={entry.items} onDismiss={onDismiss} tooEarly={tooEarly} />
                </div>
              ) : null}
            </div>
          );
        }
        return <Row key={entry.id} item={entry} onDismiss={onDismiss} tooEarly={tooEarly} onHover={() => !inline && setOpenSub(null)} />;
      })}
    </>
  );

  const active = !inline && openSub ? entries.find((e) => e.type === "submenu" && e.id === openSub) : null;

  return (
    <>
      <div
        ref={ref}
        data-ctx-menu=""
        role="menu"
        aria-label={label}
        className="f-pop f-pop-dark f-ctx"
        style={pos ? { left: pos.x, top: pos.y } : { left: at?.x ?? 0, top: at?.y ?? 0, visibility: "hidden" }}
        onKeyDown={onKeyDown}
        onContextMenu={(e) => e.preventDefault()}
      >
        {body}
      </div>
      {active && active.type === "submenu" && subAnchor ? (
        <Panel
          key={active.id}
          entries={active.items}
          anchor={subAnchor}
          label={active.label}
          inline={false}
          onDismiss={onDismiss}
          tooEarly={tooEarly}
          onBack={() => {
            setOpenSub(null);
            ref.current?.querySelector<HTMLElement>(`[aria-expanded="true"]`)?.focus();
          }}
        />
      ) : null}
    </>
  );
}

/** Rows of an inline submenu (touch and narrow screens). */
function Rows({ entries, onDismiss, tooEarly }: { entries: ContextMenuEntry[]; onDismiss: (restore: boolean) => void; tooEarly: () => boolean }) {
  return (
    <>
      {entries.map((entry, i) => {
        if (entry.type === "separator") return <div key={`sep-${i}`} className="f-menu-sep" role="separator" />;
        if (entry.type === "label") return <div key={`label-${i}`} className="f-menu-label">{entry.label}</div>;
        // Two levels are enough for the editors: a nested submenu shows its rows flat.
        if (entry.type === "submenu") return <Rows key={entry.id} entries={entry.items} onDismiss={onDismiss} tooEarly={tooEarly} />;
        return <Row key={entry.id} item={entry} onDismiss={onDismiss} tooEarly={tooEarly} />;
      })}
    </>
  );
}

function Row({ item, onDismiss, tooEarly, onHover }: { item: ContextMenuItem; onDismiss: (restore: boolean) => void; tooEarly: () => boolean; onHover?: () => void }) {
  return (
    <button
      type="button"
      role={item.checked === undefined ? "menuitem" : "menuitemcheckbox"}
      aria-checked={item.checked === undefined ? undefined : item.checked}
      aria-disabled={item.disabled || undefined}
      data-label={item.label}
      className={cx("f-menu-item", item.danger && "f-menu-item-danger")}
      onPointerEnter={onHover}
      onClick={() => {
        if (item.disabled || tooEarly()) return;
        onDismiss(false);
        item.onSelect();
      }}
    >
      <span className="f-ctx-ico">{item.icon}</span>
      <span>{item.label}</span>
      {item.shortcut || item.checked ? (
        <span className="f-menu-meta">
          {item.shortcut ? <kbd className="f-ctx-kbd">{item.shortcut}</kbd> : null}
          {item.checked ? <Glyph name="check" size="xs" /> : null}
        </span>
      ) : null}
    </button>
  );
}
