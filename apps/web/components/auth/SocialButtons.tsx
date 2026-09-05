"use client";

/**
 * Google and GitHub sign-in.
 *
 * Renders nothing when Firebase is not configured. That is the whole point:
 * a fresh clone has no `NEXT_PUBLIC_FIREBASE_*`, so it shows email/password
 * only rather than two buttons the server would answer with 503.
 */

import { useState } from "react";

import { api, setToken, type ApiError } from "@/lib/api";
import { firebaseEnabled, signInWithProvider, socialErrorKey, type SocialProvider } from "@/lib/firebase";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/dictionaries";

type TokenResponse = { access_token: string; email_verified?: boolean };

export function SocialButtons({
  onSuccess,
  onError,
  disabled,
}: {
  onSuccess: (response: TokenResponse) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState<SocialProvider | null>(null);

  if (!firebaseEnabled) return null;

  async function run(provider: SocialProvider) {
    setBusy(provider);
    try {
      const idToken = await signInWithProvider(provider);
      const data = await api<TokenResponse>("/auth/oauth/firebase", {
        method: "POST",
        body: JSON.stringify({ id_token: idToken }),
      });
      setToken(data.access_token);
      onSuccess(data);
    } catch (err) {
      // A server answer (e.g. "sign in with your password first") is more
      // useful than our generic copy, so it wins when present.
      // A 403 here means the provider gave us an address it had not verified;
      // the server has sent a confirmation link. Its message says so, so pass
      // it through rather than replacing it with generic sign-in copy.
      const apiMessage = (err as ApiError)?.status ? (err as Error).message : null;
      if (apiMessage) {
        onError(apiMessage);
      } else {
        const key = socialErrorKey(err);
        // `null` = the user closed the popup. Not an error worth showing.
        if (key) onError(t(key as MessageKey));
      }
      setBusy(null);
    }
  }

  return (
    <div className="auth-social">
      <button
        type="button"
        className="btn btn-ghost auth-social-btn"
        disabled={disabled || busy !== null}
        onClick={() => void run("google")}
      >
        <GoogleMark />
        {t("authContinueWithGoogle")}
      </button>
      <button
        type="button"
        className="btn btn-ghost auth-social-btn"
        disabled={disabled || busy !== null}
        onClick={() => void run("github")}
      >
        <GithubMark />
        {t("authContinueWithGithub")}
      </button>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

function GithubMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
      />
    </svg>
  );
}
