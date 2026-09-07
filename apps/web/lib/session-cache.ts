import { api, getToken } from "@/lib/api";
import { primeMediaToken } from "@/lib/media-token";
import { identifyPosthogUser } from "@/lib/posthog/client";

const STORAGE_KEY = "forge_session_v1";
/** Soft TTL: still show cache, but refresh in background when older. */
const SOFT_TTL_MS = 2 * 60 * 1000;

export type SessionProfile = {
  email: string;
  name?: string | null;
  avatar_url?: string | null;
  rodium_linked?: boolean;
  /**
   * The user's id on the RodiumAI platform (cuid2), stored on our side as
   * `users.rodium_sub`. Needed to build a top-up link to `rodiumai.io/pay`,
   * which identifies the account to credit by that id.
   */
  rodium_sub?: string | null;
};

export type SessionWallet = {
  balance_rodi?: string | null;
  provided_total_rodi?: string | null;
};

export type SessionRodium = {
  linked: boolean;
  wallet?: SessionWallet | null;
};

export type SessionSnapshot = {
  tokenFp: string;
  profile: SessionProfile | null;
  rodium: SessionRodium | null;
  updatedAt: number;
};

type Listener = (snap: SessionSnapshot | null) => void;

const listeners = new Set<Listener>();
let memory: SessionSnapshot | null = null;
let refreshPromise: Promise<SessionSnapshot | null> | null = null;

function tokenFingerprint(token: string): string {
  return `${token.slice(0, 10)}.${token.slice(-8)}.${token.length}`;
}

function notify(snap: SessionSnapshot | null) {
  memory = snap;
  for (const listener of listeners) {
    try {
      listener(snap);
    } catch {
      /* ignore subscriber errors */
    }
  }
}

function readStorage(): SessionSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionSnapshot;
    if (!parsed || typeof parsed !== "object" || !parsed.tokenFp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStorage(snap: SessionSnapshot | null) {
  if (typeof window === "undefined") return;
  try {
    if (!snap) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
  } catch {
    /* quota / private mode */
  }
}

/** Current in-memory/session snapshot if it matches the active token. */
export function getSessionSnapshot(): SessionSnapshot | null {
  const token = getToken();
  if (!token) return null;
  const fp = tokenFingerprint(token);
  const snap = memory || readStorage();
  if (!snap || snap.tokenFp !== fp) return null;
  if (!memory) memory = snap;
  return snap;
}

export function clearSessionCache() {
  memory = null;
  writeStorage(null);
  notify(null);
}

export function patchSessionCache(patch: {
  profile?: SessionProfile | null;
  rodium?: SessionRodium | null;
}) {
  const token = getToken();
  if (!token) {
    clearSessionCache();
    return;
  }
  const fp = tokenFingerprint(token);
  const prev = getSessionSnapshot();
  const next: SessionSnapshot = {
    tokenFp: fp,
    profile: patch.profile !== undefined ? patch.profile : prev?.profile ?? null,
    rodium: patch.rodium !== undefined ? patch.rodium : prev?.rodium ?? null,
    updatedAt: Date.now(),
  };
  writeStorage(next);
  notify(next);
}

export function subscribeSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Hydrate UI from session cache, then refresh /auth/me + /auth/rodium/account
 * (single-flight). Safe to call from multiple components.
 */
export async function ensureSession(options?: { force?: boolean }): Promise<SessionSnapshot | null> {
  const token = getToken();
  if (!token) {
    clearSessionCache();
    return null;
  }

  const existing = getSessionSnapshot();
  const freshEnough =
    existing && Date.now() - existing.updatedAt < SOFT_TTL_MS && !options?.force;
  if (freshEnough) return existing;

  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    // Fetched alongside the profile so `<img src>` URLs have a credential
    // ready on first paint rather than a render later.
    void primeMediaToken();
    try {
      const [meResult, accountResult] = await Promise.allSettled([
        api<SessionProfile & { id?: string; rodium_sub?: string | null }>("/auth/me"),
        api<{
          linked: boolean;
          wallet?: SessionWallet | null;
        }>("/auth/rodium/account"),
      ]);

      const prev = getSessionSnapshot();
      let profile = prev?.profile ?? null;
      let rodium = prev?.rodium ?? null;

      if (meResult.status === "fulfilled") {
        const me = meResult.value;
        profile = {
          email: me.email,
          name: me.name,
          avatar_url: me.avatar_url,
          rodium_linked: me.rodium_linked,
          rodium_sub: me.rodium_sub ?? null,
        };
        const distinctId = me.rodium_sub ?? (me.id ? String(me.id) : null);
        if (distinctId) {
          identifyPosthogUser(distinctId, {
            email: me.email,
            forge_user_id: me.id ? String(me.id) : null,
            rodium_linked: Boolean(me.rodium_linked),
          });
        }
      }

      if (accountResult.status === "fulfilled") {
        const acc = accountResult.value;
        rodium = {
          linked: Boolean(acc.linked),
          wallet: acc.wallet ?? null,
        };
      } else if (prev?.rodium?.linked) {
        // Keep last known wallet if live fetch fails (Nest/token hiccup).
        rodium = prev.rodium;
      }

      const snap: SessionSnapshot = {
        tokenFp: tokenFingerprint(token),
        profile,
        rodium,
        updatedAt: Date.now(),
      };
      writeStorage(snap);
      notify(snap);
      return snap;
    } catch {
      return getSessionSnapshot();
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

let walletFlight: Promise<SessionWallet | null> | null = null;

/**
 * Always re-fetch RodiumAi wallet (bypasses soft TTL). Use after generation
 * or when the badge becomes visible again.
 *
 * Prefers OIDC Nest wallet when linked; falls back to pasted API key via
 * GET /settings/rodium/wallet (gateway /v1/wallet/balance).
 */
export async function refreshRodiumWallet(): Promise<SessionWallet | null> {
  const token = getToken();
  if (!token) {
    clearSessionCache();
    return null;
  }
  if (walletFlight) return walletFlight;

  walletFlight = (async () => {
    try {
      const prev = getSessionSnapshot();
      let wallet: SessionWallet | null = prev?.rodium?.wallet ?? null;
      let linked = Boolean(prev?.rodium?.linked || prev?.profile?.rodium_linked);
      let profile = prev?.profile ?? null;

      try {
        const acc = await api<{
          linked: boolean;
          wallet?: SessionWallet | null;
          name?: string | null;
          avatar_url?: string | null;
          email?: string;
          rodium_sub?: string | null;
        }>("/auth/rodium/account?fresh=1");

        linked = Boolean(acc.linked);
        if (acc.wallet) wallet = acc.wallet;
        profile = profile
          ? {
              ...profile,
              email: acc.email || profile.email,
              name: acc.name ?? profile.name,
              avatar_url: acc.avatar_url ?? profile.avatar_url,
              rodium_linked: linked,
              rodium_sub: acc.rodium_sub ?? profile.rodium_sub ?? null,
            }
          : acc.email
            ? {
                email: acc.email,
                name: acc.name,
                avatar_url: acc.avatar_url,
                rodium_linked: linked,
                rodium_sub: acc.rodium_sub ?? null,
              }
            : profile;
      } catch {
        /* OIDC account may be unavailable — try key path below */
      }

      if (!wallet) {
        try {
          const byKey = await api<SessionWallet>("/settings/rodium/wallet");
          if (byKey && (byKey.balance_rodi != null || byKey.provided_total_rodi != null)) {
            wallet = byKey;
          }
        } catch {
          /* no pasted key / gateway error */
        }
      }

      const rodium: SessionRodium = {
        linked,
        wallet,
      };
      const snap: SessionSnapshot = {
        tokenFp: tokenFingerprint(token),
        profile,
        rodium,
        updatedAt: Date.now(),
      };
      writeStorage(snap);
      notify(snap);
      return wallet;
    } catch {
      return getSessionSnapshot()?.rodium?.wallet ?? null;
    } finally {
      walletFlight = null;
    }
  })();

  return walletFlight;
}
