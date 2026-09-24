"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, MessageSquare } from "lucide-react";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import { HomeLayout } from "@/components/HomeLayout";
import { IntegrationLogo } from "@/components/IntegrationLogo";
import { Icon } from "@/components/ui/icon";
import { api, apiBase } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Detail = {
  id: string;
  name: string;
  title: string;
  blurb: string;
  categories: string[];
  access: "yes";
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

  const logoPath =
    detail?.logo_url?.startsWith("http")
      ? detail.logo_url
      : `${apiBase()}${detail?.logo_url || `/integrations/${id}/logo`}`;
  const logo = logoPath.includes("?") ? `${logoPath}&v=4` : `${logoPath}?v=4`;

  return (
    <HomeLayout activeNav="integrations">
      <div className="integ-detail">
        <Link href="/integrations" className="integ-back">
          <Icon icon={ArrowLeft} />
          {t("integBack")}
        </Link>

        {loading ? (
          <p className="integ-empty">{t("loading")}</p>
        ) : error || !detail ? (
          <p className="integ-empty">{error || t("integNotFound")}</p>
        ) : (
          <div className="integ-detail-layout">
            <aside className="integ-detail-aside">
              <div className="integ-detail-brand">
                <span className="integ-detail-logo" aria-hidden>
                  <IntegrationLogo
                    src={logo}
                    label={detail.title || detail.name}
                    width={40}
                    height={40}
                  />
                </span>
                <div>
                  <h1>{detail.title}</h1>
                  <p className="integ-detail-blurb">{detail.blurb}</p>
                </div>
              </div>

              <div className="integ-detail-meta">
                <span className="integ-badge">{t("integAccessYes")}</span>
                {detail.categories.map((c) => (
                  <span key={c} className="integ-chip">
                    {c}
                  </span>
                ))}
                {detail.methods.map((m) => (
                  <span key={m} className="integ-chip">
                    {m}
                  </span>
                ))}
              </div>

              <div className="integ-detail-actions">
                <Link href="/dashboard" className="btn integ-cta">
                  <Icon icon={MessageSquare} />
                  {t("integOpenChat")}
                </Link>
                {detail.docs_url ? (
                  <a
                    href={detail.docs_url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-ghost integ-cta"
                  >
                    <Icon icon={ExternalLink} />
                    {t("integOfficialDocs")}
                  </a>
                ) : null}
              </div>
            </aside>

            <article className="integ-guide">
              <ChatMarkdown content={detail.guide_md || ""} />
            </article>
          </div>
        )}
      </div>
    </HomeLayout>
  );
}
