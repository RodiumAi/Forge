"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Day = { day: string; page_views: number; unique_visitors: number };
type Analytics = {
  days: Day[];
  page_views: number;
  unique_visitors: number;
  top_pages: { path: string; views: number }[];
};

type Props = {
  projectId: string;
  published: boolean;
  onError: (msg: string) => void;
};

const RANGES = [7, 30, 90] as const;

/** Cookie-free visit counts of the published site (views, daily unique visitors). */
export function AudienceSection({ projectId, published, onError }: Props) {
  const { t, locale } = useI18n();
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  const [data, setData] = useState<Analytics | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await api<Analytics>(`/projects/${projectId}/analytics?days=${range}`);
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) onErrorRef.current(err instanceof Error ? err.message : t("errorGeneric"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, range, t]);

  const peak = useMemo(() => Math.max(1, ...(data?.days || []).map((d) => d.page_views)), [data]);
  const fmt = useMemo(() => new Intl.NumberFormat(locale === "en" ? "en-US" : "fr-FR"), [locale]);

  return (
    <div className="options-card options-stack">
      <p className="options-help">{published ? t("audienceHelp") : t("audienceUnpublished")}</p>
      <div className="audience-range" role="group" aria-label={t("audienceRange")}>
        {RANGES.map((value) => (
          <button
            key={value}
            type="button"
            className={`btn btn-ghost btn-sm ${range === value ? "active" : ""}`}
            aria-pressed={range === value}
            onClick={() => setRange(value)}
          >
            {t("audienceDays").replace("{n}", String(value))}
          </button>
        ))}
      </div>

      <div className="audience-totals">
        <div>
          <span>{t("audienceViews")}</span>
          <strong>{fmt.format(data?.page_views ?? 0)}</strong>
        </div>
        <div>
          <span>{t("audienceVisitors")}</span>
          <strong>{fmt.format(data?.unique_visitors ?? 0)}</strong>
        </div>
      </div>

      <div className="audience-chart" role="img" aria-label={t("audienceChartLabel")}>
        {(data?.days || []).map((d) => (
          <span
            key={d.day}
            className="audience-bar"
            style={{ height: `${Math.round((d.page_views / peak) * 100)}%` }}
            title={`${d.day}: ${d.page_views} / ${d.unique_visitors}`}
          />
        ))}
      </div>

      {data && data.top_pages.length > 0 && (
        <div className="options-seo-block">
          <h4>{t("audienceTopPages")}</h4>
          <ul className="audience-pages">
            {data.top_pages.map((page) => (
              <li key={page.path}>
                <code>{page.path}</code>
                <strong>{fmt.format(page.views)}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
