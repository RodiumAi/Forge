"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { getToken } from "@/lib/api";
import { Icon } from "@/components/ui/icon";
import { rodiumRechargeUrl } from "@/lib/constants/rodium-links";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  getSessionSnapshot,
  refreshRodiumWallet,
  subscribeSession,
  type SessionWallet,
} from "@/lib/session-cache";

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
  if (abs >= 1_000) return `${trim(asNumber / 1_000)}k`;
  return trim(asNumber);
}

function initialFromCache() {
  if (typeof window === "undefined") {
    return {
      linked: false,
      wallet: null as SessionWallet | null,
      rodiumSub: null as string | null,
    };
  }
  const snap = getSessionSnapshot();
  const linked = Boolean(snap?.rodium?.linked || snap?.profile?.rodium_linked);
  return {
    linked,
    wallet: snap?.rodium?.wallet ?? null,
    rodiumSub: snap?.profile?.rodium_sub ?? null,
  };
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
  const [wallet, setWallet] = useState<SessionWallet | null>(() => initialFromCache().wallet);
  const [linked, setLinked] = useState(() => initialFromCache().linked);
  const [rodiumSub, setRodiumSub] = useState<string | null>(
    () => initialFromCache().rodiumSub,
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    if (!getToken()) return;

    const apply = (snap: ReturnType<typeof getSessionSnapshot>) => {
      const nextLinked = Boolean(snap?.rodium?.linked || snap?.profile?.rodium_linked);
      setLinked(nextLinked);
      setRodiumSub(snap?.profile?.rodium_sub ?? null);
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

  // Avoid flashing the connect CTA before session cache has spoken.
  if (!hydrated && !linked && !hasWallet) return null;

  if (!hasWallet && !linked) {
    return (
      <Link
        href="/settings?tab=generation"
        className={`rodium-wallet-connect${compact || collapsed ? " rodium-wallet-connect-compact" : ""}`}
        title={t("connectRodiumAiHint")}
      >
        {collapsed ? null : compact ? t("connectRodiumAiShort") : t("connectRodiumAi")}
      </Link>
    );
  }

  if (!hasWallet) {
    return (
      <Link
        href="/settings?tab=generation"
        className={`rodium-wallet-connect${compact || collapsed ? " rodium-wallet-connect-compact" : ""}`}
        title={t("connectRodiumAiHint")}
      >
        {collapsed ? null : compact ? "RODI" : t("connectRodiumAi")}
      </Link>
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
          aria-label={balanceTitle}
        >
          <strong className="rodium-wallet-rail-amount">{compactBalance}</strong>
        </Link>
        <a
          href={rodiumRechargeUrl(rodiumSub)}
          className="rodium-wallet-recharge"
          title={t("rechargeRodi")}
          aria-label={t("rechargeRodi")}
          target="_blank"
          rel="noreferrer"
        >
          <Icon icon={Plus} className="ui-icon-sm" />
        </a>
      </div>
    );
  }

  return (
    <div className={`rodium-wallet-wrap${compact ? " rodium-wallet-wrap-compact" : ""}`}>
      <Link
        href="/settings?tab=generation"
        className="rodium-wallet-badge"
        title={balanceTitle}
      >
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
      <a
        href={rodiumRechargeUrl(rodiumSub)}
        className="rodium-wallet-recharge"
        title={t("rechargeRodi")}
        aria-label={t("rechargeRodi")}
        target="_blank"
        rel="noreferrer"
      >
        <Icon icon={Plus} className="ui-icon-sm" />
      </a>
    </div>
  );
}
