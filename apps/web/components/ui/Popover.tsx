"use client";

import {
  cloneElement,
  isValidElement,
  useCallback,
  useId,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";

import { cx } from "./cx";
import { Glyph, type GlyphName } from "./glyph";
import { useDismiss } from "./use-dismiss";

type TriggerProps = {
  onClick?: (event: ReactMouseEvent) => void;
  "aria-expanded"?: boolean;
  "aria-haspopup"?: "menu" | "listbox" | "dialog" | boolean;
  "aria-controls"?: string;
  ref?: Ref<HTMLElement>;
};

export type PopoverProps = {
  /** The trigger: one element (Button, IconButton, AvatarButton...). It receives onClick and the aria attributes. */
  trigger: ReactElement<TriggerProps>;
  /** Content, or a render function receiving `close`. */
  children: ReactNode | ((close: () => void) => ReactNode);
  side?: "top" | "bottom";
  align?: "start" | "end";
  /** `dark` is the composer's popover look (dark in both themes). */
  tone?: "surface" | "dark";
  role?: "menu" | "listbox" | "dialog";
  label?: string;
  className?: string;
  width?: number | string;
  /** Controlled open state (optional). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const ITEM_SELECTOR = ".f-menu-item:not(:disabled):not([aria-disabled='true'])";

/**
 * Anchored floating panel. Closes on outside pointer down and on Escape (focus
 * returns to the trigger). Arrow keys, Home and End move between `.f-menu-item`
 * rows; opening a menu or listbox focuses its selected row, else the first one.
 */
export function Popover({
  trigger,
  children,
  side = "bottom",
  align = "start",
  tone = "surface",
  role = "menu",
  label,
  className,
  width,
  open: openProp,
  onOpenChange,
}: PopoverProps) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const id = useId();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const setOpen = useCallback(
    (next: boolean) => {
      if (openProp === undefined) setOpenState(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange],
  );
  const close = useCallback(() => setOpen(false), [setOpen]);
  useDismiss(open, close, [anchorRef], triggerRef);

  function focusItem(delta: number | "first" | "last" | "selected") {
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);
    if (!items.length) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    let next = 0;
    if (delta === "selected") {
      next = Math.max(0, items.findIndex((el) => el.getAttribute("aria-selected") === "true" || el.getAttribute("aria-checked") === "true"));
    } else if (delta === "first") next = 0;
    else if (delta === "last") next = items.length - 1;
    else next = current < 0 ? 0 : (current + delta + items.length) % items.length;
    items[next].focus();
  }

  function onPanelKey(event: KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusItem("first");
    } else if (event.key === "End") {
      event.preventDefault();
      focusItem("last");
    } else if (event.key === "Tab" && role !== "dialog") {
      close();
    }
  }

  const triggerEl = isValidElement(trigger)
    ? cloneElement(trigger, {
        ref: (el: HTMLElement | null) => {
          triggerRef.current = el;
        },
        onClick: (event: ReactMouseEvent) => {
          trigger.props.onClick?.(event);
          const next = !open;
          setOpen(next);
          if (next && role !== "dialog") window.setTimeout(() => focusItem("selected"), 20);
        },
        "aria-expanded": open,
        "aria-haspopup": role === "dialog" ? "dialog" : role,
        "aria-controls": open ? id : undefined,
      })
    : trigger;

  return (
    <span className="f-pop-anchor" ref={anchorRef}>
      {triggerEl}
      {open ? (
        <div
          ref={panelRef}
          id={id}
          role={role}
          aria-label={label}
          className={cx("f-pop", tone === "dark" && "f-pop-dark", className)}
          data-side={side}
          data-align={align}
          style={width != null ? { width, minWidth: 0 } : undefined}
          onKeyDown={onPanelKey}
        >
          {typeof children === "function" ? children(close) : children}
        </div>
      ) : null}
    </span>
  );
}

type MenuItemProps = Omit<HTMLAttributes<HTMLElement>, "role"> & {
  icon?: GlyphName;
  /** Custom leading visual (swatch, flag) instead of a glyph. */
  lead?: ReactNode;
  /** Right side: badge, shortcut. */
  meta?: ReactNode;
  /** Small second line. */
  hint?: ReactNode;
  href?: string;
  external?: boolean;
  danger?: boolean;
  disabled?: boolean;
  /** Listbox option or radio item: the chosen one (adds a check). */
  selected?: boolean;
  role?: "menuitem" | "option" | "menuitemradio";
};

/** Row of a Popover menu or listbox. Renders an <a> when `href` is set. */
export function MenuItem({
  icon,
  lead,
  meta,
  hint,
  href,
  external,
  danger,
  disabled,
  selected,
  role = "menuitem",
  className,
  children,
  ...rest
}: MenuItemProps) {
  const cls = cx("f-menu-item", danger && "f-menu-item-danger", className);
  const body = (
    <>
      {lead ?? (icon ? <Glyph name={icon} size="sm" /> : null)}
      <span>
        {children}
        {hint ? <small>{hint}</small> : null}
      </span>
      {meta != null || selected ? (
        <span className="f-menu-meta">
          {meta}
          {selected ? <Glyph name="check" size="sm" /> : null}
        </span>
      ) : null}
    </>
  );
  const aria =
    role === "option"
      ? { "aria-selected": Boolean(selected) }
      : role === "menuitemradio"
        ? { "aria-checked": Boolean(selected) }
        : {};
  if (href) {
    return (
      <a
        {...(rest as HTMLAttributes<HTMLAnchorElement>)}
        href={href}
        role={role}
        className={cls}
        aria-disabled={disabled || undefined}
        {...aria}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {body}
      </a>
    );
  }
  return (
    <button
      {...(rest as HTMLAttributes<HTMLButtonElement>)}
      type="button"
      role={role}
      className={cls}
      disabled={disabled}
      {...aria}
    >
      {body}
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="f-menu-label">{children}</div>;
}

export function MenuSeparator() {
  return <div className="f-menu-sep" role="separator" />;
}

/** Small explanatory block at the bottom of a menu (plan gates). */
export function MenuNote({ children }: { children: ReactNode }) {
  return <div className="f-menu-note">{children}</div>;
}
