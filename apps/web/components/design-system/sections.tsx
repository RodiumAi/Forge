"use client";

import { Braces, Copy, Hash, Plus, Sparkles, Tag, Trash2, Type, Upload } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { Icon } from "@/components/ui/icon";
import { ContextMenu, copyText, useContextMenu, useMenuTrigger, type ContextMenuEntry } from "@/components/ui/ContextMenu";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { assetObjectUrl, uploadLogo } from "./api";
import { ComponentShowcase } from "./ComponentShowcase";
import {
  COLOR_ROLES,
  GOOGLE_FONTS,
  SHOWCASE,
  colorEntries,
  contrastRatio,
  contrastRows,
  cssVars,
  dimensionEntries,
  fontFamily,
  guidance,
  iconGuidance,
  logoRules,
  normalizeHex,
  removeColor,
  scaleSizes,
  setColor,
  setDimension,
  setFont,
  setGuidance,
  setIconGuidance,
  setLogo,
  setTypeScale,
  typeScale,
  wcagLevel,
  type DesignSystemDoc,
  type FontRole,
  type GuidanceKey,
} from "./tokens";

export type SectionProps = {
  doc: DesignSystemDoc;
  onChange: (next: DesignSystemDoc) => void;
  readOnly?: boolean;
};

const ico = (I: typeof Copy) => <I size={16} aria-hidden />;

/** A right-click menu whose rows are given by the row that opens it. */
function useRowMenu(label: string) {
  const menu = useContextMenu();
  const trigger = useMenuTrigger<ContextMenuEntry[]>((items, at) => menu.open(at, items, label));
  return { bind: trigger.bind, node: <ContextMenu request={menu.request} onClose={menu.close} /> };
}

/** Rows to copy a token: its value and its CSS variable. */
function copyRows(t: (key: "dsMenuCopyValue" | "dsMenuCopyVar") => string, value: string, cssVar: string): ContextMenuEntry[] {
  return [
    { id: "copy-value", label: t("dsMenuCopyValue"), icon: ico(Copy), onSelect: () => copyText(value) },
    { id: "copy-var", label: t("dsMenuCopyVar"), icon: ico(Braces), onSelect: () => copyText(`var(${cssVar})`) },
  ];
}

/** One line per entry; empty lines are dropped on save. */
function LinesField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string[];
  onChange: (lines: string[]) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState(value.join("\n"));
  const last = useRef(value.join("\n"));
  useEffect(() => {
    const joined = value.join("\n");
    if (joined !== last.current) {
      last.current = joined;
      setText(joined);
    }
  }, [value]);
  return (
    <label className="dse-field">
      <span>{label}</span>
      <textarea
        rows={4}
        value={text}
        disabled={disabled}
        onChange={(event) => {
          setText(event.target.value);
          const lines = event.target.value.split("\n");
          last.current = lines.map((l) => l.trim()).filter(Boolean).join("\n");
          onChange(lines);
        }}
      />
    </label>
  );
}

function LevelBadge({ ratio, required }: { ratio: number; required: number }) {
  const level = wcagLevel(ratio);
  const pass = ratio >= required;
  return (
    <span className={`dse-level ${pass ? "is-pass" : "is-fail"}`} title={`${ratio.toFixed(2)}:1`}>
      {level === "fail" ? "Fail" : level} {ratio.toFixed(1)}
    </span>
  );
}

// ── colours ────────────────────────────────────────────────────────────────

export function ColorsSection({ doc, onChange, readOnly }: SectionProps) {
  const { t } = useI18n();
  const entries = colorEntries(doc);
  const rows = contrastRows(doc);
  const missing = COLOR_ROLES.filter((role) => !entries.some((entry) => entry.name === role));
  const [checkFg, setCheckFg] = useState("fg");
  const [checkBg, setCheckBg] = useState("bg");
  const colors = Object.fromEntries(entries.map((e) => [e.name, e.value]));
  const custom = colors[checkFg] && colors[checkBg] ? contrastRatio(colors[checkFg], colors[checkBg]) : null;
  const rowMenu = useRowMenu(t("dsMenuColor"));

  return (
    <div className="dse-stack">
      {rowMenu.node}
      <div className="dse-swatches">
        {entries.map((entry) => (
          <div
            key={entry.name}
            className="dse-swatch"
            {...rowMenu.bind([
              { id: "copy-hex", label: t("dsMenuCopyHex"), icon: ico(Hash), onSelect: () => copyText(entry.value) },
              { id: "copy-var", label: t("dsMenuCopyVar"), icon: ico(Braces), onSelect: () => copyText(`var(--${entry.name})`) },
              { id: "copy-name", label: t("dsMenuCopyName"), icon: ico(Tag), onSelect: () => copyText(entry.name) },
              ...(!readOnly && !["bg", "fg", "accent"].includes(entry.name)
                ? [
                    { type: "separator" as const },
                    { id: "remove", label: t("dsRemove"), icon: ico(Trash2), danger: true, onSelect: () => onChange(removeColor(doc, entry.name)) },
                  ]
                : []),
            ])}
          >
            <label className="dse-swatch-chip" style={{ background: entry.value }}>
              <input
                type="color"
                value={entry.value}
                disabled={readOnly}
                aria-label={`${entry.name} ${entry.value}`}
                onChange={(event) => onChange(setColor(doc, entry.name, event.target.value))}
              />
            </label>
            <div className="dse-swatch-meta">
              <strong>{entry.name}</strong>
              <input
                className="dse-hex"
                defaultValue={entry.value}
                key={entry.value}
                disabled={readOnly}
                aria-label={`${entry.name} hex`}
                onBlur={(event) => {
                  const hex = normalizeHex(event.target.value);
                  if (hex && hex !== entry.value) onChange(setColor(doc, entry.name, hex));
                }}
              />
              {entry.description ? <small>{entry.description}</small> : null}
            </div>
            {!readOnly && !["bg", "fg", "accent"].includes(entry.name) ? (
              <button
                type="button"
                className="dse-icon-btn"
                aria-label={`${t("dsRemove")} ${entry.name}`}
                onClick={() => onChange(removeColor(doc, entry.name))}
              >
                <Icon icon={Trash2} className="ui-icon-sm" />
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {!readOnly && missing.length ? (
        <div className="dse-row">
          {missing.map((role) => (
            <button
              key={role}
              type="button"
              className="dse-chip-btn"
              onClick={() => onChange(setColor(doc, role, colors.accent ?? "#888888"))}
            >
              <Icon icon={Plus} className="ui-icon-sm" /> {role}
            </button>
          ))}
        </div>
      ) : null}

      <h3 className="dse-h3">{t("dsContrastTitle")}</h3>
      <table className="dse-table">
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.fg}-${row.bg}`}>
              <td>
                <span className="dse-pair" style={{ background: colors[row.bg], color: colors[row.fg] }}>
                  Aa
                </span>
              </td>
              <td>
                <code>--{row.fg}</code> / <code>--{row.bg}</code>
              </td>
              <td>
                <LevelBadge ratio={row.ratio} required={row.required} />
              </td>
              <td className="dse-muted">
                {t("dsContrastRequired")} {row.required}:1
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="dse-checker">
        <span>{t("dsContrastChecker")}</span>
        <select value={checkFg} onChange={(event) => setCheckFg(event.target.value)} aria-label={t("dsContrastText")}>
          {entries.map((e) => (
            <option key={e.name} value={e.name}>
              {e.name}
            </option>
          ))}
        </select>
        <span>/</span>
        <select value={checkBg} onChange={(event) => setCheckBg(event.target.value)} aria-label={t("dsContrastBackground")}>
          {entries.map((e) => (
            <option key={e.name} value={e.name}>
              {e.name}
            </option>
          ))}
        </select>
        {custom !== null ? (
          <>
            <span className="dse-pair" style={{ background: colors[checkBg], color: colors[checkFg] }}>
              Aa
            </span>
            <LevelBadge ratio={custom} required={4.5} />
          </>
        ) : null}
      </div>
    </div>
  );
}

// ── typography ─────────────────────────────────────────────────────────────

const FONT_ROLES: FontRole[] = ["display", "body", "mono"];

export function TypographySection({ doc, onChange, readOnly }: SectionProps) {
  const { t } = useI18n();
  const scale = typeScale(doc);
  const sizes = scaleSizes(scale.base, scale.ratio);
  const families = Object.keys(GOOGLE_FONTS);
  const rowMenu = useRowMenu(t("dsMenuToken"));
  return (
    <div className="dse-stack">
      {rowMenu.node}
      <div className="dse-grid3">
        {FONT_ROLES.map((role) => {
          const family = fontFamily(doc, role);
          const options = role === "mono" ? families.filter((f) => GOOGLE_FONTS[f][0] === "mono") : families;
          return (
            <label
              key={role}
              className="dse-field"
              {...rowMenu.bind([
                { id: "copy-font", label: t("dsMenuCopyFont"), icon: ico(Type), onSelect: () => copyText(family) },
                { id: "copy-var", label: t("dsMenuCopyVar"), icon: ico(Braces), onSelect: () => copyText(`var(--font-${role})`) },
              ])}
            >
              <span>{t(role === "display" ? "dsFontDisplay" : role === "body" ? "dsFontBody" : "dsFontMono")}</span>
              <select
                value={family}
                disabled={readOnly}
                onChange={(event) => onChange(setFont(doc, role, event.target.value))}
              >
                {!GOOGLE_FONTS[family] ? <option value={family}>{family}</option> : null}
                {options.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <span className="dse-specimen-mini" style={{ fontFamily: `"${family}"` }}>
                Aa Bb Cc 0123
              </span>
            </label>
          );
        })}
      </div>
      <div className="dse-grid3">
        <label className="dse-field">
          <span>{t("dsTypeBase")}</span>
          <input
            type="number"
            min={12}
            max={22}
            value={scale.base}
            disabled={readOnly}
            onChange={(event) => onChange(setTypeScale(doc, Number(event.target.value) || 16, scale.ratio))}
          />
        </label>
        <label className="dse-field">
          <span>{t("dsTypeRatio")}</span>
          <select
            value={String(scale.ratio)}
            disabled={readOnly}
            onChange={(event) => onChange(setTypeScale(doc, scale.base, Number(event.target.value)))}
          >
            {[1.125, 1.2, 1.25, 1.333, 1.414, 1.5].map((ratio) => (
              <option key={ratio} value={String(ratio)}>
                {ratio}
              </option>
            ))}
            {![1.125, 1.2, 1.25, 1.333, 1.414, 1.5].includes(scale.ratio) ? (
              <option value={String(scale.ratio)}>{scale.ratio}</option>
            ) : null}
          </select>
        </label>
      </div>
      <div className="dse-specimen">
        {(["5xl", "4xl", "3xl", "2xl", "xl", "lg", "base", "sm", "xs"] as const).map((step) => {
          const heading = ["5xl", "4xl", "3xl", "2xl"].includes(step);
          return (
            <div
              key={step}
              className="dse-spec-row"
              {...rowMenu.bind([
                { id: "copy-value", label: t("dsMenuCopyValue"), icon: ico(Copy), onSelect: () => copyText(`${sizes[step]}px`) },
                {
                  id: "copy-font",
                  label: t("dsMenuCopyFont"),
                  icon: ico(Type),
                  onSelect: () => copyText(fontFamily(doc, heading ? "display" : "body")),
                },
              ])}
            >
              <span className="dse-muted">
                {step} · {sizes[step]}px
              </span>
              <p
                style={{
                  fontFamily: `"${fontFamily(doc, heading ? "display" : "body")}"`,
                  fontSize: Math.min(sizes[step], 72),
                  fontWeight: heading ? 700 : 400,
                }}
              >
                {heading ? doc.name : t("dsSpecimenText")}
              </p>
            </div>
          );
        })}
        <div className="dse-spec-row">
          <span className="dse-muted">mono</span>
          <p style={{ fontFamily: `"${fontFamily(doc, "mono")}"`, fontSize: sizes.sm }}>const tokens = await load();</p>
        </div>
      </div>
    </div>
  );
}

// ── spacing, radius, shadows, motion ───────────────────────────────────────

export function SpacingSection({ doc, onChange, readOnly }: SectionProps) {
  const { t } = useI18n();
  const vars = cssVars(doc);
  const shadows = Object.keys(vars).filter((key) => key.startsWith("--shadow-"));
  const motion = Object.entries(vars).filter(([key]) => key.startsWith("--motion-") || key.startsWith("--ease-"));
  const editable = (group: string) =>
    dimensionEntries(doc, group).filter((entry) => !(group === "radius" && ["none", "full"].includes(entry.key)));
  const rowMenu = useRowMenu(t("dsMenuToken"));
  return (
    <div className="dse-stack">
      {rowMenu.node}
      {(["space", "radius"] as const).map((group) => (
        <div key={group}>
          <h3 className="dse-h3">{t(group === "space" ? "dsSpacing" : "dsRadius")}</h3>
          <div className="dse-dims">
            {editable(group).map((entry) => (
              <label key={entry.key} className="dse-dim" {...rowMenu.bind(copyRows(t, `${entry.px}px`, `--${group}-${entry.key}`))}>
                <span
                  className={group === "space" ? "dse-dim-bar" : "dse-dim-box"}
                  style={
                    group === "space"
                      ? { width: Math.min(entry.px, 160) }
                      : { borderRadius: Math.min(entry.px, 40) }
                  }
                />
                <span className="dse-muted">{entry.key}</span>
                <input
                  type="number"
                  min={0}
                  max={400}
                  value={entry.px}
                  disabled={readOnly}
                  aria-label={`${group} ${entry.key}`}
                  onChange={(event) => onChange(setDimension(doc, group, entry.key, Number(event.target.value)))}
                />
              </label>
            ))}
          </div>
        </div>
      ))}
      <h3 className="dse-h3">{t("dsShadows")}</h3>
      <div className="dse-row" style={vars as CSSProperties}>
        {shadows.map((key) => (
          <div key={key} className="dse-shadow" style={{ boxShadow: `var(${key})` }} {...rowMenu.bind(copyRows(t, vars[key], key))}>
            {key.slice(9)}
          </div>
        ))}
      </div>
      {motion.length ? (
        <>
          <h3 className="dse-h3">{t("dsMotion")}</h3>
          <p className="dse-muted">
            {motion.map(([key, value]) => (
              <span key={key} className="dse-token">
                {key.slice(2)} {value}
              </span>
            ))}
          </p>
        </>
      ) : null}
    </div>
  );
}

// ── logo ───────────────────────────────────────────────────────────────────

export function LogoSection({
  doc,
  onChange,
  readOnly,
  projectId,
  onDocument,
  onAsk,
}: SectionProps & {
  projectId: string;
  onDocument: (doc: DesignSystemDoc) => void;
  onAsk: (prompt: string) => void;
}) {
  const { t } = useI18n();
  const [src, setSrc] = useState<string | null>(null);
  const [darkSrc, setDarkSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const rules = logoRules(doc);
  const logo = doc.logo;

  useEffect(() => {
    let alive = true;
    const urls: string[] = [];
    void (async () => {
      for (const [path, set] of [
        [logo?.src, setSrc],
        [logo?.darkSrc, setDarkSrc],
      ] as const) {
        if (!path) {
          set(null);
          continue;
        }
        const url = await assetObjectUrl(projectId, path);
        if (url) urls.push(url);
        if (alive) set(url);
      }
    })();
    return () => {
      alive = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [projectId, logo?.src, logo?.darkSrc]);

  async function upload(file: File | undefined, variant: "light" | "dark") {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onDocument(await uploadLogo(projectId, file, variant));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const minPx = logo?.minSizePx ?? 24;
  return (
    <div className="dse-stack">
      <div className="dse-grid2">
        <div className="dse-logo-box">
          {src ? <img src={src} alt={doc.name} className="dse-logo-clear" /> : <strong>{doc.name}</strong>}
        </div>
        <div className="dse-logo-box is-min">
          {darkSrc ? (
            <img src={darkSrc} alt={doc.name} />
          ) : src ? (
            <>
              <img src={src} alt="" style={{ height: minPx }} />
              <span className="dse-muted">{minPx} px</span>
            </>
          ) : null}
        </div>
      </div>
      {!readOnly ? (
        <div className="dse-row">
          <label className="dse-btn">
            <Icon icon={Upload} className="ui-icon-sm" /> {t("dsLogoUpload")}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              disabled={busy}
              onChange={(event) => void upload(event.target.files?.[0], "light")}
            />
          </label>
          <label className="dse-btn is-quiet">
            <Icon icon={Upload} className="ui-icon-sm" /> {t("dsLogoUploadDark")}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              disabled={busy || !logo}
              onChange={(event) => void upload(event.target.files?.[0], "dark")}
            />
          </label>
          <button type="button" className="dse-btn is-quiet" onClick={() => onAsk(t("dsLogoAskPrompt"))}>
            <Icon icon={Sparkles} className="ui-icon-sm" /> {t("dsLogoAsk")}
          </button>
        </div>
      ) : null}
      {error ? <p className="dse-error">{error}</p> : null}
      {logo ? (
        <>
          <div className="dse-grid2">
            <label className="dse-field">
              <span>{t("dsLogoClearSpace")}</span>
              <input
                value={logo.clearSpace ?? ""}
                disabled={readOnly}
                maxLength={200}
                onChange={(event) => onChange(setLogo(doc, { clearSpace: event.target.value }))}
              />
            </label>
            <label className="dse-field">
              <span>{t("dsLogoMinSize")}</span>
              <input
                type="number"
                min={8}
                max={2000}
                value={minPx}
                disabled={readOnly}
                onChange={(event) => onChange(setLogo(doc, { minSizePx: Number(event.target.value) }))}
              />
            </label>
          </div>
          <div className="dse-grid2">
            <LinesField
              label={t("dsLogoUsage")}
              value={rules.usage}
              disabled={readOnly}
              onChange={(usage) => onChange(setLogo(doc, { usage }))}
            />
            <LinesField
              label={t("dsLogoMisuse")}
              value={rules.misuse}
              disabled={readOnly}
              onChange={(misuse) => onChange(setLogo(doc, { misuse }))}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

// ── written guidance ───────────────────────────────────────────────────────

export function GuidanceSection({ doc, onChange, readOnly, field }: SectionProps & { field: GuidanceKey }) {
  const { t } = useI18n();
  const value = guidance(doc, field);
  return (
    <div className="dse-stack">
      <label className="dse-field">
        <span>{t("dsSummary")}</span>
        <textarea
          rows={3}
          value={value.summary}
          maxLength={2000}
          disabled={readOnly}
          onChange={(event) => onChange(setGuidance(doc, field, { ...value, summary: event.target.value }))}
        />
      </label>
      <div className="dse-grid2">
        <LinesField
          label={t("dsDo")}
          value={value.do}
          disabled={readOnly}
          onChange={(lines) => onChange(setGuidance(doc, field, { ...value, do: lines }))}
        />
        <LinesField
          label={t("dsDont")}
          value={value.dont}
          disabled={readOnly}
          onChange={(lines) => onChange(setGuidance(doc, field, { ...value, dont: lines }))}
        />
      </div>
    </div>
  );
}

export function IconographySection({ doc, onChange, readOnly }: SectionProps) {
  const { t } = useI18n();
  const value = iconGuidance(doc);
  const set = (patch: Partial<typeof value>) => onChange(setIconGuidance(doc, { ...value, ...patch }));
  return (
    <div className="dse-stack">
      <div className="dse-grid3">
        <label className="dse-field">
          <span>{t("dsIconLibrary")}</span>
          <input value={value.library} disabled={readOnly} maxLength={60} onChange={(e) => set({ library: e.target.value })} />
        </label>
        <label className="dse-field">
          <span>{t("dsIconStyle")}</span>
          <select value={value.style} disabled={readOnly} onChange={(e) => set({ style: e.target.value })}>
            {["outline", "filled", "duotone"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="dse-field">
          <span>{t("dsIconStroke")}</span>
          <input
            type="number"
            step={0.25}
            min={0.5}
            max={4}
            value={value.stroke}
            disabled={readOnly}
            onChange={(e) => set({ stroke: Number(e.target.value) || 1.75 })}
          />
        </label>
      </div>
      <div className="dse-icons">
        {[Sparkles, Upload, Plus, Trash2].map((Glyph, index) => (
          <span key={index}>
            <Glyph size={24} strokeWidth={value.stroke} fill={value.style === "filled" ? "currentColor" : "none"} aria-hidden />
          </span>
        ))}
      </div>
      <label className="dse-field">
        <span>{t("dsSummary")}</span>
        <textarea rows={2} value={value.summary} disabled={readOnly} onChange={(e) => set({ summary: e.target.value })} />
      </label>
      <div className="dse-grid2">
        <LinesField label={t("dsDo")} value={value.do} disabled={readOnly} onChange={(lines) => set({ do: lines })} />
        <LinesField label={t("dsDont")} value={value.dont} disabled={readOnly} onChange={(lines) => set({ dont: lines })} />
      </div>
    </div>
  );
}

export function ComponentsSection({ doc, onChange, readOnly }: SectionProps) {
  const { t } = useI18n();
  const picked = doc.components?.length ? doc.components : [...SHOWCASE];
  return (
    <div className="dse-stack">
      {!readOnly ? (
        <div className="dse-row" role="group" aria-label={t("dsComponentsPick")}>
          {SHOWCASE.map((name) => (
            <label key={name} className="dse-check">
              <input
                type="checkbox"
                checked={picked.includes(name)}
                onChange={(event) => {
                  const next = event.target.checked ? [...picked, name] : picked.filter((c) => c !== name);
                  onChange({ ...doc, components: SHOWCASE.filter((c) => next.includes(c)) });
                }}
              />
              {name}
            </label>
          ))}
        </div>
      ) : null}
      <ComponentShowcase vars={cssVars(doc)} components={picked} />
    </div>
  );
}
