"use client";

import { useEffect, useRef, useState } from "react";
import { Plug } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { apiBase, getToken } from "@/lib/api";
import { connectorLogoAlt, connectorLogoSrc } from "@/lib/connectors/logos";
import { useI18n } from "@/lib/i18n/I18nProvider";

export type ComposerConnector = {
  id: string;
  name: string;
  category: string;
  configured: boolean;
};

type Props = {
  selected: ComposerConnector[];
  onChange: (next: ComposerConnector[]) => void;
  disabled?: boolean;
};

export function formatConnectorMarkers(selected: ComposerConnector[]): string {
  if (!selected.length) return "";
  return selected
    .map(
      (c) =>
        `[Connector: ${c.id} | status:${c.configured ? "connected" : "missing"}]`,
    )
    .join("\n");
}

export function PromptConnectorChips({
  selected,
  onRemove,
}: {
  selected: ComposerConnector[];
  onRemove: (id: string) => void;
}) {
  const { t } = useI18n();
  if (!selected.length) return null;
  return (
    <div className="landing-files builder-connector-chips">
      {selected.map((c) => (
        <button
          key={c.id}
          type="button"
          className={`landing-file-chip connector-chip${c.configured ? "" : " missing"}`}
          onClick={() => onRemove(c.id)}
          title={c.configured ? c.name : t("connectorNotConnected")}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={connectorLogoSrc(c.id) || "/connectors/rodiumai.png"}
            alt={connectorLogoAlt(c.id)}
            width={14}
            height={14}
          />
          <span>{c.name}</span>
          {!c.configured ? <span className="connector-chip-warn">!</span> : null}
          <span aria-hidden>×</span>
        </button>
      ))}
    </div>
  );
}

export function PromptConnectorPicker({ selected, onChange, disabled }: Props) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ComposerConnector[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${apiBase()}/connectors`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!res.ok) throw new Error("failed");
        const data = (await res.json()) as Array<{
          id: string;
          name: string;
          category: string;
          configured: boolean;
        }>;
        if (!cancelled) {
          setItems(
            data.map((c) => ({
              id: c.id,
              name: c.name,
              category: c.category,
              configured: Boolean(c.configured),
            })),
          );
        }
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const toggle = (c: ComposerConnector) => {
    if (selected.some((x) => x.id === c.id)) {
      onChange(selected.filter((x) => x.id !== c.id));
    } else {
      onChange([...selected, c]);
    }
  };

  return (
    <div className="builder-connector-picker" ref={rootRef}>
      <button
        type="button"
        className={`builder-plus-label builder-connector-btn${selected.length ? " has-selection" : ""}`}
        title={t("connectorsHint")}
        aria-label={t("connectorsAria")}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="builder-plus">
          <Icon icon={Plug} className="ui-icon-md" />
          {selected.length > 0 ? (
            <span className="builder-plus-badge" aria-hidden>
              {selected.length}
            </span>
          ) : null}
        </span>
      </button>
      {open ? (
        <div className="builder-connector-popover" role="listbox" aria-label={t("connectors")}>
          <p className="builder-connector-popover-title">{t("connectorsPickTitle")}</p>
          {loading ? (
            <p className="builder-connector-popover-empty">{t("loading")}</p>
          ) : items.length === 0 ? (
            <p className="builder-connector-popover-empty">{t("connectorsCatalogEmpty")}</p>
          ) : (
            <ul className="builder-connector-list">
              {items.map((c) => {
                const active = selected.some((x) => x.id === c.id);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={`builder-connector-item${active ? " active" : ""}`}
                      onClick={() => toggle(c)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={connectorLogoSrc(c.id, locale === "fr" ? "dark" : "dark") || ""}
                        alt=""
                        width={20}
                        height={20}
                      />
                      <span className="builder-connector-item-text">
                        <strong>{c.name}</strong>
                        <small>
                          {c.configured ? t("connectorConnected") : t("connectorNotConnected")}
                        </small>
                      </span>
                      {active ? <span className="builder-connector-check">✓</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <a className="builder-connector-manage" href="/connectors">
            {t("connectorsManage")}
          </a>
        </div>
      ) : null}
    </div>
  );
}
