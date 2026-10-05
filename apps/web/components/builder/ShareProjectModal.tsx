"use client";

/**
 * Canva-style project share slideover.
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

import { Loader2, UserPlus, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Icon } from "@/components/ui/icon";
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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

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

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="design-slideover-root share-slideover-root">
      <button
        type="button"
        className="design-slideover-backdrop"
        aria-label={t("close")}
        onClick={onClose}
      />
      <aside
        className="design-slideover share-slideover"
        role="dialog"
        aria-modal="true"
        aria-label={t("shareTitle")}
      >
        <header className="history-panel-head">
          <span className="history-panel-title">
            <Icon icon={UserPlus} className="ui-icon-sm" />
            {t("shareTitle")}
          </span>
          <button
            type="button"
            className="history-panel-close"
            onClick={onClose}
            aria-label={t("close")}
          >
            <Icon icon={X} className="ui-icon-sm" />
          </button>
        </header>
        <p className="share-sub">{t("shareSubtitle").replace("{name}", projectName)}</p>

        <form className="share-body" onSubmit={(e) => void submit(e)}>
          <div className="options-field">
            <label htmlFor="share-email">{t("shareEmail")}</label>
            <input
              id="share-email"
              type="email"
              value={email}
              placeholder="teammate@example.com"
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              required
            />
          </div>

          <div className="share-row">
            <div className="options-field">
              <label htmlFor="share-role">{t("shareRole")}</label>
              <select
                id="share-role"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                <option value="editor">{t("shareRoleEditor")}</option>
                <option value="viewer">{t("shareRoleViewer")}</option>
              </select>
            </div>

            <div className="options-field">
              <label htmlFor="share-billing">{t("shareBilling")}</label>
              <select
                id="share-billing"
                value={billingPolicy}
                onChange={(e) => setBillingPolicy(e.target.value as BillingPolicy)}
              >
                <option value="owner_pays">{t("shareBillingOwner")}</option>
                <option value="each_pays_own">{t("shareBillingEach")}</option>
              </select>
            </div>
          </div>

          {billingPolicy === "owner_pays" ? (
            <div className="options-field">
              <label htmlFor="share-cap">{t("shareFrodiCap")}</label>
              <p className="options-help">{t("shareFrodiCapHelp")}</p>
              <input
                id="share-cap"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={frodiCap}
                placeholder={t("shareFrodiCapPlaceholder")}
                onChange={(e) => setFrodiCap(e.target.value)}
              />
            </div>
          ) : null}

          {error ? <p className="builder-pane-error">{error}</p> : null}
          {message ? (
            <p className="share-ok" role="status" aria-live="polite">
              {message}
            </p>
          ) : null}

          <div className="options-actions">
            <button type="submit" className="btn" disabled={busy || !email.trim()}>
              <Icon icon={busy ? Loader2 : UserPlus} className={`ui-icon-sm ${busy ? "agent-spin" : ""}`} />
              {busy ? t("shareInviting") : t("shareInvite")}
            </button>
          </div>
        </form>

        <section className="share-members">
          <h5>{t("shareMembers")}</h5>
          {membersLoading ? (
            <p className="options-help">{t("loading")}</p>
          ) : members.length === 0 ? (
            <p className="options-help">{t("shareMembersEmpty")}</p>
          ) : (
            <ul className="share-member-list">
              {members.map((m) => (
                <li key={m.user_id || m.email} className="share-member">
                  <div className="share-member-id">
                    <strong>{m.name || m.email}</strong>
                    <span>{m.email}</span>
                  </div>
                  <div className="share-member-meta">
                    <span className={`share-member-status${m.accepted_at || m.status === "accepted" ? " is-accepted" : ""}`}>
                      {m.accepted_at || m.status === "accepted"
                        ? t("shareStatusAccepted")
                        : t("shareStatusPending")}
                    </span>
                    <span className="share-member-role">
                      {m.role === "viewer" ? t("shareRoleViewer") : t("shareRoleEditor")}
                    </span>
                    <button
                      type="button"
                      className="share-member-remove"
                      disabled={removing === (m.user_id || m.email)}
                      onClick={() => void removeMember(m)}
                    >
                      {removing === (m.user_id || m.email) ? t("shareRemoving") : t("shareRemove")}
                    </button>
                    <span className="share-member-cap">
                      {m.frodi_used_this_cycle != null
                        ? t("shareUsedOfCap")
                            .replace("{used}", String(m.frodi_used_this_cycle))
                            .replace(
                              "{cap}",
                              m.frodi_cap_per_cycle == null || m.frodi_cap_per_cycle === 0
                                ? "∞"
                                : String(m.frodi_cap_per_cycle),
                            )
                        : m.frodi_cap_per_cycle == null || m.frodi_cap_per_cycle === 0
                          ? t("shareCapNone")
                          : t("shareCapValue").replace("{n}", String(m.frodi_cap_per_cycle))}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>,
    document.body,
  );
}
