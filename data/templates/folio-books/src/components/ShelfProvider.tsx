import { createContext, useContext, useState, type ReactNode } from "react";
import { SHELF, type Status } from "../data";

type Entry = { status: Status; progress: number };

type Shelf = {
  entries: Record<string, Entry>;
  entry: (id: string) => Entry | undefined;
  setStatus: (id: string, status: Status) => void;
  toggleWant: (id: string) => void;
  setProgress: (id: string, progress: number) => void;
};

const ShelfContext = createContext<Shelf | null>(null);

/** The reader's shelf (status and progress per book), shared by every screen. */
export default function ShelfProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Record<string, Entry>>(SHELF);

  function setStatus(id: string, status: Status) {
    setEntries((all) => ({ ...all, [id]: { status, progress: all[id]?.progress ?? 0 } }));
  }

  function toggleWant(id: string) {
    setEntries((all) => {
      const next = { ...all };
      if (next[id]?.status === "want") delete next[id];
      else if (!next[id]) next[id] = { status: "want", progress: 0 };
      return next;
    });
  }

  function setProgress(id: string, progress: number) {
    setEntries((all) => ({ ...all, [id]: { status: progress >= 1 ? "finished" : "reading", progress } }));
  }

  const value: Shelf = { entries, entry: (id) => entries[id], setStatus, toggleWant, setProgress };
  return <ShelfContext.Provider value={value}>{children}</ShelfContext.Provider>;
}

export function useShelf() {
  const shelf = useContext(ShelfContext);
  if (!shelf) throw new Error("useShelf must be used inside <ShelfProvider>");
  return shelf;
}
