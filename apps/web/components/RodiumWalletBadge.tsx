"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getToken } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  getSessionSnapshot,
  refreshRodiumWallet,
  subscribeSession,
  type SessionWallet,
} from "@/lib/session-cache";
import {
  isForgeStatusSettled,
  refreshForgeStatus,
  subscribeForgeStatus,
  useForgeStatus,
} from "@/lib/forge-status";
import { frodiUsage } from "@/lib/frodi-usage";

const POLL_MS = 45_000;

function formatRodi(value: string | null | undefined, locale: string): string {
  if (value == null || value === "") return "—";
  const normalized = value.replace(",", ".");
  const asNumber = Number(normalized);
  if (!Number.isFinite(asNumber)) return value;
  try {
    return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
      maximumFractionDigits: 2,
    }).format(asNumber);
  } catch {
    return value;
  }
}

/** Short balance for the 64px rail (e.g. 7.7k, 1.2M). */
function formatRodiCompact(value: string | null | undefined): string {
  if (value == null || value === "") return "—";
  const asNumber = Number(String(value).replace(",", "."));
  if (!Number.isFinite(asNumber)) return "—";
  const abs = Math.abs(asNumber);
  const trim = (n: number) =>
    n
      .toFixed(n >= 10 || Number.isInteger(n) ? 0 : 1)
      .replace(/\.0$/, "");
  if (abs >= 1_000_000) return `${trim(asNumber / 1_000_000)}M`;
  if (abs >= 10_000) return `${trim(asNumber / 1_000)}k`;
  // Below 10k the rail shows the figure itself. Rounding 1989.6 up to "2k"
  // hid a debit that should be visible after every prompt.
  if (Number.isInteger(asNumber)) return String(Math.trunc(asNumber));
  return asNumber.toFixed(1);
}

function initialFromCache() {
  if (typeof window === "undefined") {
    return {
      linked: false,
      wallet: null as SessionWallet | null,
    };
  }
  const snap = getSessionSnapshot();
  const linked = Boolean(snap?.rodium?.linked || snap?.profile?.rodium_linked);
  return {
    linked,
    wallet: snap?.rodium?.wallet ?? null,
  };
}

const NEXT_PLAN: Record<string, string> = {
  free: "Starter",
  starter: "Builder",
  builder: "Pro",
  pro: "Scale",
};

export function planDisplayName(slug: string | null | undefined): string | null {
  if (!slug) return null;
  if (slug === "team-pro") return "Team (Pro)";
  if (slug === "team-scale") return "Team (Scale)";
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

export function nextPlanName(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return NEXT_PLAN[slug] ?? null;
}

function PlanSkeleton({ compact }: { compact?: boolean }) {
  return (
    <span
      className={`rodium-wallet-badge rodium-wallet-pending${compact ? " rodium-wallet-connect-compact" : ""}`}
      aria-busy="true"
    >
      <span className="home-skel rodium-wallet-skel-name" />
      <span className="home-skel rodium-wallet-skel-meter" />
    </span>
  );
}

export function RodiumWalletBadge({
  compact = false,
  collapsed = false,
}: {
  compact?: boolean;
  /** Narrow rail: icon + recharge only (full balance stays in title). */
  collapsed?: boolean;
}) {
  const { t, locale } = useI18n();
  const forge = useForgeStatus();
  const [forgeSettled, setForgeSettled] = useState(isForgeStatusSettled);
  const [wallet, setWallet] = useState<SessionWallet | null>(() => initialFromCache().wallet);
  const [linked, setLinked] = useState(() => initialFromCache().linked);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const unsub = subscribeForgeStatus(() => setForgeSettled(isForgeStatusSettled()));
    setForgeSettled(isForgeStatusSettled());
    return unsub;
  }, []);

  useEffect(() => {
    setHydrated(true);
    if (!getToken()) return;

    const apply = (snap: ReturnType<typeof getSessionSnapshot>) => {
      const nextLinked = Boolean(snap?.rodium?.linked || snap?.profile?.rodium_linked);
      setLinked(nextLinked);
      if (snap?.rodium?.wallet !== undefined) {
        setWallet(snap.rodium.wallet ?? null);
      }
    };
    apply(getSessionSnapshot());
    const unsub = subscribeSession(apply);

    const pull = () => {
      if (!getToken()) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void refreshRodiumWallet();
      void refreshForgeStatus();
    };

    pull();

    const onFocus = () => pull();
    const onVis = () => {
      if (document.visibilityState === "visible") pull();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    const timer = window.setInterval(pull, POLL_MS);

    return () => {
      unsub();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(timer);
    };
  }, []);

  const hasWallet =
    wallet != null &&
    (wallet.balance_rodi != null || wallet.provided_total_rodi != null);

  // FRODI is the primary reservoir on Forge Cloud; RODI is the fallback wallet.
  // Off Forge Cloud (open-source / unlinked) `frodi` is null and this badge
  // behaves exactly as before, showing RODI only.
  const frodi = forge?.frodi ?? null;
  const hasFrodi = frodi != null;

  // Avoid flashing the connect CTA before session cache has spoken.
  // The session cache has RODI immediately. Wait for the Forge status fetch
  // so the sidebar does not flash RODI and then jump to FRODI.
  if (!forgeSettled && !hasFrodi) {
    return <PlanSkeleton compact={compact || collapsed} />;
  }

  if (!hydrated && !linked && !hasWallet && !hasFrodi) return null;

  if (!hasWallet && !linked && !hasFrodi) {
    return null;
  }

  if (!hasWallet && !hasFrodi) {
    // Settled with neither FRODI nor RODI: hide (no infinite skeleton).
    return null;
  }

  // FRODI-primary path: show the plan reservoir up front, with RODI as the
  // fallback line, while keeping the same recharge deep-link.
  const planSlug = forge?.plan ?? forge?.entitlements?.plan_slug ?? null;
  const planName = planDisplayName(planSlug);

  if (hasFrodi) {
    const usage = frodiUsage(forge);
    const usedPct = usage?.usedPct ?? 0;
    const frodiFull = formatRodi(String(frodi), locale);
    const frodiTitle = planName
      ? `${planName} · ${t("balanceFrodi")}: ${frodiFull}`
      : `${t("balanceFrodi")}: ${frodiFull}`;
    const meter = (
      <span className="rodium-wallet-meter" aria-hidden>
        <span style={{ width: `${usedPct}%` }} />
      </span>
    );

    if (collapsed) {
      return (
        <div className="rodium-wallet-wrap rodium-wallet-wrap-compact rodium-wallet-wrap-rail">
          <Link
            href="/settings?tab=generation"
            className="rodium-wallet-badge rodium-wallet-badge-rail"
            title={frodiTitle}
          >
            {meter}
          </Link>
        </div>
      );
    }

    return (
      <div className={`rodium-wallet-wrap${compact ? " rodium-wallet-wrap-compact" : ""}`}>
        <Link href="/settings?tab=generation" className="rodium-wallet-badge" title={frodiTitle}>
          {planName ? <span className="rodium-wallet-plan">{planName}</span> : <span>…</span>}
          {meter}
        </Link>
      </div>
    );
  }

  const balance = formatRodi(wallet?.balance_rodi, locale);
  const provided = formatRodi(wallet?.provided_total_rodi, locale);
  const providedNum = Number(String(wallet?.provided_total_rodi ?? "").replace(",", "."));
  const showProvided = Number.isFinite(providedNum) && providedNum > 0;
  const balanceTitle = showProvided
    ? `${t("balanceRodi")}: ${balance} · ${t("providedRodi")}: ${provided}`
    : `${t("balanceRodi")}: ${balance}`;

  if (collapsed) {
    const compactBalance = formatRodiCompact(wallet?.balance_rodi);
    return (
      <div className="rodium-wallet-wrap rodium-wallet-wrap-compact rodium-wallet-wrap-rail">
        <Link
          href="/settings?tab=generation"
          className="rodium-wallet-badge rodium-wallet-badge-rail"
          title={balanceTitle}
        >
          <strong className="rodium-wallet-rail-amount">{compactBalance}</strong>
        </Link>
      </div>
    );
  }

  return (
    <div className={`rodium-wallet-wrap${compact ? " rodium-wallet-wrap-compact" : ""}`}>
      <Link href="/settings?tab=generation" className="rodium-wallet-badge" title={balanceTitle}>
        <span className="rodium-wallet-main">
          <strong>{balance}</strong>
          <span>RODI</span>
        </span>
        {showProvided && !compact ? (
          <span className="rodium-wallet-provided">
            {provided} {t("walletProvidedShort")}
          </span>
        ) : null}
      </Link>
    </div>
  );
}
