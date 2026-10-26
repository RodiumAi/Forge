"use client";

/**
 * Deck editor (plan 5.5): slide thumbnails on the left, the canvas in the
 * middle with the speaker notes below, the properties (or image) panel on
 * the right and the AI chat beside it. Document access, chat and images go
 * through adapters so the same editor runs on the API and on fixtures.
 */

import { lazy, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  Code2,
  Circle,
  ImageIcon,
  Loader2,
  Minus,
  MoveRight,
  PanelLeftOpen,
  PanelRightOpen,
  PieChart,
  Plus,
  Smile,
  Square,
  Table2,
  Type,
  Video,
} from "lucide-react";
import { DEFAULT_TOKENS, themeTokensFromDesign, type AssetUrl, type ThemeTokens } from "@/components/deck-player";
import type { SlideElement } from "@/lib/contracts/forge-design";
import { describeTarget, targetFor, type AiTarget } from "./ai";
import { DeckDesignSystem } from "./DeckDesignSystem";
import type { DocTransport } from "./autosave";
import type { ChatClient } from "./chat-client";
import { DeckChat, type ChatRequest } from "./DeckChat";
import { canvasMenu, elementMenu, slideMenu } from "./deck-menus";
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
  normalizeAngle,
  parseClipboard,
  pasteElements,
  removeSlide,
  updateRef,
  updateSlide,
  type ClipboardPayload,
  type ImageElement,
  type TextElement,
} from "./model";
import { aabb, unionRect, type Point as SlidePoint } from "./geometry";
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
import { WorkspaceBar, type WorkspacePerson } from "@/components/builder/WorkspaceBar";
import { Button, IconButton } from "@/components/ui/Button";
import { centerOf, ContextMenu, isContextMenuKey, useContextMenu, type ContextMenuEntry, type Point } from "@/components/ui/ContextMenu";
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
  /** Share button (owner only), next to Publish. */
  share?: ReactNode;
  /** Who else works on the deck, shown to guests. */
  people?: WorkspacePerson[];
  readOnly?: boolean;
  backHref: string;
  /** Brief from the home composer, handed to the assistant on a new deck. */
  initialPrompt?: string | null;
  onInitialPromptUsed?: () => void;
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
  const [layerHover, setLayerHover] = useState<string | null>(null);
  const [imageTarget, setImageTarget] = useState<ImageTarget | null>(null);
  const [presenting, setPresenting] = useState<number | null>(null);
  // Badge shown unless the plan allows removing it and the user turned it off.
  const [keepBadge, setKeepBadge] = useState(true);
  const badge = !props.badgeRemovable || keepBadge;
  // Phones open on the canvas; the assistant slides over it on demand.
  const [chatOpen, setChatOpen] = useState(() => typeof window === "undefined" || window.innerWidth > 900);
  // Assistant width (drag handle) and slide strip placement, kept per browser.
  const [chatWidth, setChatWidth] = useState(() => readPref(CHAT_WIDTH_KEY, (v) => clampChat(Number(v)), CHAT_DEFAULT));
  const [railPos, setRailPos] = useState<"left" | "bottom">(() => readPref(RAIL_POS_KEY, (v) => (v === "bottom" ? "bottom" : "left"), "left"));
  const [panelOpen, setPanelOpen] = useState(() => readPref(PANEL_OPEN_KEY, (v) => v !== "0", true));
  const togglePanel = (open: boolean) => {
    setPanelOpen(open);
    writePref(PANEL_OPEN_KEY, open ? "1" : "0");
  };
  const changeRailPos = (pos: "left" | "bottom") => {
    setRailPos(pos);
    writePref(RAIL_POS_KEY, pos);
  };
  const resizeChat = (width: number) => {
    const next = clampChat(width);
    setChatWidth(next);
    writePref(CHAT_WIDTH_KEY, String(next));
  };
  const onChatHandleDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const start = chatWidth;
    const move = (ev: PointerEvent) => setChatWidth(clampChat(start + ev.clientX - startX));
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.classList.remove("de-resizing");
      resizeChat(start + ev.clientX - startX);
    };
    document.body.classList.add("de-resizing");
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const [insertOpen, setInsertOpen] = useState(false);
  const [emptyPicker, setEmptyPicker] = useState(false);
  const [commands, setCommands] = useState<TextCommands | null>(null);
  const [marks, setMarks] = useState<TextMarks | null>(null);
  const clipboard = useRef<ClipboardPayload | null>(null);
  const menu = useContextMenu();
  // Hand-offs from the right-click menu to the chat and the slide rail.
  const [chatRequest, setChatRequest] = useState<ChatRequest | null>(null);
  const [pickerAt, setPickerAt] = useState<{ index: number; nonce: number } | null>(null);

  const themeFile = doc?.deck.theme.tokens ?? "DESIGN.md";
  const [themeNonce, setThemeNonce] = useState(0);
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
  }, [load.status, themeFile, themeNonce]);

  // A design system was applied: DESIGN.md changed on the server, and
  // deck.json now names it (taken as the remote version, no conflict).
  const designSystemApplied = (paths: string[], designSystemId: string | null) => {
    setThemeNonce((n) => n + 1);
    const current = docState.state.doc;
    if (current && designSystemId && paths.some((p) => p.endsWith("deck.json"))) {
      docState.applyEvent({ type: "deck.deck", deck: { ...current.deck, theme: { ...current.deck.theme, designSystem: designSystemId } } });
    }
  };

  // The element tab follows the selection.
  const selectionCount = state.selection.length;
  useEffect(() => {
    if (selectionCount > 0) setTab((current) => (current === "deck" || current === "layers" ? current : "element"));
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
      if (presenting !== null || isTyping(e.target) || e.defaultPrevented) return;
      if (isContextMenuKey(e)) {
        e.preventDefault();
        menuKeyRef.current();
        return;
      }
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

  // ── right-click menus ─────────────────────────────────────────────────────

  const askChat = (request: ChatRequest) => {
    setChatOpen(true);
    setChatRequest(request);
  };

  /** Opens the properties panel on a field (by its label) or a section (by its title). */
  const reveal = (panelTab: PanelTab, label: string, section = false) => {
    setImageTarget(null);
    togglePanel(true);
    setTab(panelTab);
    window.setTimeout(() => {
      const root = document.querySelector(".de-panel");
      if (!root) return;
      const box = section
        ? Array.from(root.querySelectorAll(".de-section-head h3")).find((h) => h.textContent === label)?.closest(".de-section")
        : Array.from(root.querySelectorAll(".de-field")).find((f) => f.querySelector(".de-field-label")?.textContent === label);
      if (!box) return;
      box.scrollIntoView({ block: "nearest" });
      box.querySelector<HTMLElement>("input, textarea, select, button")?.focus({ preventScroll: true });
    }, 80);
  };

  const copyIds = (ids: string[], cut: boolean) => {
    const current = stateRef.current.doc && sid ? stateRef.current.doc.slides[sid] : undefined;
    if (!current || !ids.length) return;
    const payload = copyElements(current, ids);
    clipboard.current = payload;
    void navigator.clipboard?.writeText(JSON.stringify(payload)).catch(() => undefined);
    if (cut) dispatch({ type: "edit", recipe: deleteElements(current.id, ids), select: [] });
  };

  /** Pastes what was copied here first, else what the system clipboard holds; `at` puts it under the pointer. */
  const pasteFromMenu = async (at?: SlidePoint) => {
    let payload = clipboard.current;
    if (!payload) {
      try {
        payload = parseClipboard((await navigator.clipboard?.readText()) ?? "");
      } catch {
        payload = null;
      }
    }
    const s = stateRef.current;
    const current = s.doc && s.slideId ? s.doc.slides[s.slideId] : undefined;
    if (!payload || !current) return;
    const { slide: next, ids } = pasteElements(current, payload);
    const put = (d: Parameters<typeof updateSlide>[0]) => updateSlide(d, current.id, () => next);
    const bounds = at ? unionRect(ids.map((id) => absoluteBox(next, id)).filter((b): b is NonNullable<typeof b> => !!b).map(aabb)) : null;
    // Top-left corner under the pointer, kept inside the slide when it fits.
    const fmt = s.doc?.deck.format;
    const target = bounds && at && fmt ? { x: Math.max(0, Math.min(at.x, fmt.width - bounds.w)), y: Math.max(0, Math.min(at.y, fmt.height - bounds.h)) } : null;
    const recipe = bounds && target ? (d: Parameters<typeof updateSlide>[0]) => moveBy(current.id, ids, target.x - bounds.x, target.y - bounds.y, next)(put(d)) : put;
    dispatch({ type: "edit", recipe, select: ids });
  };

  const canPaste = () => !!clipboard.current || typeof navigator === "undefined" || typeof navigator.clipboard?.readText === "function";
  const aiReady = !!props.chat && !readOnly;

  const insertAt = (kind: InsertKind, at: SlidePoint) => {
    if (!slide || !doc) return;
    const element = newElement(kind, slide, doc.deck, { text: t("newText"), series: copyFor(locale).series });
    const x = Math.round(Math.min(Math.max(0, at.x - element.w / 2), Math.max(0, doc.deck.format.width - element.w)));
    const y = Math.round(Math.min(Math.max(0, at.y - element.h / 2), Math.max(0, doc.deck.format.height - element.h)));
    const placed = { ...element, x, y } as SlideElement;
    dispatch({ type: "edit", recipe: insertElement(sid, placed), select: [placed.id] });
  };

  const restoreRatio = (el: ImageElement) => {
    const img = new window.Image();
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) return;
      run(setFields(sid, [el.id], { h: Math.max(1, Math.round((el.w * img.naturalHeight) / img.naturalWidth)) }));
    };
    img.src = assetUrl(el.src);
  };

  const openCanvasMenu = (at: Point, point: SlidePoint, ids: string[]) => {
    if (!slide || !doc) return;
    const current = slide;
    const ro = !!readOnly;
    if (!ids.length) {
      menu.open(
        at,
        canvasMenu({
          t,
          readOnly: ro,
          canPaste: canPaste(),
          hasElements: current.elements.length > 0,
          hasBackgroundImage: current.background?.type === "image",
          aiReady,
          inserts: INSERTS.map(({ kind, label }) => ({ kind, label })),
          do: {
            paste: () => void pasteFromMenu(),
            pasteHere: () => void pasteFromMenu(point),
            selectAll: () => {
              const scope = state.groupScope ? locate(current.elements, state.groupScope)?.element : null;
              const list = scope && scope.type === "group" ? scope.children : current.elements;
              dispatch({ type: "select", ids: list.map((el) => el.id) });
            },
            insert: (kind) => insertAt(kind, point),
            insertImage: () => setImageTarget({ kind: "new" }),
            background: () => reveal("slide", t("background"), true),
            backgroundImage: () => setImageTarget({ kind: "background" }),
            removeBackgroundImage: () =>
              run((d) =>
                updateSlide(d, current.id, (sl) => {
                  const next = { ...sl };
                  delete next.background;
                  return next;
                }),
              ),
            changeLayout: () => askChat({ nonce: Date.now(), kind: "form", action: "change_layout" }),
            transition: () => reveal("slide", t("transition"), true),
            askAi: () => {
              dispatch({ type: "selectSlide", id: current.id, focus: true });
              askChat({ nonce: Date.now(), kind: "focus" });
            },
            present: () => {
              dispatch({ type: "editText", id: null });
              setPresenting(presentIndex(doc.deck, current.id));
            },
          },
        }),
        t("ctxCanvas"),
      );
      return;
    }
    const els = ids.map((id) => findElement(current, id)).filter((el): el is SlideElement => !!el);
    const single = els.length === 1 ? els[0] : null;
    const items: ContextMenuEntry[] = elementMenu({
      t,
      readOnly: ro,
      single,
      count: els.length,
      anyLocked: els.some((el) => el.locked),
      allLocked: els.length > 0 && els.every((el) => el.locked),
      canPaste: canPaste(),
      aiReady,
      rotation: single?.rotation ?? 0,
      do: {
        replaceImage: () => single && setImageTarget({ kind: "element", id: single.id }),
        fit: (fit) => single && run(setFields(current.id, [single.id], { fit: fit === "cover" ? undefined : fit })),
        restoreRatio: () => single?.type === "image" && restoreRatio(single),
        alt: () => reveal("element", t("alt")),
        editText: () => single && dispatch({ type: "editText", id: single.id }),
        ai: (action) => askChat(action === "translate" ? { nonce: Date.now(), kind: "form", action } : { nonce: Date.now(), kind: "quick", action }),
        fillWithImage: () => single && setImageTarget({ kind: "fill", id: single.id }),
        enterGroup: () => single && dispatch({ type: "enterGroup", id: single.id }),
        ungroup: () => single && ungroupSelection(single.id),
        group: () => {
          const id = freshId("group", allElementIds(current.elements));
          dispatch({ type: "edit", recipe: group(current.id, ids, id), select: [id] });
        },
        cut: () => copyIds(ids, true),
        copy: () => copyIds(ids, false),
        paste: () => void pasteFromMenu(),
        duplicate: () => {
          const result = duplicateElements(current, ids);
          dispatch({ type: "edit", recipe: (d) => updateSlide(d, current.id, () => result.slide), select: result.ids });
        },
        z: (move) => run(zOrder(current.id, ids, move)),
        align: (how) => run(align(current.id, current, doc.deck, ids, how)),
        distribute: (axis) => run(distribute(current.id, current, ids, axis)),
        rotate: (by) =>
          single &&
          run(
            patchElements(current.id, [single.id], (el) => {
              const next = { ...el };
              const angle = by === null ? 0 : normalizeAngle((el.rotation ?? 0) + by);
              if (angle) next.rotation = angle;
              else delete next.rotation;
              return next;
            }),
          ),
        lock: (locked) => run(setFields(current.id, ids, { locked: locked ? true : undefined })),
        link: () => reveal("element", t("link")),
        animation: () => reveal("element", t("animation"), true),
        askAi: () => askChat({ nonce: Date.now(), kind: "focus" }),
        remove: () => dispatch({ type: "edit", recipe: deleteElements(current.id, ids), select: [] }),
      },
    });
    menu.open(at, items, t("ctxElement"));
  };

  const openSlideMenu = (id: string, at: Point) => {
    if (!doc) return;
    const index = doc.deck.slides.findIndex((r) => r.id === id);
    const ref = doc.deck.slides[index];
    if (!ref) return;
    dispatch({ type: "selectSlide", id, focus: true });
    menu.open(
      at,
      slideMenu({
        t,
        readOnly: !!readOnly,
        index,
        total: doc.deck.slides.length,
        hidden: !!ref.hidden,
        aiReady,
        do: {
          addBefore: () => setPickerAt({ index, nonce: Date.now() }),
          addAfter: () => setPickerAt({ index: index + 1, nonce: Date.now() }),
          duplicate: () => {
            const result = duplicateSlide(doc, id);
            dispatch({ type: "edit", recipe: () => result.doc, slideId: result.id, select: [] });
          },
          toggleHidden: () => run((d) => updateRef(d, id, (r) => (r.hidden ? withoutHidden(r) : { ...r, hidden: true }))),
          move: (by) => run((d) => ({ ...d, deck: moveSlide(d.deck, index, index + by) })),
          present: () => {
            dispatch({ type: "editText", id: null });
            setPresenting(presentIndex(doc.deck, id));
          },
          askAi: () => askChat({ nonce: Date.now(), kind: "focus" }),
          remove: () => {
            if (window.confirm(t("confirmDeleteSlide"))) deleteSlide(id);
          },
        },
      }),
      t("ctxSlide"),
    );
  };

  // Menu key or Shift+F10 on the canvas: over the selection, else mid-slide.
  const menuKeyRef = useRef<() => void>(() => undefined);
  menuKeyRef.current = () => {
    if (!slide || !doc) return;
    const selectedBox = document.querySelector("[data-selected]");
    if (selection.length && selectedBox) {
      const at = centerOf(selectedBox);
      const box = absoluteBox(slide, selection[0]);
      if (at && box) openCanvasMenu(at, { x: box.x, y: box.y }, selection);
      return;
    }
    const at = centerOf(document.querySelector("[data-testid='deck-canvas-overlay']"));
    if (at) openCanvasMenu(at, { x: doc.deck.format.width / 2, y: doc.deck.format.height / 2 }, []);
  };

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

  const rail = (
    <SlideRail
      orientation={railPos === "bottom" ? "horizontal" : "vertical"}
      onOrientation={(o) => changeRailPos(o === "horizontal" ? "bottom" : "left")}
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
      onSlideContextMenu={openSlideMenu}
      pickerAt={pickerAt}
      onPickerAtDone={() => setPickerAt(null)}
    />
  );

  return (
    <div
      className={`de-root${chatOpen ? "" : " chat-closed"}${railPos === "bottom" ? " rail-bottom" : ""}`}
      style={{ "--de-chat-w": `${chatWidth}px` } as CSSProperties}
    >
      <WorkspaceBar
        kind="slides"
        name={doc.deck.title || props.projectName || t("untitled")}
        backHref={props.backHref}
        className="de-topbar"
        people={props.people}
        saveStatus={
          <span className={`de-save is-${docState.save}`} role="status">
            {saveLabel}
          </span>
        }
        center={
          <div className="de-topbar-tools">
            <IconButton icon="undo" size="sm" plain onClick={() => dispatch({ type: "undo" })} disabled={!canUndo(state) || readOnly} label={t("undo")} title={`${t("undo")} (Ctrl+Z)`} />
            <IconButton icon="redo" size="sm" plain onClick={() => dispatch({ type: "redo" })} disabled={!canRedo(state) || readOnly} label={t("redo")} title={`${t("redo")} (Ctrl+Shift+Z)`} />
            <div className="de-insert">
              <Button variant="ghost" size="sm" icon="plus" onClick={() => setInsertOpen(!insertOpen)} aria-expanded={insertOpen} aria-haspopup="menu" disabled={readOnly || !slide}>
                {t("insert")}
              </Button>
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
            <IconButton
              icon="layers"
              size="sm"
              plain
              onClick={() => {
                setImageTarget(null);
                togglePanel(true);
                setTab("layers");
              }}
              aria-pressed={panelOpen && !imageTarget && tab === "layers"}
              label={t("layers")}
            />
            <IconButton icon="layout" size="sm" plain onClick={() => setTab("deck")} label={t("deckSettings")} />
          </div>
        }
        tools={
          <IconButton
            icon="sparkles"
            size="sm"
            label={t("chat")}
            aria-pressed={chatOpen}
            aria-expanded={chatOpen}
            onClick={() => setChatOpen(!chatOpen)}
          />
        }
        actions={
          <>
            {props.share}
            {props.publisher && !readOnly ? (
              <PublishMenu publisher={props.publisher} badge={keepBadge} onBadgeChange={setKeepBadge} beforePublish={docState.flush} disabled={visibleCount === 0} t={t} />
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              icon="play"
              disabled={visibleCount === 0}
              onClick={() => {
                dispatch({ type: "editText", id: null });
                setPresenting(presentIndex(doc.deck, state.slideId));
              }}
              title={t("presentFromHere")}
            >
              <span className="f-bd-lbl">{t("present")}</span>
            </Button>
            {props.exportMenu ? (
              <div className="de-export-slot" onPointerDownCapture={() => void docState.flush()}>
                {props.exportMenu}
              </div>
            ) : null}
          </>
        }
      />

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
            initialPrompt={props.initialPrompt}
            onInitialPromptUsed={props.onInitialPromptUsed}
            onCollapse={() => setChatOpen(false)}
            uploadImage={props.images ? props.images.upload : undefined}
            assetUrl={assetUrl}
            request={chatRequest}
            onRequestDone={() => setChatRequest(null)}
          />
        ) : null}
        {chatOpen ? (
          <div
            className="de-chat-resize"
            role="separator"
            aria-orientation="vertical"
            aria-label={t("chatResize")}
            aria-valuemin={CHAT_MIN}
            aria-valuemax={CHAT_MAX}
            aria-valuenow={chatWidth}
            tabIndex={0}
            onPointerDown={onChatHandleDown}
            onDoubleClick={() => resizeChat(CHAT_DEFAULT)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                e.preventDefault();
                resizeChat(chatWidth + (e.key === "ArrowRight" ? 24 : -24));
              }
            }}
          />
        ) : null}

        {!chatOpen ? (
          <button type="button" className="de-chat-reopen" onClick={() => setChatOpen(true)} aria-label={t("chatOpen")} title={t("chatOpen")}>
            <PanelLeftOpen size={16} aria-hidden />
            <span>{t("chatTitle")}</span>
          </button>
        ) : null}

        {railPos === "left" ? rail : null}

        <div className="de-workarea">


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
                onContextMenu={({ x, y, point, ids }) => openCanvasMenu({ x, y }, point, ids)}
                highlight={layerHover}
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
        {railPos === "bottom" ? rail : null}
        </div>

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
        ) : !panelOpen ? (
          <button type="button" className="de-panel-reopen" onClick={() => togglePanel(true)} aria-label={t("panelOpen")} title={t("panelOpen")}>
            <PanelRightOpen size={16} aria-hidden />
            <span>{t("properties")}</span>
          </button>
        ) : slide && slideRef ? (
          <PropertiesPanel
            onCollapse={() => togglePanel(false)}
            designSystem={
              props.projectId ? <DeckDesignSystem projectId={props.projectId} t={t} readOnly={readOnly} onApplied={designSystemApplied} /> : null
            }
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
            onSelectLayers={(ids, parent) => {
              if (state.groupScope !== parent) dispatch({ type: "enterGroup", id: parent });
              dispatch({ type: "select", ids });
            }}
            onHoverLayer={setLayerHover}
            onLayerMenu={(at, ids) => openCanvasMenu(at, { x: 0, y: 0 }, ids)}
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

      <ContextMenu request={menu.request} onClose={menu.close} />

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

const CHAT_WIDTH_KEY = "forge_deck_chat_width";
const RAIL_POS_KEY = "forge_deck_rail_pos";
const PANEL_OPEN_KEY = "forge_deck_panel_open";
const CHAT_DEFAULT = 320;
const CHAT_MIN = 260;
const CHAT_MAX = 640;

function clampChat(width: number): number {
  return Number.isFinite(width) ? Math.round(Math.min(CHAT_MAX, Math.max(CHAT_MIN, width))) : CHAT_DEFAULT;
}

function readPref<T>(key: string, parse: (raw: string) => T, fallback: T): T {
  try {
    const raw = typeof window === "undefined" ? null : localStorage.getItem(key);
    return raw === null ? fallback : parse(raw);
  } catch {
    return fallback;
  }
}

function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode: the preference only lasts for this page.
  }
}
