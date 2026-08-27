"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Globe,
  Loader2,
  Pencil,
  Upload,
} from "lucide-react";
import { api, apiBase, getToken } from "@/lib/api";
import { projectPublicUrl } from "@/lib/asset-url";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { topProgressDone, topProgressStart } from "@/lib/top-progress";
import { usePublishLive } from "@/lib/firebase/live";

type Props = {
  projectId: string;
  slug?: string;
  sitesUrl?: string | null;
  publishedAt?: string | null;
  onMetaChange?: (meta: {
    slug: string;
    sites_url: string;
    published_at?: string | null;
  }) => void;
};

type PublishResult = {
  public_url: string;
  files_uploaded: number;
  slug: string;
  published_at?: string | null;
};

type ProjectPatch = {
  slug: string;
  sites_url?: string | null;
  published_at?: string | null;
};

type PopoverPos = { top: number; right: number };

const PUBLISH_TIMEOUT_MS = 10 * 60 * 1000;

function displayHost(url: string): string {
  try {
    const u = new URL(url);
    return u.host + (u.pathname === "/" ? "" : u.pathname.replace(/\/$/, ""));
  } catch {
    return url.replace(/^https?:\/\//, "");
  }
}

function formatPublishDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function PublishPopover({
  projectId,
  slug: slugProp,
  sitesUrl,
  publishedAt,
  onMetaChange,
}: Props) {
  const { t, locale } = useI18n();
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PopoverPos>({ top: 0, right: 0 });
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [savingSlug, setSavingSlug] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [slug, setSlug] = useState(slugProp || "");
  const [url, setUrl] = useState(sitesUrl || "");
  const [lastPublished, setLastPublished] = useState(publishedAt || null);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftSlug, setDraftSlug] = useState(slugProp || "");
  const [mounted, setMounted] = useState(false);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const publishLive = usePublishLive(projectId);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Resolve the project's own favicon when the popover opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const seo = await api<{ favicon_path?: string | null }>(`/projects/${projectId}/seo`);
        if (cancelled) return;
        setFaviconUrl(
          projectPublicUrl(projectId, seo.favicon_path || "/favicon.png", Date.now()),
        );
      } catch {
        if (!cancelled) setFaviconUrl(projectPublicUrl(projectId, "/favicon.png", Date.now()));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  useEffect(() => {
    if (slugProp) setSlug(slugProp);
    if (sitesUrl) setUrl(sitesUrl);
    setLastPublished(publishedAt || null);
  }, [slugProp, sitesUrl, publishedAt]);

  useEffect(() => {
    if (!busy) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 500);
    return () => window.clearInterval(id);
  }, [busy]);

  useEffect(() => {
    const phase = publishLive?.phase;
    if (!phase) return;
    if (phase === "done") {
      setBusy(false);
      if (publishLive.published_at) setLastPublished(publishLive.published_at);
    } else if (phase === "error") {
      setBusy(false);
      if (publishLive.message) setError(publishLive.message);
    } else if (phase !== "idle") {
      setBusy(true);
      setOpen(true);
    }
  }, [publishLive]);

  const updatePos = () => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setPos({
      top: rect.bottom + 8,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePos();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (busy || exporting) return;
      const target = e.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (busy || exporting) return;
        setEditing(false);
        setOpen(false);
      }
    }
    function onReposition() {
      updatePos();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, busy, exporting]);

  async function publish() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = window.setTimeout(() => controller.abort(), PUBLISH_TIMEOUT_MS);

    setBusy(true);
    setError(null);
    setExportNotice(null);
    setOpen(true);
    topProgressStart();
    try {
      const res = await api<PublishResult>(
        `/projects/${projectId}/publish`,
        { method: "POST", signal: controller.signal },
      );
      setUrl(res.public_url);
      setSlug(res.slug || slug);
      setLastPublished(res.published_at || new Date().toISOString());
      onMetaChange?.({
        slug: res.slug || slug,
        sites_url: res.public_url,
        published_at: res.published_at || new Date().toISOString(),
      });
    } catch (err) {
      if (controller.signal.aborted) {
        setError(t("publishTimeout"));
      } else {
        setError(err instanceof Error ? err.message : t("publishFailed"));
      }
    } finally {
      window.clearTimeout(timer);
      if (abortRef.current === controller) abortRef.current = null;
      setBusy(false);
      topProgressDone();
    }
  }

  async function exportZip() {
    setExporting(true);
    setError(null);
    setExportNotice(null);
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
      const filename =
        match?.[1] || `${(slug || "project").replace(/[^a-z0-9-_]/gi, "-")}-export.zip`;
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      setExportNotice(t("optionsExportDone"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setExporting(false);
    }
  }

  async function copy() {
    if (!lastPublished || !url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  async function saveSlug() {
    const next = draftSlug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
    if (!next || next === slug) {
      setEditing(false);
      setDraftSlug(slug);
      return;
    }
    setSavingSlug(true);
    setError(null);
    try {
      const res = await api<ProjectPatch>(`/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify({ slug: next }),
      });
      setSlug(res.slug);
      setDraftSlug(res.slug);
      if (res.sites_url) setUrl(res.sites_url);
      setEditing(false);
      onMetaChange?.({
        slug: res.slug,
        sites_url: res.sites_url || url,
        published_at: res.published_at ?? lastPublished,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("publishSlugFailed"));
    } finally {
      setSavingSlug(false);
    }
  }

  const hasPublished = Boolean(lastPublished);
  const hostLabel = hasPublished && url
    ? displayHost(url)
    : slug
      ? `${slug}.lvh.me:8080`
      : t("publishEmpty");

  const phaseFromLive = publishLive?.phase;
  const phaseLabel =
    phaseFromLive === "queued"
      ? t("publishPhaseDeps")
      : phaseFromLive === "deps"
        ? t("publishPhaseDeps")
        : phaseFromLive === "build"
          ? t("publishPhaseBuild")
          : phaseFromLive === "upload"
            ? t("publishPhaseUpload")
            : phaseFromLive === "done"
              ? t("publishPhaseFinalize")
              : elapsed < 8
                ? t("publishPhaseDeps")
                : elapsed < 45
                  ? t("publishPhaseBuild")
                  : elapsed < 90
                    ? t("publishPhaseUpload")
                    : t("publishPhaseFinalize");

  const panel = open && mounted
    ? createPortal(
        <div
          ref={popoverRef}
          className={`publish-popover publish-popover-portal${busy ? " is-busy" : ""}`}
          role="dialog"
          aria-label={t("publish")}
          aria-busy={busy}
          style={{ top: pos.top, right: pos.right }}
        >
          <header className="publish-popover-head">
            <div className="publish-title-row">
              <span className={`publish-status-dot${hasPublished ? " live" : ""}`} />
              <strong>{t("publish")}</strong>
            </div>
          </header>

          <p className="publish-meta">
            {busy
              ? `${phaseLabel} · ${elapsed}s`
              : hasPublished
                ? t("publishChangesSince").replace(
                    "{date}",
                    formatPublishDate(lastPublished!, locale),
                  )
                : t("publishNever")}
          </p>

          <p className="publish-draft-hint">{t("publishDraftVsLive")}</p>

          <div className="publish-section-label">
            <span>{t("publishWebsiteUrl")}</span>
            <span className="publish-add-domain-muted">{t("publishDomainHint")}</span>
          </div>

          <div className="publish-url-card">
            {editing ? (
              <form
                className="publish-slug-edit"
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveSlug();
                }}
              >
                <input
                  value={draftSlug}
                  onChange={(e) => setDraftSlug(e.target.value)}
                  autoFocus
                  spellCheck={false}
                  aria-label={t("publishEditSlug")}
                  disabled={savingSlug || busy}
                />
                <button type="submit" className="publish-icon-btn" disabled={savingSlug || busy} title={t("save")}>
                  {savingSlug ? (
                    <Icon icon={Loader2} className="ui-icon-sm agent-spin" />
                  ) : (
                    <Icon icon={Check} className="ui-icon-sm" />
                  )}
                </button>
              </form>
            ) : (
              <>
                <div className="publish-url-main">
                  <span className="publish-favicon" aria-hidden>
                    {/* The site's own favicon, not Forge's app icon. Falls back
                        to a neutral globe when the project has none yet. */}
                    {faviconUrl ? (
                      <img
                        src={faviconUrl}
                        alt=""
                        width={16}
                        height={16}
                        onError={() => setFaviconUrl(null)}
                      />
                    ) : (
                      <Icon icon={Globe} className="ui-icon-sm" />
                    )}
                  </span>
                  {hasPublished && url ? (
                    <a href={url} target="_blank" rel="noreferrer" className="publish-url-link">
                      {hostLabel}
                    </a>
                  ) : (
                    <span className="publish-url-link muted" title={t("publishLiveLockedHint")}>
                      {hostLabel}
                    </span>
                  )}
                </div>
                <div className="publish-url-actions">
                  <button
                    type="button"
                    className="publish-icon-btn"
                    title={t("publishEditSlug")}
                    onClick={() => {
                      setDraftSlug(slug);
                      setEditing(true);
                    }}
                    disabled={!slug || busy}
                  >
                    <Icon icon={Pencil} className="ui-icon-sm" />
                  </button>
                  <button
                    type="button"
                    className="publish-icon-btn"
                    title={t("publishCopy")}
                    onClick={() => void copy()}
                    disabled={!hasPublished || !url || busy}
                  >
                    <Icon icon={copied ? Check : Copy} className="ui-icon-sm" />
                  </button>
                  {hasPublished && url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="publish-icon-btn"
                      title={t("publishOpen")}
                    >
                      <Icon icon={ExternalLink} className="ui-icon-sm" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      className="publish-icon-btn"
                      title={t("publishLiveLockedHint")}
                      disabled
                    >
                      <Icon icon={ExternalLink} className="ui-icon-sm" />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {!hasPublished && (
            <p className="publish-live-hint">{t("publishLiveLockedHint")}</p>
          )}

          <div className="publish-visibility">
            <Icon icon={Globe} className="ui-icon-sm" />
            <span>{t("publishVisibilityPublic")}</span>
          </div>

          <div className="publish-security">
            <Icon icon={CheckCircle2} className="ui-icon-sm" />
            <span>{t("publishSecurityOk")}</span>
          </div>

          <div className="publish-export-block">
            <p className="publish-export-help">{t("optionsExportHelp")}</p>
            <button
              type="button"
              className="publish-export-btn"
              disabled={busy || exporting}
              onClick={() => void exportZip()}
            >
              <Icon
                icon={exporting ? Loader2 : Download}
                className={`ui-icon-sm ${exporting ? "agent-spin" : ""}`}
              />
              {exporting ? t("optionsExporting") : t("optionsExport")}
            </button>
            {exportNotice ? <p className="publish-export-ok">{exportNotice}</p> : null}
          </div>

          {error && <p className="publish-error">{error}</p>}

          <div className="publish-footer">
            <button
              type="button"
              className="publish-run"
              disabled={busy || exporting}
              onClick={() => void publish()}
            >
              {busy ? (
                <>
                  <Icon icon={Loader2} className="ui-icon-sm agent-spin" />
                  {t("publishRunning")}
                </>
              ) : hasPublished ? (
                t("publishUpdate")
              ) : (
                t("publishRun")
              )}
            </button>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="publish-wrap" ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        className={`builder-publish-btn${busy ? " is-busy" : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        {busy ? (
          <Icon icon={Loader2} className="ui-icon-sm agent-spin" />
        ) : (
          <Icon icon={Upload} className="ui-icon-sm" />
        )}
        {busy ? t("publishRunning") : t("publish")}
      </button>
      {panel}
    </div>
  );
}
