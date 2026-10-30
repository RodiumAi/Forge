"use client";

/**
 * "Partager" panel of the deck bar, laid out like Canva's: people with
 * access, the link access level (who, then view or edit), a large copy
 * button, then round shortcuts to download, present and publish.
 * Download, Publish and Invite keep their own dialogs; the tiles open them.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Glyph, type GlyphName } from "@/components/ui/glyph";
import { Popover } from "@/components/ui/Popover";
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

function Tile({ icon, label, onClick, disabled, accent }: { icon: GlyphName; label: ReactNode; onClick: () => void; disabled?: boolean; accent?: boolean }) {
  return (
    <button type="button" className="de-share-tile" onClick={onClick} disabled={disabled}>
      <span className={`de-share-tile-icon${accent ? " is-accent" : ""}`}>
        <Glyph name={icon} />
      </span>
      <span className="de-share-tile-label">{label}</span>
    </button>
  );
}

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
    async (run: () => Promise<ShareLink>): Promise<ShareLink | null> => {
      setBusy(true);
      setError(null);
      try {
        const next = await run();
        setState(next);
        return next;
      } catch (err) {
        setError((err as Error)?.message || t("shareLinkError"));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [t],
  );

  const access: LinkAccess = state?.access ?? "none";
  const shared = access !== "none";

  /** Copies the link; a closed link is first opened for viewing. */
  const copy = async () => {
    if (!link) return;
    let current = state;
    if (!current?.token || current.access === "none") current = await apply(() => link.set("view"));
    if (!current?.token) return;
    try {
      await navigator.clipboard.writeText(link.url(current.token));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard refused: show the link so it can be copied by hand.
      setError(link.url(current.token));
    }
  };

  const hint =
    access === "view"
      ? t("shareLinkViewHint")
      : access === "edit"
        ? state?.seats_left == null
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
      width={380}
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
              <section className="de-share-section">
                <h3>{t("sharePeople")}</h3>
                <button type="button" className="de-share-invite" onClick={after(onInvite)}>
                  <Glyph name="search" size="sm" />
                  <span>{t("shareAddPeople")}</span>
                </button>
              </section>
            ) : null}

            {link ? (
              <section className="de-share-section" aria-label={t("shareLinkLabel")}>
                <h3>{t("shareLinkLabel")}</h3>
                <div className="de-share-access">
                  <span className="de-share-access-icon">
                    <Glyph name={shared ? "globe" : "lock"} />
                  </span>
                  <select
                    className="de-share-select"
                    value={shared ? "link" : "invited"}
                    disabled={!state || busy}
                    aria-label={t("shareLinkWho")}
                    onChange={(e) => void apply(() => link.set(e.target.value === "link" ? "view" : "none"))}
                  >
                    <option value="invited">{t("shareLinkNone")}</option>
                    <option value="link">{t("shareLinkAnyone")}</option>
                  </select>
                  {shared ? (
                    <select
                      className="de-share-select de-share-role"
                      value={access}
                      disabled={busy}
                      aria-label={t("shareLinkRole")}
                      onChange={(e) => void apply(() => link.set(e.target.value as LinkAccess))}
                    >
                      <option value="view">{t("shareRoleView")}</option>
                      <option value="edit" disabled={!state?.can_edit_link}>
                        {state?.can_edit_link ? t("shareRoleEdit") : t("shareRoleEditLocked")}
                      </option>
                    </select>
                  ) : null}
                </div>
                <p className="de-hint">{hint}</p>
                <button type="button" className="de-share-copy" disabled={!state || busy} onClick={() => void copy()}>
                  <Glyph name={copied ? "check" : "link"} size="sm" />
                  {copied ? t("publishCopied") : shared ? t("publishCopy") : t("shareLinkOpenCopy")}
                </button>
                {shared ? (
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

            <div className="de-share-tiles">
              {onDownload ? <Tile icon="download" label={t("menuExport")} onClick={after(onDownload)} /> : null}
              {onPresent ? <Tile icon="play" label={t("present")} accent disabled={presentDisabled} onClick={after(onPresent)} /> : null}
              {onPublish ? <Tile icon="globe" label={t("sharePublicPage")} onClick={after(onPublish)} /> : null}
              {onInvite ? <Tile icon="users" label={t("shareInvite")} onClick={after(onInvite)} /> : null}
            </div>
          </div>
        );
      }}
    </Popover>
  );
}
