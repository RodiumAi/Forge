"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { HomeLayout } from "@/components/HomeLayout";
import { ConnectorLogo } from "@/components/ConnectorLogo";
import { Icon } from "@/components/ui/icon";
import { api, getToken } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { patchSessionCache } from "@/lib/session-cache";

type ConnectorField = {
  id: string;
  label: string;
  secret: boolean;
  placeholder: string;
  required?: boolean;
};

type Connector = {
  id: string;
  name: string;
  category: string;
  description: string;
  use_case: string;
  auth_type: string;
  configured: boolean;
  supports_test: boolean;
  managed?: boolean;
  removable?: boolean;
  credentials_hint: string | null;
  fields: ConnectorField[];
  fallback_provider?: string | null;
  warning?: string | null;
  quota_used?: number | null;
  quota_limit?: number | null;
  quota_unit?: string | null;
};

type ConnectorTestResult = {
  ok: boolean;
  message: string;
};

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

export default function ConnectorDetailPage() {
  const params = useParams<{ id: string }>();
  const connectorId = params.id;
  const router = useRouter();
  const { t, locale } = useI18n();
  const [connector, setConnector] = useState<Connector | null>(null);
  const [account, setAccount] = useState<RodiumAccount | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [accountLoading, setAccountLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testOk, setTestOk] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedKeyId, setSelectedKeyId] = useState("");
  const [selectingKey, setSelectingKey] = useState(false);
  const [showManualPaste, setShowManualPaste] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/");
      return;
    }
    setLoading(true);
    setAccountLoading(false);
    setError(null);
    const load = async () => {
      const item = await api<Connector>(`/connectors/${connectorId}`, {}, locale);
      setConnector(item);
      setLoading(false);

      if (item.id === "rodiumai" && item.managed) {
        setAccountLoading(true);
        try {
          const rodium = await api<RodiumAccount>("/auth/rodium/account");
          setAccount(rodium);
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
        } catch {
          setAccount(null);
        } finally {
          setAccountLoading(false);
        }
      } else {
        setAccount(null);
      }
    };
    load().catch((err) => {
      if (err instanceof Error && /invalid token|not authenticated|unauthorized/i.test(err.message)) {
        return;
      }
      setError(err instanceof Error ? err.message : t("errorGeneric"));
      setLoading(false);
      setAccountLoading(false);
    });
  }, [connectorId, locale, router, t]);

  const generationFields = useMemo(() => {
    if (!connector) return [];
    if (connector.managed && connector.id === "rodiumai") {
      // Manual paste is a fallback only — primary path is select-key.
      if (!showManualPaste) return [];
      return [
        {
          id: "api_key",
          label: t("connectorPasteKeyFallback"),
          secret: true,
          placeholder: "rd_sk_…",
        },
      ];
    }
    return connector.fields;
  }, [connector, showManualPaste, t]);

  const activeKeys = useMemo(
    () => (account?.api_keys || []).filter((k) => k.is_active),
    [account],
  );

  const canSave = useMemo(
    () => generationFields.some((field) => values[field.id]?.trim()),
    [generationFields, values],
  );

  const canSelectKey = Boolean(selectedKeyId) && !selectingKey;

  const canTest = useMemo(() => {
    if (!connector?.supports_test) return false;
    const apiKey = values.api_key?.trim();
    return Boolean(apiKey || connector.configured || account?.has_generation_key);
  }, [account?.has_generation_key, connector, values]);

  async function saveCredentials(credentials: Record<string, string>) {
    setSaving(true);
    setError(null);
    setMessage(null);
    setTestMessage(null);
    setTestOk(null);
    try {
      const item = await api<Connector>(`/connectors/${connectorId}`, {
        method: "PUT",
        body: JSON.stringify({ credentials }),
      });
      setConnector(item);
      setValues({});
      setMessage(t("saved"));
      if (item.id === "rodiumai" && item.managed) {
        const rodium = await api<RodiumAccount>("/auth/rodium/account");
        setAccount(rodium);
        patchSessionCache({
          rodium: { linked: Boolean(rodium.linked), wallet: rodium.wallet ?? null },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setSaving(false);
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
        ok: boolean;
        selected_api_key_id: string;
        has_generation_key: boolean;
        generation_key_hint?: string | null;
      }>("/auth/rodium/select-key", {
        method: "POST",
        body: JSON.stringify({ api_key_id: selectedKeyId }),
      });
      const rodium = await api<RodiumAccount>("/auth/rodium/account");
      setAccount(rodium);
      patchSessionCache({
        rodium: { linked: Boolean(rodium.linked), wallet: rodium.wallet ?? null },
        profile: {
          email: rodium.email || "",
          name: rodium.name,
          avatar_url: rodium.avatar_url,
          rodium_linked: Boolean(rodium.linked),
        },
      });
      setSelectedKeyId(result.selected_api_key_id || selectedKeyId);
      const item = await api<Connector>(`/connectors/${connectorId}`, {}, locale);
      setConnector(item);
      setMessage(t("connectorKeyLinked"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setSelectingKey(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const credentials: Record<string, string> = {};
    for (const field of generationFields) {
      const value = values[field.id]?.trim();
      if (value) credentials[field.id] = value;
    }
    await saveCredentials(credentials);
  }

  async function onRemove() {
    if (connector?.managed || connector?.removable === false) return;
    await saveCredentials({});
  }

  async function onTest() {
    if (!connector?.supports_test) return;
    setTesting(true);
    setError(null);
    setTestMessage(null);
    setTestOk(null);
    try {
      const credentials: Record<string, string> = {};
      const apiKey = values.api_key?.trim();
      if (apiKey) credentials.api_key = apiKey;
      const result = await api<ConnectorTestResult>(`/connectors/${connectorId}/test`, {
        method: "POST",
        body: JSON.stringify({ credentials }),
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
      <HomeLayout activeNav="connectors">
        <section className="home-settings home-connector-detail" aria-busy="true" aria-label={t("loading")}>
          <div className="home-skel home-skel-line w40" style={{ height: "0.9rem", marginBottom: "1.25rem" }} />
          <header className="home-settings-head home-connector-detail-head">
            <div className="home-skel home-skel-logo" />
            <div className="home-skel-card-body" style={{ flex: 1 }}>
              <div className="home-skel home-skel-title" />
              <div className="home-skel home-skel-line w85" />
              <div className="home-skel home-skel-line w55" />
            </div>
          </header>
          <div className="home-connector-detail-stack">
            {[0, 1, 2].map((i) => (
              <article key={i} className="home-settings-card">
                <div className="home-settings-card-head">
                  <div className="home-skel-card-body" style={{ flex: 1 }}>
                    <div className="home-skel home-skel-title" />
                    <div className="home-skel home-skel-line w70" />
                  </div>
                  <div className="home-skel home-skel-badge" />
                </div>
                <div className="home-skel-card-body">
                  <div className="home-skel home-skel-line w85" />
                  <div className="home-skel home-skel-line w55" />
                  <div className="home-skel home-skel-input" />
                </div>
              </article>
            ))}
          </div>
        </section>
      </HomeLayout>
    );
  }

  if (!connector) {
    return (
      <HomeLayout activeNav="connectors">
        <section className="home-settings home-connector-detail">
          <p className="error home-settings-feedback">{error || t("connectorNotFound")}</p>
        </section>
      </HomeLayout>
    );
  }

  const isManagedRodium = connector.id === "rodiumai" && Boolean(connector.managed);
  const showRemove = connector.configured && connector.removable !== false && !connector.managed;

  return (
    <HomeLayout activeNav="connectors">
      <section className="home-settings home-connector-detail">
        <Link href="/connectors" className="home-connector-back">
          <Icon icon={ArrowLeft} className="ui-icon-sm" />
          {t("connectorBack")}
        </Link>

        <header className="home-settings-head home-connector-detail-head">
          <ConnectorLogo id={connector.id} size={52} className="home-connector-logo-lg" />
          <div>
            <h1>{connector.name}</h1>
            <p>{connector.description}</p>
          </div>
        </header>

        <div className="home-connector-detail-stack">
        <article className="home-settings-card home-connector-use-card">
          <h2>{t("connectorUseCaseTitle")}</h2>
          <p>{connector.use_case}</p>
        </article>

        {connector.warning && (
          <article className="home-settings-card">
            <p className="home-settings-hint">{connector.warning}</p>
          </article>
        )}

        {isManagedRodium && accountLoading && (
          <>
            {[0, 1, 2].map((i) => (
              <article key={`skel-${i}`} className="home-settings-card" aria-busy="true">
                <div className="home-settings-card-head">
                  <div className="home-skel-card-body" style={{ flex: 1 }}>
                    <div className="home-skel home-skel-title" />
                    <div className="home-skel home-skel-line w70" />
                  </div>
                  <div className="home-skel home-skel-badge" />
                </div>
                {i === 0 ? (
                  <div className="home-skel-meta-row">
                    <div className="home-skel home-skel-avatar" />
                    <div className="home-skel-card-body" style={{ flex: 1 }}>
                      <div className="home-skel home-skel-line w55" />
                      <div className="home-skel home-skel-line w40" />
                    </div>
                  </div>
                ) : i === 1 ? (
                  <div className="home-skel-wallet">
                    <div className="home-skel-card-body">
                      <div className="home-skel home-skel-line w40" />
                      <div className="home-skel home-skel-title" />
                    </div>
                    <div className="home-skel-card-body">
                      <div className="home-skel home-skel-line w40" />
                      <div className="home-skel home-skel-title" />
                    </div>
                  </div>
                ) : (
                  <div className="home-skel-card-body">
                    <div className="home-skel home-skel-line w85" />
                    <div className="home-skel home-skel-input" />
                    <div className="home-skel home-skel-line w70" />
                  </div>
                )}
              </article>
            ))}
          </>
        )}

        {isManagedRodium && !accountLoading && (
          <>
            <article className="home-settings-card">
              <div className="home-settings-card-head">
                <div>
                  <h2>{t("connectorAccountTitle")}</h2>
                  <p className="home-settings-hint">{t("connectorManagedHelp")}</p>
                </div>
                <span className="home-settings-badge ok">
                  {t("connectorManaged")}
                  {account?.email ? ` · ${account.email}` : ""}
                </span>
              </div>
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
            </article>

            <article className="home-settings-card">
              <div className="home-settings-card-head">
                <div>
                  <h2>{t("connectorWalletTitle")}</h2>
                </div>
              </div>
              <div className="home-connector-wallet">
                <div>
                  <span className="muted">{t("balanceRodi")}</span>
                  <strong>{account?.wallet?.balance_rodi ?? "—"}</strong>
                </div>
                <div>
                  <span className="muted">{t("providedRodi")}</span>
                  <strong>{account?.wallet?.provided_total_rodi ?? "—"}</strong>
                </div>
              </div>
            </article>

            <article className="home-settings-card">
              <div className="home-settings-card-head">
                <div>
                  <h2>{t("connectorKeysTitle")}</h2>
                  <p className="home-settings-hint">{t("connectorSelectKeyHelp")}</p>
                </div>
                <span
                  className={`home-settings-badge ${account?.has_generation_key ? "ok" : "warn"}`}
                >
                  {account?.has_generation_key
                    ? t("connectorConfigured")
                    : t("connectorNotConfigured")}
                  {account?.has_generation_key && account.generation_key_hint
                    ? ` · ${account.generation_key_hint}`
                    : ""}
                </span>
              </div>

              {activeKeys.length ? (
                <form className="home-settings-form" onSubmit={(e) => void onSelectAccountKey(e)}>
                  <label className="home-settings-field">
                    <span>{t("connectorSelectKey")}</span>
                    <select
                      className="home-settings-input"
                      value={selectedKeyId}
                      onChange={(e) => setSelectedKeyId(e.target.value)}
                    >
                      <option value="">{t("connectorSelectKeyPlaceholder")}</option>
                      {activeKeys.map((key) => (
                        <option key={key.id} value={key.id}>
                          {key.name}
                          {key.last4 ? ` (…${key.last4})` : ""}
                          {key.billing_source ? ` · ${key.billing_source}` : ""}
                          {account?.selected_api_key_id === key.id
                            ? ` · ${t("connectorKeyActive")}`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="home-settings-hint">{t("connectorSelectKeyRotateHint")}</p>
                  {error && <p className="error home-settings-feedback">{error}</p>}
                  {message && <p className="home-settings-success">{message}</p>}
                  <div className="home-settings-actions">
                    <button
                      className="landing-create home-settings-save"
                      type="submit"
                      disabled={!canSelectKey}
                    >
                      {selectingKey ? t("settingsSaving") : t("connectorUseSelectedKey")}
                    </button>
                    <button
                      type="button"
                      className="home-settings-test"
                      onClick={() => setShowManualPaste((v) => !v)}
                    >
                      {showManualPaste ? t("connectorHidePaste") : t("connectorShowPaste")}
                    </button>
                  </div>
                </form>
              ) : (
                <p className="muted">{t("connectorNoKeys")}</p>
              )}
            </article>
          </>
        )}

        {(!isManagedRodium || showManualPaste) && (
        <article className="home-settings-card">
          <div className="home-settings-card-head">
            <div>
              <h2>{isManagedRodium ? t("connectorPasteKeyFallback") : t("connectorConfigure")}</h2>
              <p className="home-settings-hint">
                {isManagedRodium ? t("connectorPasteKeyHelp") : t("connectorFieldsHelp")}
              </p>
            </div>
            {!isManagedRodium && (
              <span className={`home-settings-badge ${connector.configured ? "ok" : "warn"}`}>
                {connector.configured ? t("connectorConfigured") : t("connectorNotConfigured")}
                {connector.credentials_hint ? ` · ${connector.credentials_hint}` : ""}
              </span>
            )}
          </div>

          {(generationFields.length > 0 || !isManagedRodium) && (
            <form className="home-settings-form" onSubmit={onSubmit}>
              {generationFields.map((field) => (
                <label key={field.id} className="home-settings-field">
                  <span>
                    {field.label}
                    {field.required === false ? ` (${t("optional")})` : ""}
                  </span>
                  {field.id === "service_account_json" ? (
                    <textarea
                      className="home-settings-input"
                      rows={6}
                      placeholder={field.placeholder}
                      value={values[field.id] || ""}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [field.id]: e.target.value,
                        }))
                      }
                      autoComplete="off"
                    />
                  ) : (
                    <input
                      className="home-settings-input"
                      type={field.secret ? "password" : "text"}
                      placeholder={field.placeholder}
                      value={values[field.id] || ""}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [field.id]: e.target.value,
                        }))
                      }
                      autoComplete="off"
                    />
                  )}
                </label>
              ))}

              {error && !isManagedRodium && (
                <p className="error home-settings-feedback">{error}</p>
              )}
              {message && !isManagedRodium && (
                <p className="home-settings-success">{message}</p>
              )}
              {testMessage && (
                <p className={testOk ? "home-settings-success" : "error home-settings-feedback"}>
                  {testMessage}
                </p>
              )}

              <div className="home-settings-actions">
                {generationFields.length > 0 && (
                  <button className="landing-create home-settings-save" type="submit" disabled={saving || !canSave}>
                    {saving ? t("settingsSaving") : t("connectorSave")}
                  </button>
                )}
                {connector.supports_test && (
                  <button
                    type="button"
                    className="home-settings-test"
                    onClick={() => void onTest()}
                    disabled={testing || !canTest}
                  >
                    {testing ? t("rodiumTesting") : t("rodiumTest")}
                  </button>
                )}
                {showRemove && (
                  <button
                    type="button"
                    className="home-settings-remove"
                    onClick={() => void onRemove()}
                    disabled={saving}
                  >
                    {t("connectorRemove")}
                  </button>
                )}
              </div>
            </form>
          )}
        </article>
        )}
        </div>
      </section>
    </HomeLayout>
  );
}
