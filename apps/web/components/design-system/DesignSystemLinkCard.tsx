"use client";

import { Palette, RefreshCw, Unlink } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { attach, detach, errorCode, getLink, listDesignSystems, resync, type DesignSystemItem, type LinkStatus } from "./api";

type Props = {
  projectId: string;
  /** Called after files were written (DESIGN.md, index.css, deck theme), to refresh the editor. */
  onApplied?: (paths: string[]) => void;
};

/**
 * The design system of a site, deck or codelab: attach one, see when it moved
 * on, review the changes and resync. Nothing is applied without a click.
 * Meant for the builder and the document editors (not wired into them here).
 */
export function DesignSystemLinkCard({ projectId, onApplied }: Props) {
  const { t } = useI18n();
  const [status, setStatus] = useState<LinkStatus | null>(null);
  const [options, setOptions] = useState<DesignSystemItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await getLink(projectId));
    } catch {
      setStatus(null);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
    void listDesignSystems()
      .then((list) => setOptions(list.items))
      .catch(() => setOptions([]));
  }, [refresh]);

  async function act(action: () => Promise<LinkStatus>) {
    setBusy(true);
    setError(null);
    try {
      const next = await action();
      setStatus(next);
      if (next.written?.length) onApplied?.(next.written);
    } catch (err) {
      setError(errorCode(err) === "DESIGN_SYSTEM_CHANGED" ? t("dsLinkChanged") : t("dsErrorGeneric"));
      void refresh();
    } finally {
      setBusy(false);
    }
  }

  const linked = status?.design_system;
  return (
    <section className="dse-link" aria-label={t("dsLinkTitle")}>
      <header className="dse-row">
        <Icon icon={Palette} className="ui-icon-sm" /> <strong>{t("dsLinkTitle")}</strong>
      </header>
      {linked ? (
        <>
          <p>
            {linked.name ?? t("dsLinkUnavailable")}
            {status?.outdated && status.available ? <span className="dse-badge">{t("dsLinkOutdated")}</span> : null}
          </p>
          {status?.outdated && status.changes.length ? (
            <ul className="dse-changes">
              {status.changes.map((change) => (
                <li key={change.path}>
                  <code>{change.path}</code>
                  {change.tokens.slice(0, 8).map((token) => (
                    <span key={token.name} className="dse-token">
                      {token.name}: {token.from ?? "∅"} → {token.to}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="dse-row">
            {status?.outdated && status.available && linked.version ? (
              <button type="button" className="dse-btn" disabled={busy} onClick={() => void act(() => resync(projectId, linked.version!))}>
                <Icon icon={RefreshCw} className="ui-icon-sm" /> {t("dsLinkResync")}
              </button>
            ) : null}
            <button type="button" className="dse-btn is-quiet" disabled={busy} onClick={() => void act(() => detach(projectId))}>
              <Icon icon={Unlink} className="ui-icon-sm" /> {t("dsLinkDetach")}
            </button>
          </div>
        </>
      ) : (
        <select
          aria-label={t("dsLinkPick")}
          disabled={busy || !options.length}
          value=""
          onChange={(event) => event.target.value && void act(() => attach(projectId, event.target.value))}
        >
          <option value="">{options.length ? t("dsLinkPick") : t("homeDesignSystemEmpty")}</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      )}
      {error ? <p className="dse-error">{error}</p> : null}
    </section>
  );
}
