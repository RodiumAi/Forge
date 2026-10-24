"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import "@/styles/forge/pages.css";

import {
  integrationCategoryKey,
  integrationLogoSrc,
  integrationMethodKey,
} from "@/components/app/integrations";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import { IntegrationLogo } from "@/components/IntegrationLogo";
import { AppShell } from "@/components/shell/AppShell";
import { Tag } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Card";
import { Glyph } from "@/components/ui/glyph";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { type CachedIntegration, ensureIntegrations, getCachedIntegrations } from "@/lib/lists-cache";

type Detail = {
  id: string;
  name: string;
  title: string;
  blurb: string;
  categories: string[];
  access: "yes" | "partial";
  methods: string[];
  docs_url?: string | null;
  badge?: string | null;
  logo_url?: string | null;
  guide_md: string;
  guide_url?: string | null;
};

export default function IntegrationDetailPage() {
  const { t, locale } = useI18n();
  const params = useParams<{ id: string }>();
  const id = params?.id || "";
  const [detail, setDetail] = useState<Detail | null>(null);
  const [all, setAll] = useState<CachedIntegration[]>(() => getCachedIntegrations(locale) || []);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void api<Detail>(`/integrations/${encodeURIComponent(id)}`, {}, locale)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch(() => {
        if (!cancelled) {
          setDetail(null);
          setError(t("integNotFound"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, locale, t]);

  useEffect(() => {
    let cancelled = false;
    void ensureIntegrations(locale)
      .then((list) => {
        if (!cancelled) setAll(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const related = useMemo(() => {
    if (!detail) return [];
    return all
      .filter((it) => it.id !== detail.id && it.categories.some((c) => detail.categories.includes(c)))
      .slice(0, 4);
  }, [all, detail]);

  const title = detail?.title || detail?.name || id;
  const logo = integrationLogoSrc(id, detail?.logo_url);
  const useHref = `/dashboard?prompt=${encodeURIComponent(t("apIntegPrompt").replace("{name}", title))}`;
  const catLabel = (c: string) => {
    const key = integrationCategoryKey(c);
    return key ? t(key) : c;
  };

  return (
    <AppShell active="integrations" title={t("uiNavIntegrations")}>
      <nav className="f-crumbs" aria-label={t("apBreadcrumb")}>
        <Link href="/integrations">{t("integTitle")}</Link>
        <Glyph name="chevron-right" size="sm" />
        <span aria-current="page">{title}</span>
      </nav>

      {loading ? (
        <div style={{ display: "grid", gap: 16, marginTop: 18 }} aria-busy="true" aria-label={t("loading")}>
          <span className="f-skel" style={{ height: 96 }} />
          <span className="f-skel" style={{ height: 320 }} />
        </div>
      ) : error || !detail ? (
        <div className="f-empty">
          <Glyph name="puzzle" size="lg" />
          <p>{error || t("integNotFound")}</p>
          <Button variant="ghost" href="/integrations" icon="arrow-left">
            {t("integBack")}
          </Button>
        </div>
      ) : (
        <>
          <header className="f-idet-head">
            <span className="lg" aria-hidden="true">
              <IntegrationLogo src={logo} label={title} width={44} height={44} />
            </span>
            <div className="t">
              <h1>{title}</h1>
              <div className="meta">
                {detail.categories.map((c) => (
                  <Tag key={c}>{catLabel(c)}</Tag>
                ))}
                {detail.access === "partial" ? (
                  <Tag tone="warn">{t("integPartial")}</Tag>
                ) : (
                  <Tag tone="ok" icon="check">
                    {t("integAccessYes")}
                  </Tag>
                )}
                {detail.badge ? <Tag tone="orange">{detail.badge}</Tag> : null}
              </div>
            </div>
            <div className="acts">
              {detail.docs_url ? (
                <Button variant="ghost" href={detail.docs_url} external>
                  {t("integOfficialDocs")}
                </Button>
              ) : null}
              <Button href={useHref} icon="sparkles">
                {t("apIntegUse")}
              </Button>
            </div>
          </header>

          <div className="f-idet">
            <div className="f-idet-main">
              <Panel title={t("apIntegAbout")}>
                <p style={{ color: "var(--f-muted)", marginTop: 6 }}>{detail.blurb}</p>
                {detail.methods.length ? (
                  <>
                    <h4 style={{ marginTop: 18, fontSize: 15 }}>{t("apIntegHow")}</h4>
                    <ul className="f-does">
                      {detail.methods.map((m) => {
                        const key = integrationMethodKey(m);
                        return (
                          <li key={m}>
                            <Glyph name="check" size="sm" />
                            <span>{key ? t(key) : m}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : null}
                <div className="f-idet-demo" aria-hidden="true">
                  <div className="f-mini-site">
                    <i style={{ width: "40%" }} />
                    <i style={{ width: "70%" }} />
                    <i style={{ width: "55%" }} />
                    <span className="lg">
                      <IntegrationLogo src={logo} label={title} width={24} height={24} />
                    </span>
                  </div>
                </div>
              </Panel>

              {detail.guide_md ? (
                <Panel title={t("apIntegSetup")}>
                  <div className="f-guide">
                    <ChatMarkdown content={detail.guide_md} />
                  </div>
                </Panel>
              ) : null}
            </div>

            <aside className="f-idet-side">
              <Panel title={t("apIntegAccess")}>
                <p style={{ color: "var(--f-muted)", marginTop: 6, fontSize: 14.5 }}>
                  {detail.access === "partial" ? t("apIntegAccessPartial") : t("apIntegAccessFull")}
                </p>
                <p className="f-note" style={{ marginTop: 10 }}>
                  {t("apIntegNoConfig")}
                </p>
              </Panel>

              {detail.docs_url || detail.guide_url ? (
                <Panel title={t("apIntegResources")}>
                  {detail.docs_url ? (
                    <a className="f-side-res" href={detail.docs_url} target="_blank" rel="noreferrer">
                      <Glyph name="book" size="sm" />
                      {t("integOfficialDocs")}
                      <Glyph name="arrow-right" size="sm" />
                    </a>
                  ) : null}
                  {detail.guide_url ? (
                    <a className="f-side-res" href={detail.guide_url} target="_blank" rel="noreferrer">
                      <Glyph name="file" size="sm" />
                      {t("apIntegGuideSource")}
                      <Glyph name="arrow-right" size="sm" />
                    </a>
                  ) : null}
                </Panel>
              ) : null}

              {related.length ? (
                <Panel title={t("apIntegRelated")}>
                  {related.map((it) => (
                    <Link key={it.id} className="f-side-res" href={`/integrations/${encodeURIComponent(it.id)}`}>
                      <IntegrationLogo
                        src={integrationLogoSrc(it.id, it.logo_url)}
                        label={it.title || it.name}
                        width={20}
                        height={20}
                      />
                      {it.title || it.name}
                      <Glyph name="chevron-right" size="sm" />
                    </Link>
                  ))}
                </Panel>
              ) : null}
            </aside>
          </div>
        </>
      )}
    </AppShell>
  );
}
