"use client";

/**
 * One "Partager" button for everything that leaves the editor, like Canva:
 * who has access (people, team, defaults), then tiles that open their own
 * view inside the same panel: publish the page, download the guidelines,
 * copy the published link.
 */

import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileCode2,
  FileText,
  Globe,
  Link2,
  Lock,
  Share2,
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { APP_ROUTES } from "@/components/shell/nav";
import { Popover } from "@/components/ui/Popover";
import { Icon } from "@/components/ui/icon";
import { useForgeStatus } from "@/lib/forge-status";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { publishStatus, setDefault, share, unshare, type DesignSystemItem, type PublishState } from "./api";
import { PublishView, sinceLabel } from "./DesignSystemPublish";
import { designSystemExportOptions, type DsExportFormat } from "./exports";
import type { DesignSystemDoc } from "./tokens";

type View = "main" | "publish" | "download";

const FORMATS: Record<DsExportFormat, { icon: typeof FileText; label: MessageKey; hint: MessageKey }> = {
  pdf: { icon: FileText, label: "apDsExportPdf", hint: "dsHubPdfHint" },
  md: { icon: FileCode2, label: "apDsExportMd", hint: "dsHubMdHint" },
};

function Switch({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="dsh-switch-row" onClick={onToggle}>
      <span>{label}</span>
      <span className={`dsh-switch${on ? " is-on" : ""}`} aria-hidden>
        <i />
      </span>
    </button>
  );
}

function Tile({
  icon,
  label,
  sub,
  onClick,
  disabled,
  live,
}: {
  icon: typeof Globe;
  label: string;
  sub: string;
  onClick: () => void;
  disabled?: boolean;
  live?: boolean;
}) {
  return (
    <button type="button" className="dsh-tile" onClick={onClick} disabled={disabled}>
      <span className="dsh-tile-icon">
        <Icon icon={icon} />
        {live ? <span className="dsp-live-dot" aria-hidden /> : null}
      </span>
      <strong>{label}</strong>
      <small>{sub}</small>
    </button>
  );
}

export function DesignSystemShareHub({
  projectId,
  doc,
  item,
  onItem,
  run,
  onInvite,
  onDownload,
  beforePublish,
}: {
  projectId: string;
  doc: DesignSystemDoc;
  item: DesignSystemItem | null;
  onItem: (next: DesignSystemItem) => void;
  /** The editor's action runner: shows the notice on success or failure. */
  run: (action: () => Promise<unknown>, done?: MessageKey) => Promise<void>;
  onInvite: () => void;
  onDownload: (format: DsExportFormat) => void;
  /** Saves pending edits before publishing. */
  beforePublish: () => Promise<void>;
}) {
  const { t, locale } = useI18n();
  const status = useForgeStatus();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("main");
  const [state, setState] = useState<PublishState | null>(null);
  const [copied, setCopied] = useState(false);
  const owner = Boolean(item?.owner.mine);
  const live = Boolean(state?.published_at);
  const exports = designSystemExportOptions(status);

  useEffect(() => {
    if (!owner) return;
    let alive = true;
    void publishStatus(projectId)
      .then((s) => alive && setState(s))
      .catch(() => alive && setState(null));
    return () => {
      alive = false;
    };
  }, [projectId, owner]);

  async function copy() {
    if (!state?.public_url) return;
    try {
      await navigator.clipboard.writeText(state.public_url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard refused: the link stays visible in the publish view */
    }
  }

  function header(title: string, back: boolean): ReactNode {
    return (
      <header className="dsh-head">
        {back ? (
          <button type="button" className="f-icon-btn f-icon-btn-sm" onClick={() => setView("main")} aria-label={t("dsHubBack")}>
            <Icon icon={ChevronLeft} />
          </button>
        ) : null}
        <strong>{title}</strong>
      </header>
    );
  }

  return (
    <Popover
      role="dialog"
      label={t("dsShare")}
      align="end"
      width={380}
      className="dsh-pop"
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setView("main");
      }}
      trigger={
        <button type="button" className="f-btn f-btn-primary f-btn-sm dsp-trigger">
          <Icon icon={Share2} className="ui-icon-sm" /> <span className="f-bd-lbl">{t("dsShare")}</span>
          {live ? <span className="dsp-live-dot" aria-label={t("dsPublishLive")} /> : null}
        </button>
      }
    >
      <div className="dsh">
        {view === "main" ? (
          <>
            {header(t("dsHubTitle"), false)}
            {item ? (
              <section className="dsh-section">
                <p className="dsh-label">{t("dsHubAccess")}</p>
                {owner ? (
                  <button type="button" className="f-btn f-btn-secondary dsh-invite" onClick={onInvite}>
                    <Icon icon={UserPlus} className="ui-icon-sm" /> {t("dsInvitePeople")}
                  </button>
                ) : null}
                <div className="dsh-access">
                  <span className="dsh-access-icon">
                    <Icon icon={item.visibility === "team" ? Users : Lock} />
                  </span>
                  <span className="dsh-access-text">
                    <strong>{item.visibility === "team" ? t("dsHubTeam") : t("dsHubPrivate")}</strong>
                    <small>{item.visibility === "team" ? t("dsVisibilityTeam") : t("dsVisibilityPrivate")}</small>
                  </span>
                  {item.can_share ? (
                    <button
                      type="button"
                      className="f-btn f-btn-ghost f-btn-sm"
                      onClick={() =>
                        void run(
                          async () => onItem(await (item.visibility === "team" ? unshare(projectId) : share(projectId))),
                          item.visibility === "team" ? "dsUnshared" : "dsShared",
                        )
                      }
                    >
                      {item.visibility === "team" ? t("dsUnshare") : t("dsShareTeam")}
                    </button>
                  ) : null}
                </div>
                {owner ? (
                  <Switch
                    on={item.is_default_user}
                    label={t("dsHubDefaultUser")}
                    onToggle={() => void run(async () => onItem(await setDefault(projectId, "user", !item.is_default_user)))}
                  />
                ) : null}
                {item.can_set_team_default ? (
                  <Switch
                    on={item.is_default_team}
                    label={t("dsHubDefaultTeam")}
                    onToggle={() => void run(async () => onItem(await setDefault(projectId, "team", !item.is_default_team)))}
                  />
                ) : null}
              </section>
            ) : null}
            <section className="dsh-tiles">
              {owner ? (
                <Tile
                  icon={Globe}
                  label={t("dsPublishButton")}
                  sub={live && state?.published_at ? sinceLabel(state.published_at, locale) : t("dsHubNotPublished")}
                  live={live}
                  onClick={() => setView("publish")}
                />
              ) : null}
              <Tile icon={Download} label={t("dsHubDownload")} sub={t("dsHubDownloadSub")} onClick={() => setView("download")} />
              {owner ? (
                <Tile
                  icon={Link2}
                  label={copied ? t("dsHubCopied") : t("dsPublishCopy")}
                  sub={live ? t("dsHubPublicPage") : t("dsHubPublishFirst")}
                  disabled={!live}
                  onClick={() => void copy()}
                />
              ) : null}
            </section>
          </>
        ) : view === "publish" ? (
          <>
            {header(t("dsPublishTitle"), true)}
            <PublishView
              projectId={projectId}
              doc={doc}
              state={state}
              onPublished={setState}
              beforePublish={beforePublish}
              onCopy={() => void copy()}
              copied={copied}
            />
          </>
        ) : (
          <>
            {header(t("dsHubDownload"), true)}
            <div className="dsh-formats">
              {exports.map(({ format, allowed }) => {
                const meta = FORMATS[format];
                return (
                  <button
                    key={format}
                    type="button"
                    className={`dsh-format${allowed ? "" : " is-locked"}`}
                    aria-disabled={allowed ? undefined : true}
                    onClick={() => {
                      if (!allowed) return;
                      setOpen(false);
                      setView("main");
                      onDownload(format);
                    }}
                  >
                    <span className="dsh-format-icon">
                      <Icon icon={allowed ? meta.icon : Lock} />
                    </span>
                    <span className="dsh-format-text">
                      <strong>{t(meta.label)}</strong>
                      <small>{allowed ? t(meta.hint) : t("apDsExportLocked")}</small>
                    </span>
                    {allowed ? <Icon icon={ChevronRight} className="ui-icon-sm" /> : null}
                  </button>
                );
              })}
              {exports.some((o) => !o.allowed) ? (
                <Link className="dse-plans-link" href={APP_ROUTES.billing}>
                  {t("apDsExportSeePlans")}
                </Link>
              ) : null}
            </div>
          </>
        )}
      </div>
    </Popover>
  );
}
