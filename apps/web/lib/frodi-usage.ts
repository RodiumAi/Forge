import type { ForgeStatus } from "@/lib/forge-status";

/** Weekly allotment when the gateway balance does not carry the plan figure. */
const GRANT_BY_PLAN: Record<string, number> = {
  free: 500,
  starter: 2000,
  builder: 5000,
  pro: 10000,
  scale: 30000,
  "team-pro": 10000,
  "team-scale": 25000,
};

export type FrodiUsage = {
  plan: string | null;
  remaining: number;
  grant: number;
  usedPct: number;
  resetsAt: string | null;
};

export function frodiUsage(status: ForgeStatus | null): FrodiUsage | null {
  const remaining = status?.frodi;
  if (remaining == null || !Number.isFinite(remaining)) return null;
  const plan = status?.plan ?? status?.entitlements?.plan_slug ?? null;
  const fromApi = status?.frodi_grant;
  const grant =
    fromApi != null && Number.isFinite(fromApi) && fromApi > 0
      ? fromApi
      : plan
        ? GRANT_BY_PLAN[plan]
        : undefined;
  if (!grant) return null;
  const used = Math.max(0, grant - remaining);
  const usedPct = Math.min(100, Math.round((used / grant) * 100));
  return {
    plan,
    remaining,
    grant,
    usedPct,
    resetsAt: status?.frodi_resets_at ?? null,
  };
}

export type UsageLevel = 80 | 95 | 100 | null;

export function usageLevel(usedPct: number): UsageLevel {
  if (usedPct >= 100) return 100;
  if (usedPct >= 95) return 95;
  if (usedPct >= 80) return 80;
  return null;
}

function dismissKey(level: 80 | 95, resetsAt: string | null): string {
  return `forge-frodi-dismiss:${level}:${resetsAt || "cycle"}`;
}

export function isUsageDismissed(level: UsageLevel, resetsAt: string | null): boolean {
  if (level == null || level === 100) return false;
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(dismissKey(level, resetsAt)) === "1";
  } catch {
    return false;
  }
}

export function dismissUsage(level: 80 | 95, resetsAt: string | null): void {
  try {
    window.localStorage.setItem(dismissKey(level, resetsAt), "1");
  } catch {
    /* private mode */
  }
}
