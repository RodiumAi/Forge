"use client";

/**
 * "Import slides" dialog: the slides of a converted PowerPoint file as
 * thumbnails, each with a checkbox, and whether to keep the file's own
 * colours. What is picked goes back to the editor, which inserts it.
 */

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { canvasSize, SlideView, type AssetUrl, type ThemeTokens } from "@/components/deck-player";
import type { Deck, Slide } from "@/lib/contracts/forge-design";
import { pickedSlides, selectAll, toDeckTheme, toggleSlide, warningTotals, type ImportedSlide, type SlideImport } from "./slide-import";
import type { DeckStringKey, DeckT } from "./strings";

export type SlideImportState =
  | { status: "reading"; name: string }
  | { status: "error"; name: string; message: string }
  | { status: "ready"; name: string; result: SlideImport };

const THUMB_WIDTH = 220;

const ImportThumb = memo(function ImportThumb({ slide, deck, tokens, assetUrl }: { slide: Slide; deck: Deck; tokens: ThemeTokens; assetUrl: AssetUrl }) {
  const size = canvasSize(deck);
  return <SlideView slide={slide} deck={deck} tokens={tokens} mode="thumbnail" scale={THUMB_WIDTH / size.width} assetUrl={assetUrl} />;
});

export function SlideImportDialog({
  state,
  deck,
  tokens,
  assetUrl,
  t,
  onCancel,
  onImport,
}: {
  state: SlideImportState;
  deck: Deck;
  tokens: ThemeTokens;
  assetUrl: AssetUrl;
  t: DeckT;
  onCancel: () => void;
  onImport: (picks: ImportedSlide[], keepTheme: boolean) => void;
}) {
  const slides = useMemo(() => (state.status === "ready" ? state.result.slides : []), [state]);
  const [selection, setSelection] = useState<Set<number>>(() => selectAll(slides));
  const [keepTheme, setKeepTheme] = useState(true);
  useEffect(() => setSelection(selectAll(slides)), [slides]);
  const themed = useMemo(() => (keepTheme ? null : new Map(slides.map((s) => [s.index, toDeckTheme(s.slide)]))), [keepTheme, slides]);
  const picks = pickedSlides(slides, selection);
  const warnings = warningTotals(picks);

  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>("input, button")?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") cancelRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.status]);

  const size = canvasSize(deck);
  return (
    <div className="de-modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="de-modal de-import" role="dialog" aria-modal="true" aria-labelledby="de-import-title" ref={dialogRef}>
        <header className="de-import-head">
          <h2 id="de-import-title">{t("importTitle")}</h2>
          <p className="de-import-file">{t("importFrom", { name: state.name })}</p>
        </header>

        {state.status === "reading" ? (
          <p className="de-import-status" role="status">
            <Loader2 size={16} className="de-spin" aria-hidden /> {t("importReading", { name: state.name })}
          </p>
        ) : state.status === "error" ? (
          <p className="de-import-status is-error" role="alert">
            <AlertTriangle size={16} aria-hidden /> {state.message}
          </p>
        ) : slides.length === 0 ? (
          <p className="de-import-status">{t("importEmpty")}</p>
        ) : (
          <>
            <div className="de-import-bar">
              <span className="de-import-count" aria-live="polite">
                {t("importCount", { n: picks.length, total: slides.length })}
              </span>
              <button type="button" className="de-button de-button-ghost" onClick={() => setSelection(selectAll(slides))} disabled={picks.length === slides.length}>
                {t("selectAll")}
              </button>
              <button type="button" className="de-button de-button-ghost" onClick={() => setSelection(new Set())} disabled={picks.length === 0}>
                {t("importClear")}
              </button>
            </div>
            <ul className="de-import-grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${THUMB_WIDTH + 16}px, 1fr))` }}>
              {slides.map((s) => {
                const checked = selection.has(s.index);
                const label = t("importSlideLabel", { n: s.index, title: s.title || "" }).replace(/[:\s]+$/, "");
                return (
                  <li key={s.index}>
                    <label className={`de-import-item${checked ? " is-checked" : ""}`}>
                      <input type="checkbox" checked={checked} onChange={() => setSelection((prev) => toggleSlide(prev, s.index))} aria-label={label} />
                      <span className="de-import-thumb" style={{ width: THUMB_WIDTH, height: (THUMB_WIDTH * size.height) / size.width }}>
                        <ImportThumb slide={themed?.get(s.index) ?? s.slide} deck={deck} tokens={tokens} assetUrl={assetUrl} />
                        <span className="de-import-check" aria-hidden>
                          {checked ? <Check size={14} /> : null}
                        </span>
                      </span>
                      <span className="de-import-caption">
                        <span className="de-import-n">{s.index}</span>
                        <span className="de-import-title">{s.title}</span>
                        {s.hidden ? <span className="de-import-hidden">{t("importHidden")}</span> : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <label className="de-import-theme">
              <input type="checkbox" checked={keepTheme} onChange={(e) => setKeepTheme(e.target.checked)} />
              <span>
                {t("importKeepTheme")}
                <small>{t("importKeepThemeHint")}</small>
              </span>
            </label>
            {warnings.length ? (
              <div className="de-import-warnings">
                <p>{t("importWarnings")}</p>
                <ul>
                  {warnings.map(([code, n]) => (
                    <li key={code}>{t(`importWarn_${code}` as DeckStringKey, { n }) || code}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}

        <div className="de-row">
          <button type="button" className="de-button" onClick={onCancel}>
            {t("cancel")}
          </button>
          <button type="button" className="de-button de-button-primary" disabled={state.status !== "ready" || picks.length === 0} onClick={() => onImport(picks, keepTheme)}>
            {t("importRun")}
          </button>
        </div>
      </div>
    </div>
  );
}
