import { ArrowDown, CarTaxiFront, Coffee, Music } from "lucide-react";

export const ONBOARD_KEY = "nova_onboard_done";

export const AVATAR_URL =
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=70";

export const SLIDES = [
  { kicker: "Welcome", title: "One account, every move", body: "Spend, save and send in seconds. Nova keeps your money in clear view." },
  { kicker: "Instant", title: "Send money in a tap", body: "Free transfers to any Nova user, and clean receipts for everyone else." },
  { kicker: "In control", title: "See where it goes", body: "Weekly spending, smart categories, and alerts the moment cash moves." },
];

export type Tab = "home" | "cards" | "activity" | "account";

export const TITLES: Record<Tab, string> = { home: "Nova", cards: "Cards", activity: "Activity", account: "Account" };
export const SUBS: Record<Tab, string> = { home: "Good morning, Amine", cards: "Manage your cards", activity: "This week", account: "Amine Kada" };

export const TX = [
  { name: "Kora Coffee", cat: "Café · Today", amt: "-2,400", in: false, icon: Coffee },
  { name: "Salary — Northwind", cat: "Income · Yesterday", amt: "+845,000", in: true, icon: ArrowDown },
  { name: "Yassir Ride", cat: "Transport · Yesterday", amt: "-3,150", in: false, icon: CarTaxiFront },
  { name: "Spotify", cat: "Subscription · Mon", amt: "-4,990", in: false, icon: Music },
  { name: "From Awa D.", cat: "Transfer · Mon", amt: "+15,000", in: true, icon: ArrowDown },
];

export type Tx = (typeof TX)[number];

export const SPEND = [
  { d: "M", h: 44 }, { d: "T", h: 62 }, { d: "W", h: 38 },
  { d: "T", h: 80 }, { d: "F", h: 95 }, { d: "S", h: 54 }, { d: "S", h: 30 },
];
