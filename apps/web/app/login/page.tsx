"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { LocaleSwitch, useI18n } from "@/lib/i18n/I18nProvider";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loginWithRodium() {
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ authorize_url: string }>("/auth/rodium/start");
      window.location.href = data.authorize_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem" }}>
      <div className="card" style={{ width: "min(420px, 100%)" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.5rem" }}>
          <div className="header-locale">
            <LocaleSwitch />
          </div>
        </div>
        <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
          <Image src="/forge-rodiumai.png" alt={t("brandAlt")} width={220} height={64} priority />
          <h1 style={{ margin: "0.85rem 0 0.35rem", fontSize: "1.25rem" }}>{t("loginTitle")}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {t("loginRodiumSub")}
          </p>
        </div>

        {error && (
          <p className="error" style={{ marginTop: "0.75rem" }}>
            {error}
          </p>
        )}

        <button
          className="btn"
          type="button"
          style={{ width: "100%", marginTop: "1.25rem" }}
          disabled={loading}
          onClick={() => void loginWithRodium()}
        >
          {loading ? t("loginRodiumRedirecting") : t("loginWithRodium")}
        </button>

        <p className="muted" style={{ marginTop: "1rem", textAlign: "center", fontSize: "0.82rem" }}>
          {t("loginRodiumHint")}
        </p>

        <button
          type="button"
          className="muted"
          style={{
            display: "block",
            margin: "1rem auto 0",
            background: "none",
            border: 0,
            cursor: "pointer",
            textDecoration: "underline",
          }}
          onClick={() => router.push("/")}
        >
          {t("settingsBack")}
        </button>
      </div>
    </div>
  );
}
