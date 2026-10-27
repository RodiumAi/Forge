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
import { AuthAlert, AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/Button";
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

  const guestNext = encodeURIComponent(sanitizeReturnTo(back) || "/dashboard");
  const done = Boolean(notice);
  const expired = preview?.status === "expired";
  const loadingPreview = !preview && !error;

  return (
    <AuthCard
      title={t("inviteTitle")}
      subtitle={subtitle}
      icon={loadingPreview ? "spinner" : done ? "check" : expired || (error && !preview) ? "clock" : "users"}
      tone={done ? "ok" : expired || (error && !preview) ? "danger" : "accent"}
      error={error || (expired ? t("inviteExpired") : null)}
      notice={notice}
    >
      {preview ? (
        <div className="f-auth-invite">
          <span className="f-auth-invite-avatar" aria-hidden>
            {(preview.project_name || "F").trim().charAt(0).toUpperCase()}
          </span>
          <div>
            <b>{preview.project_name || "Forge"}</b>
            <small>{fill(t("lndAuthInviteFrom"), { inviter: preview.inviter_name || "Forge" })}</small>
          </div>
          <span className="f-auth-invite-role">
            <span className="f-sr-only">{t("lndAuthInviteRole")}: </span>
            {roleLabel}
          </span>
        </div>
      ) : null}

      {preview && !notice && !closed ? (
        signedIn && !mismatch ? (
          <div className="f-auth-actions">
            <Button
              size="lg"
              icon="check"
              loading={busy === "accept"}
              disabled={busy !== null}
              onClick={() => void respond("accept")}
            >
              {busy === "accept" ? t("authWorking") : t("inviteAccept")}
            </Button>
            <Button
              size="lg"
              variant="ghost"
              loading={busy === "decline"}
              disabled={busy !== null}
              onClick={() => void respond("decline")}
            >
              {busy === "decline" ? t("authWorking") : t("inviteDecline")}
            </Button>
          </div>
        ) : signedIn && mismatch ? (
          <AuthAlert tone="warn">{fill(t("inviteMismatch"), { email, current })}</AuthAlert>
        ) : (
          <div className="f-auth-guest">
            <p>{fill(t("inviteSignInHint"), { email })}</p>
            <p className="f-auth-guest-hint">{fill(t("inviteCreateHint"), { email })}</p>
            <div className="f-auth-actions">
              <Button size="lg" onClick={() => router.push(`/login?next=${guestNext}`)}>
                {t("authSignInCta")}
              </Button>
              <Button size="lg" variant="ghost" onClick={() => router.push(`/register?next=${guestNext}`)}>
                {t("authSignUpCta")}
              </Button>
            </div>
          </div>
        )
      ) : null}
      {projectId ? (
        <Button size="lg" block iconEnd="arrow-right" onClick={() => router.push(`/projects/${projectId}`)}>
          {t("inviteOpen")}
        </Button>
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
