"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";

import { cx } from "./cx";
import { Glyph, type GlyphName } from "./glyph";

export type TabItem<T extends string> = {
  id: T;
  label: ReactNode;
  icon?: GlyphName;
  /** Panel id for aria-controls. */
  controls?: string;
  disabled?: boolean;
};

/** Arrow keys, Home and End move between the buttons of a group. */
function useRovingKeys(count: number) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  function onKeyDown(event: KeyboardEvent, index: number, pick?: (i: number) => void) {
    let next = -1;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % count;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + count) % count;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = count - 1;
    if (next < 0) return;
    event.preventDefault();
    refs.current[next]?.focus();
    pick?.(next);
  }
  return { refs, onKeyDown };
}

/** Rounded tab strip (project views, settings sections). WAI-ARIA tabs with automatic activation. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Accessible name of the tab list. */
  label: string;
  className?: string;
}) {
  const { refs, onKeyDown } = useRovingKeys(items.length);
  return (
    <div className={cx("f-tabs", className)} role="tablist" aria-label={label}>
      {items.map((item, index) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="tab"
            className="f-tab"
            aria-selected={selected}
            aria-controls={item.controls}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => onKeyDown(event, index, (i) => onChange(items[i].id))}
          >
            {item.icon ? <Glyph name={item.icon} size="sm" /> : null}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/** Pill segmented control (FR/EN, grid/list, monthly). Buttons with aria-pressed. */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  label,
  size = "md",
  className,
}: {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  size?: "md" | "lg";
  className?: string;
}) {
  const { refs, onKeyDown } = useRovingKeys(items.length);
  return (
    <div className={cx("f-seg", size === "lg" && "f-seg-lg", className)} role="group" aria-label={label}>
      {items.map((item, index) => (
        <button
          key={item.id}
          ref={(el) => {
            refs.current[index] = el;
          }}
          type="button"
          aria-pressed={item.id === value}
          disabled={item.disabled}
          onClick={() => onChange(item.id)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {item.icon ? <Glyph name={item.icon} size="sm" /> : null}
          {item.label}
        </button>
      ))}
    </div>
  );
}
