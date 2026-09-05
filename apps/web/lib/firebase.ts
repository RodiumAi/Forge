/**
 * Firebase client SDK — popup sign-in with Google and GitHub.
 *
 * Same shape as the RodiumAi user app, on purpose: the browser collects an ID
 * token and posts it to `POST /auth/oauth/firebase`, which verifies it with
 * the Admin SDK. No provider secret ever reaches this bundle, and there is no
 * second OAuth callback route to maintain.
 *
 * `firebaseEnabled` is the switch that keeps a fresh clone honest. With the
 * `NEXT_PUBLIC_FIREBASE_*` vars unset it is false, the buttons are not
 * rendered, and nobody clicks an option the server would answer with 503.
 */

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  GithubAuthProvider,
  GoogleAuthProvider,
  getAuth,
  signInWithPopup,
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

export type SocialProvider = "google" | "github";

function firebaseApp(): FirebaseApp {
  if (!firebaseEnabled) throw new Error("firebase_not_configured");
  // getApps() guards against double-init across HMR and multiple importers.
  return getApps().length ? getApp() : initializeApp(firebaseConfig as Record<string, string>);
}

function firebaseAuth(): Auth {
  if (typeof window === "undefined") throw new Error("firebase_client_only");
  return getAuth(firebaseApp());
}

/**
 * Open the provider popup and return a freshly-minted ID token.
 *
 * `forceRefresh` matters: a token cached from an earlier session can be close
 * enough to expiry that it fails verification server-side by the time it
 * arrives.
 */
export async function signInWithProvider(provider: SocialProvider): Promise<string> {
  const auth = firebaseAuth();
  let authProvider;
  if (provider === "google") {
    authProvider = new GoogleAuthProvider();
    // Otherwise a signed-in browser silently reuses one account, which is
    // baffling for anyone with two.
    authProvider.setCustomParameters({ prompt: "select_account" });
  } else {
    authProvider = new GithubAuthProvider();
    // GitHub hides the address unless asked; without it the server has no
    // email to key the account on and refuses the sign-in.
    authProvider.addScope("read:user");
    authProvider.addScope("user:email");
  }
  const credential = await signInWithPopup(auth, authProvider);
  return credential.user.getIdToken(true);
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
