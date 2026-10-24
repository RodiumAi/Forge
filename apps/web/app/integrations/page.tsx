"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import "@/styles/forge/pages.css";

import {
  INTEGRATION_CATEGORIES,
  integrationCategoryKey,
  integrationLogoSrc,
} from "@/components/app/integrations";
import { IntegrationLogo } from "@/components/IntegrationLogo";
import { AppShell } from "@/components/shell/AppShell";
import { FilterChip, Tag } from "@/components/ui/Badge";
import { Glyph } from "@/components/ui/glyph";
import { SearchInput } from "@/components/ui/Input";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  type CachedIntegration,
  ensureIntegrations,
  getCachedIntegrations,
  subscribeIntegrations,
} from "@/lib/lists-cache";

export default function IntegrationsPage() {
  const { t, locale } = useI18n();
  // Starts empty on both server and client (the cache lives in sessionStorage),
  // then fills from the cache right after hydration.
  const [items, setItems] = useState<CachedIntegration[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  // `?cat=` deep links (read once, kept in sync without a navigation).
  useEffect(() => {
    const cat = new URLSearchParams(window.location.search).get("cat");
    if (cat) setCategory(cat);
  }, []);

  function chooseCategory(next: string) {
    setCategory(next);
    const url = next === "all" ? "/integrations" : `/integrations?cat=${encodeURIComponent(next)}`;
    window.history.replaceState(null, "", url);
  }

  useEffect(() => subscribeIntegrations(() => setItems(getCachedIntegrations(locale) || [])), [locale]);

  useEffect(() => {
    let cancelled = false;
    const cached = getCachedIntegrations(locale);
    if (cached?.length) setItems(cached);
    setLoading(true);
    void ensureIntegrations(locale)
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) for (const c of item.categories) map.set(c, (map.get(c) || 0) + 1);
    return map;
  }, [items]);

  const categories = useMemo(() => {
    const order = INTEGRATION_CATEGORIES as readonly string[];
    const known = order.filter((c) => counts.has(c));
    const extra = [...counts.keys()].filter((c) => !order.includes(c)).sort();
    return [...known, ...extra];
  }, [counts]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== "all" && !item.categories.includes(category)) return false;
      if (!needle) return true;
      return `${item.id} ${item.name} ${item.title} ${item.blurb} ${item.categories.join(" ")}`
        .toLowerCase()
        .includes(needle);
    });
  }, [items, query, category]);

  const catLabel = (c: string) => {
    const key = integrationCategoryKey(c);
    return key ? t(key) : c;
  };

  return (
    <AppShell active="integrations" title={t("uiNavIntegrations")}>
      <div className="f-page-head">
        <div>
          <h1>{t("integTitle")}</h1>
          <p>{t("apIntegLead")}</p>
        </div>
      </div>
      <div className="f-toolbar">
        <div className="f-chip-row" role="group" aria-label={t("integCategories")}>
          <FilterChip pressed={category === "all"} count={items.length} onClick={() => chooseCategory("all")}>
            {t("integAll")}
          </FilterChip>
          {categories.map((c) => (
            <FilterChip key={c} pressed={category === c} count={counts.get(c) || 0} onClick={() => chooseCategory(c)}>
              {catLabel(c)}
            </FilterChip>
          ))}
        </div>
        <span className="f-toolbar-spacer" />
        <SearchInput
          label={t("apSearchIntegrations")}
          placeholder={t("apSearchIntegrations")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading && items.length === 0 ? (
        <div className="f-integ-grid" aria-busy="true" aria-label={t("loading")}>
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="f-skel" style={{ height: 176, borderRadius: 20 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="f-empty">
          <Glyph name="puzzle" size="lg" />
          <p>{t("integEmpty")}</p>
        </div>
      ) : (
        <div className="f-integ-grid">
          {filtered.map((item) => (
            <article key={item.id} className="f-integ">
              <Link
                href={`/integrations/${encodeURIComponent(item.id)}`}
                className="f-integ-link"
                aria-label={`${t("apIntegView")}: ${item.title || item.name}`}
              />
              <span className="lg" aria-hidden="true">
                <IntegrationLogo
                  src={integrationLogoSrc(item.id, item.logo_url)}
                  label={item.title || item.name}
                  width={28}
                  height={28}
                />
              </span>
              <b>{item.title || item.name}</b>
              <p>{item.blurb}</p>
              <div className="foot">
                <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {item.categories.slice(0, 2).map((c) => (
                    <Tag key={c}>{catLabel(c)}</Tag>
                  ))}
                </span>
                {item.access === "partial" ? <Tag tone="warn">{t("integPartial")}</Tag> : null}
                {item.badge ? <Tag tone="orange">{item.badge}</Tag> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}
