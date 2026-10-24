"use client";

/**
 * The central canvas: the slide rendered by the deck player (mode "edit"),
 * scaled to fit, with an interaction layer on top for selection, move,
 * resize, rotation, marquee selection, snapping guides and inline text
 * editing. No responsive layout: the slide keeps its canvas size and is
 * only scaled.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";
import { canvasSize, SlideCanvas, type AssetUrl, type ThemeTokens } from "@/components/deck-player";
import type { Deck, Slide, SlideElement } from "@/lib/contracts/forge-design";
import type { SlideNotice } from "./ai";
import {
  aabb,
  center,
  HANDLES,
  hitTest,
  rectFromPoints,
  rectsIntersect,
  resizeBox,
  rotationFromPointer,
  roundBox,
  snapMove,
  snapTargets,
  unionRect,
  type Box,
  type Guide,
  type Point,
  type Rect,
} from "./geometry";
import { absoluteBox, locate, outermost, removeElements, scaleChildren } from "./model";
import { patchElements } from "./ops";
import type { EditorAction } from "./state";
import type { DeckT } from "./strings";

type Gesture =
  | { kind: "move"; start: Point; ids: string[]; rect: Rect; others: Rect[]; moved: boolean }
  | { kind: "resize"; start: Point; id: string; box: Box; handle: keyof typeof HANDLES; type: SlideElement["type"]; moved: boolean }
  | { kind: "rotate"; id: string; center: Point; moved: boolean }
  | { kind: "marquee"; start: Point; current: Point; additive: boolean; base: string[] };

export type CanvasProps = {
  deck: Deck;
  slide: Slide;
  slideIndex: number;
  tokens: ThemeTokens;
  assetUrl: AssetUrl;
  selection: string[];
  groupScope: string | null;
  editingText: string | null;
  readOnly?: boolean;
  dispatch: (action: EditorAction) => void;
  notices: SlideNotice[];
  onDismissNotice: (notice: SlideNotice) => void;
  t: DeckT;
  /** Inline text editor for the element being edited, in canvas coordinates. */
  textEditor?: ReactNode;
};

const PADDING = 32;
const SNAP_PX = 6;

/** Elements that can be picked at the current scope, with their slide boxes. */
function scopeItems(slide: Slide, groupScope: string | null) {
  const list = groupScope ? locate(slide.elements, groupScope)?.element : null;
  const elements = list && list.type === "group" ? list.children : slide.elements;
  const out: (Box & { id: string; z?: number; locked?: boolean })[] = [];
  for (const el of elements) {
    const box = absoluteBox(slide, el.id);
    if (box) out.push({ ...box, id: el.id, z: el.z, locked: el.locked });
  }
  return out;
}

export function useContainerSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    read();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

export function EditorCanvas(props: CanvasProps) {
  const { deck, slide, tokens, assetUrl, selection, groupScope, editingText, readOnly, dispatch, t } = props;
  const size = canvasSize(deck);
  const [containerRef, container] = useContainerSize<HTMLDivElement>();
  const scale = Math.max(0.05, Math.min((container.width - PADDING * 2) / size.width, (container.height - PADDING * 2) / size.height));
  const stage = { width: size.width * scale, height: size.height * scale };

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [hover, setHover] = useState<string | null>(null);

  // The element being edited inline is drawn by the text editor, not the player.
  const displaySlide = useMemo(
    () => (editingText ? { ...slide, elements: removeElements(slide.elements, new Set([editingText])) } : slide),
    [slide, editingText],
  );

  const toCanvas = (e: { clientX: number; clientY: number }): Point => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
  };

  const slideId = slide.id;

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const p = toCanvas(e);
    const handle = (e.target as HTMLElement).closest<HTMLElement>("[data-handle]")?.dataset.handle;
    overlayRef.current?.setPointerCapture?.(e.pointerId);
    if (editingText) {
      dispatch({ type: "editText", id: null });
    }
    if (handle && selection.length === 1 && !readOnly) {
      const found = locate(slide.elements, selection[0]);
      const abs = absoluteBox(slide, selection[0]);
      if (!found || !abs || found.element.locked) return;
      if (handle === "rotate") {
        gesture.current = { kind: "rotate", id: found.element.id, center: center(abs), moved: false };
      } else {
        const el = found.element;
        gesture.current = {
          kind: "resize",
          start: p,
          id: el.id,
          box: { x: el.x, y: el.y, w: el.w, h: el.h, rotation: el.rotation ?? 0 },
          handle: handle as keyof typeof HANDLES,
          type: el.type,
          moved: false,
        };
      }
      return;
    }
    const items = scopeItems(slide, groupScope);
    const hit = hitTest(items, p);
    if (!hit) {
      if (groupScope) {
        const groupBox = absoluteBox(slide, groupScope);
        if (groupBox && !rectsIntersect(aabb(groupBox), { x: p.x, y: p.y, w: 1, h: 1 })) dispatch({ type: "enterGroup", id: null });
      }
      const additive = e.shiftKey;
      if (!additive) dispatch({ type: "select", ids: [] });
      gesture.current = { kind: "marquee", start: p, current: p, additive, base: additive ? selection : [] };
      return;
    }
    if (e.shiftKey) {
      dispatch({ type: "select", ids: [hit.id], additive: true });
      return;
    }
    const ids = selection.includes(hit.id) ? selection : [hit.id];
    if (!selection.includes(hit.id)) dispatch({ type: "select", ids });
    if (readOnly) return;
    const moving = outermost(slide, ids).filter((id) => !locate(slide.elements, id)?.element.locked);
    if (!moving.length) return;
    const rects = moving.map((id) => aabb(absoluteBox(slide, id)!));
    const others = items.filter((item) => !moving.includes(item.id)).map((item) => aabb(item));
    gesture.current = { kind: "move", start: p, ids: moving, rect: unionRect(rects)!, others, moved: false };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const p = toCanvas(e);
    const g = gesture.current;
    if (!g) {
      const hit = hitTest(scopeItems(slide, groupScope), p);
      setHover(hit?.id ?? null);
      return;
    }
    if (g.kind === "marquee") {
      g.current = p;
      const rect = rectFromPoints(g.start, p);
      setMarquee(rect);
      const ids = scopeItems(slide, groupScope)
        .filter((item) => rectsIntersect(aabb(item), rect))
        .map((item) => item.id);
      const merged = g.additive ? [...g.base, ...ids.filter((id) => !g.base.includes(id))] : ids;
      if (rect.w > 2 || rect.h > 2) dispatch({ type: "select", ids: merged });
      return;
    }
    if (g.kind === "move") {
      let dx = p.x - g.start.x;
      let dy = p.y - g.start.y;
      if (!g.moved && Math.hypot(dx, dy) * scale < 3) return;
      g.moved = true;
      if (e.shiftKey) {
        // Constrain to the main axis.
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      let found: Guide[] = [];
      if (!e.altKey) {
        const snapped = snapMove(g.rect, dx, dy, snapTargets(size, g.others), SNAP_PX / scale, size);
        dx = snapped.dx;
        dy = snapped.dy;
        found = snapped.guides;
      }
      setGuides(found);
      const ids = g.ids;
      const ddx = Math.round(dx);
      const ddy = Math.round(dy);
      dispatch({ type: "gesture", recipe: patchElements(slideId, ids, (el) => ({ ...el, x: el.x + ddx, y: el.y + ddy })) });
      return;
    }
    if (g.kind === "resize") {
      const delta = { x: p.x - g.start.x, y: p.y - g.start.y };
      const handle = HANDLES[g.handle];
      const corner = handle.sx !== 0 && handle.sy !== 0;
      const ratioByDefault = (g.type === "image" || g.type === "icon") && corner;
      const box = roundBox(resizeBox(g.box, handle, delta, { keepRatio: e.shiftKey !== ratioByDefault }));
      g.moved = true;
      dispatch({
        type: "gesture",
        recipe: patchElements(slideId, [g.id], (el) => {
          const next = { ...el, x: box.x, y: box.y, w: box.w, h: box.h } as SlideElement;
          // A group scales its content with it.
          if (next.type === "group") {
            const sx = box.w / el.w;
            const sy = box.h / el.h;
            next.children = scaleChildren(next.children, sx, sy, corner ? Math.min(sx, sy) : 1);
          }
          return next;
        }),
      });
      return;
    }
    if (g.kind === "rotate") {
      const angle = rotationFromPointer(g.center, p, e.shiftKey);
      g.moved = true;
      dispatch({
        type: "gesture",
        recipe: patchElements(slideId, [g.id], (el) => {
          const next = { ...el };
          if (angle) next.rotation = angle;
          else delete next.rotation;
          return next;
        }),
      });
    }
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    overlayRef.current?.releasePointerCapture?.(e.pointerId);
    const g = gesture.current;
    gesture.current = null;
    setGuides([]);
    setMarquee(null);
    if (!g || g.kind === "marquee") return;
    if (g.moved) dispatch({ type: "commit" });
  }

  function onDoubleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (readOnly) return;
    const p = toCanvas(e);
    const hit = hitTest(scopeItems(slide, groupScope), p);
    if (!hit) return;
    const el = locate(slide.elements, hit.id)?.element;
    if (!el) return;
    if (el.type === "text" && !el.locked) {
      dispatch({ type: "editText", id: el.id });
    } else if (el.type === "group") {
      dispatch({ type: "enterGroup", id: el.id });
      const child = hitTest(scopeItems(slide, el.id), p);
      if (child) dispatch({ type: "select", ids: [child.id] });
    }
  }

  // Screen boxes of the selection.
  const selected = selection
    .map((id) => {
      const box = absoluteBox(slide, id);
      const el = locate(slide.elements, id)?.element;
      return box && el ? { id, box, locked: !!el.locked } : null;
    })
    .filter((x): x is { id: string; box: Box; locked: boolean } => !!x);
  const single = selected.length === 1 ? selected[0] : null;
  const multiBounds = selected.length > 1 ? unionRect(selected.map((s) => aabb(s.box))) : null;
  const hoverBox = hover && !selection.includes(hover) ? absoluteBox(slide, hover) : null;
  const scopeBox = groupScope ? absoluteBox(slide, groupScope) : null;
  const slideNotices = props.notices.filter((n) => n.slideId === slide.id);

  const boxStyle = (box: Box): CSSProperties => ({
    left: box.x * scale,
    top: box.y * scale,
    width: box.w * scale,
    height: box.h * scale,
    transform: box.rotation ? `rotate(${box.rotation}deg)` : undefined,
  });

  return (
    <div ref={containerRef} className="de-canvas-area">
      <div className="de-stage" style={{ width: stage.width, height: stage.height }}>
        <div className="de-stage-canvas" style={{ width: size.width, height: size.height, transform: `scale(${scale})` }}>
          <SlideCanvas slide={displaySlide} size={size} tokens={tokens} mode="edit" assetUrl={assetUrl} />
        </div>
        <div
          ref={overlayRef}
          className="de-overlay"
          role="presentation"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={() => setHover(null)}
          onDoubleClick={onDoubleClick}
          data-testid="deck-canvas-overlay"
        >
          {scopeBox ? <div className="de-scope" style={boxStyle(scopeBox)} /> : null}
          {hoverBox ? <div className="de-hover" style={boxStyle(hoverBox)} /> : null}
          {selected.map((s) => (
            <div key={s.id} className={`de-selection${s.locked ? " is-locked" : ""}`} style={boxStyle(s.box)} data-selected={s.id}>
              {single && single.id === s.id && !s.locked && !readOnly && editingText !== s.id
                ? [
                    ...Object.keys(HANDLES).map((name) => <span key={name} className={`de-handle de-handle-${name}`} data-handle={name} />),
                    <span key="rotate" className="de-handle de-handle-rotate" data-handle="rotate" />,
                  ]
                : null}
            </div>
          ))}
          {multiBounds ? <div className="de-multi" style={boxStyle(multiBounds)} /> : null}
          {marquee ? <div className="de-marquee" style={boxStyle(marquee)} /> : null}
          {guides.map((g, i) =>
            g.axis === "x" ? (
              <div key={i} className="de-guide de-guide-x" style={{ left: g.at * scale, top: 0, height: stage.height }} />
            ) : (
              <div key={i} className="de-guide de-guide-y" style={{ top: g.at * scale, left: 0, width: stage.width }} />
            ),
          )}
        </div>
        {props.textEditor ? (
          <div className="de-text-layer" style={{ width: size.width, height: size.height, transform: `scale(${scale})` }}>
            {props.textEditor}
          </div>
        ) : null}
        {slideNotices.length ? (
          <ul className="de-notices" aria-live="polite">
            {slideNotices.map((notice) => (
              <li key={notice.code} className="de-notice">
                <AlertTriangle size={14} aria-hidden />
                <span>{notice.code === "SLIDE_FALLBACK" ? t("noticeFallback") : t("noticeScope", { detail: notice.detail ?? "" })}</span>
                <button type="button" onClick={() => props.onDismissNotice(notice)} aria-label={t("dismiss")} title={t("dismiss")}>
                  <X size={12} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
