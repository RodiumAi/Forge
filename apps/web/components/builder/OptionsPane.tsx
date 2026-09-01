"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Download,
  ExternalLink,
  Globe2,
  KeyRound,
  Loader2,
  Palette,
  Save,
  Search,
  Settings2,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { api, apiBase, getToken } from "@/lib/api";
import { removeProject } from "@/lib/lists-cache";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { SeoOptionsSection } from "@/components/builder/SeoOptionsSection";
import { sitesBaseDomain, sitesScheme, sitesUrlForSlug } from "@/lib/sites-url";

type OptionsSection = "general" | "environment" | "brand" | "seo" | "publishing" | "stats" | "danger";

type ProjectStats = {
  slug: string;
  status: string;
  preview_running: boolean;
  published: boolean;
  published_at: string | null;
  sites_url: string | null;
  created_at: string;
  updated_at: string;
  visitors_total: number;
  visitors_7d: number;
  files_count: number;
  messages_count: number;
  agent_runs_count: number;
  comments_count: number;
  storage_bytes: number;
  tracking_ready: boolean;
};

type Props = {
  projectId: string;
  projectName: string;
  projectSlug?: string;
  sitesUrl?: string | null;
  publishedAt?: string | null;
  section?: OptionsSection;
  onSectionChange?: (section: OptionsSection) => void;
  onNameSaved?: (meta: { name: string; slug?: string; sites_url?: string | null }) => void;
  onOpenDesign: () => void;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(value: string | null | undefined, locale: string): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function OptionsPane({
  projectId,
  projectName,
  projectSlug = "",
  sitesUrl = null,
  publishedAt = null,
  section: sectionProp,
  onSectionChange,
  onNameSaved,
  onOpenDesign,
}: Props) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [internalSection, setInternalSection] = useState<OptionsSection>("general");
  const section = sectionProp ?? internalSection;
  const selectSection = (next: OptionsSection) => {
    onSectionChange?.(next);
    if (sectionProp === undefined) setInternalSection(next);
  };
  const [name, setName] = useState(projectName);
  const [slug, setSlug] = useState(projectSlug);
  const [envContent, setEnvContent] = useState("");
  const [envPath, setEnvPath] = useState(".env");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (sectionProp !== undefined) setInternalSection(sectionProp);
  }, [sectionProp]);

  useEffect(() => {
    setName(projectName);
  }, [projectName]);

  useEffect(() => {
    setSlug(projectSlug);
  }, [projectSlug]);

  useEffect(() => {
    let cancelled = false;
    async function loadEnv() {
      for (const path of [".env.local", ".env"]) {
        try {
          const file = await api<{ path: string; content: string }>(
            `/projects/${projectId}/files/content?path=${encodeURIComponent(path)}`,
          );
          if (!cancelled) {
            setEnvPath(path);
            setEnvContent(file.content);
          }
          return;
        } catch {
          /* try next */
        }
      }
      if (!cancelled) {
        setEnvPath(".env");
        setEnvContent("# Forge project env\nVITE_APP_NAME=\n");
      }
    }
    void loadEnv();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (section !== "stats") return;
    let cancelled = false;
    setStatsLoading(true);
    void api<ProjectStats>(`/projects/${projectId}/stats`)
      .then((res) => {
        if (!cancelled) setStats(res);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("errorGeneric"));
        }
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [section, projectId, t]);

  const nav = useMemo(
    () =>
      [
        {
          group: t("optionsGroupProject"),
          items: [
            { id: "general" as const, label: t("optionsNavGeneral"), icon: Settings2 },
            { id: "environment" as const, label: t("optionsNavEnv"), icon: KeyRound },
            { id: "brand" as const, label: t("optionsNavBrand"), icon: Palette },
          ],
        },
        {
          group: t("optionsGroupSite"),
          items: [
            { id: "seo" as const, label: t("optionsNavSeo"), icon: Search },
            { id: "publishing" as const, label: t("optionsNavPublish"), icon: Globe2 },
            { id: "stats" as const, label: t("optionsNavStats"), icon: BarChart3 },
          ],
        },
        {
          group: t("optionsGroupAdvanced"),
          items: [{ id: "danger" as const, label: t("optionsNavDanger"), icon: AlertTriangle }],
        },
      ] satisfies Array<{
        group: string;
        items: Array<{ id: OptionsSection; label: string; icon: LucideIcon }>;
      }>,
    [t],
  );

  function flashOk(text: string) {
    setMessage(text);
    setError(null);
  }

  async function saveGeneral(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const body: { name?: string; slug?: string } = {};
      const nextName = name.trim();
      const nextSlug = slug.trim();
      if (nextName && nextName !== projectName) body.name = nextName;
      if (nextSlug && nextSlug !== projectSlug) body.slug = nextSlug;
      if (!body.name && !body.slug) {
        flashOk(t("optionsSaved"));
        return;
      }
      const res = await api<{ name: string; slug: string; sites_url?: string | null }>(
        `/projects/${projectId}`,
        {
          method: "PATCH",
          body: JSON.stringify(body),
        },
      );
      setName(res.name);
      setSlug(res.slug);
      onNameSaved?.({
        name: res.name,
        slug: res.slug,
        sites_url: res.sites_url,
      });
      flashOk(t("optionsSaved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  async function saveEnv() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api(`/projects/${projectId}/files/content`, {
        method: "PUT",
        body: JSON.stringify({ path: envPath, content: envContent }),
      });
      flashOk(t("optionsSaved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  async function deleteProject() {
    if (deleteConfirm.trim() !== projectName.trim()) return;
    setDeleting(true);
    setError(null);
    try {
      await api(`/projects/${projectId}`, { method: "DELETE" });
      removeProject(locale, projectId);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
      setDeleting(false);
    }
  }

  async function exportProject() {
    setExporting(true);
    setError(null);
    setMessage(null);
    try {
      const headers = new Headers();
      const token = getToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      headers.set("Accept-Language", locale === "en" ? "en" : "fr");
      const res = await fetch(`${apiBase()}/projects/${projectId}/export`, {
        method: "GET",
        headers,
      });
      if (!res.ok) {
        let detail = res.statusText;
        try {
          const data = await res.json();
          if (typeof data.detail === "string") detail = data.detail;
        } catch {
          /* ignore */
        }
        throw new Error(detail);
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const match = /filename="([^"]+)"/i.exec(cd);
      const filename = match?.[1] || `${(projectSlug || projectName || "project").replace(/[^a-z0-9-_]/gi, "-")}-export.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      flashOk(t("optionsExportDone"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setExporting(false);
    }
  }

  const sectionMeta: Record<OptionsSection, { title: string; subtitle: string }> = {
    general: { title: t("optionsNavGeneral"), subtitle: t("optionsGeneralSub") },
    environment: { title: t("optionsNavEnv"), subtitle: t("optionsEnvSub") },
    brand: { title: t("optionsNavBrand"), subtitle: t("optionsBrandSub") },
    seo: { title: t("optionsNavSeo"), subtitle: t("optionsSeoSub") },
    publishing: { title: t("optionsNavPublish"), subtitle: t("optionsPublishSub") },
    stats: { title: t("optionsNavStats"), subtitle: t("optionsStatsSub") },
    danger: { title: t("optionsNavDanger"), subtitle: t("optionsDangerSub") },
  };

  return (
    <section className="builder-options-pane builder-main-pane options-shell">
      <aside className="options-shell-nav" aria-label={t("builderModeOptions")}>
        <header className="options-shell-nav-head">
          <h2>{t("builderModeOptions")}</h2>
          <p>{t("optionsShellHint")}</p>
        </header>
        <nav className="options-shell-groups">
          {nav.map((group) => (
            <div key={group.group} className="options-shell-group">
              <p className="options-shell-group-label">{group.group}</p>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`options-shell-item ${section === item.id ? "active" : ""} ${
                    item.id === "danger" ? "danger" : ""
                  }`}
                  onClick={() => {
                    selectSection(item.id);
                    setMessage(null);
                    setError(null);
                  }}
                >
                  <span className="options-shell-item-icon" aria-hidden>
                    <Icon icon={item.icon} className="ui-icon-sm" />
                  </span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="options-shell-main">
        <header className="options-panel-head">
          <h3>{sectionMeta[section].title}</h3>
          <p>{sectionMeta[section].subtitle}</p>
        </header>

        {error && <p className="builder-pane-error">{error}</p>}
        {message && <p className="builder-pane-ok">{message}</p>}

        {section === "general" && (
          <form className="options-card" onSubmit={(e) => void saveGeneral(e)}>
            <div className="options-field">
              <label htmlFor="options-name">{t("optionsProjectName")}</label>
              <p className="options-help">{t("optionsProjectNameHelp")}</p>
              <input
                id="options-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="options-field">
              <label htmlFor="options-slug">{t("optionsProjectSlug")}</label>
              <p className="options-help">{t("optionsProjectSlugHelp")}</p>
              <div className="options-slug-row">
                <span className="options-slug-prefix">{sitesScheme()}://</span>
                <input
                  id="options-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                  autoComplete="off"
                />
                <span className="options-slug-suffix">.{sitesBaseDomain()}</span>
              </div>
            </div>
            <div className="options-actions">
              <button type="submit" className="btn" disabled={busy || !name.trim()}>
                <Icon icon={Save} className="ui-icon-sm" />
                {t("save")}
              </button>
            </div>
          </form>
        )}

        {section === "environment" && (
          <div className="options-card">
            <div className="options-field">
              <div className="options-env-meta">
                <strong>{t("optionsEnv")}</strong>
                <code>{envPath}</code>
              </div>
              <p className="options-help">{t("optionsEnvHelp")}</p>
              <ul className="options-tips">
                <li>{t("optionsEnvTipVite")}</li>
                <li>{t("optionsEnvTipSecrets")}</li>
                <li>{t("optionsEnvTipRestart")}</li>
              </ul>
              <textarea
                className="code-editor-area options-env"
                value={envContent}
                onChange={(e) => setEnvContent(e.target.value)}
                spellCheck={false}
              />
            </div>
            <div className="options-actions">
              <button type="button" className="btn" disabled={busy} onClick={() => void saveEnv()}>
                <Icon icon={Save} className="ui-icon-sm" />
                {t("optionsSaveEnv")}
              </button>
            </div>
          </div>
        )}

        {section === "brand" && (
          <div className="options-card">
            <p className="options-help">{t("optionsBrandHelp")}</p>
            <div className="options-actions">
              <button type="button" className="btn" onClick={onOpenDesign}>
                <Icon icon={Palette} className="ui-icon-sm" />
                {t("designOpen")}
              </button>
            </div>
          </div>
        )}

        {section === "seo" && (
          <SeoOptionsSection
            projectId={projectId}
            onOk={flashOk}
            onError={(msg) => {
              setError(msg);
              setMessage(null);
            }}
          />
        )}

        {section === "publishing" && (
          <div className="options-card options-stack">
            <div className="options-stat-row">
              <span>{t("optionsPublishStatus")}</span>
              <strong className={publishedAt ? "ok" : "muted"}>
                {publishedAt ? t("optionsPublishLive") : t("publishEmpty")}
              </strong>
            </div>
            <div className="options-stat-row">
              <span>{t("publishLast")}</span>
              <strong>{formatDate(publishedAt, locale)}</strong>
            </div>
            <div className="options-stat-row">
              <span>{t("publishWebsiteUrl")}</span>
              <strong className="options-url">
                {sitesUrl || (slug ? sitesUrlForSlug(slug) : "—")}
              </strong>
            </div>
            <p className="options-help">{t("optionsPublishHelp")}</p>
            {sitesUrl && (
              <div className="options-actions">
                <a className="btn btn-ghost" href={sitesUrl} target="_blank" rel="noreferrer">
                  <Icon icon={ExternalLink} className="ui-icon-sm" />
                  {t("publishOpen")}
                </a>
              </div>
            )}

            <div className="options-seo-block">
              <h4>{t("optionsExportTitle")}</h4>
              <p className="options-help">{t("optionsExportHelp")}</p>
              <div className="options-actions">
                <button
                  type="button"
                  className="btn"
                  disabled={exporting}
                  onClick={() => void exportProject()}
                >
                  <Icon
                    icon={exporting ? Loader2 : Download}
                    className={`ui-icon-sm ${exporting ? "agent-spin" : ""}`}
                  />
                  {exporting ? t("optionsExporting") : t("optionsExport")}
                </button>
              </div>
            </div>
          </div>
        )}

        {section === "stats" && (
          <div className="options-card">
            {statsLoading && <p className="options-help">{t("loading")}</p>}
            {!statsLoading && stats && (
              <>
                <div className="options-stats-grid">
                  <article className="options-stat-card">
                    <p>{t("optionsStatVisitors")}</p>
                    <strong>{stats.visitors_total.toLocaleString(locale === "en" ? "en-US" : "fr-FR")}</strong>
                    <span>
                      {t("optionsStatVisitors7d").replace(
                        "{n}",
                        stats.visitors_7d.toLocaleString(locale === "en" ? "en-US" : "fr-FR"),
                      )}
                    </span>
                  </article>
                  <article className="options-stat-card">
                    <p>{t("optionsStatFiles")}</p>
                    <strong>{stats.files_count}</strong>
                    <span>{formatBytes(stats.storage_bytes)}</span>
                  </article>
                  <article className="options-stat-card">
                    <p>{t("optionsStatMessages")}</p>
                    <strong>{stats.messages_count}</strong>
                    <span>
                      {t("optionsStatRuns").replace("{n}", String(stats.agent_runs_count))}
                    </span>
                  </article>
                  <article className="options-stat-card">
                    <p>{t("optionsStatComments")}</p>
                    <strong>{stats.comments_count}</strong>
                    <span>{stats.preview_running ? t("optionsStatPreviewOn") : t("optionsStatPreviewOff")}</span>
                  </article>
                </div>
                <div className="options-stack" style={{ marginTop: "1rem" }}>
                  <div className="options-stat-row">
                    <span>{t("optionsStatCreated")}</span>
                    <strong>{formatDate(stats.created_at, locale)}</strong>
                  </div>
                  <div className="options-stat-row">
                    <span>{t("optionsStatUpdated")}</span>
                    <strong>{formatDate(stats.updated_at, locale)}</strong>
                  </div>
                </div>
                {!stats.tracking_ready && (
                  <p className="options-help options-note">{t("optionsStatsTrackingHint")}</p>
                )}
              </>
            )}
          </div>
        )}

        {section === "danger" && (
          <div className="options-card options-danger">
            <div className="options-danger-banner">
              <Icon icon={AlertTriangle} className="ui-icon-md" />
              <div>
                <strong>{t("optionsDangerTitle")}</strong>
                <p>{t("optionsDangerHelp")}</p>
              </div>
            </div>
            <div className="options-field">
              <label htmlFor="options-delete-confirm">
                {t("optionsDangerConfirm").replace("{name}", projectName)}
              </label>
              <input
                id="options-delete-confirm"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={projectName}
                autoComplete="off"
              />
            </div>
            <div className="options-actions">
              <button
                type="button"
                className="btn btn-danger"
                disabled={deleting || deleteConfirm.trim() !== projectName.trim()}
                onClick={() => void deleteProject()}
              >
                <Icon icon={Trash2} className="ui-icon-sm" />
                {deleting ? t("optionsDangerDeleting") : t("optionsDangerDelete")}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
