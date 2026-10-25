"use client";

/**
 * The design system a project follows: pick one of mine or my team's, see
 * when it moved on and apply the update, detach it (back to the project's own
 * charter), or create one. Below the Builder plan it shows locked. Used by the
 * deck Theme section and the builder's Options > Marque.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Lock, Palette, Plus, RefreshCw, Unlink } from "lucide-react";
import {
  attach,
  detach,
  errorCode,
  getLink,
  listDesignSystems,
  resync,
  type DesignSystemItem,
  type DesignSystemList,
  type LinkStatus,
} from "@/components/design-system/api";
import { rodiumUpgradeUrl } from "@/lib/constants/rodium-links";

import "./design-system-picker.css";

export const DS_STRINGS = {
  fr: {
    dsLoading: "Chargement des design systems...",
    dsPick: "Choisir un design system",
    dsNone: "Aucun design system",
    dsNoneHint: "Choisissez votre charte : logo, couleurs, polices",
    dsUpToDate: "À jour",
    dsOutdated: "Mise à jour disponible",
    dsUnavailable: "Design system plus disponible",
    dsEmpty: "Vous n'avez pas encore de design system.",
    dsScope_team: "Équipe",
    dsScope_personal: "Les miens",
    dsScope_shared: "Partagés avec moi",
    dsCreate: "Créer un design system",
    dsCreateHint: "Logo, couleurs, polices et ton, réutilisables partout",
    dsUpdateHint: "Le design system a changé ({n} modification(s)).",
    dsResync: "Appliquer la mise à jour",
    dsDetach: "Détacher le design system",
    dsChanged: "Le design system a encore changé : réessayez.",
    dsError: "Impossible d'appliquer le design system.",
    dsLockedTitle: "Design system : à partir du plan Builder",
    dsLockedHint: "Gardez logo, couleurs et polices au même endroit et appliquez-les à vos présentations, sites et applis.",
    dsUpgrade: "Passer à Builder",
  },
  en: {
    dsLoading: "Loading design systems...",
    dsPick: "Choose a design system",
    dsNone: "No design system",
    dsNoneHint: "Pick your brand: logo, colours, fonts",
    dsUpToDate: "Up to date",
    dsOutdated: "Update available",
    dsUnavailable: "Design system no longer available",
    dsEmpty: "You have no design system yet.",
    dsScope_team: "Team",
    dsScope_personal: "Mine",
    dsScope_shared: "Shared with me",
    dsCreate: "Create a design system",
    dsCreateHint: "Logo, colours, fonts and tone, reusable everywhere",
    dsUpdateHint: "The design system changed ({n} change(s)).",
    dsResync: "Apply the update",
    dsDetach: "Detach the design system",
    dsChanged: "The design system changed again: try again.",
    dsError: "Could not apply the design system.",
    dsLockedTitle: "Design system: from the Builder plan",
    dsLockedHint: "Keep your logo, colours and fonts in one place and apply them to your decks, sites and apps.",
    dsUpgrade: "Upgrade to Builder",
  },
} as const;

export type DsKey = keyof (typeof DS_STRINGS)["en"];
export type DsT = (key: DsKey, vars?: Record<string, string>) => string;

/** A `t` for the picker's own strings, in the given locale. */
export function dsTranslator(locale: string): DsT {
  const table = locale.startsWith("fr") ? DS_STRINGS.fr : DS_STRINGS.en;
  return (key, vars) => {
    let out: string = table[key];
    for (const [k, v] of Object.entries(vars ?? {})) out = out.replace(`{${k}}`, v);
    return out;
  };
}

/** What the project follows now; `null` while loading. */
export type DesignSystemState = { linked: boolean; locked: boolean } | null;

type Props = {
  projectId: string;
  t: DsT;
  readOnly?: boolean;
  /** Files the design system wrote (DESIGN.md, deck.json): the editor reloads them. */
  onApplied: (paths: string[], designSystemId: string | null) => void;
  /** Linked or not, locked or not, each time it is known. */
  onState?: (state: DesignSystemState) => void;
  className?: string;
};

const GROUPS = ["team", "personal", "shared"] as const;

export function DesignSystemPicker({ projectId, t, readOnly, onApplied, onState, className }: Props) {
  const [list, setList] = useState<DesignSystemList | null>(null);
  const [status, setStatus] = useState<LinkStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const [nextList, nextStatus] = await Promise.all([
      listDesignSystems().catch(() => null),
      getLink(projectId).catch(() => null),
    ]);
    setList(nextList);
    setStatus(nextStatus);
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  async function act(action: () => Promise<LinkStatus>) {
    setBusy(true);
    setError(null);
    setOpen(false);
    try {
      const next = await action();
      setStatus(next);
      if (next.written?.length) onApplied(next.written, next.design_system?.id ?? null);
    } catch (err) {
      const code = errorCode(err);
      setError(code === "DESIGN_SYSTEM_CHANGED" ? t("dsChanged") : code === "DESIGN_SYSTEM_NOT_IN_PLAN" ? t("dsLockedTitle") : t("dsError"));
      void refresh();
    } finally {
      setBusy(false);
    }
  }

  const items = list?.items ?? [];
  const locked = list?.allowed === false;
  const linked = status?.design_system ?? null;
  const linkedItem = linked ? items.find((i) => i.id === linked.id) : undefined;
  const createHref = "/dashboard?create=design_system#create";
  const known = Boolean(list || status);
  const isLinked = Boolean(linked);

  useEffect(() => {
    onState?.(known ? { linked: isLinked, locked } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- report when the facts change
  }, [known, isLinked, locked]);

  if (!list && !status) return <p className="de-hint">{t("dsLoading")}</p>;

  if (locked) {
    // Shown, not hidden: the picker the plan would open, greyed, with the plan
    // it needs, so the feature is discoverable from the Starter plan.
    return (
      <div className={`de-ds is-locked${className ? ` ${className}` : ""}`}>
        <div className="de-ds-current" aria-disabled="true">
          <Swatch />
          <span className="de-ds-name">
            <strong>{t("dsPick")}</strong>
            <small>{t("dsNoneHint")}</small>
          </span>
          <span className="de-ds-plan">
            <Lock size={11} aria-hidden /> Builder
          </span>
        </div>
        <div className="de-ds-locked">
          <div>
            <strong>{t("dsLockedTitle")}</strong>
            <p>{t("dsLockedHint")}</p>
            <a className="de-ds-btn is-primary" href={rodiumUpgradeUrl()}>
              {t("dsUpgrade")}
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`de-ds${className ? ` ${className}` : ""}`} ref={boxRef}>
      <button
        type="button"
        className={`de-ds-current${open ? " is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={busy || readOnly}
        onClick={() => setOpen((v) => !v)}
      >
        <Swatch item={linkedItem} />
        <span className="de-ds-name">
          <strong>{linked ? (linked.name ?? t("dsUnavailable")) : t("dsNone")}</strong>
          <small>{linked ? (status?.outdated ? t("dsOutdated") : t("dsUpToDate")) : t("dsNoneHint")}</small>
        </span>
        <ChevronDown size={15} aria-hidden />
      </button>

      {open ? (
        <div className="de-ds-menu" role="listbox" aria-label={t("dsPick")}>
          {items.length === 0 ? <p className="de-ds-empty">{t("dsEmpty")}</p> : null}
          {GROUPS.map((scope) => {
            const rows = items.filter((i) => i.scope === scope);
            if (!rows.length) return null;
            return (
              <div key={scope} role="group" aria-label={t(`dsScope_${scope}`)}>
                <p className="de-ds-group">{t(`dsScope_${scope}`)}</p>
                {rows.map((item) => {
                  const selected = item.id === linked?.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className="de-ds-option"
                      onClick={() => (selected ? setOpen(false) : void act(() => attach(projectId, item.id)))}
                    >
                      <Swatch item={item} />
                      <span className="de-ds-name">
                        <strong>{item.name}</strong>
                        {item.preview.display ? <small style={{ fontFamily: `'${item.preview.display}', inherit` }}>{item.preview.display}</small> : null}
                      </span>
                      {selected ? <Check size={14} aria-hidden /> : null}
                    </button>
                  );
                })}
              </div>
            );
          })}
          <a className="de-ds-option de-ds-create" href={createHref}>
            <span className="de-ds-plus" aria-hidden>
              <Plus size={14} />
            </span>
            <span className="de-ds-name">
              <strong>{t("dsCreate")}</strong>
              <small>{t("dsCreateHint")}</small>
            </span>
          </a>
        </div>
      ) : null}

      {linked && status?.outdated && status.available && linked.version ? (
        <div className="de-ds-update">
          <p>{t("dsUpdateHint", { n: String(status.changes.reduce((n, c) => n + Math.max(1, c.tokens.length), 0)) })}</p>
          <button type="button" className="de-ds-btn is-primary" disabled={busy || readOnly} onClick={() => void act(() => resync(projectId, linked.version!))}>
            <RefreshCw size={13} aria-hidden /> {t("dsResync")}
          </button>
        </div>
      ) : null}
      {linked && !readOnly ? (
        <button type="button" className="de-ds-detach" disabled={busy} onClick={() => void act(() => detach(projectId))}>
          <Unlink size={13} aria-hidden /> {t("dsDetach")}
        </button>
      ) : null}
      {error ? <p className="de-ds-error">{error}</p> : null}
    </div>
  );
}

function Swatch({ item }: { item?: DesignSystemItem }) {
  if (!item) {
    return (
      <span className="de-ds-swatch is-empty" aria-hidden>
        <Palette size={15} />
      </span>
    );
  }
  const [accent = "#EB6118", bg = "#1C1F26", fg = "#F6F4F0"] = item.preview.colors;
  return (
    <span className="de-ds-swatch" aria-hidden style={{ background: bg, color: fg === bg ? "#fff" : fg }}>
      <span style={{ fontFamily: item.preview.display ? `'${item.preview.display}', inherit` : undefined }}>Aa</span>
      <i style={{ background: accent }} />
    </span>
  );
}
