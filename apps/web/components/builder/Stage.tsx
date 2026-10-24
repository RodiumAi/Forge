"use client";

/**
 * The right side of the site and app builder: the bar above the preview (URL,
 * page, device, reload, open in a tab, test on a phone), the empty stage of a
 * new project, and the canvas that assembles itself while Forge builds.
 */

import QRCode from "qrcode";
import { useEffect, useState } from "react";

import { APP_ROUTES } from "@/components/shell/nav";
import { Button, IconButton } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Glyph } from "@/components/ui/glyph";
import { Popover } from "@/components/ui/Popover";
import { Segmented } from "@/components/ui/Tabs";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { kindStyle } from "@/lib/kind-style";
import type { ProjectKindId } from "@/lib/kinds";
import type { ViewportMode } from "./types";

/** The stepped Forge mark (also the FRODI meter motif). */
export function StepsMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1000 1000" className={className} aria-hidden>
      <path fill="currentColor" d="M0 0H1000V1000H740V785H525V735H475V525H260V475H215V260H0Z" />
    </svg>
  );
}

export type StageActivity = { kind: "building" } | { kind: "paused"; step?: number; total?: number } | null;

type PreviewBarProps = {
  platform: "web" | "mobile";
  url: string;
  pages: string[];
  previewPath: string;
  onPreviewPathChange: (path: string) => void;
  viewport: ViewportMode;
  onViewportChange: (v: ViewportMode) => void;
  previewBusy: boolean;
  onRefresh: () => void;
  onOpenExternal: () => void;
  /** Draft link encoded in the "Test on my phone" QR code. */
  phoneUrl?: string | null;
  activity?: StageActivity;
};

/** The bar above the preview. */
export function PreviewBar({
  platform,
  url,
  pages,
  previewPath,
  onPreviewPathChange,
  viewport,
  onViewportChange,
  previewBusy,
  onRefresh,
  onOpenExternal,
  phoneUrl,
  activity,
}: PreviewBarProps) {
  const { t } = useI18n();
  const devices =
    platform === "mobile"
      ? ([
          { id: "phone", label: <Glyph name="smartphone" size="sm" label={t("bdPhone")} /> },
          { id: "tablet", label: <Glyph name="tablet" size="sm" label={t("bdTablet")} /> },
        ] as const)
      : ([
          { id: "desktop", label: <Glyph name="monitor" size="sm" label={t("bdDesktop")} /> },
          { id: "tablet", label: <Glyph name="tablet" size="sm" label={t("bdTablet")} /> },
          { id: "phone", label: <Glyph name="smartphone" size="sm" label={t("bdPhone")} /> },
        ] as const);
  const list = pages.length ? pages : ["/"];

  let pill = (
    <span className="f-bd-url" title={url}>
      <Glyph name={platform === "mobile" ? "smartphone" : "lock"} size="sm" />
      <span>{url}</span>
    </span>
  );
  if (activity?.kind === "building") {
    pill = (
      <span className="f-bd-url is-busy" role="status">
        <Glyph name="refresh" size="sm" className="f-spin" />
        <span>{t("bdBuilding")}</span>
      </span>
    );
  } else if (activity?.kind === "paused") {
    pill = (
      <span className="f-bd-url is-paused" role="status">
        <Glyph name="pause" size="sm" />
        <span>
          {activity.step && activity.total
            ? t("bdPaused").replace("{n}", String(activity.step)).replace("{total}", String(activity.total))
            : t("bdPausedPlain")}
        </span>
      </span>
    );
  }

  return (
    <div className="f-bd-stagebar">
      {pill}
      {list.length > 1 || platform === "web" ? (
        <label className="f-bd-select">
          <span className="f-sr-only">{t("bdPageLabel")}</span>
          <select value={previewPath || "/"} onChange={(e) => onPreviewPathChange(e.target.value)}>
            {list.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <Glyph name="chevron-down" size="xs" />
        </label>
      ) : null}
      <span className="sp" />
      {platform === "mobile" && phoneUrl ? <PhoneTest url={phoneUrl} /> : null}
      <Segmented
        className="f-bd-devices"
        label={t("bdDevices")}
        value={viewport}
        onChange={(v) => onViewportChange(v as ViewportMode)}
        items={devices}
      />
      <IconButton
        icon="refresh"
        size="sm"
        label={t("bdRefresh")}
        onClick={onRefresh}
        disabled={previewBusy}
        className={previewBusy ? "is-busy" : undefined}
      />
      <IconButton icon="expand" size="sm" label={t("bdOpenTab")} onClick={onOpenExternal} className="f-bd-hide-mob" />
    </div>
  );
}

/** "Test on my phone": QR code of the draft link. */
function PhoneTest({ url }: { url: string }) {
  const { t } = useI18n();
  const [qr, setQr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    QRCode.toDataURL(url, { margin: 1, width: 200, errorCorrectionLevel: "M" })
      .then((data) => alive && setQr(data))
      .catch(() => alive && setQr(null));
    return () => {
      alive = false;
    };
  }, [open, url]);
  return (
    <Popover
      align="end"
      role="dialog"
      label={t("bdTestOnPhone")}
      width={260}
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button size="sm" variant="ghost" icon="qr">
          <span className="f-btn-label">{t("bdTestOnPhone")}</span>
        </Button>
      }
    >
      <div className="f-bd-phoneqr">
        {qr ? <img src={qr} alt="" width={180} height={180} /> : <span className="f-skel" style={{ width: 180, height: 180 }} />}
        <p>{t("bdTestOnPhoneHint")}</p>
      </div>
    </Popover>
  );
}

/** A new project: what will appear here, and a way out to the templates. */
export function EmptyStage({ kind, onShowPreview }: { kind: ProjectKindId; onShowPreview?: () => void }) {
  const { t } = useI18n();
  const k = kindStyle(kind);
  const label = t(k.labelKey).toLowerCase();
  return (
    <div className="f-bd-empty">
      <div className="big" style={{ color: k.color }}>
        <StepsMark />
      </div>
      <h2>{t("bdEmptyStageTitle").replace("{kind}", label)}</h2>
      <p className="f-bd-hide-mob">{t("bdEmptyStageBody")}</p>
      <p className="f-bd-only-mob">{t("bdEmptyStageBodyMob")}</p>
      <div className="row">
        <Button variant="ghost" size="sm" icon="layers" href={APP_ROUTES.templates}>
          {t("bdBrowseTemplates")}
        </Button>
        {onShowPreview ? (
          <Button variant="subtle" size="sm" icon="eye" onClick={onShowPreview}>
            {t("bdShowPreview")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Spots the Forge cursor visits while the canvas assembles (percent of the canvas). */
const CURSOR_PATH: Array<[number, number]> = [
  [12, 14],
  [70, 12],
  [30, 34],
  [52, 52],
  [22, 72],
  [74, 78],
];

/**
 * First generation of a project with nothing to preview yet: skeleton blocks
 * appear one by one with the Forge cursor moving over them. Paused, it stops
 * where the run stopped.
 */
export function BuildCanvas({ phone, paused, progress = 0 }: { phone?: boolean; paused?: boolean; progress?: number }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (paused) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1300);
    return () => window.clearInterval(id);
  }, [paused]);
  const total = phone ? 5 : 6;
  // Blocks shown: grows with time, never below the run's own progress.
  const shown = Math.min(total, Math.max(1 + Math.floor(progress * total), paused ? Math.ceil(progress * total) : 1 + (tick % (total + 2))));
  const [cx1, cy1] = CURSOR_PATH[(shown - 1 + CURSOR_PATH.length) % CURSOR_PATH.length];
  const on = (i: number) => cx("blk", i < shown && "on");

  return (
    <div className={cx("f-bd-build", phone && "phone", paused && "paused")} aria-hidden>
      {phone ? (
        [30, 46, 18, 18, 18].map((h, i) => (
          <div key={i} className={cx(on(i), "f-skel")} style={{ height: `${h}cqw`, minHeight: h * 1.6, borderRadius: 14 }} />
        ))
      ) : (
        <>
          <div className={cx(on(0), "row")}>
            <span className="f-skel" style={{ width: "18%", height: 14 }} />
            <span style={{ display: "flex", gap: 10, width: "36%" }}>
              <span className="f-skel" style={{ flex: 1, height: 10 }} />
              <span className="f-skel" style={{ flex: 1, height: 10 }} />
              <span className="f-skel" style={{ flex: 1, height: 10 }} />
            </span>
          </div>
          <div style={{ display: "grid", gap: 14 }}>
            <span className={cx(on(1), "f-skel")} style={{ width: "62%", height: 34 }} />
            <span className={cx(on(2), "f-skel")} style={{ width: "44%", height: 34 }} />
            <span className={cx(on(2), "f-skel")} style={{ width: "36%", height: 12 }} />
          </div>
          <div className="grid">
            <span className={cx(on(3), "f-skel")} style={{ minHeight: 90 }} />
            <span className={cx(on(4), "f-skel")} style={{ minHeight: 90 }} />
            <span className={cx(on(5), "f-skel")} style={{ minHeight: 90 }} />
          </div>
        </>
      )}
      {!paused ? (
        <span className="f-bd-cursor" style={{ left: `${cx1}%`, top: `${cy1}%` }}>
          <img src="/brand/forge/forge-app-icon-orange.svg" alt="" />
        </span>
      ) : null}
    </div>
  );
}
