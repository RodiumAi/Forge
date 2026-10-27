"use client";

import { Check, ChevronDown, Palette } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nProvider";

export type DesignSystemOption = { id: string; name: string };

export type DesignSystemPreview = { colors: string[]; display: string | null; body: string | null };

const previewCache = new Map<string, Promise<DesignSystemPreview | null>>();

function firstFont(value: unknown): string | null {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : null;
  return typeof value === "string" ? value.split(",")[0].trim() || null : null;
}

/** Colours and fonts of a design-system.json document, for the mini preview. */
export function previewFromDocument(document: unknown): DesignSystemPreview {
  const tokens = (document as { tokens?: Record<string, unknown> } | null)?.tokens ?? {};
  const colorGroup = (tokens.color ?? {}) as Record<string, unknown>;
  const colors: string[] = [];
  for (const [name, token] of Object.entries(colorGroup)) {
    if (name.startsWith("$")) continue;
    const value = (token as { $value?: unknown } | null)?.$value;
    if (typeof value === "string" && colors.length < 5) colors.push(value);
  }
  const fonts = (tokens.font ?? {}) as Record<string, { $value?: unknown } | undefined>;
  return { colors, display: firstFont(fonts.display?.$value), body: firstFont(fonts.body?.$value) };
}

/** One fetch per design system per page view; a failure shows no preview. */
export function loadDesignSystemPreview(projectId: string): Promise<DesignSystemPreview | null> {
  let flight = previewCache.get(projectId);
  if (!flight) {
    flight = api<unknown>(`/projects/${projectId}/design-system`, { retries: 0 })
      .then(previewFromDocument)
      .catch(() => null);
    previewCache.set(projectId, flight);
  }
  return flight;
}

function usePreview(projectId: string | null) {
  const [preview, setPreview] = useState<DesignSystemPreview | null>(null);
  useEffect(() => {
    let alive = true;
    setPreview(null);
    if (projectId) void loadDesignSystemPreview(projectId).then((p) => alive && setPreview(p));
    return () => {
      alive = false;
    };
  }, [projectId]);
  return preview;
}

function Swatches({ preview }: { preview: DesignSystemPreview | null }) {
  if (!preview?.colors.length) return null;
  return (
    <span className="fdh-ds-swatches" aria-hidden>
      {preview.colors.map((color, index) => (
        <span key={`${color}-${index}`} className="fdh-ds-swatch" style={{ background: color }} />
      ))}
    </span>
  );
}

function OptionRow({ option, selected }: { option: DesignSystemOption; selected: boolean }) {
  const { t } = useI18n();
  const preview = usePreview(option.id);
  return (
    <>
      <span className="fdh-ds-option-main">
        <span className="fdh-ds-option-name">{option.name}</span>
        <Swatches preview={preview} />
      </span>
      {preview && (preview.display || preview.body) ? (
        <span className="fdh-ds-fonts">
          {preview.display ? (
            <span style={{ fontFamily: preview.display }}>
              {t("homeDesignSystemDisplay")}: {preview.display}
            </span>
          ) : null}
          {preview.body ? (
            <span style={{ fontFamily: preview.body }}>
              {t("homeDesignSystemBody")}: {preview.body}
            </span>
          ) : null}
        </span>
      ) : null}
      {selected ? <Icon icon={Check} className="ui-icon-sm fdh-ds-check" /> : null}
    </>
  );
}

type Props = {
  options: readonly DesignSystemOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
};

/** Pick the design system of the new project, "Aucun" included (listbox pattern). */
export function DesignSystemPicker({ options, value, onChange, disabled }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const rows: (DesignSystemOption | null)[] = [null, ...options];
  const selectedIndex = Math.max(
    0,
    rows.findIndex((row) => (row?.id ?? null) === value),
  );
  const [active, setActive] = useState(selectedIndex);
  const current = options.find((option) => option.id === value) ?? null;
  const currentPreview = usePreview(current?.id ?? null);

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function pick(index: number) {
    onChange(rows[index]?.id ?? null);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function onListKey(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(rows.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(rows.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      pick(active);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div className="fdh-ds" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="fdh-pill fdh-ds-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${t("homeDesignSystemAria")}: ${current?.name ?? t("homeDesignSystemNone")}`}
        disabled={disabled}
        onClick={() => {
          setActive(selectedIndex);
          setOpen((v) => !v);
        }}
      >
        <Icon icon={Palette} className="ui-icon-sm" />
        <span className="fdh-ds-current">{current?.name ?? t("homeDesignSystemNone")}</span>
        <Swatches preview={current ? currentPreview : null} />
        <Icon icon={ChevronDown} className="ui-icon-sm" />
      </button>
      {open ? (
        <div className="fdh-popover">
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-label={t("homeDesignSystemAria")}
            aria-activedescendant={`${listId}-${active}`}
            className="fdh-ds-list"
            onKeyDown={onListKey}
          >
            {rows.map((row, index) => {
              const selected = (row?.id ?? null) === value;
              return (
                <li
                  key={row?.id ?? "none"}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={selected}
                  className={`fdh-ds-option${index === active ? " is-active" : ""}`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pick(index)}
                >
                  {row ? (
                    <OptionRow option={row} selected={selected} />
                  ) : (
                    <>
                      <span className="fdh-ds-option-main">
                        <span className="fdh-ds-option-name">{t("homeDesignSystemNone")}</span>
                      </span>
                      {selected ? <Icon icon={Check} className="ui-icon-sm fdh-ds-check" /> : null}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          {!options.length ? <p className="fdh-ds-empty">{t("homeDesignSystemEmpty")}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
