"use client";

import { useEffect, useRef, useState } from "react";

import { useToast } from "@/components/app/useToast";
import { SwitchRow } from "@/components/ui/Switch";
import { api, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/dictionaries";

export type EmailPreferenceKey = "forge_billing" | "forge_credits" | "forge_team" | "forge_product" | "forge_projects";

export type EmailPreferences = Record<EmailPreferenceKey, boolean>;

export type EmailPreferencesResponse = {
  available: boolean;
  reason?: string | null;
  message?: string | null;
  preferences?: EmailPreferences | null;
};

export const EMAIL_PREFERENCES_PATH = "/settings/email-preferences";

const ROWS: { key: EmailPreferenceKey; title: MessageKey; description: MessageKey }[] = [
  { key: "forge_billing", title: "apForgeEmailsBilling", description: "apForgeEmailsBillingDesc" },
  { key: "forge_credits", title: "apForgeEmailsCredits", description: "apForgeEmailsCreditsDesc" },
  { key: "forge_team", title: "apForgeEmailsTeam", description: "apForgeEmailsTeamDesc" },
  { key: "forge_product", title: "apForgeEmailsProduct", description: "apForgeEmailsProductDesc" },
  { key: "forge_projects", title: "apForgeEmailsProjects", description: "apForgeEmailsProjectsDesc" },
];

type State =
  | { kind: "loading" }
  | { kind: "unavailable"; message: string | null }
  | { kind: "ready"; preferences: EmailPreferences };

/**
 * Which Forge emails this person receives. The switches live on the RodiumAi
 * account; forge-api proxies them. Each toggle saves at once, shows the new
 * value straight away and puts the old one back if the save fails.
 */
export function ForgeEmailPreferences() {
  const { t, locale } = useI18n();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [pending, setPending] = useState<Partial<Record<EmailPreferenceKey, boolean>>>({});
  const [toast, notify] = useToast();
  // The last value the server confirmed, per switch, so a failed save rolls
  // back to it even when another switch changed in between.
  const confirmed = useRef<EmailPreferences | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<EmailPreferencesResponse>(EMAIL_PREFERENCES_PATH, {}, locale)
      .then((res) => {
        if (cancelled) return;
        if (res.available && res.preferences) {
          confirmed.current = res.preferences;
          setState({ kind: "ready", preferences: res.preferences });
        } else {
          setState({ kind: "unavailable", message: res.message ?? null });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "unavailable", message: null });
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  async function toggle(key: EmailPreferenceKey, next: boolean) {
    if (state.kind !== "ready" || pending[key]) return;
    setState((prev) => (prev.kind === "ready" ? { ...prev, preferences: { ...prev.preferences, [key]: next } } : prev));
    setPending((p) => ({ ...p, [key]: true }));
    try {
      const res = await api<EmailPreferencesResponse>(
        EMAIL_PREFERENCES_PATH,
        { method: "PATCH", body: JSON.stringify({ [key]: next }) },
        locale,
      );
      const saved = res.preferences?.[key] ?? next;
      confirmed.current = { ...(confirmed.current ?? ({} as EmailPreferences)), [key]: saved };
      setState((prev) =>
        prev.kind === "ready" ? { ...prev, preferences: { ...prev.preferences, [key]: saved } } : prev,
      );
      notify(t("apForgeEmailsSaved"), "check");
    } catch (err) {
      const previous = confirmed.current?.[key] ?? !next;
      setState((prev) =>
        prev.kind === "ready" ? { ...prev, preferences: { ...prev.preferences, [key]: previous } } : prev,
      );
      notify(err instanceof ApiError && err.message ? err.message : t("errorGeneric"), "alert");
    } finally {
      setPending((p) => ({ ...p, [key]: false }));
    }
  }

  return (
    <div className="f-forge-emails" style={{ marginTop: 12 }}>
      <p className="f-note" style={{ marginTop: 8 }}>
        <b>{t("apForgeEmails")}.</b> {t("apForgeEmailsLead")}
      </p>
      {state.kind === "loading" ? (
        <p className="f-note" role="status">
          {t("apForgeEmailsLoading")}
        </p>
      ) : state.kind === "unavailable" ? (
        <p className="f-note">{state.message || t("apForgeEmailsUnavailable")}</p>
      ) : (
        <>
          {ROWS.map((row) => (
            <SwitchRow
              key={row.key}
              title={t(row.title)}
              description={t(row.description)}
              checked={state.preferences[row.key]}
              disabled={Boolean(pending[row.key])}
              onChange={(next) => void toggle(row.key, next)}
            />
          ))}
          <p className="f-note">{t("apForgeEmailsReceipts")}</p>
        </>
      )}
      {toast}
    </div>
  );
}
