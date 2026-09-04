"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HomeLayout } from "@/components/HomeLayout";
import { RodiumGenerationPanel } from "@/components/RodiumGenerationPanel";
import {
  SettingsBlock,
  SettingsPanel,
  SettingsRow,
  SettingsShell,
  type SettingsSection,
} from "@/components/SettingsShell";
import { api, getToken } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useTheme } from "@/lib/theme/ThemeProvider";

type Profile = {
  id: string;
  email: string;
  name?: string | null;
  avatar_url?: string | null;
  rodium_linked?: boolean;
  created_at: string;
};

const SECTIONS: SettingsSection[] = ["account", "appearance", "security", "generation"];

function parseSection(raw: string | null): SettingsSection {
  if (raw === "rodium" || raw === "generation") return "generation";
  if (raw && SECTIONS.includes(raw as SettingsSection)) return raw as SettingsSection;
  return "account";
}

export default function SettingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useI18n();
  // Keyed off the preference, not the resolved theme: "System" must read as
  // selected even though what's painted is light or dark.
  const { preference, setPreference } = useTheme();

  const [section, setSection] = useState<SettingsSection>(() => parseSection(searchParams.get("tab")));
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    setSection(parseSection(searchParams.get("tab")));
  }, [searchParams]);

  function selectSection(next: SettingsSection) {
    setSection(next);
    setMessage(null);
    setError(null);
    router.replace(`/settings?tab=${next}`, { scroll: false });
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/");
      return;
    }
    api<Profile>("/auth/me")
      .then(setProfile)
      .catch((err) => {
        if (err instanceof Error && /invalid token|not authenticated|unauthorized/i.test(err.message)) {
          return;
        }
        setError(err instanceof Error ? err.message : t("errorGeneric"));
      })
      .finally(() => setLoading(false));
  }, [router, t]);

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    setChangingPassword(true);
    setError(null);
    setMessage(null);
    try {
      await api("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setMessage(t("settingsPasswordChanged"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setChangingPassword(false);
    }
  }

  const joinedDate =
    profile?.created_at && locale
      ? new Date(profile.created_at).toLocaleDateString(locale)
      : null;

  return (
    <HomeLayout activeNav="settings" fillMain>
      <SettingsShell active={section} onActiveChange={selectSection}>
        {loading && <p className="settings-panel-loading">{t("loading")}</p>}

        {!loading && section === "account" && (
          <SettingsPanel title={t("settingsAccountTitle")} subtitle={t("settingsAccountSub")}>
            <SettingsBlock title={t("settingsProfileSection")} subtitle={t("settingsProfileHelp")}>
              {profile?.avatar_url ? (
                <SettingsRow title={t("settingsProfilePhoto")} hint={t("rodiumManagedHelp")}>
                  <img className="settings-avatar" src={profile.avatar_url} alt="" />
                </SettingsRow>
              ) : null}
              {profile?.name ? (
                <SettingsRow title={t("rodiumAccountTitle")} hint={t("rodiumManagedHelp")}>
                  <span className="settings-value">{profile.name}</span>
                </SettingsRow>
              ) : null}
              <SettingsRow title={t("settingsAccountEmail")} hint={t("settingsEmailHint")}>
                <span className="settings-value">{profile?.email || "—"}</span>
              </SettingsRow>
              {profile?.rodium_linked ? (
                <SettingsRow title={t("rodiumManaged")} hint={t("loginRodiumHint")}>
                  <span className="settings-value">{t("rodiumConfigured")}</span>
                </SettingsRow>
              ) : null}
              {joinedDate && (
                <SettingsRow title={t("settingsMemberSince")} hint={t("settingsMemberSinceHint")}>
                  <span className="settings-value">{joinedDate}</span>
                </SettingsRow>
              )}
            </SettingsBlock>
          </SettingsPanel>
        )}

        {!loading && section === "generation" && (
          <SettingsPanel title={t("settingsGenerationTitle")} subtitle={t("settingsGenerationSub")}>
            <RodiumGenerationPanel />
          </SettingsPanel>
        )}

        {!loading && section === "appearance" && (
          <SettingsPanel title={t("settingsAppearanceTitle")} subtitle={t("settingsAppearanceSub")}>
            <SettingsBlock title={t("settingsThemeLabel")} subtitle={t("settingsThemeHelp")}>
              <SettingsRow title={t("settingsThemeLabel")} hint={t("settingsThemeRowHint")}>
                <div className="settings-theme-toggle" role="group" aria-label={t("settingsThemeLabel")}>
                  <button
                    type="button"
                    className={preference === "system" ? "active" : ""}
                    aria-pressed={preference === "system"}
                    onClick={() => setPreference("system")}
                  >
                    {t("settingsThemeSystem")}
                  </button>
                  <button
                    type="button"
                    className={preference === "light" ? "active" : ""}
                    aria-pressed={preference === "light"}
                    onClick={() => setPreference("light")}
                  >
                    {t("settingsThemeLight")}
                  </button>
                  <button
                    type="button"
                    className={preference === "dark" ? "active" : ""}
                    aria-pressed={preference === "dark"}
                    onClick={() => setPreference("dark")}
                  >
                    {t("settingsThemeDark")}
                  </button>
                </div>
              </SettingsRow>
            </SettingsBlock>
          </SettingsPanel>
        )}

        {!loading && section === "security" && (
          <SettingsPanel title={t("settingsSecurityTitle")} subtitle={t("settingsSecuritySub")}>
            {profile?.rodium_linked ? (
              <SettingsBlock title={t("settingsPasswordSection")} subtitle={t("loginRodiumHint")}>
                <p className="settings-value">{t("loginRodiumHint")}</p>
              </SettingsBlock>
            ) : (
              <SettingsBlock title={t("settingsPasswordSection")} subtitle={t("settingsPasswordHelp")}>
                <form className="settings-inline-form" onSubmit={onChangePassword}>
                  <label className="home-settings-field">
                    <span>{t("settingsCurrentPassword")}</span>
                    <input
                      className="home-settings-input"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                  </label>
                  <label className="home-settings-field">
                    <span>{t("settingsNewPassword")}</span>
                    <input
                      className="home-settings-input"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </label>
                  {error && <p className="error home-settings-feedback">{error}</p>}
                  {message && <p className="home-settings-success">{message}</p>}
                  <div className="home-settings-actions">
                    <button
                      className="landing-create home-settings-save"
                      type="submit"
                      disabled={changingPassword || !currentPassword || newPassword.length < 8}
                    >
                      {changingPassword ? t("settingsSaving") : t("settingsChangePassword")}
                    </button>
                  </div>
                </form>
              </SettingsBlock>
            )}
          </SettingsPanel>
        )}
      </SettingsShell>
    </HomeLayout>
  );
}
