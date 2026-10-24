"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import "@/styles/forge/pages.css";

import { useToast } from "@/components/app/useToast";
import { listDesignSystems, type DesignSystemItem } from "@/components/design-system/api";
import { planDisplayName } from "@/components/RodiumWalletBadge";
import { AppShell } from "@/components/shell/AppShell";
import { formatCount } from "@/components/shell/FrodiCard";
import { APP_ROUTES } from "@/components/shell/nav";
import { Avatar } from "@/components/ui/Avatar";
import { Tag } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Glyph } from "@/components/ui/glyph";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { MenuItem, Popover } from "@/components/ui/Popover";
import { ApiError, api } from "@/lib/api";
import { useForgeStatus } from "@/lib/forge-status";
import { frodiUsage } from "@/lib/frodi-usage";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useEnabledKinds } from "@/lib/kinds";
import { getSessionSnapshot } from "@/lib/session-cache";

type TeamSetup = { plan: string; seats: number; emails: string[] };
type TeamMember = { email: string; status: string };
type RemoveState = {
  email: string;
  reason: string;
  sentReason: string;
  sentTo: string;
  code: string;
  busy: boolean;
  error: string;
};

/** Seat count and invitees chosen at checkout (pricing seat dialog); no seat API yet. */
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

function statusTag(status: string, t: (k: "teamRoleMember" | "teamStatusRemoved" | "teamStatusRestore" | "teamStatusPending") => string) {
  if (status === "accepted") return <Tag tone="ok">{t("teamRoleMember")}</Tag>;
  if (status === "removed") return <Tag tone="danger">{t("teamStatusRemoved")}</Tag>;
  if (status === "restore") return <Tag tone="info">{t("teamStatusRestore")}</Tag>;
  return <Tag tone="warn">{t("teamStatusPending")}</Tag>;
}

export default function TeamPage() {
  const { t, locale } = useI18n();
  const status = useForgeStatus();
  const usage = frodiUsage(status);
  const enabledKinds = useEnabledKinds();
  const [setup, setSetup] = useState<TeamSetup | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [role, setRole] = useState<"owner" | "member" | null>(null);
  const [draft, setDraft] = useState("");
  const [pendingAdd, setPendingAdd] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<RemoveState | null>(null);
  const [designSystems, setDesignSystems] = useState<DesignSystemItem[]>([]);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [toast, notify] = useToast();

  useEffect(() => {
    setSetup(readSetup());
    setOwnerEmail(getSessionSnapshot()?.profile?.email || "");
    void refreshMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, []);

  useEffect(() => {
    if (!enabledKinds.includes("design_system")) return;
    let alive = true;
    void listDesignSystems()
      .then((list) => alive && setDesignSystems(list.items.filter((item) => item.scope === "team" || item.visibility === "team")))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [enabledKinds]);

  async function refreshMembers() {
    try {
      const res = await api<{ role?: string; members: TeamMember[] }>("/auth/team/seats", {}, locale);
      setRole(res.role === "member" ? "member" : "owner");
      setMembers(res.members || []);
    } catch {
      setRole("owner");
      setMembers([]);
    }
  }

  function save(next: TeamSetup) {
    setSetup(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private mode */
    }
  }

  function askAdd(event: FormEvent) {
    event.preventDefault();
    if (!setup) return;
    const email = draft.trim().toLowerCase();
    if (!email.includes("@") || setup.emails.includes(email) || members.some((m) => m.email === email)) return;
    setPendingAdd(email);
  }

  async function confirmAdd() {
    if (!setup || !pendingAdd) return;
    setAdding(true);
    try {
      await api("/auth/team/invites", { method: "POST", body: JSON.stringify({ email: pendingAdd, seats: setup.seats }) }, locale);
      setDraft("");
      setPendingAdd(null);
      notify(t("apInviteSent"), "send");
      await refreshMembers();
    } catch (err) {
      setPendingAdd(null);
      notify(err instanceof ApiError ? err.message : t("errorGeneric"), "alert");
    } finally {
      setAdding(false);
    }
  }

  async function changeSeat(path: string, email: string) {
    try {
      await api(path, { method: "POST", body: JSON.stringify({ email }) }, locale);
      await refreshMembers();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : t("errorGeneric"), "alert");
    }
  }

  async function sendRemoveCode() {
    if (!pendingRemove) return;
    const reason = pendingRemove.reason.trim();
    if (reason.length < 3) return;
    setPendingRemove({ ...pendingRemove, busy: true, error: "" });
    try {
      const res = await api<{ message?: string | null }>(
        "/auth/team/seat-remove/code",
        { method: "POST", body: JSON.stringify({ member_email: pendingRemove.email, reason }) },
        locale,
      );
      setPendingRemove((c) => (c ? { ...c, busy: false, sentReason: reason, sentTo: res.message || "", error: "", code: "" } : c));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t("teamRemoveSendCode");
      setPendingRemove((c) => (c ? { ...c, busy: false, error: message } : c));
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
        { method: "POST", body: JSON.stringify({ member_email: pendingRemove.email, reason, code: pendingRemove.code }) },
        locale,
      );
      save({ ...setup, emails: setup.emails.filter((item) => item !== pendingRemove.email) });
      setPendingRemove(null);
      notify(t("apMemberRemoved"), "check");
      await refreshMembers();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t("teamRemoveCodeLabel");
      setPendingRemove((c) => (c ? { ...c, busy: false, error: message } : c));
    }
  }

  const holding = members.filter((m) => ["pending", "accepted", "removed", "restore"].includes(m.status)).length;
  const filled = 1 + members.filter((m) => m.status === "pending" || m.status === "accepted").length;
  const open = setup ? Math.max(0, setup.seats - 1 - holding) : 0;
  const title = planDisplayName(status?.plan ?? setup?.plan) || "Team (Pro)";
  const perSeat = usage?.grant ?? null;
  const codeReady =
    !!pendingRemove &&
    pendingRemove.sentReason.length > 0 &&
    pendingRemove.reason.trim() === pendingRemove.sentReason &&
    /^\d{6}$/.test(pendingRemove.code);

  return (
    <AppShell active="team" title={t("uiNavTeam")}>
      {toast}
      <div className="f-page-head">
        <div>
          <h1>{t("apTeamTitle")}</h1>
          <p>
            {title}
            {perSeat ? ` · ${t("apFrodiPerSeat").replace("{n}", formatCount(perSeat, locale))}` : ""}
            {role === "member" ? ` · ${t("teamMemberLead")}` : ""}
          </p>
        </div>
        {role === "owner" ? (
          <Button variant="ghost" icon="plus" href={`${APP_ROUTES.billing}#plans`}>
            {t("apAddSeats")}
          </Button>
        ) : null}
      </div>

      {role === null || !setup ? (
        <div className="f-grid-2" aria-busy="true">
          <div className="f-skel" style={{ height: 200, borderRadius: 24 }} />
          <div className="f-skel" style={{ height: 200, borderRadius: 24 }} />
        </div>
      ) : role === "member" ? (
        <section className="f-panel">
          <h2>{t("apMembers")}</h2>
          {members.map((member) => (
            <div key={`${member.status}-${member.email}`} className="f-member" style={{ gridTemplateColumns: "auto minmax(0,1fr) auto" }}>
              <Avatar name={member.email} tone="other" />
              <div className="nm">
                <b>{member.email}</b>
              </div>
              {member.status === "owner" ? <Tag tone="orange">{t("teamRoleOwner")}</Tag> : <Tag>{t("teamRoleMember")}</Tag>}
            </div>
          ))}
        </section>
      ) : (
        <>
          <div className="f-grid-2">
            <section className="f-panel" style={{ display: "grid", gap: 16 }}>
              <h2>{t("apSeats")}</h2>
              <div className="f-seat-stats">
                <div>
                  <b>{setup.seats}</b>
                  <span>{t("teamStatPaid")}</span>
                </div>
                <div>
                  <b>{filled}</b>
                  <span>{t("teamStatFilled")}</span>
                </div>
                <div>
                  <b>{open}</b>
                  <span>{t("teamStatOpen")}</span>
                </div>
              </div>
              <div className="f-seat-map">
                <Avatar name={ownerEmail || title} size="sm" />
                {members
                  .filter((m) => m.status === "accepted" || m.status === "pending")
                  .map((m) => (
                    <Avatar key={m.email} name={m.email} size="sm" tone="other" />
                  ))}
                {Array.from({ length: Math.min(open, 20) }, (_, i) => (
                  <i key={i} aria-label={t("apFreeSeat")}>
                    +
                  </i>
                ))}
              </div>
            </section>

            <section className="f-panel" style={{ display: "grid", gap: 12, alignContent: "start" }}>
              <h2>{t("apInviteTitle")}</h2>
              <p className="f-panel-lead">{open > 0 ? t("apInviteLead").replace("{n}", String(open)) : t("teamSeatsFull")}</p>
              {open > 0 ? (
                <form className="f-invite-form" onSubmit={askAdd}>
                  <Input
                    type="email"
                    required
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={t("teamAddPlaceholder")}
                    aria-label={t("teamAddPlaceholder")}
                  />
                  <Button type="submit" icon="send">
                    {t("apInvite")}
                  </Button>
                </form>
              ) : (
                <Button variant="ghost" icon="plus" href={`${APP_ROUTES.billing}#plans`} style={{ width: "fit-content" }}>
                  {t("apAddSeats")}
                </Button>
              )}
              <p className="f-note">{t("teamAddHint")}</p>
            </section>
          </div>

          <section className="f-panel" style={{ marginTop: 16 }}>
            <h2>{t("apMembers")}</h2>
            <div className="f-member">
              <Avatar name={ownerEmail || title} />
              <div className="nm">
                <b>{ownerEmail || title}</b>
                <small>{t("apYou")}</small>
              </div>
              <span />
              <Tag tone="orange">{t("teamRoleOwner")}</Tag>
            </div>
            {members.map((member) => (
              <div key={member.email} className="f-member">
                <Avatar name={member.email} tone="other" />
                <div className="nm">
                  <b>{member.email}</b>
                  <small>{member.status === "accepted" ? t("apActive") : member.status === "pending" ? t("apInviteSentShort") : ""}</small>
                </div>
                {statusTag(member.status, t)}
                <Popover
                  align="end"
                  label={member.email}
                  trigger={<IconButton icon="more" plain size="sm" label={t("apMoreActions").replace("{name}", member.email)} />}
                >
                  {(close) =>
                    member.status === "accepted" ? (
                      <MenuItem
                        icon="trash"
                        danger
                        onClick={() => {
                          close();
                          setPendingRemove({ email: member.email, reason: "", sentReason: "", sentTo: "", code: "", busy: false, error: "" });
                        }}
                      >
                        {t("apRemoveFromTeam")}
                      </MenuItem>
                    ) : member.status === "removed" ? (
                      <MenuItem icon="undo" onClick={() => { close(); void changeSeat("/auth/team/invites/restore", member.email); }}>
                        {t("teamRestore")}
                      </MenuItem>
                    ) : (
                      <MenuItem icon="x" onClick={() => { close(); void changeSeat("/auth/team/invites/cancel", member.email); }}>
                        {t("teamCancelInvite")}
                      </MenuItem>
                    )
                  }
                </Popover>
              </div>
            ))}
          </section>
        </>
      )}

      {designSystems.length ? (
        <>
          <div className="f-section-title">
            <h2>{t("apSharedDs")}</h2>
            <Button variant="ghost" size="sm" href={`${APP_ROUTES.projects}?kind=design_system`}>
              {t("apManage")}
            </Button>
          </div>
          <div className="f-integ-grid">
            {designSystems.map((ds) => (
              <article key={ds.id} className="f-integ">
                <Link className="f-integ-link" href={`/projects/${ds.id}/design-system`} aria-label={ds.name} />
                <span className="f-palette-line" aria-hidden>
                  {ds.preview.colors.slice(0, 5).map((c) => (
                    <i key={c} style={{ background: c }} />
                  ))}
                </span>
                <b>{ds.name}</b>
                <p>{ds.owner.mine ? t("apYou") : ds.owner.name || ""}</p>
                <div className="foot">
                  {ds.is_default_team ? <Tag tone="orange">{t("apTeamDefault")}</Tag> : <span />}
                  <Glyph name="arrow-right" size="sm" />
                </div>
              </article>
            ))}
          </div>
        </>
      ) : null}

      <Dialog
        open={Boolean(pendingAdd)}
        onClose={() => !adding && setPendingAdd(null)}
        title={t("teamAddTitle")}
        description={pendingAdd ? t("teamAddBody").replace("{email}", pendingAdd) : undefined}
        closeLabel={t("uiClose")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingAdd(null)} disabled={adding}>
              {t("teamCancel")}
            </Button>
            <Button loading={adding} onClick={() => void confirmAdd()}>
              {t("teamAddConfirm")}
            </Button>
          </>
        }
      />

      <Dialog
        open={Boolean(pendingRemove)}
        onClose={() => !pendingRemove?.busy && setPendingRemove(null)}
        title={t("teamRemoveTitle")}
        description={pendingRemove ? `${pendingRemove.email}. ${t("teamRemoveTerms")}` : undefined}
        closeLabel={t("uiClose")}
        footer={
          <>
            <Button variant="ghost" disabled={pendingRemove?.busy} onClick={() => setPendingRemove(null)}>
              {t("teamCancel")}
            </Button>
            <Button variant="danger" icon="trash" disabled={!codeReady} loading={Boolean(pendingRemove?.busy && pendingRemove.sentReason)} onClick={() => void confirmRemove()}>
              {pendingRemove?.busy && pendingRemove.sentReason ? t("teamRemoveWorking") : t("teamRemoveConfirm")}
            </Button>
          </>
        }
      >
        {pendingRemove ? (
          <div style={{ display: "grid", gap: 12 }}>
            <Field label={t("teamRemoveReason")}>
              <Textarea
                data-autofocus
                value={pendingRemove.reason}
                placeholder={t("teamRemoveReasonPh")}
                maxLength={500}
                onChange={(event) => setPendingRemove((c) => (c ? { ...c, reason: event.target.value, error: "" } : c))}
              />
            </Field>
            <Button
              variant="ghost"
              size="sm"
              icon="mail"
              style={{ width: "fit-content" }}
              disabled={pendingRemove.busy || pendingRemove.reason.trim().length < 3}
              onClick={() => void sendRemoveCode()}
            >
              {pendingRemove.busy && !pendingRemove.sentReason ? t("teamRemoveSending") : t("teamRemoveSendCode")}
            </Button>
            {pendingRemove.sentReason ? (
              <>
                <p className="f-success">{t("teamRemoveCodeSent").replace("{email}", pendingRemove.sentTo || ownerEmail)}</p>
                <Field label={t("teamRemoveCodeLabel")}>
                  <Input
                    className="f-code-input"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={pendingRemove.code}
                    onChange={(event) =>
                      setPendingRemove((c) => (c ? { ...c, code: event.target.value.replace(/\D/g, "").slice(0, 6), error: "" } : c))
                    }
                  />
                </Field>
              </>
            ) : null}
            {pendingRemove.error ? (
              <p className="f-error" role="alert">
                {pendingRemove.error}
              </p>
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </AppShell>
  );
}
