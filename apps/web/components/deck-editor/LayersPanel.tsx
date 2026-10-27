"use client";

/**
 * The layers of the current slide, front at the top as in Figma or Canva:
 * drag a row (or its grip on touch) to restack it among its siblings, Alt+Up
 * and Alt+Down for the keyboard, eye and lock per row, double click to rename,
 * groups unfold, Shift and Ctrl pick several, hovering a row outlines it on
 * the canvas and right click opens the element menu.
 */

import { ChevronRight, Code2, Eye, EyeOff, GripVertical, Group, ImageIcon, LineChart, Lock, Shapes, Smile, Table, Type, Unlock, Video } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";

import { centerOf, isContextMenuKey, useLongPress, type Point } from "@/components/ui/ContextMenu";
import type { Slide, SlideElement } from "@/lib/contracts/forge-design";
import { elementLabel, locate, paintOrder } from "./model";
import { placeLayers, setFields, zOrder, type Recipe } from "./ops";
import type { DeckT } from "./strings";

type Props = {
  slide: Slide;
  selection: string[];
  readOnly?: boolean;
  run: (recipe: Recipe, key?: string) => void;
  /** Select ids that all live in `parent` (null: the slide itself). */
  onSelect: (ids: string[], parent: string | null) => void;
  /** Outline an element on the canvas while its row is hovered. */
  onHover?: (id: string | null) => void;
  /** Right click, long press or Menu key on a row, after it was selected. */
  onMenu?: (at: Point, ids: string[]) => void;
  t: DeckT;
};

type Row = { el: SlideElement; parent: string | null; depth: number };
type Drop = { target: string; before: boolean };
type Drag = { ids: string[]; parent: string | null };

const TYPE_ICON = {
  text: Type,
  image: ImageIcon,
  shape: Shapes,
  icon: Smile,
  table: Table,
  chart: LineChart,
  video: Video,
  code: Code2,
  group: Group,
} as const;

/** Front first, as the list shows them. */
function frontFirst(elements: SlideElement[]): SlideElement[] {
  return [...paintOrder(elements)].reverse();
}

function parentOf(slide: Slide, id: string): string | null {
  const found = locate(slide.elements, id);
  return found?.ancestors.at(-1)?.id ?? null;
}

function siblingsOf(slide: Slide, parent: string | null): SlideElement[] {
  if (!parent) return slide.elements;
  const group = locate(slide.elements, parent)?.element;
  return group && group.type === "group" ? group.children : [];
}

export function LayersPanel({ slide, selection, readOnly, run, onSelect, onHover, onMenu, t }: Props) {
  const sid = slide.id;
  const listRef = useRef<HTMLUListElement>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [renaming, setRenaming] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);
  const anchor = useRef<string | null>(null);
  const suppressClick = useRef(false);
  const pressed = useRef<string | null>(null);
  /** Escape closes the rename field: its blur must not save. */
  const renameCancelled = useRef(false);

  // Unfold the groups that hold a selected element, so the selection shows.
  const selectionKey = selection.join(",");
  useEffect(() => {
    const open: string[] = [];
    for (const id of selection) for (const group of locate(slide.elements, id)?.ancestors ?? []) open.push(group.id);
    if (!open.length) return;
    setExpanded((prev) => (open.every((id) => prev.has(id)) ? prev : new Set([...prev, ...open])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey, slide.id]);

  useEffect(() => () => onHover?.(null), [onHover]);

  const rows = useMemo(() => {
    const out: Row[] = [];
    const walk = (list: SlideElement[], parent: string | null, depth: number) => {
      for (const el of frontFirst(list)) {
        out.push({ el, parent, depth });
        if (el.type === "group" && expanded.has(el.id)) walk(el.children, el.id, depth + 1);
      }
    };
    walk(slide.elements, null, 0);
    return out;
  }, [slide.elements, expanded]);

  const toggleOpen = (id: string, open?: boolean) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (open ?? !next.has(id)) next.add(id);
      else next.delete(id);
      return next;
    });

  /** What a gesture on `id` acts on: the selection when the row is part of it and all share a parent. */
  const targetIds = (id: string, parent: string | null): string[] => {
    if (!selection.includes(id)) return [id];
    return selection.every((s) => parentOf(slide, s) === parent) ? selection : [id];
  };

  const pick = (e: MouseEvent | KeyboardEvent, row: Row) => {
    const { el, parent } = row;
    const sameParent = selection.length > 0 && selection.every((s) => parentOf(slide, s) === parent);
    if ((e.ctrlKey || e.metaKey) && sameParent) {
      const ids = selection.includes(el.id) ? selection.filter((s) => s !== el.id) : [...selection, el.id];
      anchor.current = el.id;
      onSelect(ids, parent);
      return;
    }
    if (e.shiftKey && sameParent && anchor.current && parentOf(slide, anchor.current) === parent) {
      const order = frontFirst(siblingsOf(slide, parent)).map((s) => s.id);
      const a = order.indexOf(anchor.current);
      const b = order.indexOf(el.id);
      if (a >= 0 && b >= 0) {
        onSelect(order.slice(Math.min(a, b), Math.max(a, b) + 1), parent);
        return;
      }
    }
    anchor.current = el.id;
    onSelect([el.id], parent);
  };

  const openMenu = (at: Point, row: Row) => {
    if (!onMenu) return;
    const ids = targetIds(row.el.id, row.parent);
    if (!selection.includes(row.el.id)) onSelect(ids, row.parent);
    onMenu(at, ids);
  };

  const longPress = useLongPress((at) => {
    const row = rows.find((r) => r.el.id === pressed.current);
    if (row) openMenu(at, row);
  });

  // ── drag to restack ───────────────────────────────────────────────────────

  const dropAt = (x: number, y: number, current: Drag): Drop | null => {
    const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-layer]");
    if (!hit || !listRef.current?.contains(hit)) return null;
    const id = hit.dataset.layer!;
    if ((hit.dataset.parent || null) !== current.parent || current.ids.includes(id)) return null;
    const rect = hit.getBoundingClientRect();
    return { target: id, before: y < rect.top + rect.height / 2 };
  };

  const startDrag = (e: ReactPointerEvent, row: Row) => {
    if (readOnly || e.button !== 0 || renaming) return;
    const origin = { x: e.clientX, y: e.clientY };
    const pointerId = e.pointerId;
    let current: Drag | null = null;
    let target: Drop | null = null;
    const scroller = listRef.current?.closest<HTMLElement>(".de-panel-body") ?? null;

    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      if (!current) {
        if (Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y) < 5) return;
        longPress.cancel();
        current = { ids: targetIds(row.el.id, row.parent), parent: row.parent };
        setDrag(current);
      }
      ev.preventDefault();
      if (scroller) {
        const box = scroller.getBoundingClientRect();
        if (ev.clientY < box.top + 28) scroller.scrollBy(0, -8);
        else if (ev.clientY > box.bottom - 28) scroller.scrollBy(0, 8);
      }
      target = dropAt(ev.clientX, ev.clientY, current);
      setDrop(target);
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      if (current) {
        suppressClick.current = true;
        window.setTimeout(() => (suppressClick.current = false), 0);
        if (ev.type === "pointerup" && target) {
          const rest = frontFirst(siblingsOf(slide, current.parent)).filter((el) => !current!.ids.includes(el.id));
          const index = rest.findIndex((el) => el.id === target!.target);
          if (index >= 0) {
            const shown = target.before ? index : index + 1;
            run(placeLayers(sid, current.ids, rest.length - shown));
            if (!current.ids.every((id) => selection.includes(id))) onSelect(current.ids, current.parent);
          }
        }
      }
      setDrag(null);
      setDrop(null);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  // ── keyboard ──────────────────────────────────────────────────────────────

  const focusRow = (from: HTMLElement, step: number) => {
    const all = Array.from(listRef.current?.querySelectorAll<HTMLElement>(".de-layer-main") ?? []);
    const at = all.indexOf(from);
    all[Math.max(0, Math.min(all.length - 1, at + step))]?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, row: Row) => {
    const { el, parent } = row;
    if (isContextMenuKey(e)) {
      e.preventDefault();
      const at = centerOf(e.currentTarget);
      if (at) openMenu(at, row);
      return;
    }
    if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      if (readOnly) return;
      const up = e.key === "ArrowUp";
      run(zOrder(sid, targetIds(el.id, parent), e.shiftKey ? (up ? "front" : "back") : up ? "forward" : "backward"));
      // The row moved: keep the focus on it once it has rendered again.
      window.setTimeout(() => listRef.current?.querySelector<HTMLElement>(`[data-layer="${CSS.escape(el.id)}"] .de-layer-main`)?.focus(), 0);
      return;
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      focusRow(e.currentTarget, e.key === "ArrowUp" ? -1 : 1);
      return;
    }
    if (el.type === "group" && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
      e.preventDefault();
      toggleOpen(el.id, e.key === "ArrowRight");
      return;
    }
    if (e.key === "ArrowLeft" && parent) {
      e.preventDefault();
      listRef.current?.querySelector<HTMLElement>(`[data-layer="${CSS.escape(parent)}"] .de-layer-main`)?.focus();
      return;
    }
    // Left and right stay in the list instead of nudging the element.
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      return;
    }
    if (e.key === "F2" && !readOnly) {
      e.preventDefault();
      setRenaming(el.id);
    }
  };

  const rename = (el: SlideElement, value: string) => {
    setRenaming(null);
    if (renameCancelled.current) return;
    const name = value.trim();
    if ((el.name ?? "") === name || (!el.name && name === elementLabel(el))) return;
    run(setFields(sid, [el.id], { name: name || undefined }));
  };

  if (!slide.elements.length) return <p className="de-hint">{t("noElements")}</p>;

  const renderRow = (row: Row) => {
    const { el, parent, depth } = row;
    const Icon = TYPE_ICON[el.type];
    const selected = selection.includes(el.id);
    const open = el.type === "group" && expanded.has(el.id);
    const dropHere = drop?.target === el.id ? (drop.before ? " is-drop-before" : " is-drop-after") : "";
    const dragging = drag?.ids.includes(el.id) ? " is-dragging" : "";
    return (
      <li
        key={el.id}
        className={`de-layer${selected ? " is-selected" : ""}${el.hidden ? " is-hidden" : ""}${dropHere}${dragging}`}
        data-layer={el.id}
        data-parent={parent ?? ""}
        style={{ "--de-layer-depth": depth } as CSSProperties}
        onMouseEnter={() => onHover?.(el.id)}
        onMouseLeave={() => onHover?.(null)}
      >
        <div className="de-layer-row">
          {!readOnly ? (
            <span className="de-layer-grip" aria-hidden onPointerDown={(e) => startDrag(e, row)}>
              <GripVertical size={13} />
            </span>
          ) : null}
          {el.type === "group" ? (
            <button
              type="button"
              className={`de-layer-twisty${open ? " is-open" : ""}`}
              aria-label={open ? t("layerCollapse") : t("layerExpand")}
              aria-expanded={open}
              onClick={() => toggleOpen(el.id)}
            >
              <ChevronRight size={13} aria-hidden />
            </button>
          ) : (
            <span className="de-layer-twisty" aria-hidden />
          )}
          {renaming === el.id ? (
            <input
              className="de-layer-rename"
              defaultValue={el.name ?? elementLabel(el)}
              aria-label={t("layerRename")}
              autoFocus
              maxLength={80}
              onFocus={(e) => {
                renameCancelled.current = false;
                e.currentTarget.select();
              }}
              onBlur={(e) => rename(el, e.currentTarget.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") rename(el, e.currentTarget.value);
                else if (e.key === "Escape") {
                  renameCancelled.current = true;
                  setRenaming(null);
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="de-layer-main"
              aria-pressed={selected}
              title={readOnly ? undefined : t("layerHint")}
              onPointerDown={(e) => {
                if (e.pointerType === "touch") {
                  pressed.current = el.id;
                  longPress.onPointerDown(e);
                } else startDrag(e, row);
              }}
              onPointerMove={longPress.onPointerMove}
              onPointerUp={longPress.onPointerUp}
              onPointerCancel={longPress.onPointerCancel}
              onClick={(e) => {
                if (suppressClick.current || longPress.justFired()) return;
                pick(e, row);
              }}
              onDoubleClick={() => !readOnly && setRenaming(el.id)}
              onContextMenu={(e) => {
                if (e.shiftKey || !onMenu) return;
                e.preventDefault();
                if (longPress.justFired()) return;
                openMenu({ x: e.clientX, y: e.clientY }, row);
              }}
              onKeyDown={(e) => onKey(e, row)}
            >
              <Icon size={13} className="de-layer-icon" aria-hidden />
              <span className="de-layer-name">{elementLabel(el)}</span>
            </button>
          )}
          <button
            type="button"
            className={`de-layer-toggle${el.locked ? " is-on" : ""}`}
            aria-label={el.locked ? t("unlock") : t("lock")}
            title={el.locked ? t("unlock") : t("lock")}
            aria-pressed={!!el.locked}
            disabled={readOnly}
            onClick={() => run(setFields(sid, [el.id], { locked: el.locked ? undefined : true }))}
          >
            {el.locked ? <Lock size={13} aria-hidden /> : <Unlock size={13} aria-hidden />}
          </button>
          <button
            type="button"
            className={`de-layer-toggle${el.hidden ? " is-on" : ""}`}
            aria-label={el.hidden ? t("show") : t("hide")}
            title={el.hidden ? t("show") : t("hide")}
            aria-pressed={!!el.hidden}
            disabled={readOnly}
            onClick={() => run(setFields(sid, [el.id], { hidden: el.hidden ? undefined : true }))}
          >
            {el.hidden ? <EyeOff size={13} aria-hidden /> : <Eye size={13} aria-hidden />}
          </button>
        </div>
        {open && el.type === "group" ? <ul className="de-layer-children">{rows.filter((r) => r.parent === el.id).map(renderRow)}</ul> : null}
      </li>
    );
  };

  return (
    <div className={`de-layers-panel${drag ? " is-dragging" : ""}`}>
      <ul className="de-layer-list" ref={listRef} aria-label={t("layers")}>
        {rows.filter((r) => r.parent === null).map(renderRow)}
      </ul>
      {!readOnly ? <p className="de-hint de-layers-hint">{t("layersKeys")}</p> : null}
    </div>
  );
}
