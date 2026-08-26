"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, getToken } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { patchSessionCache } from "@/lib/session-cache";
import { SettingsBlock, SettingsRow } from "@/components/SettingsShell";

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
  has_generation_key?: boolean;
  generation_key_hint?: string | null;
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
 * RodiumAi generation key / wallet controls — Settings → Génération.
 */
export function RodiumGenerationPanel() {
  const { t, locale } = useI18n();
  const [account, setAccount] = useState<RodiumAccount | null>(null);
  const [keyStatus, setKeyStatus] = useState<RodiumKeyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedKeyId, setSelectedKeyId] = useState("");
  const [selectingKey, setSelectingKey] = useState(false);
  const [showManualPaste, setShowManualPaste] = useState(false);
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
        ]);
        if (cancelled) return;
        setAccount(rodium);
        setKeyStatus(item);
        patchSessionCache({
          rodium: { linked: Boolean(rodium.linked), wallet: rodium.wallet ?? null },
          profile: {
            email: rodium.email || "",
            name: rodium.name,
            avatar_url: rodium.avatar_url,
            rodium_linked: Boolean(rodium.linked),
          },
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

  async function refreshAccountAndKey() {
    const [rodium, item] = await Promise.all([
      api<RodiumAccount>("/auth/rodium/account"),
      api<RodiumKeyStatus>("/settings/rodium", {}, locale),
    ]);
    setAccount(rodium);
    setKeyStatus(item);
    patchSessionCache({
      rodium: { linked: Boolean(rodium.linked), wallet: rodium.wallet ?? null },
      profile: {
        email: rodium.email || "",
        name: rodium.name,
        avatar_url: rodium.avatar_url,
        rodium_linked: Boolean(rodium.linked),
      },
    });
    return rodium;
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
    return <p className="settings-panel-loading">{t("loading")}</p>;
  }

  return (
    <>
      <SettingsBlock title={t("rodiumAccountTitle")} subtitle={t("rodiumManagedHelp")}>
        <SettingsRow title={t("settingsRodiumStatus")}>
          <span className={`home-settings-badge ${account?.linked ? "ok" : "warn"}`}>
            {account?.linked ? t("rodiumManaged") : t("rodiumNotConfigured")}
            {account?.email ? ` · ${account.email}` : ""}
          </span>
        </SettingsRow>
        {(account?.name || account?.email) && (
          <SettingsRow title={t("rodiumAccountTitle")}>
            <div className="home-connector-meta">
              {account?.avatar_url ? (
                <img className="home-connector-avatar" src={account.avatar_url} alt="" />
              ) : null}
              <div>
                <p>
                  <strong>{account?.name || account?.email || "—"}</strong>
                </p>
                {account?.email && account?.name ? <p className="muted">{account.email}</p> : null}
              </div>
            </div>
          </SettingsRow>
        )}
      </SettingsBlock>

      <SettingsBlock title={t("rodiumWalletTitle")}>
        <SettingsRow title={t("balanceRodi")}>
          <span className="settings-value">{account?.wallet?.balance_rodi ?? "—"}</span>
        </SettingsRow>
        <SettingsRow title={t("providedRodi")}>
          <span className="settings-value">{account?.wallet?.provided_total_rodi ?? "—"}</span>
        </SettingsRow>
      </SettingsBlock>

      <SettingsBlock title={t("rodiumKeysTitle")} subtitle={t("rodiumSelectKeyHelp")}>
        <SettingsRow
          title={t("settingsRodiumStatus")}
          hint={
            account?.has_generation_key && account.generation_key_hint
              ? account.generation_key_hint
              : undefined
          }
        >
          <span className={`home-settings-badge ${account?.has_generation_key ? "ok" : "warn"}`}>
            {account?.has_generation_key ? t("rodiumConfigured") : t("rodiumNotConfigured")}
          </span>
        </SettingsRow>

        {activeKeys.length ? (
          <form className="settings-inline-form" onSubmit={(e) => void onSelectAccountKey(e)}>
            <label className="home-settings-field">
              <span>{t("rodiumSelectKey")}</span>
              <select
                className="home-settings-input"
                value={selectedKeyId}
                onChange={(e) => setSelectedKeyId(e.target.value)}
              >
                <option value="">{t("rodiumSelectKeyPlaceholder")}</option>
                {activeKeys.map((key) => (
                  <option key={key.id} value={key.id}>
                    {key.name}
                    {key.last4 ? ` (…${key.last4})` : ""}
                    {key.billing_source ? ` · ${key.billing_source}` : ""}
                    {account?.selected_api_key_id === key.id ? ` · ${t("rodiumKeyActive")}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <p className="home-settings-hint">{t("rodiumSelectKeyRotateHint")}</p>
            {error && <p className="error home-settings-feedback">{error}</p>}
            {message && <p className="home-settings-success">{message}</p>}
            {testMessage && (
              <p className={testOk ? "home-settings-success" : "error home-settings-feedback"}>
                {testMessage}
              </p>
            )}
            <div className="home-settings-actions">
              <button
                className="landing-create home-settings-save"
                type="submit"
                disabled={!canSelectKey}
              >
                {selectingKey ? t("settingsSaving") : t("rodiumUseSelectedKey")}
              </button>
              {keyStatus?.supports_test && (
                <button
                  type="button"
                  className="home-settings-test"
                  onClick={() => void onTest()}
                  disabled={testing || !canTest}
                >
                  {testing ? t("rodiumTesting") : t("rodiumTest")}
                </button>
              )}
              <button
                type="button"
                className="home-settings-test"
                onClick={() => setShowManualPaste((v) => !v)}
              >
                {showManualPaste ? t("rodiumHidePaste") : t("rodiumShowPaste")}
              </button>
            </div>
          </form>
        ) : (
          <p className="muted">{t("rodiumNoKeys")}</p>
        )}

        {showManualPaste && (
          <form className="settings-inline-form" onSubmit={(e) => void onPasteSubmit(e)}>
            <label className="home-settings-field">
              <span>{t("rodiumPasteKeyFallback")}</span>
              <input
                className="home-settings-input"
                type="password"
                placeholder="rd_sk_…"
                value={apiKeyPaste}
                onChange={(e) => setApiKeyPaste(e.target.value)}
                autoComplete="off"
              />
            </label>
            <p className="home-settings-hint">{t("rodiumPasteKeyHelp")}</p>
            <div className="home-settings-actions">
              <button
                className="landing-create home-settings-save"
                type="submit"
                disabled={!canSavePaste}
              >
                {saving ? t("settingsSaving") : t("rodiumSaveKey")}
              </button>
            </div>
          </form>
        )}
      </SettingsBlock>
    </>
  );
}
