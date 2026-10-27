"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, apiBase, getToken } from "@/lib/api";
import { projectPublicUrl } from "@/lib/asset-url";
import QRCode from "qrcode";
import { Button } from "@/components/ui/Button";
import { Glyph } from "@/components/ui/glyph";
import { exportAllowed, useForgeStatus } from "@/lib/forge-status";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { topProgressDone, topProgressStart } from "@/lib/top-progress";
import { sitesBaseDomain, sitesHostLabel, sitesUrlForSlug } from "@/lib/sites-url";

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
  /** Nothing to publish yet (empty project) or Forge is still writing. */
  disabled?: boolean;
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
  disabled = false,
}: Props) {
  const { t, locale } = useI18n();
  const forgeStatus = useForgeStatus();
  const canExport = exportAllowed(forgeStatus);
  const [upgradeNote, setUpgradeNote] = useState<{ text: string; id: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!upgradeNote) return;
    const timer = window.setTimeout(() => setUpgradeNote(null), 3200);
    return () => window.clearTimeout(timer);
  }, [upgradeNote]);
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
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

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

  // QR of the live URL: scan from the popover to open the published site on a
  // phone. Regenerated when the panel opens or the slug changes.
  useEffect(() => {
    if (!open || !hasPublished || !url) {
      setQrDataUrl(null);
      return;
    }
    let alive = true;
    QRCode.toDataURL(url, { margin: 1, width: 264, errorCorrectionLevel: "M" })
      .then((data) => {
        if (alive) setQrDataUrl(data);
      })
      .catch(() => {
        if (alive) setQrDataUrl(null);
      });
    return () => {
      alive = false;
    };
  }, [open, hasPublished, url]);

  const effectiveUrl = url || sitesUrl || (slug ? sitesUrlForSlug(slug) : "");
  const hostLabel = effectiveUrl
    ? displayHost(effectiveUrl)
    : slug
      ? sitesHostLabel(slug)
      : t("publishEmpty");

  // Publish is a single synchronous POST: phases are estimated from the
  // elapsed time (the granular Firestore phases went away with the mirror).
  const phaseIndex = elapsed < 45 ? 0 : elapsed < 90 ? 1 : 2;
  const phases = [t("bdPhaseBuild"), t("bdPhaseImages"), t("bdPhaseUpload")];
  const ent = forgeStatus?.entitlements ?? null;
  const planSlug = forgeStatus?.plan ?? ent?.plan_slug ?? null;
  // Off Forge Cloud nothing is plan-gated: every row reads as included.
  const customDomainOk = ent ? ent.custom_domain : true;
  const showBadgeNote = planSlug === "free";

  const panel = open && mounted
    ? createPortal(
        <>
          {/* Real backdrop: a document-level mousedown listener never fires
              when the click lands on the preview iframe (iframe events don't
              bubble to the parent document), so the popover looked stuck. */}
          <button
            type="button"
            className="f-bd-pub-backdrop"
            aria-label={t("close")}
            tabIndex={-1}
            onClick={() => {
              if (!busy && !exporting) setOpen(false);
            }}
          />
          <div
            ref={popoverRef}
            className="f-bd-pub"
            role="dialog"
            aria-label={t("bdPublishTitle")}
            aria-busy={busy}
            style={{ top: pos.top, right: pos.right }}
          >
            <div className="f-bd-pub-head">
              <span className={`dot${hasPublished ? " live" : ""}`} aria-hidden />
              <h3>{t("bdPublishTitle")}</h3>
            </div>
            <p className="f-bd-pub-meta">
              {busy
                ? `${phases[phaseIndex]} · ${elapsed} s`
                : hasPublished
                  ? t("publishChangesSince").replace("{date}", formatPublishDate(lastPublished!, locale))
                  : t("publishNever")}
            </p>

            <div className="f-bd-pub-url">
              {editing ? (
                <form
                  className="f-bd-pub-slug"
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
                  <span className="dom">.{sitesBaseDomain()}</span>
                  <button type="submit" className="f-bd-pub-ib" disabled={savingSlug || busy} aria-label={t("save")}>
                    <Glyph name={savingSlug ? "refresh" : "check"} size="sm" className={savingSlug ? "f-spin" : undefined} />
                  </button>
                </form>
              ) : (
                <>
                  <span className="fav" aria-hidden>
                    {/* The favicon of the site itself, not the Forge app icon. */}
                    {faviconUrl ? (
                      <img src={faviconUrl} alt="" width={16} height={16} onError={() => setFaviconUrl(null)} />
                    ) : (
                      <Glyph name="globe" size="sm" />
                    )}
                  </span>
                  {hasPublished && url ? (
                    <a href={url} target="_blank" rel="noreferrer" className="lnk">
                      {hostLabel}
                    </a>
                  ) : (
                    <span className="lnk muted" title={t("publishLiveLockedHint")}>
                      {hostLabel}
                    </span>
                  )}
                  <button
                    type="button"
                    className="f-bd-pub-ib"
                    aria-label={t("publishEditSlug")}
                    title={t("publishEditSlug")}
                    onClick={() => {
                      setDraftSlug(slug);
                      setEditing(true);
                    }}
                    disabled={!slug || busy}
                  >
                    <Glyph name="edit" size="sm" />
                  </button>
                  <button
                    type="button"
                    className="f-bd-pub-ib"
                    aria-label={copied ? t("bdLinkCopied") : t("publishCopy")}
                    title={t("publishCopy")}
                    onClick={() => void copy()}
                    disabled={!hasPublished || !url || busy}
                  >
                    <Glyph name={copied ? "check" : "copy"} size="sm" />
                  </button>
                </>
              )}
            </div>
            {!hasPublished && !busy ? <p className="f-bd-pub-note">{t("publishLiveLockedHint")}</p> : null}

            {busy || hasPublished ? (
              <div className="f-bd-pub-mid">
                {hasPublished && url && qrDataUrl && !busy ? (
                  <img className="f-bd-pub-qr" src={qrDataUrl} alt={t("publishQrAlt")} width={92} height={92} />
                ) : null}
                <ol className="f-bd-pub-phases" aria-live="polite">
                  {phases.map((label, index) => {
                    const state = !busy ? "ok" : index < phaseIndex ? "ok" : index === phaseIndex ? "run" : "wait";
                    return (
                      <li key={label} className={state}>
                        {state === "ok" ? (
                          <Glyph name="check" size="sm" />
                        ) : state === "run" ? (
                          <Glyph name="refresh" size="sm" className="f-spin" />
                        ) : (
                          <span className="w" aria-hidden />
                        )}
                        {label}
                      </li>
                    );
                  })}
                </ol>
              </div>
            ) : null}
            {hasPublished && url && qrDataUrl && !busy ? <p className="f-bd-pub-note">{t("publishQrHint")}</p> : null}

            <div className="f-bd-pub-row">
              <Glyph name={customDomainOk ? "globe" : "lock"} size="sm" />
              <span>
                {t("bdCustomDomain")}
                <small>{customDomainOk ? t("bdIncluded") : t("bdIncludedIn").replace("{plan}", "Pro")}</small>
              </span>
            </div>
            <button
              type="button"
              className="f-bd-pub-row is-action"
              disabled={busy || exporting}
              onClick={() => {
                if (!canExport) {
                  setUpgradeNote({ text: t("optionsExportTease"), id: Date.now() });
                  return;
                }
                setUpgradeNote(null);
                void exportZip();
              }}
            >
              <Glyph
                name={exporting ? "refresh" : canExport ? "download" : "lock"}
                size="sm"
                className={exporting ? "f-spin" : undefined}
              />
              <span>
                {exporting ? t("optionsExporting") : t("bdCodeZip")}
                <small>{canExport ? t("bdIncluded") : t("bdFromPlan").replace("{plan}", "Starter")}</small>
              </span>
            </button>
            {upgradeNote ? <p className="f-bd-pub-note warn">{upgradeNote.text}</p> : null}
            {exportNotice ? <p className="f-bd-pub-note ok">{exportNotice}</p> : null}
            {showBadgeNote ? <p className="f-bd-pub-note">{t("bdByForgeBadge")}</p> : null}
            {error ? (
              <p className="f-bd-pub-note err" role="alert">
                {error}
              </p>
            ) : null}

            <Button icon="rocket" loading={busy} disabled={exporting} onClick={() => void publish()} block>
              {busy ? t("publishRunning") : hasPublished ? t("bdPublishChanges") : t("bdPublishFirst")}
            </Button>
          </div>
        </>,
        document.body,
      )
    : null;

  return (
    <div className="f-bd-pub-wrap" ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        className="f-btn f-btn-primary f-btn-sm"
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={disabled && !busy}
        onClick={() => setOpen((v) => !v)}
      >
        <Glyph name={busy ? "refresh" : "rocket"} size="sm" className={busy ? "f-spin" : undefined} />
        <span className="f-btn-label">{busy ? t("publishRunning") : t("bdPublish")}</span>
      </button>
      {panel}
    </div>
  );
}
