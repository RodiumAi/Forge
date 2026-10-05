/**
 * Firebase client SDK — Google sign-in for Forge login/register.
 *
 * Same shape as the RodiumAi user app: the browser collects an ID token and
 * posts it to `POST /auth/oauth/firebase`, which verifies it with the Admin
 * SDK. No provider secret reaches this bundle.
 *
 * Popup first, then `signInWithRedirect` when the browser blocks the popup or
 * opens it as an orphaned tab (common in embedded browsers / strict COOP).
 * Without that fallback the Google tab finishes alone and never returns here.
 *
 * `firebaseEnabled` is the switch that keeps a fresh clone honest. With the
 * `NEXT_PUBLIC_FIREBASE_*` vars unset it is false, the Google button is not
 * rendered, and nobody clicks an option the server would answer with 503.
 */

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  type Auth,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
} as const;

export const firebaseEnabled: boolean = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
);

function firebaseApp(): FirebaseApp {
  if (!firebaseEnabled) throw new Error("firebase_not_configured");
  // getApps() guards against double-init across HMR and multiple importers.
  return getApps().length ? getApp() : initializeApp(firebaseConfig as Record<string, string>);
}

function firebaseAuth(): Auth {
  if (typeof window === "undefined") throw new Error("firebase_client_only");
  return getAuth(firebaseApp());
}

function googleProvider(): GoogleAuthProvider {
  const authProvider = new GoogleAuthProvider();
  // Otherwise a signed-in browser silently reuses one account, which is
  // baffling for anyone with two.
  authProvider.setCustomParameters({ prompt: "select_account" });
  return authProvider;
}

/**
 * Open the Google popup and return a freshly-minted ID token.
 *
 * If the browser blocks the popup (or opens an orphaned tab that cannot talk
 * back), fall through to a full-page redirect. That path completes via
 * `completeGoogleRedirect` on the next load of login/register.
 *
 * `forceRefresh` matters: a token cached from an earlier session can be close
 * enough to expiry that it fails verification server-side by the time it
 * arrives.
 */
export async function signInWithGoogle(): Promise<string> {
  const auth = firebaseAuth();
  const authProvider = googleProvider();
  try {
    const credential = await signInWithPopup(auth, authProvider);
    return credential.user.getIdToken(true);
  } catch (error) {
    if ((error as { code?: string } | null)?.code !== "auth/popup-blocked") {
      throw error;
    }
    await signInWithRedirect(auth, authProvider);
    // Navigation away — keep the caller pending until unload.
    return new Promise<string>(() => {});
  }
}

/**
 * Finish a Google redirect round-trip after returning to /login or /register.
 * Returns null when this load was not a redirect completion.
 */
export async function completeGoogleRedirect(): Promise<string | null> {
  if (!firebaseEnabled || typeof window === "undefined") return null;
  const result = await getRedirectResult(firebaseAuth());
  if (!result?.user) return null;
  return result.user.getIdToken(true);
}

/** @deprecated Prefer `signInWithGoogle`. Kept for older call sites. */
export async function signInWithProvider(provider: "google"): Promise<string> {
  if (provider !== "google") {
    throw new Error("unsupported_social_provider");
  }
  return signInWithGoogle();
}

/**
 * Map Firebase's error codes onto message keys. A closed popup is not an
 * error worth shouting about — the caller renders nothing for `null`.
 */
export function socialErrorKey(error: unknown): string | null {
  const code = (error as { code?: string } | null)?.code ?? "";
  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return null;
    case "auth/popup-blocked":
      return "authSocialPopupBlocked";
    case "auth/account-exists-with-different-credential":
      return "authSocialAccountExists";
    case "auth/unauthorized-domain":
    case "auth/operation-not-allowed":
      return "authSocialUnavailable";
    default:
      return "authSocialFailed";
  }
}
