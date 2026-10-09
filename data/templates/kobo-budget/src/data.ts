import {
  ArrowDown,
  Bell,
  Bus,
  CircleHelp,
  Clapperboard,
  Coins,
  Download,
  House,
  Shield,
  ShoppingCart,
  Target,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const ONBOARD_KEY = "kobo_onboard_done";

export const SLIDES = [
  { kicker: "See it", title: "Know where money goes", body: "Every expense sorted into clear categories, the moment you log it." },
  { kicker: "Plan it", title: "Set a budget per category", body: "Give groceries, transport and fun a monthly limit that fits your life." },
  { kicker: "Keep it", title: "Stay on track all month", body: "A single glance shows what's left, so payday never feels like a surprise." },
];

export type Tab = "home" | "add" | "stats" | "account";

export const TITLES: Record<Tab, string> = { home: "September", add: "New expense", stats: "Statistics", account: "Account" };
export const SUBS: Record<Tab, string> = { home: "Budget overview", add: "Log a spend", stats: "Last 6 months", account: "Awa Diallo" };

/* Monthly budget model (CFA) */
export const BUDGET = 2000;
export const SPENT = 1240;
export const LEFT = BUDGET - SPENT;
export const PCT = Math.round((SPENT / BUDGET) * 100);

export type Category = { name: string; Icon: LucideIcon; spent: number; limit: number; hue: string };

export const CATS: Category[] = [
  { name: "Groceries", Icon: ShoppingCart, spent: 380, limit: 450, hue: "var(--accent)" },
  { name: "Transport", Icon: Bus, spent: 210, limit: 240, hue: "#38bdf8" },
  { name: "Rent", Icon: House, spent: 520, limit: 520, hue: "#a78bfa" },
  { name: "Fun", Icon: Clapperboard, spent: 96, limit: 150, hue: "#f472b6" },
  { name: "Savings", Icon: Coins, spent: 34, limit: 200, hue: "#34d399" },
];

export const RECENT = [
  { name: "Marché Kermel", cat: "Groceries · Today", amt: "-6,200", Icon: ShoppingCart },
  { name: "Bus DDD", cat: "Transport · Today", amt: "-350", Icon: Bus },
  { name: "Cinéma Sea Plaza", cat: "Fun · Yesterday", amt: "-3,000", Icon: Clapperboard },
  { name: "Salary — Baobab Ltd", cat: "Income · 1 Sep", amt: "+845,000", Icon: ArrowDown, in: true },
];

export const MONTHS = [
  { d: "Apr", h: 58 }, { d: "May", h: 71 }, { d: "Jun", h: 49 },
  { d: "Jul", h: 88 }, { d: "Aug", h: 64 }, { d: "Sep", h: 62 },
];

export const CHIPS = ["Groceries", "Transport", "Rent", "Fun", "Savings", "Health"];
export const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"];

export const SETTINGS = [
  [
    { Icon: Target, title: "Monthly budget", sub: "2,000 CFA · resets 1st", action: "Edit" },
    { Icon: Wallet, title: "Accounts", sub: "Cash · Wave · Orange Money", action: "Manage" },
    { Icon: Download, title: "Export data", sub: "Download CSV of all expenses", action: "Export" },
    { Icon: Bell, title: "Reminders", sub: "Daily log · 20:00", action: "Set" },
  ],
  [
    { Icon: Shield, title: "Security", sub: "App lock · PIN", action: "Edit" },
    { Icon: CircleHelp, title: "Help & support", sub: "Guides and contact", action: "Open" },
  ],
];
