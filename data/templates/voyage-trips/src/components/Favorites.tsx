import { createContext, useContext, useState, type ReactNode } from "react";

type Favorites = { ids: string[]; has: (id: string) => boolean; toggle: (id: string) => void };

const FavoritesContext = createContext<Favorites | null>(null);

/** Saved destinations, shared by Explore, Saved, Profile and the detail screen. */
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>(["santorini", "kyoto", "iceland"]);
  const has = (id: string) => ids.includes(id);
  const toggle = (id: string) => setIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  return <FavoritesContext.Provider value={{ ids, has, toggle }}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used inside <FavoritesProvider>");
  return ctx;
}
