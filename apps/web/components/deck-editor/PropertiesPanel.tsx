"use client";

/**
 * Right panel, by selection: the element (arrange, style by type, image,
 * chart data, table, animation), the slide (background, transition,
 * presets, layers) and the deck (title, format, theme tokens).
 */

import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  Group,
  ImageIcon,
  Lock,
  Trash2,
  Ungroup,
  Unlock,
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
  PanelRightClose,
} from "lucide-react";
import type { ReactNode } from "react";
import type { Point } from "@/components/ui/ContextMenu";
import type { ThemeTokens } from "@/components/deck-player";
import { FORMAT_SIZES, PATTERNS, type Deck, type Slide, type SlideElement } from "@/lib/contracts/forge-design";
import { ChartDataEditor, TableEditor } from "./DataEditors";
import { colorTokens, ColorField, Field, NumberField, Section, SelectField, TextField, Toggle } from "./fields";
import type { Align } from "./geometry";
import { elementLabel, findElement, updateRef, type Doc, type SlideRef } from "./model";
import { patchElements, setFields, setStyle, type Recipe } from "./ops";
import { LayersPanel } from "./LayersPanel";
import { ROLE_SIZES } from "./text-style";
import { AnimationPicker, TransitionPicker } from "./pickers";
import { applyPreset, applyTransitionToAll, PRESETS, type PresetId } from "./presets";
import type { DeckLocale, DeckStringKey, DeckT } from "./strings";

export type PanelTab = "element" | "slide" | "layers" | "deck";

export type ImageTarget = { kind: "element"; id: string } | { kind: "fill"; id: string } | { kind: "background" } | { kind: "new" };

type Props = {
  doc: Doc;
  slide: Slide;
  slideRef: SlideRef;
  selection: string[];
  tokens: ThemeTokens;
  themeFile: string;
  tab: PanelTab;
  onTab: (tab: PanelTab) => void;
  run: (recipe: Recipe, key?: string) => void;
  onSelect: (ids: string[]) => void;
  onImage: (target: ImageTarget) => void;
  onGroup: () => void;
  onUngroup: (id: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onZ: (move: "front" | "forward" | "backward" | "back") => void;
  onAlign: (how: Align) => void;
  onDistribute: (axis: "x" | "y") => void;
  t: DeckT;
  locale: DeckLocale;
  readOnly?: boolean;
  /** Hides the panel; a tab on the right edge brings it back. */
  onCollapse?: () => void;
  /** Design system picker shown at the top of the Theme section. */
  designSystem?: ReactNode;
  /** Layers tab: pick elements inside a group (or the slide when null). */
  onSelectLayers?: (ids: string[], parent: string | null) => void;
  onHoverLayer?: (id: string | null) => void;
  onLayerMenu?: (at: Point, ids: string[]) => void;
};

const PRESET_LABELS: Record<PresetId, [DeckStringKey, DeckStringKey]> = {
  sober: ["presetSober", "presetSoberHint"],
  dynamic: ["presetDynamic", "presetDynamicHint"],
  elegant: ["presetElegant", "presetElegantHint"],
};

const ICON_RE = new RegExp(PATTERNS.ICON);
const COMMON_ICONS = [
  "star",
  "check",
  "circle-check",
  "arrow-right",
  "rocket",
  "lightbulb",
  "target",
  "trending-up",
  "users",
  "shield-check",
  "zap",
  "heart",
  "globe",
  "chart-bar",
  "clock",
  "mail",
  "phone",
  "map-pin",
  "settings",
  "sparkles",
];

function IconButton({ label, onClick, children, disabled, active }: { label: string; onClick: () => void; children: ReactNode; disabled?: boolean; active?: boolean }) {
  return (
    <button type="button" className={`de-icon-button${active ? " is-active" : ""}`} aria-label={label} title={label} onClick={onClick} disabled={disabled} aria-pressed={active}>
      {children}
    </button>
  );
}

export function PropertiesPanel(props: Props) {
  const { tab, onTab, selection, t } = props;
  const tabs: { id: PanelTab; label: string; disabled?: boolean }[] = [
    { id: "element", label: t("tabElement"), disabled: selection.length === 0 },
    { id: "slide", label: t("tabSlide") },
    { id: "layers", label: t("tabLayers") },
    { id: "deck", label: t("tabDeck") },
  ];
  const active = tab === "element" && selection.length === 0 ? "slide" : tab;
  return (
    <aside className="de-panel" aria-label={t("properties")}>
      <div className="de-panel-head">
      <div className="de-tabs" role="tablist">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active === item.id}
            className={`de-tab${active === item.id ? " is-active" : ""}`}
            disabled={item.disabled}
            onClick={() => onTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {props.onCollapse ? (
        <button type="button" className="de-icon-button de-panel-collapse" onClick={props.onCollapse} aria-label={t("panelCollapse")} title={t("panelCollapse")}>
          <PanelRightClose size={15} aria-hidden />
        </button>
      ) : null}
      </div>
      <div className="de-panel-body" role="tabpanel">
        {active === "element" ? (
          <ElementPanel {...props} />
        ) : active === "slide" ? (
          <SlidePanel {...props} />
        ) : active === "layers" ? (
          <LayersPanel
            slide={props.slide}
            selection={selection}
            readOnly={props.readOnly}
            run={props.run}
            onSelect={props.onSelectLayers ?? ((ids) => props.onSelect(ids))}
            onHover={props.onHoverLayer}
            onMenu={props.onLayerMenu}
            t={t}
          />
        ) : (
          <DeckPanel {...props} />
        )}
      </div>
    </aside>
  );
}

// ── element ─────────────────────────────────────────────────────────────────

function ElementPanel(props: Props) {
  const { slide, selection, run, t, locale, readOnly } = props;
  const sid = slide.id;
  const elements = selection.map((id) => findElement(slide, id)).filter((e): e is SlideElement => !!e);
  if (!elements.length) return null;
  const el = elements[0];
  const single = elements.length === 1;
  const ids = elements.map((e) => e.id);
  const set = (fields: Record<string, unknown>, key?: string) => run(setFields(sid, ids, fields), key);

  const arrange = (
    <Section title={single ? elementLabel(el) : t("multiple", { n: elements.length })}>
      <div className="de-row de-row-buttons">
        <IconButton label={t("bringFront")} onClick={() => props.onZ("front")} disabled={readOnly}>
          <ArrowUpToLine size={16} aria-hidden />
        </IconButton>
        <IconButton label={t("bringForward")} onClick={() => props.onZ("forward")} disabled={readOnly}>
          <ChevronUp size={16} aria-hidden />
        </IconButton>
        <IconButton label={t("sendBackward")} onClick={() => props.onZ("backward")} disabled={readOnly}>
          <ChevronDown size={16} aria-hidden />
        </IconButton>
        <IconButton label={t("sendBack")} onClick={() => props.onZ("back")} disabled={readOnly}>
          <ArrowDownToLine size={16} aria-hidden />
        </IconButton>
        <span className="de-row-gap" />
        <IconButton label={t("duplicate")} onClick={props.onDuplicate} disabled={readOnly}>
          <Copy size={16} aria-hidden />
        </IconButton>
        <IconButton label={t("delete")} onClick={props.onDelete} disabled={readOnly}>
          <Trash2 size={16} aria-hidden />
        </IconButton>
      </div>
      <div className="de-row de-row-buttons" role="group" aria-label={t("align")}>
        <IconButton label={t("alignLeft")} onClick={() => props.onAlign("left")} disabled={readOnly}>
          <AlignStartVertical size={16} aria-hidden />
        </IconButton>
        <IconButton label={t("alignHCenter")} onClick={() => props.onAlign("hcenter")} disabled={readOnly}>
          <AlignCenterVertical size={16} aria-hidden />
        </IconButton>
        <IconButton label={t("alignRight")} onClick={() => props.onAlign("right")} disabled={readOnly}>
          <AlignEndVertical size={16} aria-hidden />
        </IconButton>
        <IconButton label={t("alignTop")} onClick={() => props.onAlign("top")} disabled={readOnly}>
          <AlignStartHorizontal size={16} aria-hidden />
        </IconButton>
        <IconButton label={t("alignVMiddle")} onClick={() => props.onAlign("vmiddle")} disabled={readOnly}>
          <AlignCenterHorizontal size={16} aria-hidden />
        </IconButton>
        <IconButton label={t("alignBottom")} onClick={() => props.onAlign("bottom")} disabled={readOnly}>
          <AlignEndHorizontal size={16} aria-hidden />
        </IconButton>
        {elements.length >= 3 ? (
          <>
            <IconButton label={t("distributeH")} onClick={() => props.onDistribute("x")} disabled={readOnly}>
              <AlignHorizontalSpaceAround size={16} aria-hidden />
            </IconButton>
            <IconButton label={t("distributeV")} onClick={() => props.onDistribute("y")} disabled={readOnly}>
              <AlignVerticalSpaceAround size={16} aria-hidden />
            </IconButton>
          </>
        ) : null}
      </div>
      <div className="de-row de-row-buttons">
        {elements.length > 1 ? (
          <button type="button" className="de-button de-button-ghost" onClick={props.onGroup} disabled={readOnly}>
            <Group size={14} aria-hidden /> {t("group")}
          </button>
        ) : null}
        {single && el.type === "group" ? (
          <button type="button" className="de-button de-button-ghost" onClick={() => props.onUngroup(el.id)} disabled={readOnly}>
            <Ungroup size={14} aria-hidden /> {t("ungroup")}
          </button>
        ) : null}
        <IconButton label={el.locked ? t("unlock") : t("lock")} onClick={() => set({ locked: el.locked ? undefined : true })} active={!!el.locked} disabled={readOnly}>
          {el.locked ? <Lock size={16} aria-hidden /> : <Unlock size={16} aria-hidden />}
        </IconButton>
        <IconButton label={el.hidden ? t("show") : t("hide")} onClick={() => set({ hidden: el.hidden ? undefined : true })} active={!!el.hidden} disabled={readOnly}>
          {el.hidden ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
        </IconButton>
      </div>
      {single ? (
        <>
          <div className="de-row">
            <NumberField label="X" value={el.x} min={-10000} max={10000} onChange={(v) => set({ x: Math.round(v) })} disabled={readOnly} />
            <NumberField label="Y" value={el.y} min={-10000} max={10000} onChange={(v) => set({ y: Math.round(v) })} disabled={readOnly} />
          </div>
          <div className="de-row">
            <NumberField label="L" value={el.w} min={1} max={10000} onChange={(v) => set({ w: Math.max(1, Math.round(v)) })} disabled={readOnly} />
            <NumberField label="H" value={el.h} min={1} max={10000} onChange={(v) => set({ h: Math.max(1, Math.round(v)) })} disabled={readOnly} />
          </div>
          <div className="de-row">
            <NumberField label={t("rotation")} value={el.rotation ?? 0} min={-360} max={360} suffix="°" onChange={(v) => set({ rotation: v ? v : undefined })} disabled={readOnly} />
            <NumberField
              label={t("opacity")}
              value={Math.round((el.opacity ?? 1) * 100)}
              min={0}
              max={100}
              suffix="%"
              onChange={(v) => set({ opacity: v >= 100 ? undefined : Math.round(v) / 100 })}
              disabled={readOnly}
            />
          </div>
        </>
      ) : null}
    </Section>
  );

  return (
    <>
      {arrange}
      {single ? <TypeSection {...props} el={el} /> : null}
      {single ? (
        <Section title={t("animation")}>
          <AnimationPicker value={el.animation} onChange={(animation) => set({ animation })} t={t} locale={locale} disabled={readOnly} />
        </Section>
      ) : null}
      {single ? (
        <Section title={t("name")}>
          <TextField label={t("name")} value={el.name ?? ""} maxLength={120} onChange={(v) => set({ name: v.trim() || undefined })} />
          <TextField
            label={t("link")}
            value={el.link ?? ""}
            placeholder="https://"
            onChange={(v) => {
              const value = v.trim();
              if (!value) set({ link: undefined });
              else if (/^https:\/\//.test(value)) set({ link: value.slice(0, 2000) });
            }}
          />
          <TextField
            label={t("matchKey")}
            value={el.matchKey ?? ""}
            hint={t("matchKeyHint")}
            onChange={(v) => {
              const value = v.trim();
              if (!value) set({ matchKey: undefined });
              else if (new RegExp(PATTERNS.ID).test(value)) set({ matchKey: value });
            }}
          />
        </Section>
      ) : null}
      {single ? (
        <p className="de-hint">{t("shortcuts")}</p>
      ) : null}
    </>
  );
}

const ROLES = [
  ["title", "roleTitle"],
  ["subtitle", "roleSubtitle"],
  ["heading", "roleHeading"],
  ["body", "roleBody"],
  ["quote", "roleQuote"],
  ["caption", "roleCaption"],
  ["label", "roleLabel"],
] as const;

/** Text roles as tiles: a sample at the role's relative size, its name and its size on the slide. */
function RolePicker({
  value,
  tokens,
  disabled,
  t,
  onChange,
}: {
  value?: string;
  tokens: ThemeTokens;
  disabled?: boolean;
  t: DeckT;
  onChange: (role: string | undefined) => void;
}) {
  return (
    <div className="de-field">
      <span className="de-field-label">{t("role")}</span>
      <div className="de-roles" role="radiogroup" aria-label={t("role")}>
        {ROLES.map(([role, label]) => {
          const size = ROLE_SIZES[role] ?? 32;
          const display = role === "title" || role === "heading" || role === "subtitle";
          return (
            <button
              key={role}
              type="button"
              role="radio"
              aria-checked={value === role}
              className={`de-role${value === role ? " is-active" : ""}`}
              disabled={disabled}
              onClick={() => onChange(role)}
              title={`${t(label)} · ${size} px`}
            >
              <span
                className="de-role-sample"
                aria-hidden
                style={{
                  fontFamily: tokens[display ? "--font-display" : "--font-body"],
                  fontSize: Math.max(10, Math.round(size / 3.4)),
                  fontWeight: role === "title" || role === "heading" ? 700 : role === "label" ? 600 : 400,
                  fontStyle: role === "quote" ? "italic" : undefined,
                  textTransform: role === "label" ? "uppercase" : undefined,
                  letterSpacing: role === "label" ? "0.08em" : undefined,
                }}
              >
                {role === "quote" ? "“Aa”" : "Aa"}
              </span>
              <span className="de-role-name">{t(label)}</span>
              <span className="de-role-size">{size} px</span>
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={!value}
          className={`de-role de-role-free${!value ? " is-active" : ""}`}
          disabled={disabled}
          onClick={() => onChange(undefined)}
        >
          <span className="de-role-name">{t("roleNone")}</span>
        </button>
      </div>
    </div>
  );
}

function TypeSection(props: Props & { el: SlideElement }) {
  const { el, slide, run, tokens, t, readOnly } = props;
  const sid = slide.id;
  const set = (fields: Record<string, unknown>, key?: string) => run(setFields(sid, [el.id], fields), key);
  switch (el.type) {
    case "text":
      return (
        <Section title={t("style")}>
          <RolePicker value={el.role} tokens={tokens} disabled={readOnly} t={t} onChange={(role) => set({ role })} />
          <ColorField label={t("color")} value={el.style?.color} tokens={tokens} t={t} onChange={(color) => run(setStyle(sid, [el.id], { color }))} />
          <div className="de-row">
            <NumberField label={t("weight")} value={el.style?.weight ?? 400} min={100} max={900} step={100} onChange={(v) => run(setStyle(sid, [el.id], { weight: Math.round(v / 100) * 100 }))} disabled={readOnly} />
            <NumberField label={t("letterSpacing")} value={el.style?.letterSpacing ?? 0} min={-20} max={100} step={0.5} onChange={(v) => run(setStyle(sid, [el.id], { letterSpacing: v || undefined }))} disabled={readOnly} />
          </div>
          <SelectField
            label={t("valign")}
            value={el.style?.valign ?? ""}
            options={[
              { value: "", label: t("alignTop") },
              { value: "middle", label: t("alignVMiddle") },
              { value: "bottom", label: t("alignBottom") },
            ]}
            onChange={(v) => run(setStyle(sid, [el.id], { valign: v || undefined }))}
            disabled={readOnly}
          />
          <Toggle label={t("uppercase")} checked={!!el.style?.uppercase} onChange={(v) => run(setStyle(sid, [el.id], { uppercase: v }))} />
        </Section>
      );
    case "shape":
      return (
        <Section title={t("style")}>
          <SelectField
            label={t("shape")}
            value={el.shape}
            options={[
              { value: "rect", label: t("shapeRect") },
              { value: "ellipse", label: t("shapeEllipse") },
              { value: "line", label: t("shapeLine") },
              { value: "arrow", label: t("shapeArrow") },
            ]}
            onChange={(v) => v && set({ shape: v })}
            disabled={readOnly}
          />
          <ColorField label={t("fill")} value={el.fill} tokens={tokens} t={t} allowNone onChange={(fill) => set({ fill })} />
          <ColorField label={t("stroke")} value={el.stroke} tokens={tokens} t={t} allowNone onChange={(stroke) => set({ stroke })} />
          <div className="de-row">
            <NumberField label={t("strokeWidth")} value={el.strokeWidth ?? 0} min={0} max={200} onChange={(v) => set({ strokeWidth: v || undefined })} disabled={readOnly} />
            <NumberField label={t("radius")} value={el.radius ?? 0} min={0} max={2000} onChange={(v) => set({ radius: v || undefined })} disabled={readOnly} />
          </div>
          {el.shape === "rect" || el.shape === "ellipse" ? (
            <button type="button" className="de-button de-button-ghost" onClick={() => props.onImage({ kind: "fill", id: el.id })} disabled={readOnly}>
              <ImageIcon size={14} aria-hidden /> {t("fillWithImage")}
            </button>
          ) : null}
        </Section>
      );
    case "image":
      return (
        <Section title={t("image")}>
          <button type="button" className="de-button" onClick={() => props.onImage({ kind: "element", id: el.id })} disabled={readOnly}>
            <ImageIcon size={14} aria-hidden /> {t("replaceImage")}
          </button>
          <SelectField
            label={t("fit")}
            value={el.fit ?? "cover"}
            options={[
              { value: "cover", label: t("fitCover") },
              { value: "contain", label: t("fitContain") },
              { value: "fill", label: t("fitFill") },
            ]}
            onChange={(v) => set({ fit: v || undefined })}
            disabled={readOnly}
          />
          <NumberField label={t("radius")} value={el.radius ?? 0} min={0} max={2000} onChange={(v) => set({ radius: v || undefined })} disabled={readOnly} />
          <TextField label={t("alt")} value={el.alt ?? ""} maxLength={300} onChange={(v) => set({ alt: v.trim() || undefined })} />
          {el.credit ? (
            <p className="de-hint">
              {t("credit")}: {[el.credit.author, el.credit.source].filter(Boolean).join(" / ")}
            </p>
          ) : null}
        </Section>
      );
    case "icon":
      return (
        <Section title={t("icon")}>
          <TextField
            label={t("iconName")}
            value={el.icon}
            onChange={(v) => {
              const value = v.trim().toLowerCase();
              if (ICON_RE.test(value) && value.length <= 64) set({ icon: value });
            }}
          />
          <div className="de-chips">
            {COMMON_ICONS.map((name) => (
              <button key={name} type="button" className={`de-chip${el.icon === name ? " is-active" : ""}`} onClick={() => set({ icon: name })} disabled={readOnly}>
                {name}
              </button>
            ))}
          </div>
          <ColorField label={t("color")} value={el.color} tokens={tokens} t={t} onChange={(color) => set({ color })} />
          <NumberField label={t("strokeWidth")} value={el.strokeWidth ?? 2} min={0.5} max={4} step={0.25} onChange={(v) => set({ strokeWidth: v })} disabled={readOnly} />
        </Section>
      );
    case "chart":
      return (
        <Section title={t("chart")}>
          <SelectField
            label={t("chartKind")}
            value={el.chart}
            options={[
              { value: "bar", label: t("chartBar") },
              { value: "line", label: t("chartLine") },
              { value: "pie", label: t("chartPie") },
            ]}
            onChange={(v) => v && set({ chart: v })}
            disabled={readOnly}
          />
          <div className="de-row">
            <Toggle label={t("stacked")} checked={!!el.options?.stacked} onChange={(v) => set({ options: { ...(el.options ?? {}), stacked: v || undefined } })} />
            <Toggle label={t("legend")} checked={!!el.options?.legend} onChange={(v) => set({ options: { ...(el.options ?? {}), legend: v } })} />
            <Toggle label={t("showValues")} checked={!!el.options?.values} onChange={(v) => set({ options: { ...(el.options ?? {}), values: v } })} />
          </div>
          <Field label={t("chartData")}>
            <ChartDataEditor data={el.data} onChange={(data) => set({ data }, `chart:${el.id}`)} t={t} disabled={readOnly} />
          </Field>
          {el.data.series.map((series, i) => (
            <ColorField
              key={i}
              label={series.name}
              value={series.color}
              tokens={tokens}
              t={t}
              allowNone
              onChange={(color) =>
                set({
                  data: { ...el.data, series: el.data.series.map((s, j) => (j === i ? { ...s, color } : s)) },
                })
              }
            />
          ))}
        </Section>
      );
    case "table":
      return (
        <Section title={t("table")}>
          <Toggle label={t("headerRow")} checked={!!el.headerRow} onChange={(v) => set({ headerRow: v || undefined })} />
          <TableEditor
            rows={el.rows}
            t={t}
            disabled={readOnly}
            onChange={(rows) => {
              const sameColumns = rows[0]?.length === el.rows[0]?.length;
              set({ rows, columnWidths: sameColumns ? el.columnWidths : undefined }, `table:${el.id}`);
            }}
          />
          <NumberField label={t("size")} value={el.style?.size ?? 28} min={6} max={200} onChange={(v) => run(setStyle(sid, [el.id], { size: v }))} disabled={readOnly} />
          <ColorField label={t("color")} value={el.style?.color} tokens={tokens} t={t} allowNone onChange={(color) => run(setStyle(sid, [el.id], { color }))} />
          <ColorField label={t("headerFill")} value={el.style?.headerFill} tokens={tokens} t={t} allowNone onChange={(headerFill) => run(setStyle(sid, [el.id], { headerFill }))} />
          <ColorField label={t("border")} value={el.style?.border} tokens={tokens} t={t} allowNone onChange={(border) => run(setStyle(sid, [el.id], { border }))} />
        </Section>
      );
    case "video":
      return (
        <Section title={t("video")}>
          <TextField
            label={t("videoUrl")}
            value={el.url}
            onChange={(v) => {
              const value = v.trim();
              if (/^https:\/\//.test(value)) set({ url: value.slice(0, 2000) });
            }}
          />
          <Toggle label={t("autoplay")} checked={!!el.autoplay} onChange={(v) => set({ autoplay: v || undefined })} />
          <Toggle label={t("muted")} checked={!!el.muted} onChange={(v) => set({ muted: v || undefined })} />
        </Section>
      );
    case "code":
      return (
        <Section title={t("code")}>
          <TextField
            label={t("language")}
            value={el.language ?? ""}
            onChange={(v) => {
              const value = v.trim().toLowerCase();
              if (!value) set({ language: undefined });
              else if (new RegExp(PATTERNS.LANGUAGE).test(value)) set({ language: value });
            }}
          />
          <TextField label={t("code")} value={el.code} multiline maxLength={20000} onChange={(code) => set({ code })} />
          <div className="de-row">
            <NumberField label={t("size")} value={el.size ?? 24} min={6} max={200} onChange={(v) => set({ size: v })} disabled={readOnly} />
            <Toggle label={t("lineNumbers")} checked={!!el.lineNumbers} onChange={(v) => set({ lineNumbers: v || undefined })} />
          </div>
          <TextField
            label={t("highlight")}
            value={el.highlight ?? ""}
            onChange={(v) => {
              const value = v.replace(/\s+/g, "");
              if (!value) set({ highlight: undefined });
              else if (new RegExp(PATTERNS.HIGHLIGHT).test(value)) set({ highlight: value });
            }}
          />
        </Section>
      );
    default:
      return null;
  }
}

// ── slide ───────────────────────────────────────────────────────────────────

function SlidePanel(props: Props) {
  const { slide, slideRef, tokens, run, t, locale, readOnly } = props;
  const sid = slide.id;
  const bg = slide.background;
  const setBackground = (background: Slide["background"]) =>
    run((d) => ({ ...d, slides: { ...d.slides, [sid]: background ? { ...d.slides[sid], background } : withoutBackground(d.slides[sid]) } }));
  const swatches = colorTokens(tokens);
  return (
    <>
      <Section title={t("background")}>
        <div className="de-segmented" role="radiogroup" aria-label={t("background")}>
          {(["color", "gradient", "image"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={(bg?.type ?? "color") === kind}
              className={(bg?.type ?? "color") === kind ? "is-active" : ""}
              disabled={readOnly}
              onClick={() => {
                if (kind === "color") setBackground({ type: "color", token: "--bg" });
                if (kind === "gradient") setBackground({ type: "gradient", angle: 135, stops: [{ color: swatches[2]?.name ?? "--accent", at: 0 }, { color: "--bg", at: 1 }] });
                if (kind === "image") props.onImage({ kind: "background" });
              }}
            >
              {kind === "color" ? t("bgColor") : kind === "gradient" ? t("bgGradient") : t("bgImage")}
            </button>
          ))}
        </div>
        {!bg || bg.type === "color" ? (
          <ColorField label={t("bgColor")} value={bg?.token ?? "--bg"} tokens={tokens} t={t} onChange={(token) => setBackground({ type: "color", token: token ?? "--bg" })} />
        ) : null}
        {bg?.type === "gradient" ? (
          <>
            <NumberField label={t("angle")} value={bg.angle ?? 180} min={0} max={360} suffix="°" onChange={(angle) => setBackground({ ...bg, angle })} disabled={readOnly} />
            {bg.stops.map((stop, i) => (
              <ColorField
                key={i}
                label={`${t("bgColor")} ${i + 1}`}
                value={stop.color}
                tokens={tokens}
                t={t}
                onChange={(color) => color && setBackground({ ...bg, stops: bg.stops.map((s, j) => (j === i ? { ...s, color } : s)) })}
              />
            ))}
          </>
        ) : null}
        {bg?.type === "image" ? (
          <>
            <button type="button" className="de-button" onClick={() => props.onImage({ kind: "background" })} disabled={readOnly}>
              <ImageIcon size={14} aria-hidden /> {t("replaceImage")}
            </button>
            <SelectField
              label={t("fit")}
              value={bg.fit ?? "cover"}
              options={[
                { value: "cover", label: t("fitCover") },
                { value: "contain", label: t("fitContain") },
                { value: "fill", label: t("fitFill") },
              ]}
              onChange={(fit) => setBackground({ ...bg, fit: (fit || undefined) as typeof bg.fit })}
              disabled={readOnly}
            />
            <ColorField label={t("overlay")} value={bg.overlay} tokens={tokens} t={t} allowNone onChange={(overlay) => setBackground({ ...bg, overlay })} />
            {bg.overlay ? (
              <NumberField
                label={t("overlayOpacity")}
                value={Math.round((bg.overlayOpacity ?? 0.5) * 100)}
                min={0}
                max={100}
                suffix="%"
                onChange={(v) => setBackground({ ...bg, overlayOpacity: Math.round(v) / 100 })}
                disabled={readOnly}
              />
            ) : null}
          </>
        ) : null}
      </Section>
      <Section title={t("transition")}>
        <TransitionPicker
          value={slideRef.transition}
          t={t}
          locale={locale}
          disabled={readOnly}
          onChange={(transition) =>
            run((d) =>
              updateRef(d, slideRef.id, (ref) => {
                const next = { ...ref };
                if (transition) next.transition = transition;
                else delete next.transition;
                return next;
              }),
            )
          }
          onApplyAll={() => run((d) => applyTransitionToAll(d, d.deck.slides.find((r) => r.id === slideRef.id)?.transition))}
        />
      </Section>
      <Section title={t("presets")}>
        <div className="de-presets">
          {PRESETS.map((preset) => (
            <button key={preset} type="button" className="de-preset" data-preset={preset} disabled={readOnly} onClick={() => run((d) => applyPreset(d, preset))}>
              <strong>{t(PRESET_LABELS[preset][0])}</strong>
              <span>{t(PRESET_LABELS[preset][1])}</span>
            </button>
          ))}
        </div>
      </Section>
    </>
  );
}

function withoutBackground(slide: Slide): Slide {
  const next = { ...slide };
  delete next.background;
  return next;
}

// ── deck ────────────────────────────────────────────────────────────────────

function DeckPanel(props: Props) {
  const { doc, run, tokens, themeFile, t, readOnly } = props;
  const deck = doc.deck;
  const colors = colorTokens(tokens);
  const fonts = Object.entries(tokens).filter(([k]) => k.startsWith("--font-"));
  const others = Object.entries(tokens).filter(([k]) => !k.startsWith("--font-") && !colors.some((c) => c.name === k));
  return (
    <>
      <Section title={t("deckSettings")}>
        <TextField
          label={t("title")}
          value={deck.title ?? ""}
          maxLength={200}
          onChange={(v) => run((d) => ({ ...d, deck: v.trim() ? { ...d.deck, title: v.trim() } : withoutTitle(d.deck) }))}
        />
        <SelectField
          label={t("format")}
          value={deck.format.ratio}
          options={[
            { value: "16:9", label: t("format169") },
            { value: "4:3", label: t("format43") },
            { value: "1:1", label: t("format11") },
          ]}
          disabled={readOnly}
          onChange={(ratio) => {
            if (!ratio) return;
            const size = FORMAT_SIZES[ratio];
            run((d) => ({ ...d, deck: { ...d.deck, format: { ratio, ...size } as Deck["format"] } }));
          }}
        />
        <p className="de-hint">{t("formatHint")}</p>
      </Section>
      <Section title={t("theme")}>
        {props.designSystem}
        <p className="de-hint">{t("themeHint", { file: themeFile })}</p>
        <h4 className="de-subhead">{t("tokenColors")}</h4>
        <ul className="de-tokens">
          {colors.map((c) => (
            <li key={c.name}>
              <span className="de-swatch de-swatch-sm" style={{ background: c.value }} aria-hidden />
              <code>{c.name}</code>
              <span>{c.value}</span>
            </li>
          ))}
        </ul>
        <h4 className="de-subhead">{t("tokenFonts")}</h4>
        <ul className="de-tokens">
          {fonts.map(([name, value]) => (
            <li key={name}>
              <code>{name}</code>
              <span style={{ fontFamily: value }}>{value}</span>
            </li>
          ))}
        </ul>
        {others.length ? (
          <details>
            <summary>{t("tokenOther")}</summary>
            <ul className="de-tokens">
              {others.map(([name, value]) => (
                <li key={name}>
                  <code>{name}</code>
                  <span>{value}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </Section>
    </>
  );
}

function withoutTitle(deck: Deck): Deck {
  const next = { ...deck };
  delete next.title;
  return next;
}

/** Recipe to replace one element's chart data (exported for tests). */
export function setChartData(slideId: string, id: string, data: Extract<SlideElement, { type: "chart" }>["data"]): Recipe {
  return patchElements(slideId, [id], (el) => (el.type === "chart" ? { ...el, data } : el));
}
