"use client";

/**
 * Accept or decline a project invitation from the emailed link.
 *
 * The token is not consumed by opening the page (mail scanners prefetch links).
 * A new address is sent to register with the same email, then comes back here.
 */

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AuthCallbackScreen } from "@/components/auth/AuthCallbackScreen";
import { AuthCard } from "@/components/auth/AuthCard";
import { api, getToken } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { sanitizeReturnTo } from "@/lib/rodium-oauth";

type Preview = {
  status: string;
  email: string;
  role: string;
  project_name: string;
  inviter_name: string;
};

type Me = { email?: string | null };

function fill(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template);
}

function InviteInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useI18n();
  const token = params.get("token") || "";
  const back = token ? `/invite?token=${encodeURIComponent(token)}` : "/dashboard";

  const [preview, setPreview] = useState<Preview | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const signedIn = Boolean(getToken());

  useEffect(() => {
    if (!token) {
      setError(t("inviteInvalid"));
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await api<Preview>(`/projects/invites/preview?token=${encodeURIComponent(token)}`, {
          retries: 0,
        });
        if (!cancelled) setPreview(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : t("inviteInvalid"));
      }
      if (!getToken() || cancelled) return;
      try {
        const user = await api<Me>("/auth/me");
        if (!cancelled) setMe(user);
      } catch {
        if (!cancelled) setMe(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  const roleLabel =
    preview?.role === "viewer" ? t("shareRoleViewer") : t("shareRoleEditor");
  const subtitle = preview
    ? fill(t("inviteBody"), {
        inviter: preview.inviter_name || "Forge",
        project: preview.project_name || "Forge",
        role: roleLabel,
      })
    : undefined;

  async function respond(action: "accept" | "decline") {
    setBusy(action);
    setError(null);
    try {
      const data = await api<{ project_id?: string; status: string }>(`/projects/invites/${action}`, {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      if (action === "accept") {
        setNotice(t("inviteAccepted"));
        if (data.project_id) setProjectId(data.project_id);
      } else {
        setNotice(t("inviteDeclined"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("inviteInvalid"));
    } finally {
      setBusy(null);
    }
  }

  const email = preview?.email || "";
  const current = me?.email || "";
  const mismatch = Boolean(signedIn && email && current && current.toLowerCase() !== email.toLowerCase());
  const closed = preview?.status === "expired" || preview?.status === "declined";

  return (
    <AuthCard
      title={t("inviteTitle")}
      subtitle={subtitle}
      error={error || (preview?.status === "expired" ? t("inviteExpired") : null)}
      notice={notice}
    >
      {preview && !notice && !closed ? (
        signedIn && !mismatch ? (
          <div className="options-actions" style={{ display: "flex", gap: "0.6rem", justifyContent: "center" }}>
            <button type="button" className="btn" disabled={busy !== null} onClick={() => void respond("accept")}>
              {busy === "accept" ? t("authWorking") : t("inviteAccept")}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy !== null}
              onClick={() => void respond("decline")}
            >
              {busy === "decline" ? t("authWorking") : t("inviteDecline")}
            </button>
          </div>
        ) : signedIn && mismatch ? (
          <p className="options-help">
            {fill(t("inviteMismatch"), { email, current })}
          </p>
        ) : (
          <div className="invite-guest">
            <p>{fill(t("inviteSignInHint"), { email })}</p>
            <p>{fill(t("inviteCreateHint"), { email })}</p>
            <div className="invite-guest-actions">
              <button
                type="button"
                className="btn"
                onClick={() => router.push(`/login?next=${encodeURIComponent(sanitizeReturnTo(back) || "/dashboard")}`)}
              >
                {t("authSignInCta")}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => router.push(`/register?next=${encodeURIComponent(sanitizeReturnTo(back) || "/dashboard")}`)}
              >
                {t("authSignUpCta")}
              </button>
            </div>
          </div>
        )
      ) : null}
      {projectId ? (
        <p className="auth-alt">
          <button type="button" className="auth-link" onClick={() => router.push(`/projects/${projectId}`)}>
            {t("inviteOpen")}
          </button>
        </p>
      ) : null}
    </AuthCard>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<AuthCallbackScreen />}>
      <InviteInner />
    </Suspense>
  );
}
