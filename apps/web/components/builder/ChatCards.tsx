"use client";

/**
 * The cards of the redesigned chat that are not tied to a stream event: the
 * greeting with suggestions on an empty project, the "files updated" summary
 * after a run, the follow-up chips, the out-of-FRODI card and the plain error
 * card. Plan, activity and clarify cards live in their own components.
 */

import type { ReactNode } from "react";

import { nextPlanName } from "@/components/RodiumWalletBadge";
import { APP_ROUTES } from "@/components/shell/nav";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Glyph } from "@/components/ui/glyph";
import { renewPhrase } from "@/components/FrodiUsageBanner";
import { useForgeStatus, type ForgeStatus } from "@/lib/forge-status";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { ProjectKindId } from "@/lib/kinds";

/** "Forge" header of an assistant turn, with an optional right label (model, effort). */
export function ForgeWho({ right, streaming }: { right?: ReactNode; streaming?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="f-bd-who">
      <img src="/brand/forge/forge-app-icon-orange.svg" alt="" width={22} height={22} />
      {t("bdForge")}
      {streaming ? <Glyph name="refresh" size="xs" className="f-spin" /> : null}
      {right ? <span className="r">{right}</span> : null}
    </div>
  );
}

const SUGGESTIONS: Partial<Record<ProjectKindId, MessageKey[]>> = {
  web: ["bdSuggestWeb1", "bdSuggestWeb2", "bdSuggestWeb3"],
  mobile: ["bdSuggestMobile1", "bdSuggestMobile2", "bdSuggestMobile3"],
};

const FOLLOW_UPS: MessageKey[] = ["bdFollowAddPage", "bdFollowColours", "bdFollowShorter"];

/** Empty project: greeting and three ideas that fill the composer. */
export function EmptyChat({
  kind,
  firstName,
  editing,
  onPick,
}: {
  kind: ProjectKindId;
  firstName?: string | null;
  /** The project already has content (a template): suggest changes, not ideas. */
  editing?: boolean;
  onPick: (text: string) => void;
}) {
  const { t } = useI18n();
  const keys = editing ? FOLLOW_UPS : (SUGGESTIONS[kind] ?? SUGGESTIONS.web!);
  const name = firstName ? ` ${firstName}` : "";
  return (
    <div className="f-bd-msg f-bd-msg-ai">
      <ForgeWho />
      <p style={{ margin: 0 }}>{t(editing ? "bdEmptyHelloEditor" : "bdEmptyHello").replace("{name}", name)}</p>
      <div className="f-bd-suggests">
        {keys.map((key) => (
          <button key={key} type="button" onClick={() => onPick(t(key))}>
            <Glyph name="sparkles" size="sm" />
            {t(key)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Summary after a finished run: files touched, then where to look or how to undo. */
export function DoneCard({
  files,
  onViewChanges,
  onUndo,
}: {
  files: number;
  onViewChanges?: () => void;
  onUndo?: () => void;
}) {
  const { t } = useI18n();
  const title =
    files === 0 ? t("bdDoneNoFiles") : files === 1 ? t("bdDoneFile") : t("bdDoneFiles").replace("{n}", String(files));
  return (
    <section className="f-bd-card f-bd-card-ok">
      <div className="f-bd-card-head">
        <Glyph name="check" size="sm" />
        {title}
      </div>
      {onViewChanges || onUndo ? (
        <div className="f-bd-card-actions">
          {onViewChanges ? (
            <Button size="sm" variant="ghost" icon="code" onClick={onViewChanges}>
              {t("bdViewChanges")}
            </Button>
          ) : null}
          {onUndo ? (
            <Button size="sm" variant="ghost" icon="undo" onClick={onUndo}>
              {t("bdUndo")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** Follow-up chips under the last answer; a click fills the composer. */
export function FollowUps({ onPick }: { onPick: (text: string) => void }) {
  const { t } = useI18n();
  return (
    <div className="f-bd-chips">
      {FOLLOW_UPS.map((key) => (
        <button key={key} type="button" onClick={() => onPick(t(key))}>
          {t(key)}
        </button>
      ))}
    </div>
  );
}

/** A generic error or warning card in the thread. */
export function ErrorCard({
  tone = "error",
  title,
  children,
  live,
}: {
  tone?: "error" | "warning";
  title?: ReactNode;
  children: ReactNode;
  live?: boolean;
}) {
  return (
    <section
      className={cx("f-bd-card", tone === "warning" ? "f-bd-card-warn" : "f-bd-card-err")}
      role={live ? "alert" : undefined}
    >
      {title ? (
        <div className="f-bd-card-head">
          <Glyph name="alert" size="sm" />
          {title}
        </div>
      ) : null}
      <div className="f-bd-card-body" style={title ? undefined : { paddingTop: 14 }}>
        {children}
      </div>
    </section>
  );
}

/**
 * The week's (or month's on Free) FRODI are gone and the run stopped. Forge
 * Cloud falls back to the RODI wallet on its own, so "continue" just resumes
 * or re-runs; when the wallet is empty too the server says so and the card
 * offers the top up instead. The RODI amount is never shown here.
 */
export function OutOfFrodiCard({
  step,
  total,
  walletEmpty,
  onContinue,
  rechargeHref,
  busy,
  status: statusOverride,
}: {
  /** 1-based step the plan stopped at, when there was a plan. */
  step?: number;
  total?: number;
  walletEmpty?: boolean;
  onContinue?: () => void;
  rechargeHref?: string;
  busy?: boolean;
  /** Overrides the live account status (the dev states page). */
  status?: ForgeStatus | null;
}) {
  const { t } = useI18n();
  const live = useForgeStatus();
  const status = statusOverride !== undefined ? statusOverride : live;
  const plan = status?.plan ?? status?.entitlements?.plan_slug ?? null;
  const monthly = plan === "free";
  const next = nextPlanName(plan);
  const when = renewPhrase(status?.frodi_resets_at ?? null, t);
  const body = (step && total ? t("bdOutBodyStep").replace("{n}", String(step)).replace("{total}", String(total)) : t("bdOutBody")).replace(
    "{when}",
    when,
  );
  return (
    <section className="f-bd-card f-bd-card-err" role="alert">
      <div className="f-bd-card-head">
        <Glyph name="alert" size="sm" />
        {t(monthly ? "bdOutTitleMonth" : "bdOutTitle")}
      </div>
      <div className="f-bd-card-body">
        <p className="f-bd-card-text">{body}</p>
      </div>
      <div className="f-bd-card-actions">
        {walletEmpty && rechargeHref ? (
          <Button size="sm" icon="wallet" href={rechargeHref} external>
            {t("chatActionRecharge")}
          </Button>
        ) : onContinue ? (
          <Button size="sm" icon="wallet" disabled={busy} onClick={onContinue}>
            {t("bdOutContinue")}
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" icon="zap" href={`${APP_ROUTES.billing}#plans`}>
          {next ? t("bdUpgradeTo").replace("{plan}", next) : t("bdSeePlans")}
        </Button>
      </div>
    </section>
  );
}
