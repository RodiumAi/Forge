import { createContext, useContext, useState, type ReactNode } from "react";
import { productById } from "../data";

export type BagLine = { key: string; productId: string; size: string; color: string; qty: number };

type ShopState = {
  bag: BagLine[];
  wishlist: string[];
  count: number;
  subtotal: number;
  add: (productId: string, size: string, color: string) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  isWished: (id: string) => boolean;
  toggleWish: (id: string) => void;
};

const ShopContext = createContext<ShopState | null>(null);

/** Bag and wishlist, shared by Shop, Product, Bag, Profile and the tab badge. */
export function ShopProvider({ children }: { children: ReactNode }) {
  const [bag, setBag] = useState<BagLine[]>([
    { key: "noor-knit:M:Natural", productId: "noor-knit", size: "M", color: "Natural", qty: 1 },
    { key: "marin-pump:38:Navy", productId: "marin-pump", size: "38", color: "Navy", qty: 1 },
  ]);
  const [wishlist, setWishlist] = useState<string[]>(["alba-coat", "sienna-bag"]);

  const count = bag.reduce((n, l) => n + l.qty, 0);
  const subtotal = bag.reduce((s, l) => s + (productById(l.productId)?.price ?? 0) * l.qty, 0);

  function add(productId: string, size: string, color: string) {
    const key = `${productId}:${size}:${color}`;
    setBag((lines) =>
      lines.some((l) => l.key === key)
        ? lines.map((l) => (l.key === key ? { ...l, qty: Math.min(9, l.qty + 1) } : l))
        : [...lines, { key, productId, size, color, qty: 1 }],
    );
  }

  const value: ShopState = {
    bag,
    wishlist,
    count,
    subtotal,
    add,
    setQty: (key, qty) => setBag((lines) => (qty < 1 ? lines.filter((l) => l.key !== key) : lines.map((l) => (l.key === key ? { ...l, qty: Math.min(9, qty) } : l)))),
    remove: (key) => setBag((lines) => lines.filter((l) => l.key !== key)),
    clear: () => setBag([]),
    isWished: (id) => wishlist.includes(id),
    toggleWish: (id) => setWishlist((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id])),
  };

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("useShop must be used inside <ShopProvider>");
  return ctx;
}
