"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { setToken } from "@/lib/api";
import { LocaleSwitch, useI18n } from "@/lib/i18n/I18nProvider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();

  function logout() {
    setToken(null);
    router.push("/");
  }

  return (
    <div>
      <header
        style={{
          borderBottom: "1px solid var(--border)",
          background: "rgba(7,7,7,0.85)",
          backdropFilter: "blur(10px)",
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <div
          className="container"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: 64,
            gap: "1rem",
          }}
        >
          <Link href="/" className="brand">
            <Image src="/forge-rodiumai.png" alt={t("brandAlt")} width={140} height={40} priority />
          </Link>
          <nav style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <div className="header-locale">
              <LocaleSwitch />
            </div>
            <Link
              href="/dashboard"
              className="btn btn-ghost"
              style={{
                opacity: pathname === "/dashboard" ? 1 : 0.7,
                padding: "0.45rem 0.9rem",
              }}
            >
              {t("projects")}
            </Link>
            <Link
              href="/settings"
              className="btn btn-ghost"
              style={{
                opacity: pathname === "/settings" ? 1 : 0.7,
                padding: "0.45rem 0.9rem",
              }}
            >
              {t("settings")}
            </Link>
            <button type="button" className="btn btn-ghost" onClick={logout}>
              {t("logout")}
            </button>
          </nav>
        </div>
      </header>
      <main className="container" style={{ padding: "1.5rem 0 3rem" }}>
        {children}
      </main>
    </div>
  );
}
