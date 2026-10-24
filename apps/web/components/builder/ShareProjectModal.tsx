"use client";

/**
 * Project share dialog.
 *
 * Invite another Forge account by email, pick their role (editor/viewer), decide
 * who pays for their generations (owner_pays / each_pays_own) and optionally cap
 * how much FRODI they may spend per cycle. Posts to `POST /projects/{id}/share`.
 *
 * Also doubles as the minimal team view: it lists current collaborators from
 * `GET /projects/{id}/collaborators`. Live per-member FRODI *balances* live on
 * the RodiumAi platform and are not fetched here — the list shows each member's
 * per-cycle cap instead.
 */

import { FormEvent, useCallback, useEffect, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { Tag } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select } from "@/components/ui/Input";
import { Glyph } from "@/components/ui/glyph";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Role = "editor" | "viewer";
type BillingPolicy = "owner_pays" | "each_pays_own";

type Collaborator = {
  user_id: string | null;
  email: string;
  name: string | null;
  role: string;
  status?: string;
  frodi_cap_per_cycle: number | null;
  frodi_used_this_cycle: number | null;
  invited_at: string | null;
  accepted_at: string | null;
};

type ShareResult = {
  pending?: boolean;
  mail_sent?: boolean;
  already_member?: boolean;
};

type Props = {
  projectId: string;
  projectName: string;
  /** People who can be invited. `null` is unlimited. */
  seatLimit?: number | null;
  onClose: () => void;
};

export function ShareProjectModal({ projectId, projectName, seatLimit = null, onClose }: Props) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [billingPolicy, setBillingPolicy] = useState<BillingPolicy>("owner_pays");
  const [frodiCap, setFrodiCap] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [members, setMembers] = useState<Collaborator[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const rows = await api<Collaborator[]>(`/projects/${projectId}/collaborators`);
      setMembers(rows);
    } catch {
      /* owner-only / not yet shared — leave the list empty */
    } finally {
      setMembersLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    const already = members.some((member) => member.email.toLowerCase() === trimmed.toLowerCase());
    if (seatLimit != null && !already && members.length >= seatLimit) {
      setError(t("shareLimit").replace("{n}", String(seatLimit)));
      setMessage(null);
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const capRaw = frodiCap.trim();
      const cap = capRaw === "" ? null : Math.max(0, Math.floor(Number(capRaw)));
      const result = await api<ShareResult>(`/projects/${projectId}/share`, {
        method: "POST",
        body: JSON.stringify({
          email: trimmed,
          role,
          billing_policy: billingPolicy,
          frodi_cap_per_cycle: Number.isFinite(cap as number) ? cap : null,
        }),
      });
      const note = result.already_member
        ? t("shareAlreadyMember")
        : result.mail_sent === false
          ? t("shareMailFailed")
          : t("shareInvited");
      setMessage(note.replace("{email}", trimmed));
      setEmail("");
      setFrodiCap("");
      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(member: Collaborator) {
    const key = member.user_id || member.email;
    setRemoving(key);
    setError(null);
    try {
      const query = member.user_id
        ? `user_id=${encodeURIComponent(member.user_id)}`
        : `email=${encodeURIComponent(member.email)}`;
      await api(`/projects/${projectId}/collaborators?${query}`, { method: "DELETE" });
      setMembers((prev) => prev.filter((row) => (row.user_id || row.email) !== key));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setRemoving(null);
    }
  }

  const accepted = (m: Collaborator) => Boolean(m.accepted_at || m.status === "accepted");
  const capLabel = (m: Collaborator) =>
    m.frodi_used_this_cycle != null
      ? t("shareUsedOfCap")
          .replace("{used}", String(m.frodi_used_this_cycle))
          .replace(
            "{cap}",
            m.frodi_cap_per_cycle == null || m.frodi_cap_per_cycle === 0 ? "∞" : String(m.frodi_cap_per_cycle),
          )
      : m.frodi_cap_per_cycle == null || m.frodi_cap_per_cycle === 0
        ? t("shareCapNone")
        : t("shareCapValue").replace("{n}", String(m.frodi_cap_per_cycle));

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("bdShareTitle").replace("{name}", projectName || t("projectFallback"))}
      description={t("shareSubtitle").replace("{name}", projectName)}
      closeLabel={t("close")}
      className="f-bd-share"
    >
      <form className="f-bd-share-form" onSubmit={(e) => void submit(e)}>
        <div className="f-bd-share-invite">
          <Input
            id="share-email"
            type="email"
            value={email}
            placeholder="nom@exemple.com"
            aria-label={t("shareEmail")}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
            required
            data-autofocus
          />
          <Button type="submit" loading={busy} disabled={!email.trim()} icon="send">
            {busy ? t("shareInviting") : t("shareInvite")}
          </Button>
        </div>

        <div className="f-bd-share-row">
          <Field label={t("shareRole")}>
            <Select id="share-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="editor">{t("shareRoleEditor")}</option>
              <option value="viewer">{t("shareRoleViewer")}</option>
            </Select>
          </Field>
          <Field label={t("shareBilling")}>
            <Select
              id="share-billing"
              value={billingPolicy}
              onChange={(e) => setBillingPolicy(e.target.value as BillingPolicy)}
            >
              <option value="owner_pays">{t("shareBillingOwner")}</option>
              <option value="each_pays_own">{t("shareBillingEach")}</option>
            </Select>
          </Field>
        </div>

        {billingPolicy === "owner_pays" ? (
          <Field label={t("shareFrodiCap")} hint={t("shareFrodiCapHelp")}>
            <Input
              id="share-cap"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={frodiCap}
              placeholder={t("shareFrodiCapPlaceholder")}
              onChange={(e) => setFrodiCap(e.target.value)}
            />
          </Field>
        ) : null}

        {error ? (
          <p className="f-bd-share-note err" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="f-bd-share-note ok" role="status" aria-live="polite">
            {message}
          </p>
        ) : null}
      </form>

      <section className="f-bd-share-members" aria-label={t("shareMembers")}>
        <h3>{t("shareMembers")}</h3>
        {membersLoading ? (
          <p className="f-muted">{t("loading")}</p>
        ) : members.length === 0 ? (
          <p className="f-muted">{t("shareMembersEmpty")}</p>
        ) : (
          <ul>
            {members.map((m, index) => {
              const key = m.user_id || m.email;
              return (
                <li key={key} className="f-bd-member">
                  <Avatar name={m.name || m.email} size="sm" tone={index === 0 ? "self" : "other"} />
                  <div className="nm">
                    <b>{m.name || m.email}</b>
                    <small>
                      {m.email} · {capLabel(m)}
                    </small>
                  </div>
                  <div className="meta">
                    <Tag tone={accepted(m) ? "ok" : "warn"}>
                      {accepted(m) ? t("shareStatusAccepted") : t("shareStatusPending")}
                    </Tag>
                    <Tag>{m.role === "viewer" ? t("shareRoleViewer") : t("shareRoleEditor")}</Tag>
                    <Button
                      size="xs"
                      variant="ghost"
                      disabled={removing === key}
                      onClick={() => void removeMember(m)}
                    >
                      {removing === key ? t("shareRemoving") : t("shareRemove")}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {seatLimit != null ? (
        <p className="f-bd-share-note">
          <Glyph name="users" size="sm" />
          {t("shareLimit").replace("{n}", String(seatLimit))}
        </p>
      ) : null}
    </Dialog>
  );
}
