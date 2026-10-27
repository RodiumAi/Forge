"use client";

/**
 * Loads a deck, holds the editor state, autosaves it and applies AI events.
 * The component tree reads `state` and calls the returned helpers; nothing
 * here touches the DOM.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Deck, Slide } from "@/lib/contracts/forge-design";
import { applyDeckEvent, type DeckEvent, type SlideNotice } from "./ai";
import { Autosaver, type DocTransport, type SaveConflict, type SaveKey, type SaveStatus } from "./autosave";
import { updateSlide, type Doc } from "./model";
import { editorReducer, initialEditorState, type EditorAction, type EditorState } from "./state";

export type LoadState = { status: "loading" } | { status: "ready" } | { status: "error"; message: string; code?: string };

export type DeckDocument = {
  state: EditorState;
  dispatch: (action: EditorAction) => void;
  load: LoadState;
  reload: () => void;
  save: SaveStatus;
  conflict: SaveConflict | null;
  resolveConflict: (choice: "mine" | "theirs") => void;
  notes: Record<string, string>;
  setNotes: (slideId: string, markdown: string) => void;
  notices: SlideNotice[];
  addNotice: (notice: SlideNotice) => void;
  dismissNotice: (notice: SlideNotice) => void;
  applyEvent: (event: DeckEvent) => void;
  flush: () => Promise<void>;
};

export function useDeckDocument(transport: DocTransport): DeckDocument {
  const [state, dispatch] = useReducer(editorReducer, undefined, initialEditorState);
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [save, setSave] = useState<SaveStatus>("saved");
  const [conflicts, setConflicts] = useState<SaveConflict[]>([]);
  const [notes, setNotesState] = useState<Record<string, string>>({});
  const [notices, setNotices] = useState<SlideNotice[]>([]);
  const [attempt, setAttempt] = useState(0);

  const docRef = useRef<Doc | null>(null);
  docRef.current = state.doc;
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const loadedNotes = useRef(new Set<string>());

  const saver = useMemo(
    () =>
      new Autosaver(transport, {
        getDoc: () => docRef.current,
        getNotes: () => notesRef.current,
        applyDeck: (deck: Deck) => dispatch({ type: "remote", record: false, recipe: (doc) => ({ ...doc, deck }) }),
        applySlide: (id: string, slide: Slide) =>
          dispatch({ type: "remote", record: false, recipe: (doc) => updateSlide(doc, id, () => slide) }),
        applyNotes: (id: string, markdown: string) => setNotesState((prev) => ({ ...prev, [id]: markdown })),
        onStatus: setSave,
        onConflict: (conflict) => setConflicts((prev) => [...prev.filter((c) => c.key !== conflict.key), conflict]),
        onError: (_error: unknown, _key: SaveKey) => undefined,
      }),
    [transport],
  );

  useEffect(() => {
    saver.revive();
    return () => saver.dispose();
  }, [saver]);

  // Load the deck and every slide body.
  useEffect(() => {
    let alive = true;
    setLoad({ status: "loading" });
    (async () => {
      try {
        const deck = await transport.getDeck();
        const bodies = await Promise.all(
          deck.value.slides.map(async (ref) => {
            try {
              return [ref.id, await transport.getSlide(ref.id)] as const;
            } catch {
              return [ref.id, { value: { id: ref.id, elements: [] } as Slide, etag: null }] as const;
            }
          }),
        );
        if (!alive) return;
        const slides: Record<string, Slide> = {};
        const etags: Partial<Record<SaveKey, string | null>> = { deck: deck.etag };
        for (const [id, body] of bodies) {
          slides[id] = body.value;
          etags[`slide:${id}`] = body.etag;
        }
        const doc: Doc = { deck: deck.value, slides };
        docRef.current = doc;
        loadedNotes.current = new Set();
        setNotesState({});
        saver.reset(doc, etags);
        dispatch({ type: "load", doc });
        setLoad({ status: "ready" });
      } catch (error) {
        if (!alive) return;
        const err = error as { message?: string; code?: string };
        setLoad({ status: "error", message: err?.message ?? "error", code: err?.code });
      }
    })();
    return () => {
      alive = false;
    };
  }, [transport, saver, attempt]);

  // Notes of the current slide, read once.
  useEffect(() => {
    const id = state.slideId;
    if (!id || load.status !== "ready" || loadedNotes.current.has(id)) return;
    loadedNotes.current.add(id);
    let alive = true;
    transport
      .getNotes(id)
      .then((res) => {
        if (!alive) return;
        saver.setNotesBase(id, res.value, res.etag);
        setNotesState((prev) => (id in prev ? prev : { ...prev, [id]: res.value }));
      })
      .catch(() => {
        loadedNotes.current.delete(id);
      });
    return () => {
      alive = false;
    };
  }, [state.slideId, load.status, transport, saver]);

  // Every change of the document or the notes re-arms the autosave timers.
  useEffect(() => {
    if (load.status === "ready" && !state.gestureBase) saver.changed();
  }, [state.doc, state.gestureBase, notes, load.status, saver]);

  // Save what is left when the page goes away.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void saver.flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [saver]);

  const setNotes = useCallback((slideId: string, markdown: string) => {
    setNotesState((prev) => ({ ...prev, [slideId]: markdown.slice(0, 20000) }));
  }, []);

  const applyEvent = useCallback(
    (event: DeckEvent) => {
      const doc = docRef.current;
      if (!doc) return;
      const next = applyDeckEvent(doc, event);
      if (event.type === "deck.deck") {
        saver.acceptRemoteDeck(event.deck);
        for (const ref of event.deck.slides) {
          if (!doc.slides[ref.id]) saver.acceptRemoteSlide(ref.id, next.slides[ref.id]);
        }
      } else if (event.type === "deck.slide") {
        saver.acceptRemoteSlide(event.slideId, next.slides[event.slideId]);
        if (event.notes !== undefined) {
          saver.acceptRemoteNotes(event.slideId, event.notes);
          loadedNotes.current.add(event.slideId);
          setNotesState((prev) => ({ ...prev, [event.slideId]: event.notes ?? "" }));
        }
        if (!event.fallback) {
          setNotices((prev) => prev.filter((n) => !(n.slideId === event.slideId && n.code === "SLIDE_FALLBACK")));
        }
      } else {
        saver.forgetSlide(event.slideId);
      }
      docRef.current = next;
      dispatch({ type: "remote", recipe: () => next });
    },
    [saver],
  );

  const resolveConflict = useCallback(
    (choice: "mine" | "theirs") => {
      const [first, ...rest] = conflicts;
      if (!first) return;
      saver.resolve(first, choice);
      setConflicts(rest);
    },
    [conflicts, saver],
  );

  const addNotice = useCallback((notice: SlideNotice) => {
    setNotices((prev) => [...prev.filter((n) => !(n.slideId === notice.slideId && n.code === notice.code)), notice]);
  }, []);

  const dismissNotice = useCallback((notice: SlideNotice) => {
    setNotices((prev) => prev.filter((n) => n !== notice));
  }, []);

  return {
    state,
    dispatch,
    load,
    reload: () => setAttempt((n) => n + 1),
    save,
    conflict: conflicts[0] ?? null,
    resolveConflict,
    notes,
    setNotes,
    notices,
    addNotice,
    dismissNotice,
    applyEvent,
    flush: () => saver.flush(),
  };
}
