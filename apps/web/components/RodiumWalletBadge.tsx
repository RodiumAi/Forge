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

function initialFromCache() {
  if (typeof window === "undefined") return { linked: false, wallet: null as SessionWallet | null };
  const snap = getSessionSnapshot();
  const linked = Boolean(snap?.rodium?.linked || snap?.profile?.rodium_linked);
  return { linked, wallet: snap?.rodium?.wallet ?? null };
}

export function RodiumWalletBadge() {
  const { t, locale } = useI18n();
  const [wallet, setWallet] = useState<SessionWallet | null>(() => initialFromCache().wallet);
  const [linked, setLinked] = useState(() => initialFromCache().linked);

  useEffect(() => {
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
    };

    // Always fresh on mount — soft TTL previously froze the login-time balance.
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

  if (!linked) return null;

  const balance = formatRodi(wallet?.balance_rodi, locale);
  const provided = formatRodi(wallet?.provided_total_rodi, locale);

  return (
    <Link
      href="/connectors/rodiumai"
      className="rodium-wallet-badge"
      title={`${t("balanceRodi")}: ${balance} · ${t("providedRodi")}: ${provided}`}
    >
      <span className="rodium-wallet-main">
        <strong>{balance}</strong>
        <span>RODI</span>
      </span>
      <span className="rodium-wallet-provided">
        {provided} {t("walletProvidedShort")}
      </span>
    </Link>
  );
}
