"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { SiteThumb } from "@/components/SiteThumb";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";

export type GalleryTemplate = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  boot_hint: string;
  accent: string | null;
  bg: string | null;
  preview_url?: string | null;
};

type Props = {
  templates: GalleryTemplate[];
  onSelect: (tpl: GalleryTemplate) => void;
  busyId?: string | null;
  /** Show only first N on landing; null = all */
  limit?: number | null;
  variant?: "home" | "landing";
  onBrowseAll?: () => void;
};

export function TemplateGallery({
  templates,
  onSelect,
  busyId,
  limit = null,
  variant = "home",
  onBrowseAll,
}: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(limit == null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = templates;
    if (q) {
      list = list.filter(
        (tpl) =>
          tpl.title.toLowerCase().includes(q) ||
          tpl.description.toLowerCase().includes(q) ||
          tpl.tags.some((tag) => tag.toLowerCase().includes(q)),
      );
    }
    if (!expanded && limit != null) {
      return list.slice(0, limit);
    }
    return list;
  }, [templates, query, expanded, limit]);

  if (!templates.length) return null;

  return (
    <section className={`tpl-gallery tpl-gallery-${variant}`} aria-labelledby="tpl-gallery-title">
      <div className="tpl-gallery-toolbar">
        <label className="tpl-gallery-search">
          <Icon icon={Search} className="ui-icon-sm" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchTemplates")}
            aria-label={t("searchTemplates")}
          />
        </label>
        <span className="tpl-gallery-pill" id="tpl-gallery-title">
          {t("forgeTemplates")}
        </span>
        {limit != null && templates.length > limit && (
          <button
            type="button"
            className="tpl-gallery-browse"
            onClick={() => {
              if (onBrowseAll) onBrowseAll();
              else setExpanded((v) => !v);
            }}
          >
            {expanded ? t("showLess") : t("browseAllTemplates")}
          </button>
        )}
      </div>

      <div className="tpl-gallery-grid">
        {filtered.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            className="home-card tpl-card"
            disabled={Boolean(busyId)}
            onClick={() => onSelect(tpl)}
          >
            <div className="home-card-media">
              <SiteThumb
                src={tpl.preview_url || `/templates/${tpl.id}/preview`}
                viewportWidth={480}
                viewportHeight={300}
                title={tpl.title}
                className="home-card-thumb tpl-card-thumb"
              />
            </div>
            <div className="home-card-body">
              <span className="home-card-avatar" aria-hidden>
                <span>
                  {tpl.title
                    .trim()
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w) => w[0] || "")
                    .join("")
                    .toUpperCase() || "T"}
                </span>
              </span>
              <div className="home-card-meta">
                <strong title={tpl.title}>{tpl.title}</strong>
                <span className="home-card-desc" title={tpl.description}>
                  {busyId === tpl.id ? t("forkingTemplate") : tpl.description}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
