"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { HomeLayout } from "@/components/HomeLayout";
import { IntegrationLogo } from "@/components/IntegrationLogo";
import { Icon } from "@/components/ui/icon";
import { apiBase } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  CachedIntegration,
  ensureIntegrations,
  getCachedIntegrations,
  subscribeIntegrations,
} from "@/lib/lists-cache";

const CATEGORY_ORDER = [
  "forms",
  "booking",
  "chat",
  "payments",
  "data",
  "email",
  "maps",
  "media",
  "comments",
  "analytics",
  "widgets",
] as const;

function categoryLabel(cat: string, t: (key: string) => string): string {
  const known = {
    forms: "integCat_forms",
    booking: "integCat_booking",
    chat: "integCat_chat",
    payments: "integCat_payments",
    data: "integCat_data",
    email: "integCat_email",
    maps: "integCat_maps",
    media: "integCat_media",
    comments: "integCat_comments",
    analytics: "integCat_analytics",
    widgets: "integCat_widgets",
  } as const;
  const key = known[cat as keyof typeof known];
  if (!key) return cat;
  return t(key);
}

function logoSrc(item: CachedIntegration): string {
  const path = item.logo_url || `/integrations/${item.id}/logo`;
  // Bust long-lived browser caches when logos are replaced on disk.
  const withV = path.includes("?") ? `${path}&v=4` : `${path}?v=4`;
  if (withV.startsWith("http")) return withV;
  return `${apiBase()}${withV}`;
}

export default function IntegrationsPage() {
  const { t, locale } = useI18n();
  const [items, setItems] = useState<CachedIntegration[]>(
    () => getCachedIntegrations(locale) || [],
  );
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | "all">("all");
  const [loading, setLoading] = useState(items.length === 0);

  useEffect(() => {
    return subscribeIntegrations(() => {
      setItems(getCachedIntegrations(locale) || []);
    });
  }, [locale]);

  useEffect(() => {
    let cancelled = false;
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
    for (const item of items) {
      for (const c of item.categories) {
        map.set(c, (map.get(c) || 0) + 1);
      }
    }
    return map;
  }, [items]);

  const categories = useMemo(() => {
    const known = CATEGORY_ORDER.filter((c) => counts.has(c));
    const extra = [...counts.keys()]
      .filter((c) => !CATEGORY_ORDER.includes(c as (typeof CATEGORY_ORDER)[number]))
      .sort();
    return [...known, ...extra];
  }, [counts]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== "all" && !item.categories.includes(category)) return false;
      if (!needle) return true;
      return (
        item.id.includes(needle) ||
        item.name.toLowerCase().includes(needle) ||
        item.title.toLowerCase().includes(needle) ||
        item.blurb.toLowerCase().includes(needle) ||
        item.categories.some((c) => c.includes(needle))
      );
    });
  }, [items, query, category]);

  return (
    <HomeLayout activeNav="integrations">
      <div className="integ-page">
        <header className="integ-hero">
          <h1>{t("integTitle")}</h1>
          <p>{t("integSubtitle")}</p>
        </header>

        <div className="integ-layout">
          <aside className="integ-filters" aria-label={t("integFilters")}>
            <label className="integ-search">
              <Icon icon={Search} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("integSearch")}
              />
            </label>

            <div className="integ-filter-group">
              <p className="integ-filter-label">{t("integCategories")}</p>
              <button
                type="button"
                className={`integ-filter-btn ${category === "all" ? "active" : ""}`}
                onClick={() => setCategory("all")}
              >
                <span>{t("integAll")}</span>
                <span className="integ-filter-count">{items.length}</span>
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`integ-filter-btn ${category === cat ? "active" : ""}`}
                  onClick={() => setCategory(cat)}
                >
                  <span>{categoryLabel(cat, t as (key: string) => string)}</span>
                  <span className="integ-filter-count">{counts.get(cat) || 0}</span>
                </button>
              ))}
            </div>
          </aside>

          <section className="integ-grid-wrap">
            {loading && items.length === 0 ? (
              <p className="integ-empty">{t("loading")}</p>
            ) : filtered.length === 0 ? (
              <p className="integ-empty">{t("integEmpty")}</p>
            ) : (
              <div className="integ-grid">
                {filtered.map((item) => (
                  <Link
                    key={item.id}
                    href={`/integrations/${item.id}`}
                    className="integ-card"
                  >
                    <span className="integ-card-logo" aria-hidden>
                      <IntegrationLogo
                        src={logoSrc(item)}
                        label={item.title || item.name}
                        width={24}
                        height={24}
                      />
                    </span>
                    <span className="integ-card-body">
                      <span className="integ-card-title-row">
                        <strong>{item.title}</strong>
                        {item.badge ? (
                          <span className="integ-badge">{item.badge}</span>
                        ) : null}
                      </span>
                      <span className="integ-card-blurb">{item.blurb}</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </HomeLayout>
  );
}
