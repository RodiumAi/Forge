/**
 * Editor state and undo/redo history.
 *
 * The document (deck + slides) is immutable; every edit produces a new one.
 * History holds whole-document snapshots, which is cheap because unchanged
 * slides are shared between snapshots.
 *
 * - `edit` applies a change and records it. Edits with the same `key` within
 *   `COALESCE_MS` merge into one undo step (typing in a field, nudging).
 * - `preview` changes the document during a gesture (drag, resize, rotate)
 *   without recording; `gesture` does the same from the document as it was
 *   when the gesture began; `commit` then records the whole gesture as one step.
 * - `remote` replaces content from the server (AI events, conflict merges);
 *   it is recorded so the user can undo an AI change, unless `record: false`.
 */

import { allElementIds, type Doc } from "./model";

export const HISTORY_LIMIT = 100;
export const COALESCE_MS = 1000;

export type EditorState = {
  doc: Doc | null;
  past: Doc[];
  future: Doc[];
  /** Key and time of the last recorded edit, for coalescing. */
  lastKey: string | null;
  lastAt: number;
  /** Document before the gesture in progress, recorded on commit. */
  gestureBase: Doc | null;
  slideId: string | null;
  /** Selected element ids on the current slide (any depth). */
  selection: string[];
  /** The current slide itself is selected (AI target), not only shown. */
  slideSelected: boolean;
  /** Group whose children are being edited (double-click into a group). */
  groupScope: string | null;
  /** Text element in inline edit mode. */
  editingText: string | null;
};

export type EditorAction =
  | { type: "load"; doc: Doc }
  | { type: "edit"; recipe: (doc: Doc) => Doc; key?: string; at?: number; select?: string[]; slideId?: string }
  | { type: "preview"; recipe: (doc: Doc) => Doc }
  | { type: "gesture"; recipe: (doc: Doc) => Doc }
  | { type: "commit" }
  | { type: "cancelGesture" }
  | { type: "remote"; recipe: (doc: Doc) => Doc; record?: boolean }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "selectSlide"; id: string | null; focus?: boolean }
  | { type: "select"; ids: string[]; additive?: boolean }
  | { type: "focusDeck" }
  | { type: "enterGroup"; id: string | null }
  | { type: "editText"; id: string | null };

export function initialEditorState(): EditorState {
  return {
    doc: null,
    past: [],
    future: [],
    lastKey: null,
    lastAt: 0,
    gestureBase: null,
    slideId: null,
    selection: [],
    slideSelected: false,
    groupScope: null,
    editingText: null,
  };
}

function pushPast(past: Doc[], doc: Doc): Doc[] {
  const next = [...past, doc];
  return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next;
}

/** Keep the slide, selection and scopes pointing at things that still exist. */
function reconcile(state: EditorState): EditorState {
  const doc = state.doc;
  if (!doc) return state;
  const ids = doc.deck.slides.map((ref) => ref.id);
  let slideId = state.slideId;
  if (!slideId || !ids.includes(slideId) || !doc.slides[slideId]) slideId = ids.find((id) => doc.slides[id]) ?? null;
  const slide = slideId ? doc.slides[slideId] : undefined;
  const existing = slide ? allElementIds(slide.elements) : new Set<string>();
  const selection = slideId === state.slideId ? state.selection.filter((id) => existing.has(id)) : [];
  const groupScope = state.groupScope && existing.has(state.groupScope) && slideId === state.slideId ? state.groupScope : null;
  const editingText = state.editingText && existing.has(state.editingText) && slideId === state.slideId ? state.editingText : null;
  if (
    slideId === state.slideId &&
    selection.length === state.selection.length &&
    groupScope === state.groupScope &&
    editingText === state.editingText
  ) {
    return state;
  }
  return { ...state, slideId, selection, groupScope, editingText };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "load":
      return reconcile({ ...initialEditorState(), doc: action.doc, slideId: state.slideId });

    case "edit": {
      if (!state.doc) return state;
      const base = state.gestureBase ?? state.doc;
      const next = action.recipe(state.doc);
      if (next === state.doc) return state;
      const at = action.at ?? Date.now();
      const coalesce = !!action.key && action.key === state.lastKey && at - state.lastAt < COALESCE_MS && !state.gestureBase;
      return reconcile({
        ...state,
        doc: next,
        past: coalesce ? state.past : pushPast(state.past, base),
        future: [],
        lastKey: action.key ?? null,
        lastAt: at,
        gestureBase: null,
        slideId: action.slideId ?? state.slideId,
        selection: action.select ?? state.selection,
      });
    }

    case "preview": {
      if (!state.doc) return state;
      const next = action.recipe(state.doc);
      if (next === state.doc) return state;
      return { ...state, doc: next, gestureBase: state.gestureBase ?? state.doc };
    }

    case "gesture": {
      // Each pointer move recomputes from the document as it was when the gesture began.
      if (!state.doc) return state;
      const base = state.gestureBase ?? state.doc;
      const next = action.recipe(base);
      return { ...state, doc: next, gestureBase: base };
    }

    case "commit": {
      if (!state.gestureBase || !state.doc) return state;
      return {
        ...state,
        past: pushPast(state.past, state.gestureBase),
        future: [],
        gestureBase: null,
        lastKey: null,
      };
    }

    case "cancelGesture": {
      if (!state.gestureBase) return state;
      return reconcile({ ...state, doc: state.gestureBase, gestureBase: null });
    }

    case "remote": {
      if (!state.doc) return state;
      const next = action.recipe(state.doc);
      if (next === state.doc) return state;
      const record = action.record ?? true;
      return reconcile({
        ...state,
        doc: next,
        past: record ? pushPast(state.past, state.doc) : state.past,
        future: record ? [] : state.future,
        lastKey: null,
        gestureBase: null,
      });
    }

    case "undo": {
      if (!state.doc || state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return reconcile({
        ...state,
        doc: previous,
        past: state.past.slice(0, -1),
        future: [state.doc, ...state.future],
        lastKey: null,
        gestureBase: null,
        editingText: null,
      });
    }

    case "redo": {
      if (!state.doc || state.future.length === 0) return state;
      const [next, ...rest] = state.future;
      return reconcile({
        ...state,
        doc: next,
        past: pushPast(state.past, state.doc),
        future: rest,
        lastKey: null,
        gestureBase: null,
        editingText: null,
      });
    }

    case "selectSlide":
      return reconcile({
        ...state,
        slideId: action.id,
        selection: action.id === state.slideId ? state.selection : [],
        slideSelected: action.focus ?? state.slideSelected,
        groupScope: action.id === state.slideId ? state.groupScope : null,
        editingText: null,
      });

    case "select": {
      const ids = action.additive
        ? state.selection.includes(action.ids[0] ?? "")
          ? state.selection.filter((id) => !action.ids.includes(id))
          : [...state.selection, ...action.ids.filter((id) => !state.selection.includes(id))]
        : action.ids;
      return reconcile({
        ...state,
        selection: ids,
        slideSelected: true,
        editingText: state.editingText && ids.includes(state.editingText) ? state.editingText : null,
      });
    }

    case "focusDeck":
      return { ...state, selection: [], slideSelected: false, groupScope: null, editingText: null };

    case "enterGroup":
      return { ...state, groupScope: action.id, selection: [], editingText: null };

    case "editText":
      return { ...state, editingText: action.id, selection: action.id ? [action.id] : state.selection };

    default:
      return state;
  }
}

export function canUndo(state: EditorState): boolean {
  return state.past.length > 0;
}

export function canRedo(state: EditorState): boolean {
  return state.future.length > 0;
}
