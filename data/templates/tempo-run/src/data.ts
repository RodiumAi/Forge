import { ArrowUp, HeartPulse, Plus, Watch } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const ONBOARD_KEY = "temporun_onboard_done";

export const SLIDES = [
  { kicker: "Welcome", title: "Track every run", body: "Distance, pace and elevation for every session — from a 5K to marathon day." },
  { kicker: "Live", title: "Pace & GPS, in real time", body: "See your route draw itself and hear split cues while your watch keeps score." },
  { kicker: "Goals", title: "Hit your weekly target", body: "Set a weekly distance goal, close your rings and keep the streak alive." },
];

export type Tab = "home" | "runs" | "stats" | "profile";

export const TITLES: Record<Tab, string> = { home: "Tempo", runs: "Runs", stats: "Stats", profile: "Profile" };
export const SUBS: Record<Tab, string> = { home: "Good morning, Kaya", runs: "Recent sessions", stats: "This week", profile: "Kaya Mensah" };

export const AVATAR = "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?auto=format&fit=crop&w=200&q=70";

export const RUNS = [
  { name: "Riverside Loop", when: "Today · 6:42 AM", km: "8.4", pace: "5:12", time: "43:41", seed: 0 },
  { name: "Hill Repeats", when: "Yesterday · 6:10 PM", km: "6.1", pace: "5:48", time: "35:22", seed: 1 },
  { name: "Easy Recovery", when: "Mon · 7:05 AM", km: "5.0", pace: "6:20", time: "31:40", seed: 2 },
  { name: "Tempo Session", when: "Sat · 8:20 AM", km: "12.3", pace: "4:58", time: "61:05", seed: 3 },
  { name: "Sunset Sprint", when: "Fri · 7:40 PM", km: "4.2", pace: "4:44", time: "19:53", seed: 0 },
];

export const WEEK = [
  { d: "M", h: 52 }, { d: "T", h: 74 }, { d: "W", h: 30 },
  { d: "T", h: 88 }, { d: "F", h: 40 }, { d: "S", h: 96 }, { d: "S", h: 58 },
];

/* Three activity meters for the Home hero (conic rings in CSS) */
export const RINGS = [
  { label: "Distance", value: "8.4", unit: "km", pct: 84, note: "of 10 km" },
  { label: "Pace", value: "5:12", unit: "/km", pct: 72, note: "target 5:20" },
  { label: "Calories", value: "612", unit: "kcal", pct: 61, note: "of 1,000" },
];

/* Personal bests: `badge` is a text label (5K, 10K, ½) or an icon. */
export const BESTS: { badge: string | LucideIcon; title: string; sub: string; amount: string; best: boolean }[] = [
  { badge: "5K", title: "21:04", sub: "Riverside Loop · Aug 30", amount: "4:12 /km", best: true },
  { badge: "10K", title: "44:38", sub: "Marina Route · Aug 12", amount: "4:27 /km", best: true },
  { badge: "½", title: "1:38:20", sub: "City Half · Jul 06", amount: "4:39 /km", best: true },
  { badge: ArrowUp, title: "Longest run", sub: "City Half · 21.1 km", amount: "21.1 km", best: false },
];

export const DEVICES: { Icon: LucideIcon; title: string; sub: string; paired: boolean }[] = [
  { Icon: Watch, title: "Apple Watch Ultra", sub: "Syncing · 84% battery", paired: true },
  { Icon: HeartPulse, title: "Garmin HRM-Pro", sub: "Heart rate · connected", paired: true },
  { Icon: Plus, title: "Add a device", sub: "Foot pod, headphones, bike", paired: false },
];
