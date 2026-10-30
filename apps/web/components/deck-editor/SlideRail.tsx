"use client";

/**
 * Left column: slide thumbnails. Click selects (and targets the slide for
 * the AI), drag and drop or Alt+Arrow reorders, the menu duplicates, hides
 * or deletes, and "Add a slide" opens the layout picker.
 */

import { memo, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { AlertTriangle, Copy, EyeOff, Eye, MoreHorizontal, PanelBottom, PanelLeft, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { canvasSize, SlideView, type AssetUrl, type ThemeTokens } from "@/components/deck-player";
import type { Deck, Slide } from "@/lib/contracts/forge-design";
import type { SlideNotice } from "./ai";
import { LAYOUT_NAMES, slideFromLayout, type LayoutName } from "./layouts";
import { copyFor, LAYOUT_LABEL, type DeckLocale, type DeckT } from "./strings";
import { centerOf, isContextMenuKey, useLongPress, type Point } from "@/components/ui/ContextMenu";

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
  // One listener for the picker's life: re-adding it on each render could
  // drop the Escape that another listener's re-render interrupted.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
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
  orientation = "vertical",
  onOrientation,
  onSlideContextMenu,
  pickerAt,
  onPickerAtDone,
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
  /** `horizontal` = a strip under the canvas. */
  orientation?: "vertical" | "horizontal";
  onOrientation?: (next: "vertical" | "horizontal") => void;
  /** Right click, long press or the Menu key on a thumbnail. */
  onSlideContextMenu?: (id: string, at: Point) => void;
  /** Opens the layout picker to add a slide at this index (from the menu). */
  pickerAt?: { index: number; nonce: number } | null;
  /** Called once `pickerAt` opened the picker, so a remount does not open it again. */
  onPickerAtDone?: () => void;
}) {
  const horizontal = orientation === "horizontal";
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  // Index the picked layout is inserted at; null when the picker is closed.
  const [picker, setPicker] = useState<number | null>(null);
  const currentIndex = deck.slides.findIndex((ref) => ref.id === currentId);
  const pickerDone = useRef(onPickerAtDone);
  pickerDone.current = onPickerAtDone;
  useEffect(() => {
    if (!pickerAt) return;
    setPicker(pickerAt.index);
    pickerDone.current?.();
  }, [pickerAt]);
  const pressed = useRef<string | null>(null);
  const longPress = useLongPress((at) => {
    if (pressed.current) onSlideContextMenu?.(pressed.current, at);
  });

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, index: number, id: string) => {
    if (onSlideContextMenu && isContextMenuKey(e)) {
      e.preventDefault();
      const at = centerOf(e.currentTarget);
      if (at) onSlideContextMenu(id, at);
      return;
    }
    if (readOnly) return;
    if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      const to = e.key === "ArrowUp" ? index - 1 : index + 1;
      if (to >= 0 && to < deck.slides.length) onMove(index, to);
      return;
    }
    const next = horizontal ? ["ArrowRight", "ArrowDown"] : ["ArrowDown"];
    const prev = horizontal ? ["ArrowLeft", "ArrowUp"] : ["ArrowUp"];
    if (next.includes(e.key) || prev.includes(e.key)) {
      e.preventDefault();
      const to = Math.max(0, Math.min(deck.slides.length - 1, index + (next.includes(e.key) ? 1 : -1)));
      onSelect(deck.slides[to].id);
      requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-rail-slide="${deck.slides[to].id}"]`)?.focus());
    }
    if ((e.key === "Delete" || e.key === "Backspace") && deck.slides.length > 0) {
      e.preventDefault();
      onDelete(id);
    }
  };

  return (
    <nav className={`de-rail${horizontal ? " is-horizontal" : ""}`} aria-label={t("slides")}>
      <div className="de-rail-head">
        <span className="de-rail-title">
          {t("slides")} <span className="de-rail-count">{deck.slides.length}</span>
        </span>
        {onOrientation ? (
          <button
            type="button"
            className="de-icon-button de-rail-orient"
            onClick={() => onOrientation(horizontal ? "vertical" : "horizontal")}
            aria-label={horizontal ? t("railToLeft") : t("railToBottom")}
            title={horizontal ? t("railToLeft") : t("railToBottom")}
          >
            {horizontal ? <PanelLeft size={15} aria-hidden /> : <PanelBottom size={15} aria-hidden />}
          </button>
        ) : null}
      </div>
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
                const after = horizontal ? e.clientX > rect.left + rect.width / 2 : e.clientY > rect.top + rect.height / 2;
                const over = after ? index + 1 : index;
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
                onContextMenu={(e) => {
                  if (!onSlideContextMenu || e.shiftKey) return;
                  e.preventDefault();
                  if (longPress.justFired()) return;
                  longPress.cancel();
                  onSlideContextMenu(ref.id, { x: e.clientX, y: e.clientY });
                }}
                onPointerDown={(e) => {
                  pressed.current = ref.id;
                  longPress.onPointerDown(e);
                }}
                onPointerMove={longPress.onPointerMove}
                onPointerUp={longPress.onPointerUp}
                onPointerCancel={longPress.onPointerCancel}
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
                    aria-haspopup="menu"
                    aria-expanded={menu === ref.id}
                    onClick={(e) => {
                      // The same menu as a right click, opened under the button.
                      if (onSlideContextMenu) {
                        const box = e.currentTarget.getBoundingClientRect();
                        onSlideContextMenu(ref.id, { x: box.left, y: box.bottom + 4 });
                        return;
                      }
                      setMenu(menu === ref.id ? null : ref.id);
                    }}
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
          {!readOnly ? (
            <button
              type="button"
              className="de-button"
              onClick={() => setPicker(currentIndex >= 0 ? currentIndex + 1 : deck.slides.length)}
              aria-haspopup="dialog"
              aria-expanded={picker !== null}
            >
              <Plus size={16} aria-hidden /> <span className="de-rail-add-label">{t("addSlide")}</span>
            </button>
          ) : null}
          {picker !== null ? (
            <LayoutPicker
              deck={deck}
              tokens={tokens}
              assetUrl={assetUrl}
              locale={locale}
              t={t}
              onPick={(layout) => {
                const at = Math.min(picker, deck.slides.length);
                setPicker(null);
                onAdd(layout, at);
              }}
              onClose={() => setPicker(null)}
            />
          ) : null}
        </div>
      ) : null}
    </nav>
  );
}
