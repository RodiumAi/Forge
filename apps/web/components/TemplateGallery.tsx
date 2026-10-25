"use client";

import { useMemo, useState } from "react";
import { BookOpen, Monitor, Palette, Presentation, Search, Smartphone, type LucideIcon } from "lucide-react";
import { TemplateThumb } from "@/components/templates/TemplateThumb";
import { TemplatePreviewModal } from "@/components/TemplatePreviewModal";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { getKind, normalizeKind, useEnabledKinds, type ProjectKindId } from "@/lib/kinds";

const KIND_ICONS: Record<ProjectKindId, LucideIcon> = {
  web: Monitor,
  mobile: Smartphone,
  slides: Presentation,
  codelab: BookOpen,
  design_system: Palette,
};

export type GalleryTemplate = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  boot_hint: string;
  accent: string | null;
  bg: string | null;
  preview_url?: string | null;
  /** Pre-rendered card image (preview.png), preferred over preview_url. */
  preview_image_url?: string | null;
  kind?: ProjectKindId;
  /** Lowest Forge plan that may use the kit: null (Free), "starter" or "builder". */
  required_plan?: "starter" | "builder" | null;
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
  /** Controlled kind filter (the home's type tiles drive it); internal state otherwise. */
  kind?: ProjectKindId;
  onKindChange?: (kind: ProjectKindId) => void;
  /** Search the gallery opens with (remount with a new `key` to apply another). */
  initialQuery?: string;
};

export function TemplateGallery({
  templates,
  onSelect,
  busyId,
  useError = null,
  limit = null,
  variant = "home",
  onBrowseAll,
  kind: kindProp,
  onKindChange,
  initialQuery = "",
}: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState(initialQuery);
  const [expanded, setExpanded] = useState(limit == null);
  const [kindState, setKindState] = useState<ProjectKindId>(kindProp ?? "web");
  const kind = kindProp ?? kindState;
  const setKind = (next: ProjectKindId) => {
    if (kindProp === undefined) setKindState(next);
    onKindChange?.(next);
  };
  const enabledKinds = useEnabledKinds();
  // Web and mobile always show; another kind once it is on and has kits.
  const kindTabs = useMemo(
    () =>
      enabledKinds.filter(
        (id) =>
          id === "web" ||
          id === "mobile" ||
          id === kindProp ||
          templates.some((tpl) => normalizeKind(tpl.kind) === id),
      ),
    [enabledKinds, templates, kindProp],
  );
  const [selected, setSelected] = useState<GalleryTemplate | null>(null);

  const byKind = useMemo(
    () => templates.filter((tpl) => normalizeKind(tpl.kind) === kind),
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
          {kindTabs.map((id) => (
            <button
              key={id}
              type="button"
              className={kind === id ? "active" : undefined}
              aria-pressed={kind === id}
              onClick={() => setKind(id)}
            >
              <Icon icon={KIND_ICONS[id]} className="ui-icon-sm" />
              <span>{t(getKind(id).galleryLabelKey)}</span>
            </button>
          ))}
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
        <p className="tpl-gallery-empty">
          {kind === "mobile" ? t("templatesKindEmptyApp") : t("noTemplates")}
        </p>
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
                <TemplateThumb template={tpl} viewportWidth={480} viewportHeight={300} className="home-card-thumb tpl-card-thumb" />
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
