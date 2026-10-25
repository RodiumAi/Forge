"use client";

/**
 * "Publier" popover of the codelab editor top bar, like the deck and the
 * site: keep or drop the badge (only plans with `remove_badge`), save
 * pending edits, publish, then open or copy the public link.
 */

import { useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, Loader2, Send } from "lucide-react";
import type { CodelabPublisher } from "./DetailsPanel";
import type { Translate } from "./strings";

export type CodelabPublishMenuProps = {
  publisher: CodelabPublisher;
  /** Saves pending edits before publishing. */
  beforePublish: () => Promise<void>;
  /** Public URL already known (published earlier). */
  publicUrl?: string;
  onPublished: (url: string) => void;
  disabled?: boolean;
  t: Translate;
};

export function PublishMenu({ publisher, beforePublish, publicUrl, onPublished, disabled, t }: CodelabPublishMenuProps) {
  const [open, setOpen] = useState(false);
  const [badge, setBadge] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const run = async () => {
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      await beforePublish();
      const res = await publisher.publish({ badge: publisher.badgeRemovable ? badge : true });
      onPublished(res.public_url);
      setDone(true);
    } catch (err) {
      const message = (err as { message?: string })?.message;
      setError(message ? `${t("publishFailed")} ${message}` : t("publishFailed"));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard refused: the link stays visible */
    }
  };

  return (
    <div className="cle-publish-wrap" ref={root}>
      <button
        type="button"
        className="f-btn f-btn-primary f-btn-sm"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={disabled}
      >
        <Send size={14} aria-hidden /> <span className="f-bd-lbl">{t("publish")}</span>
      </button>
      {open ? (
        <div className="cle-publish" role="dialog" aria-label={t("publishTitle")}>
          <strong className="cle-publish-title">{t("publishTitle")}</strong>
          <label className="cle-publish-check">
            <input
              type="checkbox"
              checked={publisher.badgeRemovable ? badge : true}
              disabled={!publisher.badgeRemovable}
              onChange={(e) => setBadge(e.target.checked)}
            />
            {t("publishBadge")}
          </label>
          {!publisher.badgeRemovable ? <p className="cle-publish-hint">{t("publishBadgeLocked")}</p> : null}
          <button type="button" className="cle-publish-run" onClick={run} disabled={busy}>
            {busy ? <Loader2 size={14} className="cle-spin" aria-hidden /> : <Send size={14} aria-hidden />}{" "}
            {busy ? t("publishing") : t("publishRun")}
          </button>
          {error ? (
            <p className="cle-publish-hint cle-publish-error" role="alert">
              {error}
            </p>
          ) : null}
          {done ? (
            <p className="cle-publish-hint" role="status">
              {t("publishDone")}
            </p>
          ) : null}
          {publicUrl ? (
            <div className="cle-publish-links">
              <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={13} aria-hidden /> {t("publishOpen")}
              </a>
              <button type="button" onClick={copy}>
                {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />} {copied ? t("publishCopied") : t("publishCopy")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
