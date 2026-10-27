"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { IconButton } from "./Button";
import { cx } from "./cx";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal behaviour shared by Dialog and Sheet: portal, Escape, focus moved in
 * and trapped, body scroll locked, focus restored to the opener on close.
 */
function useModal(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFirst = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const auto = panel.querySelector<HTMLElement>("[data-autofocus]");
      (auto ?? panel.querySelector<HTMLElement>(FOCUSABLE) ?? panel).focus();
    }, 20);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(focusFirst);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, [open]);

  return { panelRef, mounted };
}

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Visually hidden title (palettes, search). */
  hideTitle?: boolean;
  description?: ReactNode;
  children?: ReactNode;
  /** Buttons row at the bottom. */
  footer?: ReactNode;
  size?: "md" | "wide";
  /** Pins the dialog near the top (command palette) instead of centring it. */
  placement?: "center" | "top";
  /** Hides the close button (the content provides its own way out). */
  hideClose?: boolean;
  closeLabel?: string;
  className?: string;
};

/** Centred modal dialog on a blurred scrim. Click on the scrim or Escape closes. */
export function Dialog({
  open,
  onClose,
  title,
  hideTitle,
  description,
  children,
  footer,
  size = "md",
  placement = "center",
  hideClose,
  closeLabel = "Close",
  className,
}: DialogProps) {
  const { panelRef, mounted } = useModal(open, onClose);
  const titleId = useId();
  const descId = useId();
  if (!open || !mounted) return null;
  return createPortal(
    <div
      className={cx("f-scrim", placement === "top" && "f-scrim-top")}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cx("f-dialog", size === "wide" && "f-dialog-wide", className)}
      >
        <div className={cx("f-dialog-head", hideTitle && "f-sr-only")}>
          <h2 id={titleId}>{title}</h2>
          {hideClose || hideTitle ? null : <IconButton icon="x" label={closeLabel} size="sm" plain onClick={onClose} />}
        </div>
        {description ? (
          <p id={descId} className="f-muted" style={{ fontSize: 14.5 }}>
            {description}
          </p>
        ) : null}
        {children}
        {footer ? <div className="f-dialog-foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  /** bottom: phone sheet; left: navigation drawer; right: side panel. */
  side?: "bottom" | "left" | "right";
  title?: ReactNode;
  children?: ReactNode;
  closeLabel?: string;
  className?: string;
  /** Accessible name when there is no visible title. */
  label?: string;
};

/** Sliding panel with a scrim: bottom sheet on phones, drawers on the sides. */
export function Sheet({ open, onClose, side = "bottom", title, children, closeLabel = "Close", className, label }: SheetProps) {
  const { panelRef, mounted } = useModal(open, onClose);
  const titleId = useId();
  if (!open || !mounted) return null;
  return createPortal(
    <>
      <button type="button" className="f-sheet-scrim" aria-label={closeLabel} tabIndex={-1} onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : label}
        tabIndex={-1}
        className={cx("f-sheet", className)}
        data-side={side}
      >
        {title ? (
          <div className="f-sheet-head">
            <b id={titleId}>{title}</b>
            <IconButton icon="x" label={closeLabel} size="sm" plain onClick={onClose} />
          </div>
        ) : null}
        <div className="f-sheet-body">{children}</div>
      </div>
    </>,
    document.body,
  );
}
