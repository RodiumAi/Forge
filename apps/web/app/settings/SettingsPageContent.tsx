"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import "@/styles/forge/pages.css";

import { legacySettingsAnchor } from "@/components/app/legacy-routes";
import { ConsentSettingsBlock } from "@/components/consent/ConsentSettingsBlock";
import { RodiumGenerationPanel } from "@/components/RodiumGenerationPanel";
import { AppShell } from "@/components/shell/AppShell";
import { Avatar } from "@/components/ui/Avatar";
import { Tag } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Tabs";
import { api, getToken, setToken } from "@/lib/api";
import { rodiumUserAppOrigin } from "@/lib/constants/rodium-links";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { posthogEnabled } from "@/lib/posthog/client";
import { useTheme } from "@/lib/theme/ThemeProvider";

type Profile = {
  id: string;
  email: string;
  name?: string | null;
  avatar_url?: string | null;
  rodium_linked?: boolean;
  /** True when this account has a local password to change. */
  has_password?: boolean;
  created_at: string;
};

type SectionId = "profile" | "security" | "rodiumai" | "appearance" | "language" | "privacy";

const NAV: { group: MessageKey; items: { id: SectionId; label: MessageKey }[] }[] = [
  {
    group: "apSettingsAccount",
    items: [
      { id: "profile", label: "apProfile" },
      { id: "security", label: "apSecurity" },
    ],
  },
  { group: "apSettingsForge", items: [{ id: "rodiumai", label: "apRodiumConnection" }] },
  {
    group: "apSettingsPrefs",
    items: [
      { id: "appearance", label: "apAppearance" },
      { id: "language", label: "apLanguage" },
      { id: "privacy", label: "apNotifications" },
    ],
  },
];

const ALL_IDS: string[] = NAV.flatMap((g) => g.items.map((i) => i.id));

function scrollToSection(id: string, smooth: boolean) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: smooth && !reduce ? "smooth" : "auto", block: "start" });
}

const THEMES: { id: "dark" | "light" | "system"; label: MessageKey; pv: [string, string] }[] = [
  { id: "dark", label: "apThemeDark", pv: ["#1C1F26", "#13151A"] },
  { id: "light", label: "apThemeLight", pv: ["#F1EDE6", "#FBF9F5"] },
  { id: "system", label: "apThemeSystem", pv: ["#1C1F26", "#FBF9F5"] },
];

export default function SettingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale, setLocale } = useI18n();
  // Keyed off the preference, not the resolved theme: "System" must read as
  // selected even though what's painted is light or dark.
  const { preference, setPreference } = useTheme();

  const [active, setActive] = useState<SectionId>("profile");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/");
      return;
    }
    api<Profile>("/auth/me")
      .then(setProfile)
      .catch((err) => {
        if (err instanceof Error && /invalid token|not authenticated|unauthorized/i.test(err.message)) return;
        setError(err instanceof Error ? err.message : t("errorGeneric"));
      })
      .finally(() => setLoading(false));
  }, [router, t]);

  // Old `?tab=` links (and the RodiumAi OAuth return) land on the right anchor.
  useEffect(() => {
    if (loading) return;
    const legacy = legacySettingsAnchor(searchParams.get("tab"));
    const hash = window.location.hash.replace("#", "");
    const target = legacy ?? (ALL_IDS.includes(hash) ? hash : null);
    if (legacy) router.replace(`/settings#${legacy}`, { scroll: false });
    if (target) {
      setActive(target as SectionId);
      requestAnimationFrame(() => scrollToSection(target, false));
    }
  }, [loading, router, searchParams]);

  // Highlight the section being read.
  useEffect(() => {
    if (loading || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id as SectionId);
      },
      { rootMargin: "-90px 0px -60% 0px" },
    );
    for (const id of ALL_IDS) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [loading]);

  function go(id: SectionId) {
    setActive(id);
    window.history.replaceState(null, "", `#${id}`);
    scrollToSection(id, true);
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    setChangingPassword(true);
    setError(null);
    setMessage(null);
    try {
      // Changing the password revokes every outstanding session, including
      // this tab's. The endpoint hands back a replacement so the person who
      // just changed it is not logged out by their own action.
      const settingFirstPassword = !profile?.has_password;
      const result = await api<{ access_token?: string | null }>("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          current_password: settingFirstPassword ? "" : currentPassword,
          new_password: newPassword,
        }),
      });
      if (result?.access_token) setToken(result.access_token);
      setCurrentPassword("");
      setNewPassword("");
      setMessage(settingFirstPassword ? t("settingsPasswordSet") : t("settingsPasswordChanged"));
      setProfile(await api<Profile>("/auth/me"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setChangingPassword(false);
    }
  }

  const joined = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;
  const hasPassword = Boolean(profile?.has_password);

  return (
    <AppShell active="settings" title={t("uiNavSettings")}>
      <div className="f-settings">
        <nav className="f-set-nav" aria-label={t("uiNavSettings")}>
          {NAV.map((g) => (
            <div key={g.group} style={{ display: "contents" }}>
              <h6>{t(g.group)}</h6>
              {g.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-current={active === item.id ? "true" : undefined}
                  onClick={() => go(item.id)}
                >
                  {t(item.label)}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="f-set-main">
          {loading ? (
            <>
              <span className="f-skel" style={{ height: 220 }} />
              <span className="f-skel" style={{ height: 180 }} />
            </>
          ) : (
            <>
              <section id="profile" aria-labelledby="set-profile">
                <Panel
                  title={<span id="set-profile">{t("apProfile")}</span>}
                  lead={t("apProfileLead")}
                  actions={
                    <Button variant="ghost" size="sm" href={`${rodiumUserAppOrigin()}/dashboard/settings`} external>
                      {t("apEditOnRodium")}
                    </Button>
                  }
                >
                  <div className="f-profile-head">
                    <Avatar name={profile?.name || profile?.email} src={profile?.avatar_url} size="lg" />
                    <div style={{ minWidth: 0, flex: "1 1 200px" }}>
                      <b style={{ display: "block", fontSize: 18, overflowWrap: "anywhere" }}>
                        {profile?.name || profile?.email}
                      </b>
                      <small style={{ color: "var(--f-muted)", overflowWrap: "anywhere" }}>{profile?.email}</small>
                    </div>
                    {profile?.rodium_linked ? (
                      <Tag tone="ok" icon="check">
                        {t("rodiumConnected")}
                      </Tag>
                    ) : null}
                  </div>
                  <div className="f-form-grid">
                    <Field label={t("apFullName")}>
                      <Input value={profile?.name || ""} readOnly />
                    </Field>
                    <Field label={t("apEmail")}>
                      <Input value={profile?.email || ""} readOnly />
                    </Field>
                  </div>
                  {joined ? (
                    <p className="f-note" style={{ marginTop: 12 }}>
                      {t("apMemberSince")} {joined}
                    </p>
                  ) : null}
                </Panel>
              </section>

              <section id="security" aria-labelledby="set-security">
                <Panel
                  title={<span id="set-security">{t("apSecurity")}</span>}
                  lead={hasPassword ? t("apSecurityLead") : t("apSetPasswordLead")}
                >
                  <form onSubmit={onChangePassword} style={{ display: "grid", gap: 12, marginTop: 8 }}>
                    <div className="f-form-grid">
                      {hasPassword ? (
                        <Field label={t("apCurrentPassword")}>
                          <Input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            autoComplete="current-password"
                          />
                        </Field>
                      ) : null}
                      <Field label={t("apNewPassword")} hint={t("apPasswordRule")}>
                        <Input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          autoComplete="new-password"
                          minLength={8}
                        />
                      </Field>
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
                    <div className="f-actions-row">
                      <Button
                        type="submit"
                        loading={changingPassword}
                        disabled={changingPassword || newPassword.length < 8 || (hasPassword && !currentPassword)}
                      >
                        {hasPassword ? t("apChangePassword") : t("apSetPassword")}
                      </Button>
                    </div>
                  </form>
                </Panel>
              </section>

              <section id="rodiumai" aria-labelledby="set-rodiumai">
                <Panel
                  title={<span id="set-rodiumai">{t("apRodiumConnection")}</span>}
                  lead={t("apRodiumConnectionLead")}
                >
                  <RodiumGenerationPanel />
                </Panel>
              </section>

              <section id="appearance" aria-labelledby="set-appearance">
                <Panel title={<span id="set-appearance">{t("apAppearance")}</span>} lead={t("apAppearanceLead")}>
                  <div className="f-theme-cards" role="group" aria-label={t("apAppearance")}>
                    {THEMES.map((th) => (
                      <button
                        key={th.id}
                        type="button"
                        className="f-theme-card"
                        aria-pressed={preference === th.id}
                        onClick={() => setPreference(th.id)}
                      >
                        <span className="pv" aria-hidden="true">
                          <i style={{ background: th.pv[0] }} />
                          <i style={{ background: th.pv[1] }} />
                        </span>
                        {t(th.label)}
                      </button>
                    ))}
                  </div>
                </Panel>
              </section>

              <section id="language" aria-labelledby="set-language">
                <Panel
                  title={<span id="set-language">{t("apLanguage")}</span>}
                  lead={t("apLanguageLead")}
                  actions={
                    <Segmented
                      label={t("apLanguage")}
                      value={locale}
                      onChange={(next) => setLocale(next)}
                      items={[
                        { id: "fr", label: "Français" },
                        { id: "en", label: "English" },
                      ]}
                    />
                  }
                />
              </section>

              <section id="privacy" aria-labelledby="set-privacy">
                <Panel title={<span id="set-privacy">{t("apNotifications")}</span>} lead={t("apNotificationsLead")}>
                  {posthogEnabled ? (
                    <>
                      <p className="f-note" style={{ marginTop: 8 }}>
                        <b>{t("apPrivacy")}.</b> {t("apPrivacyLead")}
                      </p>
                      <ConsentSettingsBlock />
                    </>
                  ) : null}
                </Panel>
              </section>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
