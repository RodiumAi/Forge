"use client";

/**
 * Left column: slide thumbnails. Click selects (and targets the slide for
 * the AI), drag and drop or Alt+Arrow reorders, the menu duplicates, hides
 * or deletes, and "Add a slide" opens the layout picker.
 */

import { memo, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { AlertTriangle, Copy, EyeOff, Eye, MoreHorizontal, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { canvasSize, SlideView, type AssetUrl, type ThemeTokens } from "@/components/deck-player";
import type { Deck, Slide } from "@/lib/contracts/forge-design";
import type { SlideNotice } from "./ai";
import { LAYOUT_NAMES, slideFromLayout, type LayoutName } from "./layouts";
import { copyFor, LAYOUT_LABEL, type DeckLocale, type DeckT } from "./strings";

const THUMB_WIDTH = 168;

const Thumb = memo(function Thumb({ slide, deck, tokens, assetUrl }: { slide: Slide; deck: Deck; tokens: ThemeTokens; assetUrl: AssetUrl }) {
  const size = canvasSize(deck);
  return <SlideView slide={slide} deck={deck} tokens={tokens} mode="thumbnail" scale={THUMB_WIDTH / size.width} assetUrl={assetUrl} />;
});

export function LayoutPicker({
  deck,
  tokens,
  assetUrl,
  locale,
  t,
  onPick,
  onClose,
}: {
  deck: Deck;
  tokens: ThemeTokens;
  assetUrl: AssetUrl;
  locale: DeckLocale;
  t: DeckT;
  onPick: (layout: LayoutName | null) => void;
  onClose: () => void;
}) {
  const previews = useMemo(
    () => LAYOUT_NAMES.map((name) => ({ name, slide: slideFromLayout(`preview-${name}`, name, deck.format.ratio, copyFor(locale)) })),
    [deck.format.ratio, locale],
  );
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const size = canvasSize(deck);
  return (
    <div className="de-layout-picker" role="dialog" aria-label={t("chooseLayout")} ref={ref}>
      <header>
        <strong>{t("chooseLayout")}</strong>
      </header>
      <div className="de-layout-grid">
        {previews.map(({ name, slide }) => (
          <button key={name} type="button" className="de-layout-item" onClick={() => onPick(name)} data-layout={name}>
            <SlideView slide={slide} deck={deck} tokens={tokens} mode="thumbnail" scale={132 / size.width} assetUrl={assetUrl} />
            <span>{t(LAYOUT_LABEL[name])}</span>
          </button>
        ))}
        <button type="button" className="de-layout-item" onClick={() => onPick(null)} data-layout="blank">
          <span className="de-layout-blank" style={{ aspectRatio: `${size.width} / ${size.height}` }} />
          <span>{t("layoutBlank")}</span>
        </button>
      </div>
    </div>
  );
}

export function SlideRail({
  deck,
  slides,
  currentId,
  slideSelected,
  tokens,
  assetUrl,
  notices,
  readOnly,
  locale,
  t,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
  onToggleHidden,
  onAdd,
}: {
  deck: Deck;
  slides: Record<string, Slide>;
  currentId: string | null;
  slideSelected: boolean;
  tokens: ThemeTokens;
  assetUrl: AssetUrl;
  notices: SlideNotice[];
  readOnly?: boolean;
  locale: DeckLocale;
  t: DeckT;
  onSelect: (id: string) => void;
  onMove: (from: number, to: number) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleHidden: (id: string) => void;
  onAdd: (layout: LayoutName | null, index: number) => void;
}) {
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const currentIndex = deck.slides.findIndex((ref) => ref.id === currentId);

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, index: number, id: string) => {
    if (readOnly) return;
    if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      const to = e.key === "ArrowUp" ? index - 1 : index + 1;
      if (to >= 0 && to < deck.slides.length) onMove(index, to);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const to = Math.max(0, Math.min(deck.slides.length - 1, index + (e.key === "ArrowDown" ? 1 : -1)));
      onSelect(deck.slides[to].id);
      requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-rail-slide="${deck.slides[to].id}"]`)?.focus());
    }
    if ((e.key === "Delete" || e.key === "Backspace") && deck.slides.length > 0) {
      e.preventDefault();
      onDelete(id);
    }
  };

  return (
    <nav className="de-rail" aria-label={t("slides")}>
      <ol className="de-rail-list">
        {deck.slides.map((ref, index) => {
          const slide = slides[ref.id];
          const active = ref.id === currentId;
          const warn = notices.some((n) => n.slideId === ref.id);
          const dropBefore = drag && drag.over === index && drag.from !== index && drag.from !== index - 1;
          return (
            <li
              key={ref.id}
              className={`de-rail-item${active ? " is-active" : ""}${active && slideSelected ? " is-focused" : ""}${ref.hidden ? " is-hidden" : ""}${dropBefore ? " drop-before" : ""}`}
              draggable={!readOnly}
              onDragStart={(e: DragEvent) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", ref.id);
                setDrag({ from: index, over: index });
              }}
              onDragOver={(e: DragEvent) => {
                if (!drag) return;
                e.preventDefault();
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const over = e.clientY > rect.top + rect.height / 2 ? index + 1 : index;
                if (over !== drag.over) setDrag({ ...drag, over });
              }}
              onDrop={(e: DragEvent) => {
                e.preventDefault();
                if (drag) {
                  const to = drag.over > drag.from ? drag.over - 1 : drag.over;
                  if (to !== drag.from) onMove(drag.from, to);
                }
                setDrag(null);
              }}
              onDragEnd={() => setDrag(null)}
            >
              <span className="de-rail-number">{index + 1}</span>
              <button
                type="button"
                className="de-rail-thumb"
                data-rail-slide={ref.id}
                aria-current={active ? "true" : undefined}
                aria-label={`${t("slideN", { n: index + 1 })}${ref.hidden ? ` (${t("hidden")})` : ""}`}
                onClick={() => onSelect(ref.id)}
                onKeyDown={(e) => onKey(e, index, ref.id)}
              >
                {slide ? <Thumb slide={slide} deck={deck} tokens={tokens} assetUrl={assetUrl} /> : null}
                {ref.hidden ? <EyeOff className="de-rail-flag" size={14} aria-hidden /> : null}
                {warn ? <AlertTriangle className="de-rail-warn" size={14} aria-hidden /> : null}
              </button>
              {!readOnly ? (
                <div className="de-rail-menu">
                  <button
                    type="button"
                    className="de-icon-button"
                    aria-label={t("slideActions")}
                    title={t("slideActions")}
                    aria-expanded={menu === ref.id}
                    onClick={() => setMenu(menu === ref.id ? null : ref.id)}
                  >
                    <MoreHorizontal size={14} aria-hidden />
                  </button>
                  {menu === ref.id ? (
                    <div className="de-menu" role="menu" onMouseLeave={() => setMenu(null)}>
                      <button type="button" role="menuitem" onClick={() => (setMenu(null), onDuplicate(ref.id))}>
                        <Copy size={14} aria-hidden /> {t("duplicateSlide")}
                      </button>
                      <button type="button" role="menuitem" onClick={() => (setMenu(null), onToggleHidden(ref.id))}>
                        {ref.hidden ? <Eye size={14} aria-hidden /> : <EyeOff size={14} aria-hidden />} {ref.hidden ? t("showSlide") : t("hideSlide")}
                      </button>
                      <button type="button" role="menuitem" disabled={index === 0} onClick={() => (setMenu(null), onMove(index, index - 1))}>
                        <ArrowUp size={14} aria-hidden /> {t("moveUp")}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={index === deck.slides.length - 1}
                        onClick={() => (setMenu(null), onMove(index, index + 1))}
                      >
                        <ArrowDown size={14} aria-hidden /> {t("moveDown")}
                      </button>
                      <button type="button" role="menuitem" className="is-danger" onClick={() => (setMenu(null), onDelete(ref.id))}>
                        <Trash2 size={14} aria-hidden /> {t("deleteSlide")}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
        {drag && drag.over === deck.slides.length ? <li className="de-rail-drop-end" aria-hidden /> : null}
      </ol>
      {!readOnly ? (
        <div className="de-rail-add">
          <button type="button" className="de-button" onClick={() => setPicker(true)} aria-haspopup="dialog" aria-expanded={picker}>
            <Plus size={16} aria-hidden /> {t("addSlide")}
          </button>
          {picker ? (
            <LayoutPicker
              deck={deck}
              tokens={tokens}
              assetUrl={assetUrl}
              locale={locale}
              t={t}
              onPick={(layout) => {
                setPicker(false);
                onAdd(layout, currentIndex >= 0 ? currentIndex + 1 : deck.slides.length);
              }}
              onClose={() => setPicker(false)}
            />
          ) : null}
        </div>
      ) : null}
    </nav>
  );
}
