"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import "@/styles/forge/pages.css";

import { AppShell } from "@/components/shell/AppShell";
import { APP_ROUTES } from "@/components/shell/nav";
import type { GalleryTemplate } from "@/components/TemplateGallery";
import { TemplateCard } from "@/components/templates/TemplateCard";
import { FilterChip } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Tabs";
import { getToken } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { kindStyle } from "@/lib/kind-style";
import { normalizeKind, useEnabledKinds, type ProjectKindId } from "@/lib/kinds";
import { ensureTemplates, getCachedTemplates } from "@/lib/lists-cache";
import { isPremiumTemplate } from "@/lib/template-access";

const STEP = 12;
const KIND_ORDER: ProjectKindId[] = ["slides", "web", "mobile", "codelab", "design_system"];

/** "All": the first six of each kind in turn, then the rest (the gallery opens on a mix). */
function mixTemplates(templates: GalleryTemplate[], kinds: readonly ProjectKindId[]): GalleryTemplate[] {
  const byKind = KIND_ORDER.filter((k) => kinds.includes(k)).map((k) =>
    templates.filter((tpl) => normalizeKind(tpl.kind) === k),
  );
  return [...byKind.flatMap((list) => list.slice(0, 6)), ...byKind.flatMap((list) => list.slice(6))];
}

type Access = "all" | "free" | "premium";

function accessFromParam(raw: string | null): Access {
  return raw === "free" || raw === "premium" ? raw : "all";
}

function kindFromParam(raw: string | null): ProjectKindId | "all" {
  return raw && raw !== "all" ? normalizeKind(raw) : "all";
}

function TemplatesInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { t, locale } = useI18n();
  const enabledKinds = useEnabledKinds();
  const [templates, setTemplates] = useState<GalleryTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<ProjectKindId | "all">(() => kindFromParam(params.get("kind")));
  const [access, setAccess] = useState<Access>(() => accessFromParam(params.get("access")));
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(STEP);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/");
      return;
    }
    const warm = getCachedTemplates(locale);
    if (warm) {
      setTemplates(warm as GalleryTemplate[]);
      setLoading(false);
    }
    let alive = true;
    void ensureTemplates(locale)
      .then((list) => alive && setTemplates(list as GalleryTemplate[]))
      .catch(() => undefined)
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [locale, router]);

  useEffect(() => {
    setKind(kindFromParam(params.get("kind")));
    setAccess(accessFromParam(params.get("access")));
  }, [params]);
  useEffect(() => setLimit(STEP), [kind, query, access]);

  function syncUrl(nextKind: ProjectKindId | "all", nextAccess: Access) {
    const q = new URLSearchParams();
    if (nextKind !== "all") q.set("kind", nextKind);
    if (nextAccess !== "all") q.set("access", nextAccess);
    const qs = q.toString();
    router.replace(qs ? `${APP_ROUTES.templates}?${qs}` : APP_ROUTES.templates, { scroll: false });
  }

  function chooseKind(next: ProjectKindId | "all") {
    setKind(next);
    syncUrl(next, access);
  }

  function chooseAccess(next: Access) {
    setAccess(next);
    syncUrl(kind, next);
  }

  const enabled = useMemo(
    () => templates.filter((tpl) => enabledKinds.includes(normalizeKind(tpl.kind))),
    [templates, enabledKinds],
  );
  const accessCounts = useMemo(() => {
    const premium = enabled.filter(isPremiumTemplate).length;
    return { all: enabled.length, free: enabled.length - premium, premium };
  }, [enabled]);
  const available = useMemo(
    () => (access === "all" ? enabled : enabled.filter((tpl) => isPremiumTemplate(tpl) === (access === "premium"))),
    [enabled, access],
  );
  const counts = useMemo(() => {
    const out: Partial<Record<ProjectKindId, number>> = {};
    for (const tpl of available) out[normalizeKind(tpl.kind)] = (out[normalizeKind(tpl.kind)] ?? 0) + 1;
    return out;
  }, [available]);
  const list = useMemo(() => {
    const pool = kind === "all" ? mixTemplates(available, enabledKinds) : available.filter((tpl) => normalizeKind(tpl.kind) === kind);
    const q = query.trim().toLowerCase();
    if (!q) return pool;
    return pool.filter((tpl) => `${tpl.title} ${tpl.description} ${(tpl.tags || []).join(" ")}`.toLowerCase().includes(q));
  }, [available, enabledKinds, kind, query]);

  return (
    <AppShell active="templates" title={t("uiNavTemplates")}>
      <div className="f-page-head">
        <div>
          <h1>{t("apTemplatesTitle")}</h1>
          <p>{t("apTemplatesLead")}</p>
        </div>
      </div>
      <div className="f-toolbar">
        <div className="f-chip-row" role="group" aria-label={t("apFilterKind")}>
          <FilterChip pressed={kind === "all"} count={available.length} onClick={() => chooseKind("all")}>
            {t("apAll")}
          </FilterChip>
          {KIND_ORDER.filter((k) => enabledKinds.includes(k)).map((k) => (
            <FilterChip key={k} pressed={kind === k} dot={kindStyle(k).color} count={counts[k] ?? 0} onClick={() => chooseKind(k)}>
              {t(kindStyle(k).labelKey)}
            </FilterChip>
          ))}
        </div>
        <span className="f-toolbar-spacer" />
        <Segmented<Access>
          label={t("apFilterAccess")}
          value={access}
          onChange={chooseAccess}
          items={[
            { id: "all", label: t("apAll") },
            { id: "free", label: `${t("apAccessFree")} · ${accessCounts.free}` },
            { id: "premium", label: `${t("apAccessPremium")} · ${accessCounts.premium}` },
          ]}
        />
        <SearchInput
          label={t("apSearchTemplates")}
          placeholder={t("apSearchTemplates")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="f-paper f-paper-band">
        {loading && !templates.length ? (
          <div className="f-tgrid" aria-busy="true" aria-label={t("loading")}>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="f-skel" style={{ aspectRatio: "16 / 9", borderRadius: 20 }} />
            ))}
          </div>
        ) : list.length ? (
          <div className="f-tgrid">
            {list.slice(0, limit).map((tpl, i) => (
              <TemplateCard
                key={tpl.id}
                template={tpl}
                index={i % STEP}
                href={`${APP_ROUTES.templates}/${encodeURIComponent(tpl.id)}`}
              />
            ))}
          </div>
        ) : (
          <p className="f-note" style={{ textAlign: "center", padding: 30, color: "var(--f-paper-muted)" }}>
            {t("apNoTemplateMatches")}
          </p>
        )}
        {list.length > limit ? (
          <div className="f-more-row">
            <Button variant="dark" onClick={() => setLimit((n) => n + STEP)}>
              {t("apMoreTemplates")}
            </Button>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

export default function TemplatesPage() {
  return (
    <Suspense fallback={null}>
      <TemplatesInner />
    </Suspense>
  );
}
