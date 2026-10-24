"use client";

/**
 * Deck editor (plan 5.5): slide thumbnails on the left, the canvas in the
 * middle with the speaker notes below, the properties (or image) panel on
 * the right and the AI chat beside it. Document access, chat and images go
 * through adapters so the same editor runs on the API and on fixtures.
 */

import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronsLeft,
  ChevronsRight,
  Code2,
  Circle,
  ImageIcon,
  LayoutGrid,
  Loader2,
  Minus,
  MoveRight,
  PieChart,
  Play,
  Plus,
  Redo2,
  Smile,
  Square,
  Table2,
  Type,
  Undo2,
  Video,
} from "lucide-react";
import { DEFAULT_TOKENS, themeTokensFromDesign, type AssetUrl, type ThemeTokens } from "@/components/deck-player";
import type { SlideElement } from "@/lib/contracts/forge-design";
import { describeTarget, targetFor, type AiTarget } from "./ai";
import type { DocTransport } from "./autosave";
import type { ChatClient } from "./chat-client";
import { DeckChat } from "./DeckChat";
import { DeckImagePanel } from "./DeckImagePanel";
import { EditorCanvas } from "./EditorCanvas";
import { FormatToolbar } from "./FormatToolbar";
import type { ImageClient, PickedImage } from "./images-client";
import { slideFromLayout, type LayoutName } from "./layouts";
import {
  absoluteBox,
  allElementIds,
  copyElements,
  duplicateElements,
  duplicateSlide,
  findElement,
  freshId,
  insertSlide,
  locate,
  moveSlide,
  parseClipboard,
  pasteElements,
  removeSlide,
  updateRef,
  updateSlide,
  type ClipboardPayload,
  type TextElement,
} from "./model";
import {
  align,
  deleteElements,
  distribute,
  fillWithImage,
  group,
  insertElement,
  moveBy,
  newElement,
  newImageElement,
  patchElements,
  setFields,
  setStyle,
  ungroup,
  zOrder,
  type InsertKind,
  type Recipe,
} from "./ops";
import { colorTokens } from "./fields";
import { PresentOverlay, presentIndex } from "./PresentOverlay";
import { PublishMenu, type DeckPublisher } from "./PublishMenu";
import { PropertiesPanel, type ImageTarget, type PanelTab } from "./PropertiesPanel";
import { SlideRail, LayoutPicker } from "./SlideRail";
import { canRedo, canUndo } from "./state";
import { copyFor, useDeckStrings, type DeckStringKey } from "./strings";
import type { TextCommands, TextMarks } from "./text-style";
import { useDeckDocument } from "./useDeckDocument";
import "./deck-editor.css";

const TextEditor = lazy(() => import("./TextEditor"));

export type DeckEditorProps = {
  projectId: string;
  projectName?: string;
  transport: DocTransport;
  /** Text of the theme file named by the deck (DESIGN.md or design-system.json). */
  loadTheme: (file: string) => Promise<string | null>;
  assetUrl: AssetUrl;
  chat: ChatClient | null;
  images: ImageClient | null;
  /** Whether this plan may hide the "Made with Forge" badge (`remove_badge`). */
  badgeRemovable: boolean;
  /** Export menu mounted in the top bar (pending edits are saved when it is opened). */
  exportMenu?: ReactNode;
  /** Publish action; hidden when absent. */
  publisher?: DeckPublisher | null;
  readOnly?: boolean;
  backHref: string;
};

const INSERTS: { kind: InsertKind; label: DeckStringKey; icon: typeof Type }[] = [
  { kind: "text", label: "insertText", icon: Type },
  { kind: "rect", label: "shapeRect", icon: Square },
  { kind: "ellipse", label: "shapeEllipse", icon: Circle },
  { kind: "line", label: "shapeLine", icon: Minus },
  { kind: "arrow", label: "shapeArrow", icon: MoveRight },
  { kind: "icon", label: "insertIcon", icon: Smile },
  { kind: "table", label: "insertTable", icon: Table2 },
  { kind: "chart", label: "insertChart", icon: PieChart },
  { kind: "video", label: "insertVideo", icon: Video },
  { kind: "code", label: "insertCode", icon: Code2 },
];

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

export function DeckEditor(props: DeckEditorProps) {
  const { transport, assetUrl, readOnly } = props;
  const { t, locale } = useDeckStrings();
  const docState = useDeckDocument(transport);
  const { state, dispatch, load } = docState;
  const doc = state.doc;
  const slide = doc && state.slideId ? doc.slides[state.slideId] : undefined;
  const slideIndex = doc && state.slideId ? doc.deck.slides.findIndex((r) => r.id === state.slideId) : -1;
  const slideRef = doc && slideIndex >= 0 ? doc.deck.slides[slideIndex] : undefined;

  const [tokens, setTokens] = useState<ThemeTokens>(DEFAULT_TOKENS);
  const [tab, setTab] = useState<PanelTab>("slide");
  const [imageTarget, setImageTarget] = useState<ImageTarget | null>(null);
  const [presenting, setPresenting] = useState<number | null>(null);
  // Badge shown unless the plan allows removing it and the user turned it off.
  const [keepBadge, setKeepBadge] = useState(true);
  const badge = !props.badgeRemovable || keepBadge;
  const [chatOpen, setChatOpen] = useState(true);
  const [insertOpen, setInsertOpen] = useState(false);
  const [emptyPicker, setEmptyPicker] = useState(false);
  const [commands, setCommands] = useState<TextCommands | null>(null);
  const [marks, setMarks] = useState<TextMarks | null>(null);
  const clipboard = useRef<ClipboardPayload | null>(null);

  const themeFile = doc?.deck.theme.tokens ?? "DESIGN.md";
  useEffect(() => {
    if (load.status !== "ready") return;
    let alive = true;
    props
      .loadTheme(themeFile)
      .then((text) => alive && setTokens(themeTokensFromDesign(text ?? "")))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the theme file changes
  }, [load.status, themeFile]);

  // The element tab follows the selection.
  const selectionCount = state.selection.length;
  useEffect(() => {
    if (selectionCount > 0) setTab((current) => (current === "deck" ? current : "element"));
    else setTab((current) => (current === "element" ? "slide" : current));
  }, [selectionCount]);

  const run = useCallback((recipe: Recipe, key?: string) => dispatch({ type: "edit", recipe, key }), [dispatch]);

  const sid = slide?.id ?? "";
  const selection = state.selection;

  // ── commands ──────────────────────────────────────────────────────────────

  const addSlide = useCallback(
    (layout: LayoutName | null, index: number) => {
      if (!doc) return;
      const id = freshId("s", new Set(doc.deck.slides.map((r) => r.id)));
      const body = layout ? slideFromLayout(id, layout, doc.deck.format.ratio, copyFor(locale)) : { id, background: { type: "color" as const, token: "--bg" }, elements: [] };
      dispatch({ type: "edit", recipe: (d) => insertSlide(d, { id, layout: layout ?? "text" }, body, index), slideId: id, select: [] });
    },
    [doc, dispatch, locale],
  );

  const deleteSlide = useCallback(
    (id: string) => {
      if (!doc) return;
      const index = doc.deck.slides.findIndex((r) => r.id === id);
      const nextId = doc.deck.slides[index + 1]?.id ?? doc.deck.slides[index - 1]?.id ?? null;
      dispatch({ type: "edit", recipe: (d) => removeSlide(d, id), slideId: nextId ?? undefined, select: [] });
    },
    [doc, dispatch],
  );

  const insert = (kind: InsertKind) => {
    if (!slide || !doc) return;
    const element = newElement(kind, slide, doc.deck, { text: t("newText"), series: copyFor(locale).series });
    dispatch({ type: "edit", recipe: insertElement(sid, element), select: [element.id] });
    setInsertOpen(false);
  };

  const removeSelection = useCallback(() => {
    if (!sid || !selection.length) return;
    dispatch({ type: "edit", recipe: deleteElements(sid, selection), select: [] });
  }, [dispatch, sid, selection]);

  const duplicateSelection = useCallback(() => {
    if (!slide || !selection.length) return;
    const result = duplicateElements(slide, selection);
    dispatch({ type: "edit", recipe: (d) => updateSlide(d, slide.id, () => result.slide), select: result.ids });
  }, [dispatch, slide, selection]);

  const groupSelection = useCallback(() => {
    if (!slide || selection.length < 2) return;
    const id = freshId("group", allElementIds(slide.elements));
    dispatch({ type: "edit", recipe: group(sid, selection, id), select: [id] });
  }, [dispatch, sid, slide, selection]);

  const ungroupSelection = useCallback(
    (id: string) => {
      const el = slide ? findElement(slide, id) : null;
      if (!el || el.type !== "group") return;
      dispatch({ type: "edit", recipe: ungroup(sid, id), select: el.children.map((c) => c.id) });
    },
    [dispatch, sid, slide],
  );

  const onPickImage = (image: PickedImage) => {
    if (!imageTarget || !slide || !doc) return;
    if (imageTarget.kind === "element") {
      run(setFields(sid, [imageTarget.id], { src: image.path, credit: image.credit, alt: image.alt }));
    } else if (imageTarget.kind === "fill") {
      run(fillWithImage(sid, imageTarget.id, image, image.alt));
    } else if (imageTarget.kind === "background") {
      const bg: NonNullable<typeof slide.background> = { type: "image", src: image.path, fit: "cover" };
      if (image.credit) bg.credit = image.credit;
      run((d) => updateSlide(d, sid, (s) => ({ ...s, background: bg })));
    } else {
      const element = newImageElement(slide, doc.deck, image);
      if (image.alt && element.type === "image") element.alt = image.alt;
      dispatch({ type: "edit", recipe: insertElement(sid, element), select: [element.id] });
    }
    setImageTarget(null);
  };

  // ── keyboard and clipboard ────────────────────────────────────────────────

  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      if (presenting !== null || isTyping(e.target)) return;
      const s = stateRef.current;
      const d = s.doc;
      const current = d && s.slideId ? d.slides[s.slideId] : undefined;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
        return;
      }
      if (mod && key === "y") {
        e.preventDefault();
        dispatch({ type: "redo" });
        return;
      }
      if (!current) return;
      if (mod && key === "a") {
        e.preventDefault();
        const scope = s.groupScope ? locate(current.elements, s.groupScope)?.element : null;
        const list = scope && scope.type === "group" ? scope.children : current.elements;
        dispatch({ type: "select", ids: list.map((el) => el.id) });
        return;
      }
      if (e.key === "Escape") {
        if (s.selection.length) dispatch({ type: "select", ids: [] });
        else if (s.groupScope) dispatch({ type: "enterGroup", id: null });
        else dispatch({ type: "focusDeck" });
        return;
      }
      if (!s.selection.length) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        dispatch({ type: "edit", recipe: deleteElements(current.id, s.selection), select: [] });
        return;
      }
      if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        dispatch({ type: "edit", recipe: moveBy(current.id, s.selection, dx, dy, current), key: "nudge" });
        return;
      }
      if (e.key === "Enter" && s.selection.length === 1) {
        const el = findElement(current, s.selection[0]);
        if (el?.type === "text") {
          e.preventDefault();
          dispatch({ type: "editText", id: el.id });
        } else if (el?.type === "group") {
          e.preventDefault();
          dispatch({ type: "enterGroup", id: el.id });
        }
        return;
      }
      if (mod && key === "d") {
        e.preventDefault();
        duplicateSelection();
        return;
      }
      if (mod && key === "g") {
        e.preventDefault();
        if (e.shiftKey) {
          const el = findElement(current, s.selection[0]);
          if (el?.type === "group") ungroupSelection(el.id);
        } else groupSelection();
        return;
      }
      if (mod && (e.key === "]" || e.key === "[")) {
        e.preventDefault();
        const move = e.key === "]" ? (e.shiftKey ? "front" : "forward") : e.shiftKey ? "back" : "backward";
        dispatch({ type: "edit", recipe: zOrder(current.id, s.selection, move) });
      }
    };
    const onCopy = (e: ClipboardEvent) => {
      if (presenting !== null || isTyping(e.target)) return;
      const s = stateRef.current;
      const current = s.doc && s.slideId ? s.doc.slides[s.slideId] : undefined;
      if (!current || !s.selection.length || s.editingText) return;
      const payload = copyElements(current, s.selection);
      clipboard.current = payload;
      e.clipboardData?.setData("text/plain", JSON.stringify(payload));
      e.preventDefault();
      if (e.type === "cut") dispatch({ type: "edit", recipe: deleteElements(current.id, s.selection), select: [] });
    };
    const onPaste = (e: ClipboardEvent) => {
      if (presenting !== null || isTyping(e.target)) return;
      const s = stateRef.current;
      const current = s.doc && s.slideId ? s.doc.slides[s.slideId] : undefined;
      if (!current) return;
      const payload = parseClipboard(e.clipboardData?.getData("text/plain") ?? "") ?? clipboard.current;
      if (!payload) return;
      e.preventDefault();
      const { slide: next, ids } = pasteElements(current, payload);
      dispatch({ type: "edit", recipe: (d) => updateSlide(d, current.id, () => next), select: ids });
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCopy);
    document.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCopy);
      document.removeEventListener("paste", onPaste);
    };
  }, [dispatch, presenting, readOnly, duplicateSelection, groupSelection, ungroupSelection]);

  // ── AI target ─────────────────────────────────────────────────────────────

  const target: AiTarget | undefined = targetFor({ slideId: state.slideId, slideSelected: state.slideSelected, selection });
  const described = describeTarget(doc, target);
  const targetLabel = !described
    ? t("targetDeck")
    : described.element
      ? t("targetElement", { n: described.slideIndex + 1, name: elementName(slide, target?.elementId) ?? described.element })
      : t("targetSlide", { n: described.slideIndex + 1 });

  // ── render ────────────────────────────────────────────────────────────────

  if (load.status === "loading") {
    return (
      <div className="de-root de-center">
        <Loader2 className="de-spin" aria-hidden /> {t("loading")}
      </div>
    );
  }
  if (load.status === "error" || !doc) {
    return (
      <div className="de-root de-center" role="alert">
        <p>{load.status === "error" && load.code === "WRONG_KIND" ? t("wrongKind") : t("loadError")}</p>
        {load.status === "error" && load.message ? <p className="de-hint">{load.message}</p> : null}
        <div className="de-row">
          <button type="button" className="de-button" onClick={docState.reload}>
            {t("retry")}
          </button>
          <Link className="de-button de-button-ghost" href={props.backHref}>
            {t("back")}
          </Link>
        </div>
      </div>
    );
  }

  const single = selection.length === 1 && slide ? findElement(slide, selection[0]) : null;
  const textSelected = single?.type === "text" ? (single as TextElement) : null;
  const editingEl = state.editingText && slide ? findElement(slide, state.editingText) : null;
  const editingBox = editingEl && slide ? absoluteBox(slide, editingEl.id) : null;
  const saveLabel = { saved: t("saved"), pending: t("pending"), saving: t("saving"), error: t("saveError"), conflict: t("saveConflict") }[docState.save];
  const frame = imageTarget && slide && (imageTarget.kind === "element" || imageTarget.kind === "fill") ? (findElement(slide, imageTarget.id) ?? { w: 1600, h: 900 }) : { w: doc.deck.format.width, h: doc.deck.format.height };
  const visibleCount = doc.deck.slides.filter((r) => !r.hidden).length;

  return (
    <div className={`de-root${chatOpen ? "" : " chat-closed"}`}>
      <header className="de-topbar">
        <Link href={props.backHref} className="de-icon-button" aria-label={t("back")} title={t("back")}>
          <ArrowLeft size={16} aria-hidden />
        </Link>
        <div className="de-title">
          <strong>{doc.deck.title || props.projectName || t("untitled")}</strong>
          <span className={`de-save is-${docState.save}`} role="status">
            {saveLabel}
          </span>
        </div>
        <div className="de-topbar-tools">
          <button type="button" className="de-icon-button" onClick={() => dispatch({ type: "undo" })} disabled={!canUndo(state) || readOnly} aria-label={t("undo")} title={`${t("undo")} (Ctrl+Z)`}>
            <Undo2 size={16} aria-hidden />
          </button>
          <button type="button" className="de-icon-button" onClick={() => dispatch({ type: "redo" })} disabled={!canRedo(state) || readOnly} aria-label={t("redo")} title={`${t("redo")} (Ctrl+Shift+Z)`}>
            <Redo2 size={16} aria-hidden />
          </button>
          <div className="de-insert">
            <button type="button" className="de-button" onClick={() => setInsertOpen(!insertOpen)} aria-expanded={insertOpen} aria-haspopup="menu" disabled={readOnly || !slide}>
              <Plus size={14} aria-hidden /> {t("insert")}
            </button>
            {insertOpen ? (
              <div className="de-menu de-insert-menu" role="menu" onMouseLeave={() => setInsertOpen(false)}>
                {INSERTS.map(({ kind, label, icon: Icon }) => (
                  <button key={kind} type="button" role="menuitem" onClick={() => insert(kind)}>
                    <Icon size={14} aria-hidden /> {t(label)}
                  </button>
                ))}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setInsertOpen(false);
                    setImageTarget({ kind: "new" });
                  }}
                >
                  <ImageIcon size={14} aria-hidden /> {t("insertImage")}
                </button>
              </div>
            ) : null}
          </div>
          <button type="button" className="de-icon-button" onClick={() => setTab("deck")} aria-label={t("deckSettings")} title={t("deckSettings")}>
            <LayoutGrid size={16} aria-hidden />
          </button>
          {props.exportMenu ? (
            <div className="de-export-slot" onPointerDownCapture={() => void docState.flush()}>
              {props.exportMenu}
            </div>
          ) : null}
          {props.publisher && !readOnly ? (
            <PublishMenu publisher={props.publisher} badge={keepBadge} onBadgeChange={setKeepBadge} beforePublish={docState.flush} disabled={visibleCount === 0} t={t} />
          ) : null}
          <button
            type="button"
            className="de-button de-button-primary"
            disabled={visibleCount === 0}
            onClick={() => {
              dispatch({ type: "editText", id: null });
              setPresenting(presentIndex(doc.deck, state.slideId));
            }}
            title={t("presentFromHere")}
          >
            <Play size={14} aria-hidden /> {t("present")}
          </button>
        </div>
      </header>

      <div className="de-body">
        {chatOpen ? (
          <DeckChat
            client={props.chat}
            target={target}
            targetLabel={targetLabel}
            actionTarget={state.slideId ? { slideId: state.slideId } : undefined}
            onClearTarget={() => dispatch({ type: "focusDeck" })}
            onEvent={docState.applyEvent}
            onNotice={docState.addNotice}
            beforeSend={docState.flush}
            t={t}
            locale={locale}
            readOnly={readOnly}
          />
        ) : null}
        <button type="button" className="de-chat-toggle" onClick={() => setChatOpen(!chatOpen)} aria-label={t("chat")} title={t("chat")} aria-expanded={chatOpen}>
          {chatOpen ? <ChevronsLeft size={14} aria-hidden /> : <ChevronsRight size={14} aria-hidden />}
        </button>

        <SlideRail
          deck={doc.deck}
          slides={doc.slides}
          currentId={state.slideId}
          slideSelected={state.slideSelected}
          tokens={tokens}
          assetUrl={assetUrl}
          notices={docState.notices}
          readOnly={readOnly}
          locale={locale}
          t={t}
          onSelect={(id) => dispatch({ type: "selectSlide", id, focus: true })}
          onMove={(from, to) => run((d) => ({ ...d, deck: moveSlide(d.deck, from, to) }))}
          onDuplicate={(id) => {
            const result = duplicateSlide(doc, id);
            dispatch({ type: "edit", recipe: () => result.doc, slideId: result.id, select: [] });
          }}
          onDelete={(id) => {
            if (window.confirm(t("confirmDeleteSlide"))) deleteSlide(id);
          }}
          onToggleHidden={(id) => run((d) => updateRef(d, id, (ref) => (ref.hidden ? withoutHidden(ref) : { ...ref, hidden: true })))}
          onAdd={addSlide}
        />

        <main className="de-main">
          {textSelected && slide ? (
            <FormatToolbar
              element={textSelected}
              tokens={tokens}
              editing={state.editingText === textSelected.id}
              commands={commands}
              marks={marks}
              t={t}
              disabled={readOnly}
              onEdit={() => dispatch({ type: "editText", id: textSelected.id })}
              onStyle={(patch) => run(setStyle(sid, [textSelected.id], patch), `style:${textSelected.id}`)}
            />
          ) : (
            <div className="de-format de-format-empty">
              {state.groupScope ? (
                <>
                  <span>{t("editingGroup")}</span>
                  <button type="button" className="de-button de-button-ghost" onClick={() => dispatch({ type: "enterGroup", id: null })}>
                    {t("exitGroup")}
                  </button>
                </>
              ) : (
                <span className="de-hint">{t("shortcuts")}</span>
              )}
            </div>
          )}
          {slide ? (
            <section className="de-canvas-wrap" aria-label={t("canvas", { n: slideIndex + 1 })} tabIndex={0}>
              <EditorCanvas
                deck={doc.deck}
                slide={slide}
                slideIndex={slideIndex}
                tokens={tokens}
                assetUrl={assetUrl}
                selection={selection}
                groupScope={state.groupScope}
                editingText={state.editingText}
                readOnly={readOnly}
                dispatch={dispatch}
                notices={docState.notices}
                onDismissNotice={docState.dismissNotice}
                t={t}
                textEditor={
                  editingEl && editingEl.type === "text" && editingBox ? (
                    <Suspense fallback={null}>
                      <TextEditor
                        key={editingEl.id}
                        element={editingEl}
                        box={editingBox}
                        tokens={tokens}
                        onChange={(content) => run(patchElements(sid, [editingEl.id], (el) => (el.type === "text" ? { ...el, content } : el)), `text:${editingEl.id}`)}
                        onDone={() => dispatch({ type: "editText", id: null })}
                        onReady={setCommands}
                        onMarks={setMarks}
                      />
                    </Suspense>
                  ) : null
                }
              />
            </section>
          ) : (
            <div className="de-empty">
              <p>{t("emptyDeck")}</p>
              {!readOnly ? (
                <div className="de-rail-add">
                  <button type="button" className="de-button de-button-primary" onClick={() => setEmptyPicker(true)}>
                    <Plus size={14} aria-hidden /> {t("addSlide")}
                  </button>
                  {emptyPicker ? (
                    <LayoutPicker
                      deck={doc.deck}
                      tokens={tokens}
                      assetUrl={assetUrl}
                      locale={locale}
                      t={t}
                      onPick={(layout) => {
                        setEmptyPicker(false);
                        addSlide(layout, 0);
                      }}
                      onClose={() => setEmptyPicker(false)}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
          {slide ? (
            <label className="de-notes">
              <span>{t("notes")}</span>
              <textarea
                value={docState.notes[slide.id] ?? ""}
                placeholder={t("notesPlaceholder")}
                maxLength={20000}
                readOnly={readOnly}
                onChange={(e) => docState.setNotes(slide.id, e.target.value)}
              />
            </label>
          ) : null}
        </main>

        {imageTarget && slide ? (
          <DeckImagePanel
            client={props.images}
            target={imageTarget}
            frame={{ w: frame.w, h: frame.h }}
            query={imageQuery(slide, imageTarget)}
            styleHint={styleHint(tokens, locale)}
            assetUrl={assetUrl}
            onPick={onPickImage}
            onClose={() => setImageTarget(null)}
            t={t}
          />
        ) : slide && slideRef ? (
          <PropertiesPanel
            doc={doc}
            slide={slide}
            slideRef={slideRef}
            selection={selection}
            tokens={tokens}
            themeFile={themeFile}
            tab={tab}
            onTab={setTab}
            run={run}
            onSelect={(ids) => dispatch({ type: "select", ids })}
            onImage={setImageTarget}
            onGroup={groupSelection}
            onUngroup={ungroupSelection}
            onDuplicate={duplicateSelection}
            onDelete={removeSelection}
            onZ={(move) => run(zOrder(sid, selection, move))}
            onAlign={(how) => run(align(sid, slide, doc.deck, selection, how))}
            onDistribute={(axis) => run(distribute(sid, slide, selection, axis))}
            t={t}
            locale={locale}
            readOnly={readOnly}
          />
        ) : (
          <aside className="de-panel" />
        )}
      </div>

      {docState.conflict ? (
        <div className="de-modal-backdrop">
          <div className="de-modal" role="alertdialog" aria-modal="true" aria-labelledby="de-conflict-title">
            <h2 id="de-conflict-title">
              {docState.conflict.key === "deck" ? t("conflictDeckTitle") : docState.conflict.key.startsWith("notes:") ? t("conflictNotesTitle") : t("conflictTitle")}
            </h2>
            <p>{t("conflictBody")}</p>
            <div className="de-row">
              <button type="button" className="de-button" onClick={() => docState.resolveConflict("theirs")}>
                {t("conflictTheirs")}
              </button>
              <button type="button" className="de-button de-button-primary" onClick={() => docState.resolveConflict("mine")}>
                {t("conflictMine")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {presenting !== null ? (
        <PresentOverlay
          deck={doc.deck}
          slides={doc.slides}
          notes={docState.notes}
          tokens={tokens}
          assetUrl={assetUrl}
          startAt={presenting}
          badge={badge}
          locale={locale}
          onClose={() => setPresenting(null)}
          t={t}
        />
      ) : null}
    </div>
  );
}

/** Design system style appended to AI image prompts. */
function styleHint(tokens: ThemeTokens, locale: string): string {
  const colors = colorTokens(tokens)
    .slice(0, 4)
    .map((c) => c.value)
    .join(", ");
  if (!colors) return "";
  return locale === "en" ? `Style: match the presentation palette (${colors}).` : `Style : accordé à la palette de la présentation (${colors}).`;
}

function withoutHidden<T extends { hidden?: boolean }>(ref: T): T {
  const next = { ...ref };
  delete next.hidden;
  return next;
}

function elementName(slide: { elements: SlideElement[] } | undefined, id: string | undefined): string | null {
  if (!slide || !id) return null;
  const el = locate(slide.elements, id)?.element;
  if (!el) return null;
  if (el.name) return el.name;
  if (el.type === "text") return el.role ?? el.id;
  return el.type;
}

/** Search words offered by the free image tab: the element's alt or the slide title. */
function imageQuery(slide: { elements: SlideElement[] }, target: ImageTarget): string {
  if (target.kind === "element") {
    const el = findElement(slide as never, target.id);
    if (el?.type === "image" && el.alt) return el.alt;
  }
  const title = slide.elements.find((e) => e.type === "text" && (e.role === "title" || e.role === "heading"));
  if (title?.type === "text") {
    const first = title.content[0];
    const text = first?.type === "paragraph" ? (first.text ?? first.runs?.map((r) => r.text).join("") ?? "") : "";
    return text.slice(0, 100);
  }
  return "";
}
