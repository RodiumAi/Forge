"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { INTEGRATION_CATEGORIES, integrationCategoryKey, integrationLogoSrc } from "@/components/app/integrations";
import { IntegrationLogo } from "@/components/IntegrationLogo";
import { FilterChip } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Glyph } from "@/components/ui/glyph";
import { SearchInput } from "@/components/ui/Input";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { PickedIntegration } from "@/lib/integrations-marker";
import { type CachedIntegration, ensureIntegrations, getCachedIntegrations } from "@/lib/lists-cache";

export const MAX_PICKED_INTEGRATIONS = 5;

/**
 * Catalogue of drop-in embeds, opened from the composer's + menu. Picking one
 * toggles its tag on the next message; the dialog stays open so several can be
 * added in a row.
 */
export function IntegrationPicker({
  open,
  onClose,
  picked,
  onToggle,
}: {
  open: boolean;
  onClose: () => void;
  picked: readonly PickedIntegration[];
  onToggle: (item: PickedIntegration) => void;
}) {
  const { t, locale } = useI18n();
  const [items, setItems] = useState<CachedIntegration[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const cached = getCachedIntegrations(locale);
    if (cached?.length) setItems(cached);
    setLoading(!cached?.length);
    void ensureIntegrations(locale)
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const focus = window.setTimeout(() => searchRef.current?.focus(), 60);
    return () => {
      cancelled = true;
      window.clearTimeout(focus);
    };
  }, [open, locale]);

  const categories = useMemo(() => {
    const present = new Set(items.flatMap((i) => i.categories));
    const order = INTEGRATION_CATEGORIES as readonly string[];
    return [...order.filter((c) => present.has(c)), ...[...present].filter((c) => !order.includes(c)).sort()];
  }, [items]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((i) => {
      if (category !== "all" && !i.categories.includes(category)) return false;
      if (!needle) return true;
      return [i.id, i.name, i.title, i.blurb, ...i.categories].some((v) => v.toLowerCase().includes(needle));
    });
  }, [items, query, category]);

  const pickedIds = new Set(picked.map((p) => p.id));
  const full = picked.length >= MAX_PICKED_INTEGRATIONS;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("bdIntegTitle")}
      description={t("bdIntegDesc")}
      size="wide"
      className="f-integ-dialog"
      closeLabel={t("close")}
      footer={
        <Button size="sm" onClick={onClose}>
          {t("bdIntegDone")}
        </Button>
      }
    >
      <SearchInput
        ref={searchRef}
        label={t("bdIntegSearch")}
        placeholder={t("bdIntegSearch")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        wrapClassName="f-integ-search"
      />
      <div className="f-integ-cats" role="group" aria-label={t("bdPlusInteg")}>
        <FilterChip pressed={category === "all"} count={items.length} onClick={() => setCategory("all")}>
          {t("integAll")}
        </FilterChip>
        {categories.map((c) => {
          const key = integrationCategoryKey(c);
          return (
            <FilterChip key={c} pressed={category === c} onClick={() => setCategory(c)}>
              {key ? t(key) : c}
            </FilterChip>
          );
        })}
      </div>
      <div className="f-integ-grid">
        {loading && !items.length ? <p className="f-integ-empty">{t("bdIntegLoading")}</p> : null}
        {!loading && !shown.length ? <p className="f-integ-empty">{t("bdIntegEmpty")}</p> : null}
        {shown.map((i) => {
          const on = pickedIds.has(i.id);
          return (
            <button
              key={i.id}
              type="button"
              className={`f-integ-item${on ? " on" : ""}`}
              aria-pressed={on}
              disabled={!on && full}
              onClick={() =>
                onToggle({ id: i.id, name: i.name, embedHosts: i.embed_hosts || [], logoUrl: i.logo_url })
              }
            >
              <IntegrationLogo
                src={integrationLogoSrc(i.id, i.logo_url)}
                label={i.name}
                width={32}
                height={32}
                className="f-integ-logo"
              />
              <span className="f-integ-text">
                <strong>{i.name}</strong>
                <small>{i.blurb}</small>
              </span>
              <span className="f-integ-state" aria-hidden>
                {on ? <Glyph name="check" size="sm" /> : <Glyph name="plus" size="sm" />}
              </span>
            </button>
          );
        })}
      </div>
    </Dialog>
  );
}
