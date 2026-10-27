"use client";

/**
 * "Publier" popover of the deck editor: share notes on the presenter view,
 * keep or drop the badge (only plans with `remove_badge`), then publish and
 * show the public and presenter links.
 */

import { useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, Loader2, Send } from "lucide-react";
import type { DeckT } from "./strings";

export type PublishOptions = { notes: boolean; badge: boolean };

export type DeckPublisher = {
  /** Whether this plan may hide the badge. */
  badgeRemovable: boolean;
  publish: (options: PublishOptions) => Promise<{ public_url: string }>;
  presenterUrl: (publicUrl: string) => string;
};

export type PublishMenuProps = {
  publisher: DeckPublisher;
  /** Current badge choice, shared with the Present button. */
  badge: boolean;
  onBadgeChange: (badge: boolean) => void;
  /** Saves pending edits before publishing. */
  beforePublish: () => Promise<void>;
  disabled?: boolean;
  t: DeckT;
};

export function PublishMenu({ publisher, badge, onBadgeChange, beforePublish, disabled, t }: PublishMenuProps) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
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
    try {
      await beforePublish();
      const res = await publisher.publish({ notes, badge: publisher.badgeRemovable ? badge : true });
      setUrl(res.public_url);
    } catch (err) {
      const message = (err as { message?: string })?.message;
      setError(message ? `${t("publishFailed")} ${message}` : t("publishFailed"));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard refused: the link stays visible */
    }
  };

  return (
    <div className="de-insert" ref={root}>
      <button type="button" className="f-btn f-btn-ghost f-btn-sm" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="dialog" disabled={disabled}>
        <Send size={14} aria-hidden /> <span className="f-bd-lbl">{t("publish")}</span>
      </button>
      {open ? (
        <div className="de-menu de-publish" role="dialog" aria-label={t("publishTitle")}>
          <strong className="de-publish-title">{t("publishTitle")}</strong>
          <label className="de-check">
            <input type="checkbox" checked={notes} onChange={(e) => setNotes(e.target.checked)} /> {t("publishNotes")}
          </label>
          <label className="de-check">
            <input
              type="checkbox"
              checked={publisher.badgeRemovable ? badge : true}
              disabled={!publisher.badgeRemovable}
              onChange={(e) => onBadgeChange(e.target.checked)}
            />{" "}
            {t("publishBadge")}
          </label>
          {!publisher.badgeRemovable ? <p className="de-hint">{t("publishBadgeLocked")}</p> : null}
          <button type="button" className="de-button de-button-primary" onClick={run} disabled={busy}>
            {busy ? <Loader2 size={14} className="de-spin" aria-hidden /> : <Send size={14} aria-hidden />} {busy ? t("publishing") : t("publishRun")}
          </button>
          {error ? (
            <p className="de-hint de-error" role="alert">
              {error}
            </p>
          ) : null}
          {url ? (
            <div className="de-publish-result" role="status">
              <p className="de-hint">{t("publishDone")}</p>
              <a href={url} target="_blank" rel="noreferrer" className="de-publish-link">
                <ExternalLink size={13} aria-hidden /> {t("publishOpen")}
              </a>
              <a href={publisher.presenterUrl(url)} target="_blank" rel="noreferrer" className="de-publish-link">
                <ExternalLink size={13} aria-hidden /> {t("publishPresenter")}
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
