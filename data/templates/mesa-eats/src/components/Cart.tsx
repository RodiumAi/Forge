import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ALL_DISHES, findRestaurant, SERVICE_RATE, type Dish } from "../data";

export type Line = { dish: Dish; qty: number };

export type ActiveOrder = {
  id: string;
  restaurantId: string;
  summary: string;
  count: number;
  total: number;
  step: number; // 0 confirmed, 1 cooking, 2 on the way, 3 delivered
  eta: string;
};

type CartValue = {
  restaurantId: string | null;
  lines: Line[];
  count: number;
  subtotal: number;
  fee: number;
  service: number;
  tip: number;
  setTip: (n: number) => void;
  total: number;
  qtyOf: (dishId: string) => number;
  add: (restaurantId: string, dish: Dish) => void;
  setQty: (dishId: string, qty: number) => void;
  clear: () => void;
  order: ActiveOrder | null;
  placeOrder: () => ActiveOrder | null;
};

const CartContext = createContext<CartValue | null>(null);

// A demo order already on its way, so the Orders tab shows the live tracker from the start.
const DEMO_ORDER: ActiveOrder = { id: "o-1057", restaurantId: "smash-club", summary: "Classic smash x2, Burger and fries", count: 3, total: 20700, step: 2, eta: "12:48" };

function clock(minutesFromNow: number) {
  const d = new Date(Date.now() + minutesFromNow * 60000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Cart and current order. The cart holds dishes from one restaurant at a time. */
export function CartProvider({ children }: { children: ReactNode }) {
  const [restaurantId, setRestaurantId] = useState<string | null>("smash-club");
  const [qty, setQtyMap] = useState<Record<string, number>>({ classic: 1, combo: 1 });
  const [tip, setTip] = useState(500);
  const [order, setOrder] = useState<ActiveOrder | null>(DEMO_ORDER);

  // Demo: a placed order moves one step forward every 12 seconds.
  useEffect(() => {
    if (!order || order.step >= 3) return;
    const t = window.setTimeout(() => setOrder((o) => (o ? { ...o, step: o.step + 1 } : o)), 12000);
    return () => window.clearTimeout(t);
  }, [order]);

  const value = useMemo<CartValue>(() => {
    const lines: Line[] = Object.entries(qty)
      .filter(([, q]) => q > 0)
      .map(([id, q]) => ({ dish: ALL_DISHES.find((d) => d.id === id)!, qty: q }))
      .filter((l) => l.dish);
    const count = lines.reduce((s, l) => s + l.qty, 0);
    const subtotal = lines.reduce((s, l) => s + l.qty * l.dish.price, 0);
    const fee = count ? findRestaurant(restaurantId ?? undefined)?.fee ?? 0 : 0;
    const service = Math.round((subtotal * SERVICE_RATE) / 50) * 50;
    const total = count ? subtotal + fee + service + tip : 0;

    function add(rid: string, dish: Dish) {
      if (rid !== restaurantId) {
        setRestaurantId(rid);
        setQtyMap({ [dish.id]: 1 });
        return;
      }
      setQtyMap((m) => ({ ...m, [dish.id]: (m[dish.id] ?? 0) + 1 }));
    }

    function setQty(dishId: string, q: number) {
      setQtyMap((m) => {
        const next = { ...m, [dishId]: Math.max(0, Math.min(20, q)) };
        if (next[dishId] === 0) delete next[dishId];
        return next;
      });
    }

    function placeOrder() {
      if (!count || !restaurantId) return null;
      const placed: ActiveOrder = {
        id: `o-${1058 + Math.floor(Math.random() * 40)}`,
        restaurantId,
        summary: lines.map((l) => (l.qty > 1 ? `${l.dish.name} x${l.qty}` : l.dish.name)).join(", "),
        count,
        total,
        step: 0,
        eta: clock(32),
      };
      setOrder(placed);
      setQtyMap({});
      return placed;
    }

    return {
      restaurantId, lines, count, subtotal, fee, service, tip, setTip, total,
      qtyOf: (id) => qty[id] ?? 0,
      add, setQty, clear: () => setQtyMap({}), order, placeOrder,
    };
  }, [qty, restaurantId, tip, order]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
