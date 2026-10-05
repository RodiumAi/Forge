"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { ApiError, api, getToken, setToken } from "@/lib/api";
import { LocaleSwitch, useI18n } from "@/lib/i18n/I18nProvider";
import { clearSessionCache, getSessionSnapshot } from "@/lib/session-cache";

export default function TeamJoinPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { t, locale } = useI18n();
  const token = params.token;
  const [email, setEmail] = useState("");
  const [restore, setRestore] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [account, setAccount] = useState("");

  useEffect(() => {
    if (!getToken()) {
      setAccount("");
      return;
    }
    const cached = getSessionSnapshot()?.profile?.email || "";
    if (cached) setAccount(cached);
    void api<{ email: string }>("/auth/me")
      .then((me) => setAccount(me.email || ""))
      .catch(() => setAccount(cached));
  }, []);

  useEffect(() => {
    void api<{ email: string; restore: boolean }>(`/auth/team/join/${token}`)
      .then((res) => {
        setEmail(res.email);
        setRestore(res.restore);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : t("teamJoinInvalid")));
  }, [token, locale, t]);

  const next = `/team/join/${token}`;
  const sameAccount = Boolean(account && email && account.toLowerCase() === email.toLowerCase());
  const otherAccount = Boolean(account && email && !sameAccount);

  async function switchToInvitedAccount() {
    try {
      if (getToken()) await api("/auth/logout", { method: "POST" });
    } catch {
      /* the local session still has to go */
    }
    clearSessionCache();
    setToken(null);
    setAccount("");
  }

  async function accept() {
    if (!getToken()) {
      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    setError("");
    try {
      await api(`/auth/team/join/${token}`, { method: "POST" }, locale);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("teamJoinInvalid"));
    }
  }

  return (
    <div className="join-screen">
      <div className="join-locale">
        <LocaleSwitch />
      </div>
      <article className="join-card">
        <BrandLogo className="join-logo" alt={t("brandAlt")} width={128} height={36} priority />
        <p className="join-kicker">{restore ? t("teamRestoreTitle") : t("teamJoinKicker")}</p>
        <h1>{t("teamJoinTitle")}</h1>
        {email ? (
          <p className="join-who">
            <span>{t("teamJoinFor")}</span>
            <strong>{email}</strong>
          </p>
        ) : null}
        <p className="join-lead">
          {done
            ? t("teamJoinDone")
            : otherAccount
              ? t("teamJoinWrong").replace("{account}", account).replace("{email}", email)
              : restore
                ? t("teamRestoreBody")
                : t("teamJoinBody")}
        </p>
        {error ? <p className="join-error">{error}</p> : null}
        {done ? (
          <a className="join-go" href="/dashboard">
            {t("teamJoinOpen")}
          </a>
        ) : otherAccount ? (
          <button type="button" className="join-go" onClick={() => void switchToInvitedAccount()}>
            {t("teamJoinSwitch")}
          </button>
        ) : (
          <>
            <button type="button" className="join-go" onClick={() => void accept()} disabled={!email}>
              {sameAccount ? t("teamJoinAccept") : t("teamJoinSignIn")}
            </button>
            {sameAccount ? null : (
              <a
                className="join-alt"
                href={`/register?next=${encodeURIComponent(next)}&email=${encodeURIComponent(email)}`}
              >
                {t("teamJoinCreate")}
              </a>
            )}
          </>
        )}
      </article>
    </div>
  );
}
