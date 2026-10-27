"use client";

import { api, getToken, setToken } from "@/lib/api";
import { clearForgeStatus } from "@/lib/forge-status";
import { clearSessionCache } from "@/lib/session-cache";

/**
 * Revokes the session server-side (best effort), clears every client cache
 * and goes back to the landing. Shared by the account menus.
 */
export async function signOut(): Promise<void> {
  try {
    if (getToken()) await api("/auth/logout", { method: "POST" });
  } catch {
    // Always clear the local session, even if the revoke fails.
  }
  clearSessionCache();
  clearForgeStatus();
  setToken(null);
  window.location.assign("/");
}
