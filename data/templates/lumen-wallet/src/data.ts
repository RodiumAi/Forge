import {
  ArrowDownLeft,
  Bus,
  Coffee,
  Music2,
  ShoppingBag,
  Smartphone,
  UtensilsCrossed,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const ONBOARD_KEY = "lumen_onboard_done";
export const CURRENCY = "FCFA";

const img = (id: string, w = 160) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;

export const ME = {
  first: "Amine",
  name: "Amine Kada",
  handle: "@amine.k",
  avatar: img("photo-1506794778202-cad84cf45f1d"),
};

export const BALANCE = { total: "1 284 650", change: "+ 86 400", rate: "+7.2%" };

export const SLIDES = [
  { kicker: "Welcome to Lumen", title: "Money that moves at your speed", body: "One account for spending, saving and sending, with every franc in plain sight." },
  { kicker: "Instant transfers", title: "Send in three taps, free", body: "Pick a contact, type an amount, done. Receipts land on both phones instantly." },
  { kicker: "Smart insights", title: "Know where it goes", body: "Clean categories, a weekly pulse and gentle nudges before the month runs away." },
];

export type Contact = { id: string; name: string; avatar: string };

export const CONTACTS: Contact[] = [
  { id: "awa", name: "Awa", avatar: img("photo-1531123897727-8f129e1688ce") },
  { id: "kofi", name: "Kofi", avatar: img("photo-1507003211169-0a1dd7228f2d") },
  { id: "lina", name: "Lina", avatar: img("photo-1544005313-94ddf0286df2") },
  { id: "yao", name: "Yao", avatar: img("photo-1500648767791-00dcc994a43e") },
  { id: "sara", name: "Sara", avatar: img("photo-1438761681033-6461ffad8d80") },
];

export type Tx = { id: string; name: string; meta: string; amount: string; incoming: boolean; icon: LucideIcon };

export const TRANSACTIONS: Tx[] = [
  { id: "t1", name: "Café Kora", meta: "Coffee · 09:12", amount: "-2 400", incoming: false, icon: Coffee },
  { id: "t2", name: "From Awa Diallo", meta: "Transfer · 08:40", amount: "+25 000", incoming: true, icon: ArrowDownLeft },
  { id: "t3", name: "Gozem ride", meta: "Transport · Yesterday", amount: "-3 150", incoming: false, icon: Bus },
  { id: "t4", name: "Spotify", meta: "Subscription · Mon", amount: "-4 990", incoming: false, icon: Music2 },
  { id: "t5", name: "Marché Dantokpa", meta: "Shopping · Sun", amount: "-18 700", incoming: false, icon: ShoppingBag },
];

export const WEEK = [
  { d: "M", v: 42 }, { d: "T", v: 58 }, { d: "W", v: 35 }, { d: "T", v: 71 },
  { d: "F", v: 96 }, { d: "S", v: 64 }, { d: "S", v: 28 },
];

export type Category = { name: string; amount: string; share: number; icon: LucideIcon; tint: string };

export const CATEGORIES: Category[] = [
  { name: "Food & dining", amount: "84 300", share: 38, icon: UtensilsCrossed, tint: "#c6f432" },
  { name: "Shopping", amount: "52 100", share: 24, icon: ShoppingBag, tint: "#7dd3fc" },
  { name: "Transport", amount: "31 650", share: 14, icon: Bus, tint: "#fda4af" },
  { name: "Bills & phone", amount: "27 900", share: 13, icon: Smartphone, tint: "#fcd34d" },
  { name: "Energy", amount: "23 400", share: 11, icon: Zap, tint: "#c4b5fd" },
];

export type Tab = "home" | "cards" | "insights" | "profile";

/** URL of each tab. Route path = kebab name of the screen file. */
export const PATHS: Record<Tab, string> = { home: "/", cards: "/cards", insights: "/insights", profile: "/profile" };

export const TITLES: Record<Tab, string> = { home: "Lumen", cards: "Cards", insights: "Insights", profile: "Profile" };

/** Tab matching the current URL (falls back to Home). */
export function tabFromPath(pathname: string): Tab {
  const path = pathname.replace(/\/+$/, "") || "/";
  return (Object.keys(PATHS) as Tab[]).find((t) => PATHS[t] === path) ?? "home";
}
