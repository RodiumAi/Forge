"use client";

/**
 * Top bar shared by every project workspace (site and app builder, deck,
 * codelab and design system editors): Forge icon back to the projects, kind
 * tile, inline rename, state pill, a centre slot (view tabs or tools) and a
 * right slot (save status, share, the main action). An options menu beside
 * the Forge icon gathers the editor's actions and ends with Quit. Language and
 * theme are chosen in the Forge settings, not here.
 */

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { APP_ROUTES } from "@/components/shell/nav";
import { AvatarStack, Avatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Glyph } from "@/components/ui/glyph";
import { MenuItem, MenuSeparator, Popover } from "@/components/ui/Popover";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { kindStyle } from "@/lib/kind-style";
import type { ProjectKindId } from "@/lib/kinds";

export type WorkspaceState = "new" | "gen" | "draft" | "live" | "err";

export type WorkspacePerson = { name: string | null; email: string; avatar_url: string | null };

type Props = {
  kind: ProjectKindId;
  name: string;
  /** Saves a new name; resolves with the stored name. Absent: read-only title. */
  onRename?: (next: string) => Promise<string | void>;
  state?: WorkspaceState;
  /** Overrides the default label of the state pill. */
  stateLabel?: string;
  /** View tabs or editor tools, centred between the name and the actions. */
  center?: ReactNode;
  /** "Saved", "Forge is writing..." */
  saveStatus?: ReactNode;
  /** Buttons before the actions (assistant toggle...). */
  tools?: ReactNode;
  /** Rows of the options menu (MenuItem, MenuSeparator); Quit is added at the bottom. */
  menu?: (close: () => void) => ReactNode;
  /** Share, Present, Publish or Export. */
  actions?: ReactNode;
  people?: WorkspacePerson[];
  backHref?: string;
  className?: string;
};

export function WorkspaceBar({
  kind,
  name,
  onRename,
  state,
  stateLabel,
  center,
  saveStatus,
  tools,
  menu,
  actions,
  people = [],
  backHref = APP_ROUTES.home,
  className,
}: Props) {
  const { t } = useI18n();
  const k = kindStyle(kind);

  const pill: Record<WorkspaceState, string> = {
    new: t("bdStateNew"),
    gen: t("bdStateGen"),
    draft: t("bdStateDraft"),
    live: t("bdStateLive"),
    err: t("bdStateErr"),
  };

  return (
    <header className={cx("f-bd-top", className)}>
      <Link href={backHref} className="f-bd-back" aria-label={t("bdBackToProjects")}>
        <Glyph name="chevron-left" size="sm" className="f-bd-back-arrow" />
        <img src="/brand/forge/forge-app-icon-orange.svg" alt="" width={24} height={24} />
        <span className="f-bd-back-tip" aria-hidden>
          {t("bdBackToProjects")}
        </span>
      </Link>
      {menu ? (
        <Popover
          trigger={<IconButton icon="menu" size="sm" plain className="f-bd-menu" label={t("bdMenu")} title={t("bdMenu")} />}
          role="menu"
          label={t("bdMenu")}
          width={260}
          className="f-bd-menu-pop"
        >
          {(close) => (
            <>
              {menu(close)}
              <MenuSeparator />
              <MenuItem icon="logout" href={backHref} onClick={close}>
                {t("bdQuit")}
              </MenuItem>
            </>
          )}
        </Popover>
      ) : null}
      <div className="f-bd-name">
        <span className="f-bd-kind" style={{ background: k.color }} title={t(k.labelKey)}>
          <Glyph name={k.glyph} size="sm" />
        </span>
        <NameField name={name} onRename={onRename} />
        {state ? (
          <span className={cx("f-state", "f-bd-pill", stateClass(state))}>
            <i aria-hidden />
            {stateLabel || pill[state]}
          </span>
        ) : null}
      </div>
      {center ? <div className="f-bd-center">{center}</div> : null}
      <div className="f-bd-right">
        {saveStatus ? <span className="f-bd-save" aria-live="polite">{saveStatus}</span> : null}
        {tools}
        {people.length ? <People people={people} /> : null}
        {actions}
      </div>
    </header>
  );
}

function stateClass(state: WorkspaceState): string | undefined {
  if (state === "live") return "f-state-live";
  if (state === "gen") return "f-state-gen";
  if (state === "err") return "f-state-err";
  return undefined;
}

function NameField({ name, onRename }: { name: string; onRename?: (next: string) => Promise<string | void> }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);
  const focused = useRef(false);
  const skipBlur = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(name);
  }, [name]);

  if (!onRename) {
    return (
      <span className="f-bd-title" title={name}>
        {name || t("projectFallback")}
      </span>
    );
  }

  async function commit() {
    const next = draft.trim();
    if (!next || next === name) {
      setDraft(name);
      return;
    }
    setSaving(true);
    try {
      const stored = await onRename!(next);
      setDraft(typeof stored === "string" ? stored : next);
    } catch {
      setDraft(name);
    } finally {
      setSaving(false);
    }
  }

  return (
    <input
      className="f-bd-title-input"
      value={draft}
      maxLength={200}
      disabled={saving}
      aria-label={t("editProjectName")}
      placeholder={t("projectFallback")}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        } else if (e.key === "Escape") {
          e.preventDefault();
          skipBlur.current = true;
          setDraft(name);
          (e.target as HTMLInputElement).blur();
        }
      }}
      onBlur={() => {
        focused.current = false;
        if (skipBlur.current) {
          skipBlur.current = false;
          return;
        }
        void commit();
      }}
    />
  );
}

function People({ people }: { people: WorkspacePerson[] }) {
  const { t } = useI18n();
  const shown = people.length <= 3 ? people : people.slice(0, 2);
  const extra = people.length - shown.length;
  return (
    <AvatarStack className="f-bd-people">
      {shown.map((person, index) => (
        <span key={person.email} title={person.name?.trim() || person.email}>
          <Avatar
            name={person.name?.trim() || person.email}
            src={person.avatar_url}
            size="sm"
            tone={index === 0 ? "self" : "other"}
          />
        </span>
      ))}
      {extra > 0 ? (
        <span className="f-avatar f-avatar-sm f-avatar-neutral" title={people.map((p) => p.name || p.email).join(", ")}>
          {t("projectCollabMore").replace("{n}", String(extra))}
        </span>
      ) : null}
    </AvatarStack>
  );
}

/** "Saved" / "Forge is writing..." with the matching glyph. */
export function SaveStatus({ busy, label }: { busy?: boolean; label?: string }) {
  const { t } = useI18n();
  return (
    <>
      <Glyph name={busy ? "refresh" : "check"} size="sm" className={busy ? "f-spin" : undefined} />
      {label || (busy ? t("bdSaving") : t("bdSaved"))}
    </>
  );
}
