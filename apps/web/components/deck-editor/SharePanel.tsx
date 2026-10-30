"use client";

/**
 * "Partager" panel of the deck bar, the way Canva does it: people invites and
 * the link access level (owner only), then present, download and publish.
 * Download, Publish and Invite keep their own dialogs; the rows open them.
 */

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Glyph } from "@/components/ui/glyph";
import { MenuItem, MenuSeparator, Popover } from "@/components/ui/Popover";
import type { LinkAccess, ShareLink, ShareLinkClient } from "@/lib/share-links";
import type { DeckT } from "./strings";

export type SharePanelProps = {
  /** Link settings; owner only. */
  link?: ShareLinkClient | null;
  onInvite?: () => void;
  onPresent?: () => void;
  onDownload?: () => void;
  onPublish?: () => void;
  presentDisabled?: boolean;
  t: DeckT;
};

export function SharePanel({ link, onInvite, onPresent, onDownload, onPublish, presentDisabled, t }: SharePanelProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ShareLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !link) return;
    let alive = true;
    setError(null);
    link
      .get()
      .then((s) => alive && setState(s))
      .catch((err: Error) => alive && setError(err.message || t("shareLinkError")));
    return () => {
      alive = false;
    };
  }, [open, link, t]);

  const apply = useCallback(
    async (run: () => Promise<ShareLink>) => {
      setBusy(true);
      setError(null);
      try {
        setState(await run());
      } catch (err) {
        setError((err as Error)?.message || t("shareLinkError"));
      } finally {
        setBusy(false);
      }
    },
    [t],
  );

  const url = link && state?.token && state.access !== "none" ? link.url(state.token) : null;

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard refused: the link stays selectable below */
    }
  };

  const hint =
    state?.access === "view"
      ? t("shareLinkViewHint")
      : state?.access === "edit"
        ? state.seats_left == null
          ? t("shareLinkEditHint")
          : t("shareLinkEditSeats", { n: state.seats_left })
        : t("shareLinkNoneHint");

  return (
    <Popover
      trigger={
        <Button variant="primary" size="sm" title={t("shareTitle")}>
          {t("menuShare")}
        </Button>
      }
      role="dialog"
      label={t("shareTitle")}
      align="end"
      width={340}
      className="de-share-pop"
      open={open}
      onOpenChange={setOpen}
    >
      {(close) => {
        const after = (fn?: () => void) => () => {
          close();
          fn?.();
        };
        return (
          <div className="de-share">
            <strong className="de-share-title">{t("shareTitle")}</strong>
            {onInvite ? (
              <MenuItem icon="users" hint={t("shareInviteHint")} onClick={after(onInvite)}>
                {t("shareInvite")}
              </MenuItem>
            ) : null}
            {link ? (
              <section className="de-share-link" aria-label={t("shareLinkLabel")}>
                <label className="de-share-row">
                  <Glyph name="link" size="sm" />
                  <span>{t("shareLinkLabel")}</span>
                </label>
                <select
                  className="de-share-select"
                  value={state?.access ?? "none"}
                  disabled={!state || busy}
                  aria-label={t("shareLinkLabel")}
                  onChange={(e) => void apply(() => link.set(e.target.value as LinkAccess))}
                >
                  <option value="none">{t("shareLinkNone")}</option>
                  <option value="view">{t("shareLinkView")}</option>
                  <option value="edit" disabled={!state?.can_edit_link}>
                    {state && !state.can_edit_link ? t("shareLinkEditLocked") : t("shareLinkEdit")}
                  </option>
                </select>
                <p className="de-hint">{hint}</p>
                {url ? (
                  <div className="de-share-actions">
                    <input className="de-share-url" readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label={t("shareLinkUrl")} />
                    <Button variant="primary" size="sm" icon={copied ? "check" : "copy"} onClick={copy}>
                      {copied ? t("publishCopied") : t("publishCopy")}
                    </Button>
                  </div>
                ) : null}
                {url ? (
                  <button type="button" className="de-share-reset" disabled={busy} onClick={() => void apply(link.reset)}>
                    {t("shareLinkReset")}
                  </button>
                ) : null}
                {error ? (
                  <p className="de-hint de-error" role="alert">
                    {error}
                  </p>
                ) : null}
              </section>
            ) : null}
            {onInvite || link ? <MenuSeparator /> : null}
            {onPresent ? (
              <MenuItem icon="play" disabled={presentDisabled} onClick={after(onPresent)}>
                {t("present")}
              </MenuItem>
            ) : null}
            {onDownload ? (
              <MenuItem icon="download" hint={t("shareDownloadHint")} onClick={after(onDownload)}>
                {t("menuExport")}
              </MenuItem>
            ) : null}
            {onPublish ? (
              <MenuItem icon="globe" hint={t("sharePublishHint")} onClick={after(onPublish)}>
                {t("publishTitle")}
              </MenuItem>
            ) : null}
          </div>
        );
      }}
    </Popover>
  );
}
