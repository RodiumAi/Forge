"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { api, getToken, setToken } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  clearSessionCache,
  ensureSession,
  getSessionSnapshot,
  subscribeSession,
  type SessionProfile,
} from "@/lib/session-cache";

function displayNameFromEmail(email: string) {
  const local = email.split("@")[0] || email;
  return local.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function initialsFromLabel(label: string) {
  const parts = label.split(" ").filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0]?.slice(0, 2) || "?").toUpperCase();
}

export function ProfileMenu() {
  const router = useRouter();
  const { t } = useI18n();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<SessionProfile | null>(() =>
    typeof window !== "undefined" ? getSessionSnapshot()?.profile ?? null : null,
  );
  const [avatarBroken, setAvatarBroken] = useState(false);

  useEffect(() => {
    if (!getToken()) return;
    setProfile(getSessionSnapshot()?.profile ?? null);
    const unsub = subscribeSession((snap) => {
      setProfile(snap?.profile ?? null);
      setAvatarBroken(false);
    });
    void ensureSession();
    return unsub;
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  async function logout() {
    try {
      if (getToken()) {
        await api("/auth/logout", { method: "POST" });
      }
    } catch {
      // Always clear local session even if revoke fails.
    }
    clearSessionCache();
    setToken(null);
    router.push("/");
  }

  const email = profile?.email || "";
  const name =
    (profile?.name && profile.name.trim()) ||
    (email ? displayNameFromEmail(email) : null);
  const avatarUrl = profile?.avatar_url?.trim() || "";
  const showPhoto = Boolean(avatarUrl) && !avatarBroken;
  const pending = !name && !email;
  const label = name || (pending ? "…" : t("profileFallback"));

  return (
    <div className="profile-menu" ref={rootRef}>
      <button
        type="button"
        className="profile-menu-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="profile-menu-avatar" aria-hidden>
          {showPhoto ? (
            <img src={avatarUrl} alt="" onError={() => setAvatarBroken(true)} />
          ) : pending ? (
            <span className="profile-menu-avatar-skel" />
          ) : (
            initialsFromLabel(label)
          )}
        </span>
        <span className={`profile-menu-name${pending ? " is-pending" : ""}`}>{label}</span>
        <span className="profile-menu-chevron" aria-hidden>
          <Icon icon={ChevronDown} className="ui-icon-sm" />
        </span>
      </button>

      {open && (
        <div className="profile-menu-dropdown" role="menu">
          <div className="profile-menu-header">
            <strong>{label}</strong>
            {email && <span>{email}</span>}
          </div>
          <Link href="/settings" className="profile-menu-item" role="menuitem" onClick={() => setOpen(false)}>
            {t("settings")}
          </Link>
          <Link href="/connectors" className="profile-menu-item" role="menuitem" onClick={() => setOpen(false)}>
            {t("connectors")}
          </Link>
          <button
            type="button"
            className="profile-menu-item danger"
            role="menuitem"
            onClick={() => void logout()}
          >
            {t("logout")}
          </button>
        </div>
      )}
    </div>
  );
}
