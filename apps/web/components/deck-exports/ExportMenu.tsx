"use client";

/**
 * Export menu of a slides project: PDF (optionally one page per animation
 * step), PNG (zip), PPTX (editable) and HTML (single file, offline), with the
 * plan gates of `lib/deck-exports.ts`. Formats the plan does not include show
 * the plan that unlocks them and call `onUpgrade` instead of exporting.
 *
 * Self-contained (own labels, inline styles) so the deck editor can mount it
 * anywhere: `<ExportMenu projectId={id} projectName={name} />`.
 */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Download, FileImage, FileText, Globe, Loader2, Lock, Presentation } from "lucide-react";

import { useI18n } from "@/lib/i18n/I18nProvider";
import { useForgeStatus, type ForgeStatus } from "@/lib/forge-status";
import {
  DECK_EXPORT_FORMATS,
  DeckExportError,
  deckExportAllowed,
  downloadBlob,
  exportDeck,
  REQUIRED_PLAN,
  type DeckExportFormat,
  type DeckExportWarning,
  warningText,
} from "@/lib/deck-exports";

const LABELS = {
  fr: {
    export: "Exporter",
    pdf: "PDF",
    pdfHint: "Une page par slide, texte vectoriel",
    png: "Images PNG",
    pngHint: "Une image par slide (ZIP)",
    pptx: "PowerPoint",
    pptxHint: "Fichier modifiable, notes et transitions",
    html: "Page HTML",
    htmlHint: "Un seul fichier, fonctionne hors ligne",
    steps: "Une page par étape d'animation",
    notes: "Inclure les notes du présentateur",
    working: "Export en cours…",
    done: "Export téléchargé.",
    failed: "L'export a échoué.",
    upgrade: (plan: string) => `Disponible avec le plan ${plan}`,
    warnings: "À savoir",
    close: "Fermer",
  },
  en: {
    export: "Export",
    pdf: "PDF",
    pdfHint: "One page per slide, vector text",
    png: "PNG images",
    pngHint: "One image per slide (ZIP)",
    pptx: "PowerPoint",
    pptxHint: "Editable file, notes and transitions",
    html: "HTML page",
    htmlHint: "One file, works offline",
    steps: "One page per animation step",
    notes: "Include speaker notes",
    working: "Exporting…",
    done: "Export downloaded.",
    failed: "The export failed.",
    upgrade: (plan: string) => `Available on the ${plan} plan`,
    warnings: "Good to know",
    close: "Close",
  },
} as const;

const PLAN_NAMES: Record<string, string> = { starter: "Starter", builder: "Builder" };
const ICONS: Record<DeckExportFormat, typeof FileText> = { pdf: FileText, png: FileImage, pptx: Presentation, html: Globe };

export type ExportMenuProps = {
  projectId: string;
  /** Fallback file name when the API sends none. */
  projectName?: string;
  /** Plan status; read from the shared Forge status cache when omitted. */
  status?: ForgeStatus | null;
  /** Called instead of exporting when the plan lacks the format. */
  onUpgrade?: (requiredPlan: "starter" | "builder", format: DeckExportFormat) => void;
  /** Called after a successful download, with the API's warnings. */
  onExported?: (format: DeckExportFormat, warnings: DeckExportWarning[]) => void;
  className?: string;
  style?: CSSProperties;
};

const panel: CSSProperties = {
  position: "absolute",
  right: 0,
  top: "calc(100% + 6px)",
  zIndex: 50,
  width: 300,
  padding: 8,
  borderRadius: "var(--radius-surface, 12px)",
  background: "var(--bg-elevated, #151922)",
  color: "var(--fg, #F5F7FA)",
  border: "1px solid var(--border, #2A3140)",
  boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
  font: "14px/1.4 var(--font-body, system-ui, sans-serif)",
};

const itemStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  width: "100%",
  padding: "8px 10px",
  border: 0,
  borderRadius: 8,
  background: "transparent",
  color: "inherit",
  textAlign: "left",
  font: "inherit",
  cursor: "pointer",
};

export function ExportMenu({ projectId, projectName, status: statusProp, onUpgrade, onExported, className, style }: ExportMenuProps) {
  const { locale } = useI18n();
  const t = LABELS[locale === "en" ? "en" : "fr"];
  const shared = useForgeStatus();
  const status = statusProp === undefined ? shared : statusProp;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<DeckExportFormat | null>(null);
  const [steps, setSteps] = useState(false);
  const [notes, setNotes] = useState(true);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [warnings, setWarnings] = useState<DeckExportWarning[]>([]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (busy) return;
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, busy]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function run(format: DeckExportFormat) {
    if (busy) return;
    if (!deckExportAllowed(status, format)) {
      onUpgrade?.(REQUIRED_PLAN[format], format);
      setMessage({ kind: "error", text: t.upgrade(PLAN_NAMES[REQUIRED_PLAN[format]]) });
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(format);
    setMessage(null);
    setWarnings([]);
    try {
      const options = format === "pdf" ? { steps } : format === "pptx" || format === "html" ? { notes } : {};
      const result = await exportDeck(projectId, format, options, { signal: controller.signal, fallbackName: projectName });
      downloadBlob(result.blob, result.filename);
      setWarnings(result.warnings);
      setMessage({ kind: "ok", text: t.done });
      onExported?.(format, result.warnings);
    } catch (err) {
      if (err instanceof DeckExportError && err.upgradeRequired) {
        const plan = err.requiredPlan ?? REQUIRED_PLAN[format];
        onUpgrade?.(plan, format);
        setMessage({ kind: "error", text: t.upgrade(PLAN_NAMES[plan]) });
      } else {
        setMessage({ kind: "error", text: err instanceof Error && err.message ? err.message : t.failed });
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setBusy(null);
    }
  }

  const hints: Record<DeckExportFormat, string> = { pdf: t.pdfHint, png: t.pngHint, pptx: t.pptxHint, html: t.htmlHint };
  const names: Record<DeckExportFormat, string> = { pdf: t.pdf, png: t.png, pptx: t.pptx, html: t.html };

  return (
    <div ref={rootRef} className={className} style={{ position: "relative", display: "inline-block", ...style }} data-deck-export-menu="">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="btn btn-ghost"
        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
      >
        {busy ? <Loader2 size={16} className="agent-spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
        {busy ? t.working : t.export}
      </button>
      {open && (
        <div role="menu" style={panel}>
          {DECK_EXPORT_FORMATS.map((format) => {
            const Icon = ICONS[format];
            const allowed = deckExportAllowed(status, format);
            return (
              <div key={format}>
                <button
                  type="button"
                  role="menuitem"
                  style={{ ...itemStyle, opacity: busy && busy !== format ? 0.5 : 1 }}
                  disabled={!!busy}
                  onClick={() => run(format)}
                  data-format={format}
                  data-locked={allowed ? undefined : ""}
                >
                  <Icon size={18} aria-hidden="true" style={{ flex: "none", marginTop: 1 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ display: "block", fontWeight: 600 }}>{names[format]}</strong>
                    <span style={{ display: "block", color: "var(--muted, #8B93A7)", fontSize: 12 }}>
                      {allowed ? hints[format] : t.upgrade(PLAN_NAMES[REQUIRED_PLAN[format]])}
                    </span>
                  </span>
                  {busy === format ? (
                    <Loader2 size={16} className="agent-spin" aria-hidden="true" />
                  ) : !allowed ? (
                    <Lock size={14} aria-hidden="true" style={{ color: "var(--muted, #8B93A7)" }} />
                  ) : null}
                </button>
                {format === "pdf" && allowed && (
                  <label style={{ display: "flex", gap: 8, alignItems: "center", padding: "0 10px 6px 38px", fontSize: 12 }}>
                    <input type="checkbox" checked={steps} onChange={(e) => setSteps(e.target.checked)} disabled={!!busy} />
                    {t.steps}
                  </label>
                )}
              </div>
            );
          })}
          {(deckExportAllowed(status, "pptx") || deckExportAllowed(status, "html")) && (
            <label style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 10px", fontSize: 12, borderTop: "1px solid var(--border, #2A3140)" }}>
              <input type="checkbox" checked={notes} onChange={(e) => setNotes(e.target.checked)} disabled={!!busy} />
              {t.notes}
            </label>
          )}
          {message && (
            <p role="status" style={{ margin: "6px 10px", fontSize: 12, color: message.kind === "ok" ? "var(--home-ok-text, #34D399)" : "var(--danger, #F87171)" }}>
              {message.text}
            </p>
          )}
          {warnings.length > 0 && (
            <div style={{ margin: "4px 10px 6px", fontSize: 12 }} data-export-warnings="">
              <strong style={{ display: "block", marginBottom: 2 }}>{t.warnings}</strong>
              <ul style={{ margin: 0, paddingLeft: 16, color: "var(--muted, #8B93A7)" }}>
                {warnings.map((w, i) => (
                  <li key={`${w.code}-${i}`}>{warningText(w, locale === "en" ? "en" : "fr")}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ExportMenu;
