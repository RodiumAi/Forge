import { createContext, useContext, useState, type ReactNode } from "react";

type SavedState = { saved: string[]; isSaved: (id: string) => boolean; toggle: (id: string) => void };

const SavedContext = createContext<SavedState | null>(null);

/** Favorite sessions, shared by Explore, Sleep and Profile. */
export function SavedProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<string[]>(["forest-walk", "starfield"]);
  const isSaved = (id: string) => saved.includes(id);
  const toggle = (id: string) => setSaved((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  return <SavedContext.Provider value={{ saved, isSaved, toggle }}>{children}</SavedContext.Provider>;
}

export function useSaved() {
  const ctx = useContext(SavedContext);
  if (!ctx) throw new Error("useSaved must be used inside <SavedProvider>");
  return ctx;
}
