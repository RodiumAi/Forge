"use client";

/**
 * Cover page (kicker, title, presenter, highlights, QR code of the published
 * page), presenter page and setup page ("prepare your environment") of the
 * codelab player. Everything is optional in codelab.json: an old codelab
 * renders a plain cover.
 */

import {
  BarChart3,
  Check,
  Clock,
  Copy,
  ExternalLink,
  GitBranch,
  ListOrdered,
  QrCode as QrIcon,
  Sparkles,
  Ticket,
  Wrench,
} from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";

import type { Codelab } from "@/lib/contracts/forge-design";

import { useRenderEnv, type DownloadInfo } from "./context";
import { CodeBlock } from "./markdown/CodeBlock";
import { copyToClipboard } from "./markdown/copy";
import { parseFenceInfo } from "./markdown/fence";
import { DownloadCards } from "./markdown/Markdown";
import { presenterOf } from "./navigation";
import type { StringKey, Translate } from "./strings";

const LEVEL_KEYS: Record<Codelab["level"], StringKey> = {
  beginner: "levelBeginner",
  intermediate: "levelIntermediate",
  advanced: "levelAdvanced",
};

/** QR code as an SVG (synchronous, so it prints with the page). */
export function QrCode({ text, label }: { text: string; label: string }) {
  const shape = useMemo(() => {
    try {
      const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
      const n = qr.modules.size;
      let d = "";
      for (let row = 0; row < n; row += 1) {
        for (let col = 0; col < n; col += 1) {
          if (qr.modules.get(row, col)) d += `M${col + 2} ${row + 2}h1v1h-1z`;
        }
      }
      return { size: n + 4, d };
    } catch {
      return null;
    }
  }, [text]);
  if (!shape) return null;
  return (
    <svg
      className="fcl-qr"
      viewBox={`0 0 ${shape.size} ${shape.size}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      data-qr={text}
    >
      <rect width={shape.size} height={shape.size} fill="#fff" />
      <path d={shape.d} fill="#000" />
    </svg>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function Avatar({ name, photo, size }: { name: string; photo?: string; size: "sm" | "lg" }) {
  const { assetUrl } = useRenderEnv();
  return photo ? (
    <img className="fcl-avatar" data-size={size} src={assetUrl(photo)} alt={name} />
  ) : (
    <span className="fcl-avatar" data-size={size} aria-hidden>
      {initials(name) || "?"}
    </span>
  );
}

function LinkChips({ links }: { links: { label: string; url: string }[] }) {
  if (!links.length) return null;
  return (
    <ul className="fcl-chips">
      {links.map((link, i) => (
        <li key={i}>
          <a className="fcl-chip" href={link.url} target="_blank" rel="noopener noreferrer">
            {link.label}
            <ExternalLink size={12} aria-hidden />
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Title with its last word in the accent colour, like a poster. */
function AccentTitle({ title }: { title: string }) {
  const trimmed = title.trim();
  const at = trimmed.lastIndexOf(" ");
  if (at <= 0) return <h1>{trimmed}</h1>;
  return (
    <h1>
      {trimmed.slice(0, at + 1)}
      <span className="fcl-accent">{trimmed.slice(at + 1)}</span>
    </h1>
  );
}

export function Cover({
  codelab,
  titles,
  downloads,
  publicUrl,
  showQrPlaceholder,
  hidePrerequisites,
  t,
}: {
  codelab: Codelab;
  titles: string[];
  downloads: DownloadInfo[];
  publicUrl?: string;
  /** Editor preview: say the QR code comes with publishing. */
  showQrPlaceholder?: boolean;
  /** The setup page lists them instead. */
  hidePrerequisites?: boolean;
  t: Translate;
}) {
  const cover = codelab.cover;
  const presenter = presenterOf(codelab);
  const highlights = (cover?.highlights ?? []).filter((line) => line.trim());
  const prerequisites = hidePrerequisites ? [] : (codelab.prerequisites ?? []);
  const learn = codelab.learn ?? [];
  const qrWanted = cover?.showQr !== false;
  const qr = qrWanted && publicUrl ? publicUrl : null;
  const qrPlaceholder = qrWanted && !publicUrl && showQrPlaceholder;
  return (
    <section className="fcl-hero" data-cover="">
      <div className="fcl-cover" data-has-qr={qr || qrPlaceholder ? "" : undefined}>
        <div className="fcl-cover-main">
          {cover?.eyebrow?.trim() ? <p className="fcl-kicker">{cover.eyebrow.trim()}</p> : null}
          <AccentTitle title={codelab.title} />
          {codelab.summary ? <p className="fcl-lead">{codelab.summary}</p> : null}
          {presenter && presenter.name ? (
            <div className="fcl-presented">
              <Avatar name={presenter.name} photo={presenter.photo} size="sm" />
              <div>
                <p className="fcl-presented-label">{t("presentedBy")}</p>
                <p className="fcl-presented-name">
                  {presenter.url ? (
                    <a href={presenter.url} target="_blank" rel="noopener noreferrer">
                      {presenter.name}
                    </a>
                  ) : (
                    presenter.name
                  )}
                </p>
                {presenter.role || presenter.company ? (
                  <p className="fcl-presented-role">
                    {presenter.role}
                    {presenter.role && presenter.company ? " · " : ""}
                    {presenter.company ? <span className="fcl-accent">{presenter.company}</span> : null}
                  </p>
                ) : null}
                <LinkChips links={presenter.links} />
              </div>
            </div>
          ) : null}
          {highlights.length ? (
            <ul className="fcl-highlights">
              {highlights.map((line, i) => (
                <li key={i}>
                  <Sparkles size={14} aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <ul className="fcl-facts">
            <li>
              <Clock size={14} aria-hidden />
              {t("duration")} : {t("minutes", { n: codelab.durationMinutes })}
            </li>
            <li>
              <BarChart3 size={14} aria-hidden />
              {t("level")} : {t(LEVEL_KEYS[codelab.level])}
            </li>
            <li>
              <ListOrdered size={14} aria-hidden />
              {t("steps")} : {titles.length}
            </li>
          </ul>
        </div>
        {qr ? (
          <figure className="fcl-qr-card">
            <QrCode text={qr} label={t("scanQr")} />
            <figcaption>
              <b>{t("scanQr")}</b>
              <a href={qr}>{qr.replace(/^https:\/\//, "").replace(/\/$/, "")}</a>
            </figcaption>
          </figure>
        ) : qrPlaceholder ? (
          <div className="fcl-qr-card fcl-qr-pending fcl-no-print" data-qr-placeholder="">
            <QrIcon size={40} aria-hidden />
            <span>{t("qrPending")}</span>
          </div>
        ) : null}
      </div>
      {prerequisites.length || learn.length ? (
        <div className="fcl-cards">
          {learn.length ? (
            <div className="fcl-card">
              <h2>{t("learn")}</h2>
              <ul>
                {learn.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {prerequisites.length ? (
            <div className="fcl-card">
              <h2>{t("prerequisites")}</h2>
              <ul>
                {prerequisites.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
      {downloads.length ? (
        <>
          <h2 className="fcl-card-title" style={{ fontSize: 18 }}>
            {t("downloads")}
          </h2>
          <DownloadCards items={downloads} />
        </>
      ) : null}
      {codelab.repoUrl ? (
        <p>
          <a href={codelab.repoUrl} target="_blank" rel="noopener noreferrer">
            <GitBranch size={14} aria-hidden style={{ verticalAlign: "-2px" }} /> {t("openRepo")}{" "}
            <ExternalLink size={12} aria-hidden />
          </a>
        </p>
      ) : null}
    </section>
  );
}

export function PresenterPage({ codelab, t }: { codelab: Codelab; t: Translate }) {
  const presenter = presenterOf(codelab);
  if (!presenter) return null;
  const paragraphs = (presenter.bio ?? "").split(/\n\s*\n/).filter((p) => p.trim());
  return (
    <section className="fcl-hero fcl-page" data-page="presenter">
      <p className="fcl-kicker">{t("presenter")}</p>
      <div className="fcl-person">
        <Avatar name={presenter.name} photo={presenter.photo} size="lg" />
        <div className="fcl-person-text">
          <h1>{presenter.name || t("presenter")}</h1>
          {presenter.role || presenter.company ? (
            <p className="fcl-presented-role">
              {presenter.role}
              {presenter.role && presenter.company ? " · " : ""}
              {presenter.company ? <span className="fcl-accent">{presenter.company}</span> : null}
            </p>
          ) : null}
          {paragraphs.map((text, i) => (
            <p key={i} className="fcl-bio">
              {text}
            </p>
          ))}
          <LinkChips links={presenter.links} />
          {presenter.url && !presenter.links.some((link) => link.url === presenter.url) ? (
            <p>
              <a href={presenter.url} target="_blank" rel="noopener noreferrer">
                {presenter.url.replace(/^https:\/\//, "")} <ExternalLink size={12} aria-hidden />
              </a>
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function CopyChip({ text, label }: { text: string; label: string }) {
  const { t } = useRenderEnv();
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 1600);
    return () => clearTimeout(timer);
  }, [state]);
  return (
    <button
      type="button"
      className="fcl-code-chip"
      data-state={state}
      title={t("copy")}
      aria-label={`${label} ${text}`}
      onClick={async () => setState((await copyToClipboard(text)) ? "copied" : "failed")}
    >
      <code>{text}</code>
      {state === "copied" ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
    </button>
  );
}

export function SetupPage({ codelab, t }: { codelab: Codelab; t: Translate }) {
  const setup = codelab.setup ?? {};
  const tools = setup.tools ?? [];
  const groups = (setup.groups ?? []).filter((group) => group.items.length || group.title.trim());
  const commands = setup.commands ?? [];
  const prerequisites = codelab.prerequisites ?? [];
  return (
    <section className="fcl-hero fcl-page" data-page="setup">
      <p className="fcl-kicker">{t("setupTag")}</p>
      <h1>{t("setupTitle")}</h1>
      {setup.intro?.trim() ? <p className="fcl-lead">{setup.intro.trim()}</p> : null}
      {setup.promo?.code ? (
        <div className="fcl-promo" data-promo="">
          <Ticket size={20} aria-hidden />
          <div>
            <p className="fcl-promo-label">{setup.promo.label?.trim() || t("promoCode")}</p>
            <div className="fcl-promo-row">
              <CopyChip text={setup.promo.code} label={t("promoCode")} />
              {setup.promo.url ? (
                <a href={setup.promo.url} target="_blank" rel="noopener noreferrer">
                  {t("openLink")} <ExternalLink size={12} aria-hidden />
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {tools.length ? (
        <>
          <h2 className="fcl-section-title">
            <Wrench size={16} aria-hidden /> {t("tools")}
          </h2>
          <ul className="fcl-tools">
            {tools.map((tool, i) => (
              <li key={i}>
                {tool.url ? (
                  <a href={tool.url} target="_blank" rel="noopener noreferrer">
                    {tool.name}
                  </a>
                ) : (
                  <span>{tool.name}</span>
                )}
                {tool.version ? <small>{tool.version}</small> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {groups.length ? (
        <div className="fcl-setup-groups">
          {groups.map((group, g) => (
            <div key={g} className="fcl-card fcl-setup-group">
              <h2>{group.title}</h2>
              <ol>
                {group.items.map((item, i) => (
                  <li key={i}>
                    <span className="fcl-step-num">{i + 1}</span>
                    <span className="fcl-setup-item">
                      {item.url ? (
                        <a href={item.url} target="_blank" rel="noopener noreferrer">
                          {item.text}
                        </a>
                      ) : (
                        item.text
                      )}
                      {item.code ? <CopyChip text={item.code} label={t("copy")} /> : null}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      ) : null}
      {commands.length ? (
        <>
          <h2 className="fcl-section-title">{t("commands")}</h2>
          {commands.map((command, i) => (
            <div key={i} className="fcl-command">
              {command.label?.trim() ? <p className="fcl-command-label">{command.label.trim()}</p> : null}
              <CodeBlock fence={parseFenceInfo(`${command.language || "bash"} nolines`)} code={command.code} />
            </div>
          ))}
        </>
      ) : null}
      {prerequisites.length ? (
        <div className="fcl-card" style={{ marginTop: 8 }}>
          <h2>{t("prerequisites")}</h2>
          <ul>
            {prerequisites.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
