"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { SiteThumb } from "@/components/SiteThumb";
import { TemplatePreviewModal } from "@/components/TemplatePreviewModal";
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
  kind?: "web" | "mobile";
};

type Props = {
  templates: GalleryTemplate[];
  onSelect: (tpl: GalleryTemplate) => void;
  busyId?: string | null;
  /** Gate / fork error shown inside the preview modal (e.g. empty RODI). */
  useError?: string | null;
  /** Show only first N on landing; null = all */
  limit?: number | null;
  variant?: "home" | "landing";
  onBrowseAll?: () => void;
};

export function TemplateGallery({
  templates,
  onSelect,
  busyId,
  useError = null,
  limit = null,
  variant = "home",
  onBrowseAll,
}: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(limit == null);
  const [kind, setKind] = useState<"web" | "mobile">("web");
  const [selected, setSelected] = useState<GalleryTemplate | null>(null);

  const byKind = useMemo(
    () => templates.filter((tpl) => (tpl.kind || "web") === kind),
    [templates, kind],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = byKind;
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
  }, [byKind, query, expanded, limit]);

  if (!templates.length) return null;

  return (
    <section className={`tpl-gallery tpl-gallery-${variant}`} aria-labelledby="tpl-gallery-title">
      <div className="tpl-gallery-toolbar">
        <div className="tpl-kind-switch" role="group" aria-label={t("platformToggleAria")}>
          <button
            type="button"
            className={kind === "web" ? "active" : undefined}
            aria-pressed={kind === "web"}
            onClick={() => setKind("web")}
          >
            {t("templatesKindWeb")}
          </button>
          <button
            type="button"
            className={kind === "mobile" ? "active" : undefined}
            aria-pressed={kind === "mobile"}
            onClick={() => setKind("mobile")}
          >
            {t("templatesKindApp")}
          </button>
        </div>
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
        {limit != null && byKind.length > limit && (
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

      {!byKind.length ? (
        <p className="tpl-gallery-empty">{t("templatesKindEmptyApp")}</p>
      ) : (
        <div className="tpl-gallery-grid">
          {filtered.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              className="home-card tpl-card"
              disabled={Boolean(busyId)}
              onClick={() => setSelected(tpl)}
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
              <div className="home-card-body tpl-card-body">
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
      )}

      {selected ? (
        <TemplatePreviewModal
          template={selected}
          busy={busyId === selected.id}
          alert={useError}
          onClose={() => {
            if (!busyId) setSelected(null);
          }}
          onUse={() => onSelect(selected)}
        />
      ) : null}
    </section>
  );
}
