"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plug, Search } from "lucide-react";
import { ConnectorLogo } from "@/components/ConnectorLogo";
import { HomeLayout } from "@/components/HomeLayout";
import { Icon } from "@/components/ui/icon";
import { api, getToken } from "@/lib/api";
import { CONNECTOR_LOGOS } from "@/lib/connectors/logos";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Connector = {
  id: string;
  name: string;
  category: string;
  description: string;
  use_case: string;
  auth_type: string;
  configured: boolean;
  supports_test: boolean;
  managed?: boolean;
  removable?: boolean;
  credentials_hint: string | null;
  warning?: string | null;
  fallback_provider?: string | null;
};

type StatusFilter = "all" | "enabled";
type SortMode = "popular" | "name";

const CATEGORY_ORDER = ["ai", "database", "auth", "email", "payments", "media"] as const;
const HERO_DISMISSED_KEY = "forge_connectors_hero_dismissed";

function categoryLabel(category: string, t: ReturnType<typeof useI18n>["t"]) {
  const map: Record<string, string> = {
    ai: t("connectorCategoryAi"),
    database: t("connectorCategoryDatabase"),
    auth: t("connectorCategoryAuth"),
    email: t("connectorCategoryEmail"),
    payments: t("connectorCategoryPayments"),
    media: t("connectorCategoryMedia"),
  };
  return map[category] || category;
}

export default function ConnectorsPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("popular");
  const [heroDismissed, setHeroDismissed] = useState(false);

  useEffect(() => {
    setHeroDismissed(localStorage.getItem(HERO_DISMISSED_KEY) === "1");
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/");
      return;
    }
    setLoading(true);
    api<Connector[]>("/connectors", {}, locale)
      .then(setConnectors)
      .catch((err) => {
        const message = err instanceof Error ? err.message : t("errorGeneric");
        if (/invalid token|not authenticated|unauthorized/i.test(message)) return;
        if (message.toLowerCase().includes("not found")) {
          setError(t("connectorsApiMissing"));
          return;
        }
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [locale, router, t]);

  const enabledCount = useMemo(
    () => connectors.filter((connector) => connector.configured).length,
    [connectors],
  );

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const connector of connectors) {
      counts.set(connector.category, (counts.get(connector.category) || 0) + 1);
    }
    return counts;
  }, [connectors]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    let items = connectors.filter((connector) => {
      if (statusFilter === "enabled" && !connector.configured) return false;
      if (categoryFilter && connector.category !== categoryFilter) return false;
      if (!normalizedQuery) return true;
      const haystack = `${connector.name} ${connector.description} ${connector.use_case}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });

    if (sortMode === "name") {
      items = [...items].sort((a, b) => a.name.localeCompare(b.name));
    } else {
      const order = new Map(CATEGORY_ORDER.map((cat, index) => [cat, index]));
      items = [...items].sort(
        (a, b) => (order.get(a.category as (typeof CATEGORY_ORDER)[number]) ?? 99) - (order.get(b.category as (typeof CATEGORY_ORDER)[number]) ?? 99),
      );
    }

    return items;
  }, [categoryFilter, connectors, query, sortMode, statusFilter]);

  function dismissHero() {
    localStorage.setItem(HERO_DISMISSED_KEY, "1");
    setHeroDismissed(true);
  }

  return (
    <HomeLayout activeNav="connectors" fillMain>
      <div className="connectors-page">
        <div className="connectors-panel">
          <header className="connectors-panel-head">
            <div className="connectors-panel-title">
              <span className="connectors-panel-icon" aria-hidden>
                <Icon icon={Plug} />
              </span>
              <h1>{t("connectorsTitle")}</h1>
            </div>
            <label className="connectors-sort">
              <span className="sr-only">{t("connectorsSortPopular")}</span>
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
              >
                <option value="popular">{t("connectorsSortPopular")}</option>
                <option value="name">{t("connectorsSortName")}</option>
              </select>
            </label>
          </header>

          <div className="connectors-panel-body">
            <aside className="connectors-filters">
              <label className="connectors-search">
                <Icon icon={Search} className="connectors-search-icon" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("connectorsSearchPlaceholder")}
                />
              </label>

              <div className="connectors-filter-tabs">
                <button
                  type="button"
                  className={statusFilter === "enabled" ? "active" : ""}
                  onClick={() => setStatusFilter("enabled")}
                >
                  {t("connectorsFilterEnabled")}
                  <span>{enabledCount}</span>
                </button>
                <button
                  type="button"
                  className={statusFilter === "all" ? "active" : ""}
                  onClick={() => setStatusFilter("all")}
                >
                  {t("connectorsFilterAll")}
                  <span>{connectors.length}</span>
                </button>
              </div>

              <div className="connectors-categories">
                <p>{t("connectorsCategories")}</p>
                <button
                  type="button"
                  className={categoryFilter === null ? "active" : ""}
                  onClick={() => setCategoryFilter(null)}
                >
                  {t("connectorsFilterAll")}
                  <span>{connectors.length}</span>
                </button>
                {CATEGORY_ORDER.filter((cat) => categoryCounts.has(cat)).map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={categoryFilter === category ? "active" : ""}
                    onClick={() => setCategoryFilter(category)}
                  >
                    {categoryLabel(category, t)}
                    <span>{categoryCounts.get(category) || 0}</span>
                  </button>
                ))}
              </div>

              <div className="connectors-filters-foot">
                <p>{t("connectorsMissing")}</p>
                <button type="button" className="connectors-request-btn">
                  {t("connectorsRequest")}
                </button>
              </div>
            </aside>

            <main className="connectors-content">
              {loading && <p className="home-settings-loading">{t("loading")}</p>}
              {error && <p className="error home-settings-feedback">{error}</p>}

              {!loading && !error && (
                <>
                  {!heroDismissed && (
                    <section className="connectors-hero">
                      <div className="connectors-hero-logos" aria-hidden>
                        {Object.keys(CONNECTOR_LOGOS).map((id, index) => (
                          <div
                            key={id}
                            className="connectors-hero-logo"
                            style={{ zIndex: index + 1 }}
                          >
                            <ConnectorLogo id={id} size={index === 2 ? 44 : 36} />
                          </div>
                        ))}
                      </div>
                      <h2>{t("connectorsHeroTitle")}</h2>
                      <p>{t("connectorsHeroBody")}</p>
                      <button type="button" className="connectors-hero-btn" onClick={dismissHero}>
                        {t("connectorsGotIt")}
                      </button>
                    </section>
                  )}

                  <div className="connectors-list">
                    {filtered.map((connector) => (
                      <Link
                        key={connector.id}
                        href={`/connectors/${connector.id}`}
                        className="connectors-row-card"
                      >
                        <div className="connectors-row-logo">
                          <ConnectorLogo id={connector.id} size={44} />
                          {connector.configured && (
                            <span className="connectors-row-status" title={t("connectorConfigured")} />
                          )}
                        </div>
                        <div className="connectors-row-copy">
                          <strong>
                            {connector.name}
                            {connector.managed ? (
                              <span className="connectors-managed-tag"> {t("connectorManaged")}</span>
                            ) : null}
                          </strong>
                          <span>{connector.description}</span>
                          {connector.warning ? (
                            <em className="connectors-warning">{connector.warning}</em>
                          ) : null}
                        </div>
                      </Link>
                    ))}
                  </div>

                  {!filtered.length && (
                    <p className="connectors-empty">{t("connectorsEmpty")}</p>
                  )}
                </>
              )}
            </main>
          </div>
        </div>
      </div>
    </HomeLayout>
  );
}
