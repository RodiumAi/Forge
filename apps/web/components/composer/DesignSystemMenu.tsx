"use client";

import type { CSSProperties } from "react";

import { Glyph } from "@/components/ui/glyph";
import { MenuItem, MenuLabel, MenuSeparator, Popover } from "@/components/ui/Popover";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** A design system offered by the composer (from GET /design-systems). */
export type ComposerDesignSystem = {
  id: string;
  name: string;
  /** personal (mine), team, shared with me. Missing reads as personal. */
  scope?: "personal" | "team" | "shared";
  preview?: { colors: string[]; display: string | null } | null;
};

/** The "Aa" tile in the system's font and colours, plus three colour dots. */
export function DesignSystemSwatch({ ds }: { ds: ComposerDesignSystem | null }) {
  if (!ds) {
    return (
      <span className="f-ds-swatch" aria-hidden>
        <span className="f-aa" style={{ background: "rgba(255,255,255,.08)", color: "#aaa" }}>
          Aa
        </span>
      </span>
    );
  }
  const colors = ds.preview?.colors?.length ? ds.preview.colors : ["#EB6118", "#1C1F26", "#F6F4F0"];
  const [accent, bg = "#1C1F26", fg = "#FFFFFF"] = colors;
  const font = ds.preview?.display ? `'${ds.preview.display}', var(--f-font)` : undefined;
  const aa: CSSProperties = { background: bg, color: fg === bg ? "#fff" : fg, fontFamily: font };
  return (
    <span className="f-ds-swatch" aria-hidden>
      <span className="f-aa" style={aa}>
        Aa
      </span>
      <span className="f-swatch-dots">
        {[accent, bg, fg].map((c, i) => (
          <i key={i} style={{ background: c }} />
        ))}
      </span>
    </span>
  );
}

const GROUPS = [
  { scope: "team", labelKey: "uiDsTeam" },
  { scope: "personal", labelKey: "uiDsMine" },
  { scope: "shared", labelKey: "uiDsShared" },
] as const;

/** The composer's design system button and listbox (team, mine, shared, none). */
export function DesignSystemMenu({
  options,
  value,
  onChange,
  disabled,
  manageHref,
  locked,
  upgradeHref,
  onCreate,
}: {
  options: readonly ComposerDesignSystem[];
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
  /** "Manage my design systems" link at the bottom. */
  manageHref?: string;
  /** Plan below Builder: the systems show but cannot be picked. */
  locked?: boolean;
  upgradeHref?: string;
  /** Starts a new design system (shown first when there is none). */
  onCreate?: () => void;
}) {
  const { t } = useI18n();
  const current = locked ? null : (options.find((d) => d.id === value) ?? null);
  const name = current ? current.name : t("uiDsNone");
  return (
    <Popover
      tone="dark"
      role="listbox"
      side="top"
      align="start"
      label={t("uiDsLabel")}
      width={300}
      trigger={
        <button type="button" className="f-c-btn" disabled={disabled} aria-label={`${t("uiDsLabel")}: ${name}`}>
          <DesignSystemSwatch ds={current} />
          <span className="f-lbl-long">{name}</span>
          {locked ? <Glyph name="lock" size="sm" /> : null}
          <Glyph name="chevron-down" className="f-caret" />
        </button>
      }
    >
      {(close) => (
        <>
          {locked ? (
            <div className="f-ds-locked" role="note">
              <Glyph name="lock" size="sm" />
              <span>
                <strong>{t("uiDsLockedTitle")}</strong>
                <small>{t("uiDsLockedHint")}</small>
              </span>
            </div>
          ) : null}
          {locked && upgradeHref ? (
            <MenuItem icon="crown" href={upgradeHref}>
              {t("uiDsUpgrade")}
            </MenuItem>
          ) : null}
          {!locked && !options.length && onCreate ? (
            <div className="f-ds-empty">
              <p>{t("uiDsEmpty")}</p>
              <MenuItem
                icon="plus"
                hint={t("uiDsCreateHint")}
                onClick={() => {
                  onCreate();
                  close();
                }}
              >
                {t("uiDsCreate")}
              </MenuItem>
              <MenuSeparator />
            </div>
          ) : null}
          {GROUPS.map((group) => {
            const rows = options.filter((d) => (d.scope ?? "personal") === group.scope);
            if (!rows.length) return null;
            return (
              <div key={group.scope} role="group" aria-label={t(group.labelKey)}>
                <MenuLabel>{t(group.labelKey)}</MenuLabel>
                {rows.map((d) => (
                  <MenuItem
                    key={d.id}
                    role="option"
                    lead={<DesignSystemSwatch ds={d} />}
                    selected={!locked && d.id === value}
                    disabled={locked}
                    onClick={() => {
                      onChange(d.id);
                      close();
                    }}
                  >
                    {d.name}
                  </MenuItem>
                ))}
              </div>
            );
          })}
          <MenuItem
            role="option"
            lead={<DesignSystemSwatch ds={null} />}
            selected={!current}
            hint={t("uiDsNoneHint")}
            onClick={() => {
              onChange(null);
              close();
            }}
          >
            {t("uiDsNone")}
          </MenuItem>
          {!locked && options.length && onCreate ? (
            <>
              <MenuSeparator />
              <MenuItem
                icon="plus"
                onClick={() => {
                  onCreate();
                  close();
                }}
              >
                {t("uiDsCreate")}
              </MenuItem>
            </>
          ) : null}
          {manageHref ? (
            <>
              <MenuSeparator />
              <MenuItem icon="swatch" href={manageHref}>
                {t("uiDsManage")}
              </MenuItem>
            </>
          ) : null}
        </>
      )}
    </Popover>
  );
}
