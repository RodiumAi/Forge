"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, getToken } from "@/lib/api";
import { planDisplayName } from "@/components/RodiumWalletBadge";
import { Avatar } from "@/components/ui/Avatar";
import { Tag } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { refreshForgeStatus, useForgeStatus } from "@/lib/forge-status";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { startRodiumOAuth } from "@/lib/rodium-oauth";
import { patchSessionCache, getSessionSnapshot } from "@/lib/session-cache";

type RodiumAccount = {
  linked: boolean;
  email?: string | null;
  name?: string | null;
  avatar_url?: string | null;
  wallet?: {
    balance_rodi?: string | null;
    reserved_rodi?: string | null;
    provided_total_rodi?: string | null;
  } | null;
  api_keys?: Array<{
    id: string;
    name: string;
    prefix?: string | null;
    last4?: string | null;
    billing_source?: string | null;
    is_active: boolean;
  }>;
  selected_api_key_id?: string | null;
  rodium_sub?: string | null;
  has_generation_key?: boolean;
  generation_key_hint?: string | null;
  can_generate_key?: boolean;
};

type RodiumTestResult = {
  ok: boolean;
  message: string;
};

type RodiumKeyStatus = {
  configured: boolean;
  managed: boolean;
  supports_test: boolean;
  credentials_hint: string | null;
};

/**
 * RodiumAi connection and generation key for the settings page. The RODI
 * balance is shown on the billing page only.
 */
export function RodiumGenerationPanel() {
  const { t, locale } = useI18n();
  const forge = useForgeStatus();
  const [account, setAccount] = useState<RodiumAccount | null>(null);
  const [keyStatus, setKeyStatus] = useState<RodiumKeyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedKeyId, setSelectedKeyId] = useState("");
  const [selectingKey, setSelectingKey] = useState(false);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [showManualPaste, setShowManualPaste] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [apiKeyPaste, setApiKeyPaste] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testOk, setTestOk] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [rodium, item] = await Promise.all([
          api<RodiumAccount>("/auth/rodium/account"),
          api<RodiumKeyStatus>("/settings/rodium", {}, locale),
          refreshForgeStatus(),
        ]);
        if (cancelled) return;
        setAccount(rodium);
        setKeyStatus(item);
        // Unlinked: surface paste by default (only path without OIDC).
        if (!rodium.linked) setShowManualPaste(true);
        const prev = getSessionSnapshot()?.profile ?? null;
        patchSessionCache({
          rodium: { linked: Boolean(rodium.linked), wallet: rodium.wallet ?? null },
          profile: prev
            ? {
                ...prev,
                rodium_linked: Boolean(rodium.linked),
                rodium_sub: rodium.linked
                  ? (rodium.rodium_sub ?? prev.rodium_sub ?? null)
                  : null,
                ...(rodium.linked
                  ? {
                      email: rodium.email || prev.email,
                      name: rodium.name ?? prev.name,
                      avatar_url: rodium.avatar_url ?? prev.avatar_url,
                    }
                  : {}),
              }
            : undefined,
        });
        const preferred =
          rodium.selected_api_key_id ||
          rodium.api_keys?.find((k) => k.is_active)?.id ||
          rodium.api_keys?.[0]?.id ||
          "";
        setSelectedKeyId(preferred);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error && /invalid token|not authenticated|unauthorized/i.test(err.message)) {
          return;
        }
        setError(err instanceof Error ? err.message : t("errorGeneric"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locale, t]);

  const activeKeys = useMemo(
    () => (account?.api_keys || []).filter((k) => k.is_active),
    [account],
  );

  const canSelectKey = Boolean(selectedKeyId) && !selectingKey;
  const canSavePaste = Boolean(apiKeyPaste.trim()) && !saving;
  const canTest = Boolean(
    keyStatus?.supports_test &&
      (apiKeyPaste.trim() || keyStatus.configured || account?.has_generation_key),
  );

  async function refreshAccountAndKey(fresh = false) {
    // `fresh=1` widens the server-side timeout so the platform is actually
    // queried rather than served from cache: that is the whole point of the
    // refresh button, which exists so adding a key on RodiumAi does not
    // require signing out and back in.
    const [rodium, item] = await Promise.all([
      api<RodiumAccount>(fresh ? "/auth/rodium/account?fresh=1" : "/auth/rodium/account"),
      api<RodiumKeyStatus>("/settings/rodium", {}, locale),
      refreshForgeStatus({ fresh }),
    ]);
    setAccount(rodium);
    setKeyStatus(item);
    const prev = getSessionSnapshot()?.profile ?? null;
    patchSessionCache({
      rodium: { linked: Boolean(rodium.linked), wallet: rodium.wallet ?? null },
      profile: prev
        ? {
            ...prev,
            rodium_linked: Boolean(rodium.linked),
            rodium_sub: rodium.linked
              ? (rodium.rodium_sub ?? prev.rodium_sub ?? null)
              : null,
            ...(rodium.linked
              ? {
                  email: rodium.email || prev.email,
                  name: rodium.name ?? prev.name,
                  avatar_url: rodium.avatar_url ?? prev.avatar_url,
                }
              : {}),
          }
        : undefined,
    });
    return rodium;
  }

  async function onRefresh() {
    setRefreshing(true);
    setError(null);
    setMessage(null);
    try {
      await refreshAccountAndKey(true);
      setMessage(t("rodiumRefreshed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setRefreshing(false);
    }
  }

  async function onConnect() {
    setConnecting(true);
    setError(null);
    const result = await startRodiumOAuth({
      returnTo: "/settings?tab=generation",
      unavailableHref: null,
    });
    if (!result.ok) {
      setConnecting(false);
      if (result.reason === "oidc_unavailable") {
        setError(t("rodiumManualKeyHelp"));
        setShowManualPaste(true);
      } else if (result.reason === "popup_blocked") {
        setError(t("authSocialPopupBlocked"));
      } else if (result.reason === "cancelled") {
        // User closed the window.
      } else if (result.error instanceof Error) {
        setError(result.error.message);
      } else {
        setError(t("errorGeneric"));
      }
    }
  }

  async function onSelectAccountKey(e: FormEvent) {
    e.preventDefault();
    if (!selectedKeyId) return;
    setSelectingKey(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api<{
        selected_api_key_id: string;
      }>("/auth/rodium/select-key", {
        method: "POST",
        body: JSON.stringify({ api_key_id: selectedKeyId }),
      });
      await refreshAccountAndKey();
      setSelectedKeyId(result.selected_api_key_id || selectedKeyId);
      setMessage(t("rodiumKeyLinked"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setSelectingKey(false);
    }
  }

  async function onGenerateKey() {
    if (!account?.can_generate_key || generatingKey) return;
    setGeneratingKey(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api<{
        selected_api_key_id: string;
      }>("/auth/rodium/generate-key", {
        method: "POST",
        body: "{}",
      });
      const rodium = await refreshAccountAndKey(true);
      setSelectedKeyId(
        result.selected_api_key_id ||
          rodium.selected_api_key_id ||
          rodium.api_keys?.find((k) => k.is_active)?.id ||
          "",
      );
      setMessage(t("rodiumKeyGenerated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setGeneratingKey(false);
    }
  }

  async function onPasteSubmit(e: FormEvent) {
    e.preventDefault();
    const key = apiKeyPaste.trim();
    if (!key) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    setTestMessage(null);
    setTestOk(null);
    try {
      await api("/settings/rodium", {
        method: "PUT",
        body: JSON.stringify({ api_key: key }),
      });
      setApiKeyPaste("");
      await refreshAccountAndKey();
      setMessage(t("saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setSaving(false);
    }
  }

  async function onTest() {
    if (!keyStatus?.supports_test) return;
    setTesting(true);
    setError(null);
    setTestMessage(null);
    setTestOk(null);
    try {
      const apiKey = apiKeyPaste.trim();
      const result = await api<RodiumTestResult>("/settings/rodium/test", {
        method: "POST",
        body: JSON.stringify(apiKey ? { rodium_api_key: apiKey } : {}),
      });
      setTestOk(result.ok);
      setTestMessage(result.message);
    } catch (err) {
      setTestOk(false);
      setTestMessage(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div aria-busy="true" style={{ display: "grid", gap: 12 }}>
        <span className="f-skel" style={{ height: 52 }} />
        <span className="f-skel" style={{ height: 52 }} />
      </div>
    );
  }

  // Cloud account is enough: email signup binds rodium_sub without live OIDC.
  const cloudLinked = Boolean(account?.rodium_sub || forge?.plan);
  const linked = Boolean(account?.linked) || cloudLinked;
  const planName = planDisplayName(forge?.plan ?? null);
  const who = [account?.name, account?.email || getSessionSnapshot()?.profile?.email, planName]
    .filter(Boolean)
    .join(" · ");
  const testButton = keyStatus?.supports_test ? (
    <Button variant="ghost" size="sm" loading={testing} disabled={!canTest} onClick={() => void onTest()}>
      {testing ? t("rodiumTesting") : t("rodiumTest")}
    </Button>
  ) : null;

  return (
    <>
      <div className="f-row-line">
        <div className="l" style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
          {linked ? <Avatar name={account?.name || account?.email || "RodiumAi"} src={account?.avatar_url} /> : null}
          <div style={{ minWidth: 0 }}>
            <b>{t("apConnection")}</b>
            <small>{linked ? who || t("rodiumConnected") : t("apConnectionLead")}</small>
          </div>
        </div>
        <div className="r">
          {linked ? (
            <>
              <Tag tone="ok" icon="check">
                {t("rodiumConnected")}
              </Tag>
              <IconButton
                icon="refresh"
                size="sm"
                label={refreshing ? t("rodiumRefreshing") : t("rodiumRefreshKeys")}
                disabled={refreshing}
                className={refreshing ? "f-spin" : undefined}
                onClick={() => void onRefresh()}
              />
            </>
          ) : (
            <Button size="sm" loading={connecting} onClick={() => void onConnect()}>
              {t("apConnectRodium")}
            </Button>
          )}
        </div>
      </div>

      <div className="f-row-line">
        <div className="l">
          <b>{t("apApiKey")}</b>
          <small>{t("apApiKeyLead")}</small>
        </div>
        <div className="r">
          {account?.has_generation_key && account.generation_key_hint ? (
            <code className="f-code-chip">{account.generation_key_hint}</code>
          ) : null}
          <Tag tone={account?.has_generation_key ? "ok" : "warn"}>
            {account?.has_generation_key ? t("apKeyConfigured") : t("apKeyMissing")}
          </Tag>
        </div>
      </div>

      {linked && activeKeys.length ? (
        <form className="f-row-line" onSubmit={(e) => void onSelectAccountKey(e)}>
          <div className="l" style={{ flex: 1, minWidth: 0 }}>
            <Field label={t("apSelectKey")}>
              <Select value={selectedKeyId} onChange={(e) => setSelectedKeyId(e.target.value)}>
                {activeKeys.map((key) => (
                  <option key={key.id} value={key.id}>
                    {key.name}
                    {key.last4 ? ` (...${key.last4})` : ""}
                    {account?.selected_api_key_id === key.id ? ` · ${t("apKeyInUse")}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="r">
            <Button type="submit" size="sm" loading={selectingKey} disabled={!canSelectKey}>
              {t("apUseKey")}
            </Button>
            {testButton}
          </div>
        </form>
      ) : linked ? (
        <div className="f-row-line">
          <div className="l">
            <b>{t("apNoKeys")}</b>
            {account?.can_generate_key ? <small>{t("apGenerateKeyLead")}</small> : null}
          </div>
          <div className="r">
            {account?.can_generate_key ? (
              <Button size="sm" icon="key" loading={generatingKey} onClick={() => void onGenerateKey()}>
                {t("apGenerateKey")}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {showManualPaste ? (
        <form className="f-row-line" onSubmit={(e) => void onPasteSubmit(e)}>
          <div className="l" style={{ flex: 1, minWidth: 0 }}>
            <Field label={t("apPasteKey")} hint={t("apPasteKeyHint")}>
              <Input
                type="password"
                placeholder="rd_sk_..."
                value={apiKeyPaste}
                onChange={(e) => setApiKeyPaste(e.target.value)}
                autoComplete="off"
              />
            </Field>
          </div>
          <div className="r">
            <Button type="submit" size="sm" loading={saving} disabled={!canSavePaste}>
              {t("apSaveKey")}
            </Button>
            {linked && activeKeys.length ? null : testButton}
          </div>
        </form>
      ) : null}

      <div className="f-row-line">
        <div className="l">
          <b>{t("apRodiLine")}</b>
          <small>{t("apRodiLineLead")}</small>
        </div>
        <div className="r">
          {linked ? (
            <Button variant="subtle" size="sm" onClick={() => setShowManualPaste((v) => !v)}>
              {showManualPaste ? t("apHidePaste") : t("apShowPaste")}
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" href="/billing#rodi" iconEnd="arrow-right">
            {t("apSeeBalance")}
          </Button>
        </div>
      </div>

      {error ? (
        <p className="f-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="f-success" role="status">
          {message}
        </p>
      ) : null}
      {testMessage ? (
        <p className={testOk ? "f-success" : "f-error"} role="status">
          {testMessage}
        </p>
      ) : null}
    </>
  );
}
