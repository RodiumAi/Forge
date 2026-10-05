"use client";

/**
 * The builder header's view of the account: live credit reservoirs and the
 * cached Forge plan.
 *
 * Backed by `GET /auth/forge/status`, which reads the gateway balance and the
 * cached entitlement row. FRODI is the primary reservoir (plan-gated, resets on
 * a cycle); RODI is the fallback wallet. Off Forge Cloud — open-source clones,
 * or accounts with no RodiumAi link — every field comes back `null`, and the UI
 * falls back to the RODI wallet badge (see `lib/session-cache.ts`) and shows
 * every feature rather than hiding anything behind a plan it cannot read.
 *
 * A tiny module-level cache with subscribe, mirroring `session-cache.ts`, so the
 * wallet badge, the plan panel and the feature gates all share one fetch.
 */

import { useEffect, useState } from "react";

import { api, getToken } from "@/lib/api";

export type ForgeEntitlements = {
  plan_slug: string;
  status: string;
  max_projects: number | null;
  model_selection: boolean;
  custom_domain: boolean;
  export_enabled: boolean;
  history_enabled: boolean;
  priority_generation: boolean;
  allowed_model_tiers: string[] | null;
  frodi_balance: number;
};

export type ForgeStatus = {
  frodi: number | null;
  rodi: number | null;
  frodi_grant?: number | null;
  frodi_resets_at?: string | null;
  plan: string | null;
  entitlements: ForgeEntitlements | null;
};

type Listener = (status: ForgeStatus | null) => void;

let cache: ForgeStatus | null = null;
let settled = false;
let flight: Promise<ForgeStatus | null> | null = null;
const listeners = new Set<Listener>();

export function getForgeStatusSnapshot(): ForgeStatus | null {
  return cache;
}

/** True after the first status fetch finishes, even when Forge Cloud is off. */
export function isForgeStatusSettled(): boolean {
  return settled;
}

export function subscribeForgeStatus(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(status: ForgeStatus | null) {
  cache = status;
  for (const listener of listeners) {
    try {
      listener(status);
    } catch {
      /* ignore subscriber errors */
    }
  }
}

/** Clear on logout so a later session never shows the previous account's plan. */
export function clearForgeStatus() {
  settled = false;
  notify(null);
}

/**
 * Fetch the current status (single-flight). Safe to call from many components.
 *
 * `fresh` waits out any request already in flight, then reads again. A prompt
 * can finish while an older poll is still open, and joining that poll would
 * keep the header on the balance from before the debit.
 */
export async function refreshForgeStatus(opts?: { fresh?: boolean }): Promise<ForgeStatus | null> {
  if (!getToken()) {
    if (cache) notify(null);
    return null;
  }
  if (opts?.fresh && flight) {
    try {
      await flight;
    } catch {
      /* the fresh read below replaces whatever that poll stored */
    }
  }
  if (flight) return flight;
  flight = (async () => {
    try {
      const status = await api<ForgeStatus>("/auth/forge/status");
      settled = true;
      notify(status);
      return status;
    } catch {
      // Keep the last known status on a blip rather than blanking the header.
      settled = true;
      notify(cache);
      return cache;
    } finally {
      flight = null;
    }
  })();
  return flight;
}

/** Hydrate from cache, then refresh once on mount and stay subscribed. */
export function useForgeStatus(): ForgeStatus | null {
  const [state, setState] = useState<ForgeStatus | null>(() => cache);
  useEffect(() => {
    const unsub = subscribeForgeStatus(setState);
    setState(cache);
    if (getToken()) void refreshForgeStatus();
    return unsub;
  }, []);
  return state;
}

/**
 * Whether a plan-gated feature is available.
 *
 * Unknown entitlements (off Forge Cloud, or before the first fetch) default to
 * `true` so the UI never hides a feature it cannot prove is locked — the backend
 * `require_feature` gate makes the same choice when there is no cached row.
 */
const SHARE_SEATS: Record<string, number | null> = {
  free: 0,
  starter: 3,
  builder: 10,
  pro: null,
  scale: null,
  "team-pro": null,
  "team-scale": null,
};

export function planSlugOf(status: ForgeStatus | null): string | null {
  return status?.plan ?? status?.entitlements?.plan_slug ?? null;
}

/** People you can invite. `null` means unlimited. Free is 0. */
export function shareSeatLimit(status: ForgeStatus | null): number | null {
  const slug = planSlugOf(status);
  if (!slug) return null;
  return slug in SHARE_SEATS ? SHARE_SEATS[slug] : 0;
}

/** Free and Starter never export source. Higher plans follow the entitlement flag. */
export function exportAllowed(status: ForgeStatus | null): boolean {
  const slug = planSlugOf(status);
  if (slug === "free" || slug === "starter") return false;
  return forgeFeatureEnabled(status, "export_enabled");
}

export function forgeFeatureEnabled(
  status: ForgeStatus | null,
  flag: keyof Pick<
    ForgeEntitlements,
    "model_selection" | "custom_domain" | "export_enabled" | "history_enabled" | "priority_generation"
  >,
): boolean {
  const ent = status?.entitlements;
  if (!ent) return true;
  return Boolean(ent[flag]);
}
