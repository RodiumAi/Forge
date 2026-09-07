"use client";

/**
 * Google sign-in (Firebase popup → Forge `/auth/oauth/firebase`).
 *
 * Renders nothing when Firebase is not configured. That is the whole point:
 * a fresh clone has no `NEXT_PUBLIC_FIREBASE_*`, so it shows email/password
 * only rather than a button the server would answer with 503.
 *
 * GitHub is intentionally not offered on login/register — Google only.
 */

import { useState } from "react";

import { api, setToken, type ApiError } from "@/lib/api";
import { firebaseEnabled, signInWithGoogle, socialErrorKey } from "@/lib/firebase";
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
  const [busy, setBusy] = useState(false);

  if (!firebaseEnabled) return null;

  async function run() {
    setBusy(true);
    try {
      const idToken = await signInWithGoogle();
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
      setBusy(false);
    }
  }

  return (
    <div className="auth-social">
      <button
        type="button"
        className="btn btn-ghost auth-social-btn"
        disabled={disabled || busy}
        onClick={() => void run()}
        data-testid="auth-google"
      >
        <GoogleMark />
        {t("authContinueWithGoogle")}
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
