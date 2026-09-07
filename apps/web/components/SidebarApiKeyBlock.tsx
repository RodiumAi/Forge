"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { KeyRound } from "lucide-react";
import { api, getToken } from "@/lib/api";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { startRodiumOAuth } from "@/lib/rodium-oauth";
import { patchSessionCache, refreshRodiumWallet } from "@/lib/session-cache";

type RodiumAccount = {
  linked: boolean;
  email?: string | null;
  name?: string | null;
  avatar_url?: string | null;
  wallet?: {
    balance_rodi?: string | null;
    provided_total_rodi?: string | null;
  } | null;
  api_keys?: Array<{
    id: string;
    name: string;
    last4?: string | null;
    billing_source?: string | null;
    is_active: boolean;
  }>;
  selected_api_key_id?: string | null;
  rodium_sub?: string | null;
  has_generation_key?: boolean;
  generation_key_hint?: string | null;
};

type RodiumKeyStatus = {
  configured: boolean;
  managed: boolean;
  credentials_hint: string | null;
};

/**
 * Compact API-key picker for the home/builder sidebar.
 * Linked: select autosaves on change. Unlinked: paste or connect.
 */
export function SidebarApiKeyBlock() {
  const { t, locale } = useI18n();
  const [account, setAccount] = useState<RodiumAccount | null>(null);
  const [keyStatus, setKeyStatus] = useState<RodiumKeyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedKeyId, setSelectedKeyId] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [apiKeyPaste, setApiKeyPaste] = useState("");
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [rodium, item] = await Promise.all([
          api<RodiumAccount>("/auth/rodium/account"),
          api<RodiumKeyStatus>("/settings/rodium", {}, locale),
        ]);
        if (cancelled) return;
        setAccount(rodium);
        setKeyStatus(item);
        if (!rodium.linked) setShowPaste(true);
        patchSessionCache({
          rodium: { linked: Boolean(rodium.linked), wallet: rodium.wallet ?? null },
          profile: {
            email: rodium.email || "",
            name: rodium.name,
            avatar_url: rodium.avatar_url,
            rodium_linked: Boolean(rodium.linked),
            rodium_sub: rodium.rodium_sub ?? null,
          },
        });
        const preferred =
          rodium.selected_api_key_id ||
          rodium.api_keys?.find((k) => k.is_active)?.id ||
          rodium.api_keys?.[0]?.id ||
          "";
        setSelectedKeyId(preferred);
      } catch {
        /* ignore — sidebar stays quiet */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const activeKeys = useMemo(
    () => (account?.api_keys || []).filter((k) => k.is_active),
    [account],
  );
  const linked = Boolean(account?.linked);
  const hint =
    account?.generation_key_hint ||
    keyStatus?.credentials_hint ||
    (account?.has_generation_key ? t("rodiumConfigured") : t("rodiumNotConfigured"));

  async function applySelect(apiKeyId: string) {
    if (!apiKeyId || selecting) return;
    setSelecting(true);
    setError(null);
    try {
      await api("/auth/rodium/select-key", {
        method: "POST",
        body: JSON.stringify({ api_key_id: apiKeyId }),
      });
      setSelectedKeyId(apiKeyId);
      const rodium = await api<RodiumAccount>("/auth/rodium/account");
      setAccount(rodium);
      patchSessionCache({
        rodium: { linked: Boolean(rodium.linked), wallet: rodium.wallet ?? null },
      });
      void refreshRodiumWallet();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setSelecting(false);
    }
  }

  async function onPaste() {
    const key = apiKeyPaste.trim();
    if (!key || saving) return;
    setSaving(true);
    setError(null);
    try {
      await api("/settings/rodium", {
        method: "PUT",
        body: JSON.stringify({ api_key: key }),
      });
      setApiKeyPaste("");
      setShowPaste(false);
      const [rodium, item] = await Promise.all([
        api<RodiumAccount>("/auth/rodium/account"),
        api<RodiumKeyStatus>("/settings/rodium", {}, locale),
      ]);
      setAccount(rodium);
      setKeyStatus(item);
      patchSessionCache({
        rodium: { linked: Boolean(rodium.linked), wallet: rodium.wallet ?? null },
      });
      void refreshRodiumWallet();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setSaving(false);
    }
  }

  async function onConnect() {
    setConnecting(true);
    setError(null);
    const result = await startRodiumOAuth({
      returnTo: typeof window !== "undefined" ? window.location.pathname : "/dashboard",
      unavailableHref: null,
    });
    if (!result.ok) {
      setConnecting(false);
      if (result.reason === "oidc_unavailable") {
        setShowPaste(true);
        setError(t("rodiumManualKeyHelp"));
      } else if (result.error instanceof Error) {
        setError(result.error.message);
      } else {
        setError(t("errorGeneric"));
      }
    }
  }

  if (loading) {
    return (
      <div className="home-sidebar-key-block" aria-busy="true">
        <span className="home-sidebar-key-icon" aria-hidden>
          <Icon icon={KeyRound} />
        </span>
        <span className="home-sidebar-key-hint muted">…</span>
      </div>
    );
  }

  return (
    <div className="home-sidebar-key-block">
      <div className="home-sidebar-key-head" title={hint}>
        <span className="home-sidebar-key-icon" aria-hidden>
          <Icon icon={KeyRound} />
        </span>
        <span className="home-sidebar-key-label">{t("sidebarApiKey")}</span>
      </div>
      <p className="home-sidebar-key-hint" title={hint}>
        {hint}
      </p>

      {linked && activeKeys.length > 0 ? (
        <select
          className="home-sidebar-key-select"
          value={selectedKeyId}
          disabled={selecting}
          aria-label={t("rodiumSelectKey")}
          onChange={(e) => {
            const next = e.target.value;
            setSelectedKeyId(next);
            void applySelect(next);
          }}
        >
          <option value="">{t("rodiumSelectKeyPlaceholder")}</option>
          {activeKeys.map((key) => (
            <option key={key.id} value={key.id}>
              {key.name}
              {key.last4 ? ` …${key.last4}` : ""}
              {account?.selected_api_key_id === key.id ? ` · ${t("rodiumKeyActive")}` : ""}
            </option>
          ))}
        </select>
      ) : null}

      {linked && activeKeys.length === 0 ? (
        <p className="home-sidebar-key-hint muted">
          {t("rodiumNoKeys")}{" "}
          <Link href="/settings?tab=generation">{t("settings")}</Link>
        </p>
      ) : null}

      {!linked ? (
        <button
          type="button"
          className="home-sidebar-key-btn"
          onClick={() => void onConnect()}
          disabled={connecting}
        >
          {connecting ? t("rodiumConnectWorking") : t("connectRodiumAi")}
        </button>
      ) : null}

      {(showPaste || !linked) && (
        <div className="home-sidebar-key-paste">
          <input
            type="password"
            className="home-sidebar-key-input"
            placeholder="rd_sk_…"
            value={apiKeyPaste}
            onChange={(e) => setApiKeyPaste(e.target.value)}
            autoComplete="off"
            aria-label={t("rodiumPasteKeyFallback")}
          />
          <button
            type="button"
            className="home-sidebar-key-btn"
            disabled={!apiKeyPaste.trim() || saving}
            onClick={() => void onPaste()}
          >
            {saving ? t("settingsSaving") : t("saved")}
          </button>
        </div>
      )}

      {linked ? (
        <button
          type="button"
          className="home-sidebar-key-link"
          onClick={() => setShowPaste((v) => !v)}
        >
          {showPaste ? t("rodiumHidePaste") : t("rodiumShowPaste")}
        </button>
      ) : null}

      {error ? <p className="home-sidebar-key-error">{error}</p> : null}
    </div>
  );
}
