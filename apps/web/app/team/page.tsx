"use client";

import { FormEvent, useEffect, useState } from "react";
import { HomeLayout } from "@/components/HomeLayout";
import { planDisplayName } from "@/components/RodiumWalletBadge";
import { ApiError, api } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { getSessionSnapshot } from "@/lib/session-cache";

type TeamSetup = { plan: string; seats: number; emails: string[] };
type TeamMember = { email: string; status: string };
type RemoveDialog = {
  email: string;
  reason: string;
  sentReason: string;
  sentTo: string;
  code: string;
  busy: boolean;
  error: string;
};

const KEY = "forge.teamSetup";

function readSetup(): TeamSetup {
  const mine = getSessionSnapshot()?.profile?.email?.trim() || "";
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as TeamSetup;
      const emails = Array.isArray(parsed.emails) ? parsed.emails.filter(Boolean) : [];
      if (mine && !emails.includes(mine)) emails.unshift(mine);
      return { plan: parsed.plan || "team-pro", seats: parsed.seats || emails.length || 5, emails };
    }
  } catch {
    /* ignore */
  }
  return { plan: "team-pro", seats: 5, emails: mine ? [mine] : [] };
}

function initials(email: string): string {
  const local = email.split("@")[0] || email;
  const parts = local.split(/[._-]+/).filter(Boolean);
  const letters = (parts[0]?.[0] || "") + (parts[1]?.[0] || parts[0]?.[1] || "");
  return letters.toUpperCase() || "•";
}

export default function TeamPage() {
  const { t, locale } = useI18n();
  const [setup, setSetup] = useState<TeamSetup | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [role, setRole] = useState<"owner" | "member" | null>(null);
  const [draft, setDraft] = useState("");
  const [pendingAdd, setPendingAdd] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<RemoveDialog | null>(null);

  useEffect(() => {
    setSetup(readSetup());
    void refreshMembers();
  }, []);

  async function refreshMembers() {
    try {
      const res = await api<{ role?: string; members: TeamMember[] }>("/auth/team/seats", {}, locale);
      setRole(res.role === "member" ? "member" : "owner");
      setMembers(res.members || []);
    } catch {
      setMembers([]);
    }
  }

  useEffect(() => {
    if (!pendingAdd && !pendingRemove) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !pendingRemove?.busy) {
        setPendingAdd(null);
        setPendingRemove(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingAdd, pendingRemove]);

  function save(next: TeamSetup) {
    setSetup(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  }

  function askAdd(event: FormEvent) {
    event.preventDefault();
    if (!setup) return;
    const email = draft.trim().toLowerCase();
    if (!email.includes("@") || setup.emails.includes(email)) return;
    if (setup.emails.length >= setup.seats) return;
    setPendingAdd(email);
  }

  async function confirmAdd() {
    if (!setup || !pendingAdd) return;
    try {
      await api(
        "/auth/team/invites",
        { method: "POST", body: JSON.stringify({ email: pendingAdd, seats: setup.seats }) },
        locale,
      );
      setDraft("");
      setPendingAdd(null);
      await refreshMembers();
    } catch (err) {
      setPendingAdd(null);
      setDraft(pendingAdd);
      window.alert(err instanceof ApiError ? err.message : t("teamAdd"));
    }
  }

  async function changeSeat(path: string, email: string) {
    await api(path, { method: "POST", body: JSON.stringify({ email }) }, locale);
    await refreshMembers();
  }

  function closeRemove() {
    if (pendingRemove?.busy) return;
    setPendingRemove(null);
  }

  async function sendRemoveCode() {
    if (!pendingRemove) return;
    const reason = pendingRemove.reason.trim();
    if (reason.length < 3) return;
    setPendingRemove({ ...pendingRemove, busy: true, error: "" });
    try {
      const res = await api<{ message?: string | null }>(
        "/auth/team/seat-remove/code",
        {
          method: "POST",
          body: JSON.stringify({ member_email: pendingRemove.email, reason }),
        },
        locale,
      );
      setPendingRemove((current) =>
        current
          ? {
              ...current,
              busy: false,
              sentReason: reason,
              sentTo: res.message || "",
              error: "",
              code: "",
            }
          : current,
      );
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t("teamRemoveSendCode");
      setPendingRemove((current) => (current ? { ...current, busy: false, error: message } : current));
    }
  }

  async function confirmRemove() {
    if (!setup || !pendingRemove) return;
    const reason = pendingRemove.reason.trim();
    if (reason !== pendingRemove.sentReason || pendingRemove.code.length !== 6) return;
    setPendingRemove({ ...pendingRemove, busy: true, error: "" });
    try {
      await api(
        "/auth/team/seat-remove/confirm",
        {
          method: "POST",
          body: JSON.stringify({
            member_email: pendingRemove.email,
            reason,
            code: pendingRemove.code,
          }),
        },
        locale,
      );
      save({ ...setup, emails: setup.emails.filter((item) => item !== pendingRemove.email) });
      setPendingRemove(null);
      await refreshMembers();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t("teamRemoveCodeLabel");
      setPendingRemove((current) => (current ? { ...current, busy: false, error: message } : current));
    }
  }

  const holding = members.filter((member) =>
    ["pending", "accepted", "removed", "restore"].includes(member.status),
  ).length;
  const filled = 1 + members.filter((member) => member.status === "pending" || member.status === "accepted").length;
  const open = setup ? Math.max(0, setup.seats - 1 - holding) : 0;
  const title = planDisplayName(setup?.plan) || "Team (Pro)";
  const ownerEmail = getSessionSnapshot()?.profile?.email || "";
  const codeReady =
    !!pendingRemove &&
    pendingRemove.sentReason.length > 0 &&
    pendingRemove.reason.trim() === pendingRemove.sentReason &&
    /^\d{6}$/.test(pendingRemove.code);

  return (
    <HomeLayout activeNav="team">
      <div className="home-settings team-page">
        <header className="team-head">
          <h1>{title}</h1>
          <p>{role === "member" ? t("teamMemberLead") : t("teamPageLead")}</p>
        </header>

        {role === null ? (
          <div className="home-settings-card team-card" aria-busy="true">
            <span className="home-skel" style={{ height: 52, display: "block", margin: "1rem 0" }} />
          </div>
        ) : role === "member" ? (
          <section className="home-settings-card team-card">
            <ul className="team-list">
              {members.map((member) => (
                <li key={`${member.status}-${member.email}`} className="team-row">
                  <span className="team-avatar" aria-hidden>
                    {initials(member.email)}
                  </span>
                  <div className="team-person">
                    <strong>{member.email}</strong>
                    <span>{member.status === "owner" ? t("teamRoleOwner") : t("teamRoleMember")}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : setup ? (
          <>
            <div className="team-stats">
              <div className="team-stat">
                <strong>{setup.seats}</strong>
                <span>{t("teamStatPaid")}</span>
              </div>
              <div className="team-stat">
                <strong>{filled}</strong>
                <span>{t("teamStatFilled")}</span>
              </div>
              <div className="team-stat">
                <strong>{open}</strong>
                <span>{t("teamStatOpen")}</span>
              </div>
            </div>

            <section className="home-settings-card team-card">
              <ul className="team-list">
                <li className="team-row">
                  <span className="team-avatar" aria-hidden>
                    {initials(ownerEmail || "owner")}
                  </span>
                  <div className="team-person">
                    <strong>{ownerEmail || title}</strong>
                    <span>{t("teamRoleOwner")}</span>
                  </div>
                  <span />
                </li>
                {members.map((member) => (
                  <li key={member.email} className="team-row">
                    <span className="team-avatar" aria-hidden>
                      {initials(member.email)}
                    </span>
                    <div className="team-person">
                      <div className="team-person-line">
                        <strong>{member.email}</strong>
                        <span className={`team-tag${member.status === "removed" ? " is-removed" : member.status === "accepted" ? "" : " is-pending"}`}>
                          {member.status === "accepted"
                            ? t("teamRoleMember")
                            : member.status === "removed"
                              ? t("teamStatusRemoved")
                              : member.status === "restore"
                                ? t("teamStatusRestore")
                                : t("teamStatusPending")}
                        </span>
                      </div>
                    </div>
                    {member.status === "accepted" ? (
                      <button
                        type="button"
                        className="team-remove"
                        onClick={() =>
                          setPendingRemove({
                            email: member.email,
                            reason: "",
                            sentReason: "",
                            sentTo: "",
                            code: "",
                            busy: false,
                            error: "",
                          })
                        }
                      >
                        {t("teamRemove")}
                      </button>
                    ) : member.status === "removed" ? (
                      <button type="button" className="team-remove" onClick={() => void changeSeat("/auth/team/invites/restore", member.email)}>
                        {t("teamRestore")}
                      </button>
                    ) : (
                      <button type="button" className="team-remove" onClick={() => void changeSeat("/auth/team/invites/cancel", member.email)}>
                        {t("teamCancelInvite")}
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              {open > 0 ? (
                <form className="team-add" onSubmit={askAdd}>
                  <input
                    className="home-settings-input"
                    type="email"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={t("teamAddPlaceholder")}
                    aria-label={t("teamAddPlaceholder")}
                  />
                  <button type="submit">{t("teamAdd")}</button>
                </form>
              ) : null}
              <p className="team-note">{open > 0 ? t("teamAddHint") : t("teamSeatsFull")}</p>
            </section>
          </>
        ) : (
          <div className="home-settings-card team-card" aria-busy="true">
            <span className="home-skel" style={{ height: 52, display: "block", margin: "1rem 0" }} />
            <span className="home-skel" style={{ height: 52, display: "block", margin: "1rem 0" }} />
          </div>
        )}
      </div>

      {pendingAdd ? (
        <div className="team-dialog" role="dialog" aria-modal="true" aria-labelledby="team-add-title">
          <button type="button" className="team-dialog-backdrop" aria-label={t("teamCancel")} onClick={() => setPendingAdd(null)} />
          <div className="team-dialog-card">
            <h2 id="team-add-title">{t("teamAddTitle")}</h2>
            <p className="team-dialog-terms">{t("teamAddBody").replace("{email}", pendingAdd)}</p>
            <div className="team-dialog-actions">
              <button type="button" className="team-dialog-ghost" onClick={() => setPendingAdd(null)}>
                {t("teamCancel")}
              </button>
              <button type="button" className="team-dialog-primary" onClick={confirmAdd}>
                {t("teamAddConfirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingRemove ? (
        <div className="team-dialog" role="dialog" aria-modal="true" aria-labelledby="team-remove-title">
          <button type="button" className="team-dialog-backdrop" aria-label={t("teamCancel")} onClick={closeRemove} />
          <div className="team-dialog-card">
            <h2 id="team-remove-title">{t("teamRemoveTitle")}</h2>
            <p className="team-person" style={{ textAlign: "center", margin: 0 }}>
              <strong>{pendingRemove.email}</strong>
            </p>
            <p className="team-dialog-terms">{t("teamRemoveTerms")}</p>
            <label className="team-dialog-field">
              <span>{t("teamRemoveReason")}</span>
              <textarea
                value={pendingRemove.reason}
                placeholder={t("teamRemoveReasonPh")}
                maxLength={500}
                onChange={(event) =>
                  setPendingRemove((current) =>
                    current ? { ...current, reason: event.target.value, error: "" } : current,
                  )
                }
              />
            </label>
            <div className="team-dialog-actions">
              <button
                type="button"
                className="team-dialog-ghost"
                disabled={pendingRemove.busy || pendingRemove.reason.trim().length < 3}
                onClick={() => void sendRemoveCode()}
              >
                {pendingRemove.busy && !pendingRemove.sentReason ? t("teamRemoveSending") : t("teamRemoveSendCode")}
              </button>
            </div>
            {pendingRemove.sentReason ? (
              <>
                <p className="team-dialog-sent">
                  {t("teamRemoveCodeSent").replace("{email}", pendingRemove.sentTo || ownerEmail)}
                </p>
                <label className="team-dialog-field">
                  <span>{t("teamRemoveCodeLabel")}</span>
                  <input
                    className="team-dialog-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={pendingRemove.code}
                    onChange={(event) =>
                      setPendingRemove((current) =>
                        current
                          ? { ...current, code: event.target.value.replace(/\D/g, "").slice(0, 6), error: "" }
                          : current,
                      )
                    }
                  />
                </label>
              </>
            ) : null}
            {pendingRemove.error ? <p className="team-dialog-error">{pendingRemove.error}</p> : null}
            <div className="team-dialog-actions">
              <button type="button" className="team-dialog-ghost" disabled={pendingRemove.busy} onClick={closeRemove}>
                {t("teamCancel")}
              </button>
              <button
                type="button"
                className="team-dialog-primary"
                disabled={!codeReady || pendingRemove.busy}
                onClick={() => void confirmRemove()}
              >
                {pendingRemove.busy && pendingRemove.sentReason ? t("teamRemoveWorking") : t("teamRemoveConfirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </HomeLayout>
  );
}
