"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, Copy, Globe2, Loader2, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import { api } from "@/lib/api";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";

export type DomainDnsRecord = {
  purpose: "routing" | "acm_validation" | string;
  type: string;
  name: string;
  full_name: string;
  value: string;
};

export type DomainState = {
  hostname: string;
  status: "pending_dns" | "processing" | "validated" | "failed" | string;
  cname_target: string;
  dns_records: DomainDnsRecord[];
  public_url: string | null;
  last_error: string | null;
  verified_at: string | null;
};

type Props = {
  projectId: string;
  onOk: (message: string) => void;
  onError: (message: string) => void;
};

const POLL_MS = 10_000;

export function CustomDomainSection({ projectId, onOk, onError }: Props) {
  const { t } = useI18n();
  const [domain, setDomain] = useState<DomainState | null>(null);
  const [loading, setLoading] = useState(true);
  const [hostname, setHostname] = useState("");
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<DomainState | null>(`/projects/${projectId}/domain`);
      setDomain(res);
    } catch {
      /* panel stays usable without the domain state */
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Processing: ACM issuance / ALB attach in flight — re-poll until it settles.
  useEffect(() => {
    if (domain?.status !== "processing") {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      return;
    }
    pollRef.current = setInterval(() => void load(), POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [domain?.status, load]);

  function friendlyError(code: string | null | undefined): string {
    switch (code) {
      case "apex_not_supported":
        return t("domainErrApex");
      case "invalid_hostname":
      case "empty_hostname":
        return t("domainErrInvalid");
      case "reserved_hostname":
        return t("domainErrReserved");
      case "hostname_taken":
        return t("domainErrTaken");
      case "routing_cname_missing":
        return t("domainErrRoutingCname");
      case "acm_cname_missing":
        return t("domainErrAcmCname");
      case "verify_rate_limited":
        return t("domainErrRateLimited");
      default:
        return code || t("errorGeneric");
    }
  }

  async function addDomain() {
    const value = hostname.trim();
    if (!value) return;
    setBusy(true);
    try {
      const res = await api<DomainState>(`/projects/${projectId}/domain`, {
        method: "PUT",
        body: JSON.stringify({ hostname: value }),
      });
      setDomain(res);
      setHostname("");
      onOk(t("domainAdded"));
    } catch (err) {
      onError(friendlyError(err instanceof Error ? err.message : null));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setVerifying(true);
    try {
      const res = await api<DomainState>(`/projects/${projectId}/domain/verify`, {
        method: "POST",
      });
      setDomain(res);
      if (res.status === "validated") onOk(t("domainValidated"));
    } catch (err) {
      onError(friendlyError(err instanceof Error ? err.message : null));
    } finally {
      setVerifying(false);
    }
  }

  async function removeDomain() {
    if (!window.confirm(t("domainRemoveConfirm"))) return;
    setBusy(true);
    try {
      await api(`/projects/${projectId}/domain`, { method: "DELETE" });
      setDomain(null);
      onOk(t("domainRemoved"));
    } catch (err) {
      onError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  async function copyValue(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied((prev) => (prev === key ? null : prev)), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  const statusBadge = (status: string) => {
    if (status === "validated") {
      return (
        <span className="domain-badge domain-badge-ok">
          <Icon icon={BadgeCheck} className="ui-icon-sm" />
          {t("domainStatusValidated")}
        </span>
      );
    }
    if (status === "processing") {
      return (
        <span className="domain-badge domain-badge-processing">
          <Icon icon={Loader2} className="ui-icon-sm agent-spin" />
          {t("domainStatusProcessing")}
        </span>
      );
    }
    if (status === "failed") {
      return (
        <span className="domain-badge domain-badge-failed">
          <Icon icon={TriangleAlert} className="ui-icon-sm" />
          {t("domainStatusFailed")}
        </span>
      );
    }
    return <span className="domain-badge domain-badge-pending">{t("domainStatusPending")}</span>;
  };

  return (
    <div className="options-seo-block">
      <h4>
        <Icon icon={Globe2} className="ui-icon-sm" /> {t("domainSectionTitle")}
      </h4>
      <p className="options-help">{t("domainSectionHelp")}</p>

      {loading ? (
        <p className="options-help">{t("loading")}</p>
      ) : domain === null ? (
        <div className="domain-add-row">
          <input
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
            placeholder="www.monentreprise.com"
            autoComplete="off"
            spellCheck={false}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void addDomain();
              }
            }}
          />
          <button type="button" className="btn" disabled={busy || !hostname.trim()} onClick={() => void addDomain()}>
            {busy ? <Icon icon={Loader2} className="ui-icon-sm agent-spin" /> : null}
            {t("domainAdd")}
          </button>
        </div>
      ) : (
        <div className="domain-card">
          <div className="domain-card-head">
            <strong className="domain-hostname">{domain.hostname}</strong>
            {statusBadge(domain.status)}
            <button
              type="button"
              className="btn btn-ghost domain-remove"
              title={t("domainRemove")}
              disabled={busy}
              onClick={() => void removeDomain()}
            >
              <Icon icon={Trash2} className="ui-icon-sm" />
            </button>
          </div>

          {domain.status === "validated" ? (
            <p className="options-help">
              {t("domainValidatedHelp")}{" "}
              <a href={domain.public_url || `https://${domain.hostname}`} target="_blank" rel="noreferrer">
                {domain.public_url || `https://${domain.hostname}`}
              </a>
            </p>
          ) : (
            <>
              <p className="options-help">{t("domainDnsHelp")}</p>
              <div className="domain-dns-table" role="table">
                <div className="domain-dns-row domain-dns-head" role="row">
                  <span>{t("domainColPurpose")}</span>
                  <span>{t("domainColType")}</span>
                  <span>{t("domainColName")}</span>
                  <span>{t("domainColValue")}</span>
                </div>
                {domain.dns_records.map((rec) => (
                  <div className="domain-dns-row" role="row" key={rec.purpose}>
                    <span className="domain-dns-purpose">
                      {rec.purpose === "routing" ? t("domainDnsRouting") : t("domainDnsSsl")}
                    </span>
                    <span>{rec.type}</span>
                    <span className="domain-dns-copy" title={rec.full_name}>
                      <code>{rec.name}</code>
                      <button type="button" onClick={() => void copyValue(`n-${rec.purpose}`, rec.name)}>
                        <Icon icon={Copy} className="ui-icon-sm" />
                        {copied === `n-${rec.purpose}` ? t("copied") : null}
                      </button>
                    </span>
                    <span className="domain-dns-copy">
                      <code>{rec.value}</code>
                      <button type="button" onClick={() => void copyValue(`v-${rec.purpose}`, rec.value)}>
                        <Icon icon={Copy} className="ui-icon-sm" />
                        {copied === `v-${rec.purpose}` ? t("copied") : null}
                      </button>
                    </span>
                  </div>
                ))}
              </div>

              {domain.status === "failed" && domain.last_error ? (
                <p className="domain-error">{friendlyError(domain.last_error)}</p>
              ) : null}
              {domain.status === "pending_dns" && domain.last_error ? (
                <p className="domain-hint">{friendlyError(domain.last_error)}</p>
              ) : null}

              <div className="options-actions">
                <button type="button" className="btn" disabled={verifying} onClick={() => void verify()}>
                  <Icon
                    icon={verifying ? Loader2 : RefreshCw}
                    className={`ui-icon-sm ${verifying ? "agent-spin" : ""}`}
                  />
                  {domain.status === "failed" ? t("domainRetry") : t("domainVerify")}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
