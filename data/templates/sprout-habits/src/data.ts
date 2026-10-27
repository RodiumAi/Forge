import {
  Apple,
  BookOpen,
  Brain,
  Dumbbell,
  Footprints,
  GlassWater,
  Moon,
  Music,
  PenLine,
  PersonStanding,
  Salad,
  Sun,
  type LucideIcon,
} from "lucide-react";

export const ONBOARD_KEY = "sprout_onboard_done";

const img = (id: string, w = 600) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;

export const ME = {
  first: "Inès",
  name: "Inès Kouassi",
  handle: "@ines.grows",
  since: "Growing since March 2026",
  avatar: img("photo-1534528741775-53994a69daeb", 160),
};

export const ONBOARD_PHOTO = img("photo-1499209974431-9dddcece7f88", 900);

export const SLIDES = [
  { kicker: "Welcome to Sprout", title: "Small habits, planted daily", body: "Pick a few things that matter, check them off, and watch your days fill with green." },
  { kicker: "Streaks that motivate", title: "Keep the flame going", body: "Every check feeds a streak. Miss a day? Sprout keeps your best and helps you restart." },
  { kicker: "See yourself grow", title: "A month you can read at a glance", body: "A calm heatmap, your best streaks and gentle reminders at the time you choose." },
];

/** Pastel tile colours; `ink` is the readable accent used on that tile. */
export const PALETTE = {
  peach: { bg: "#ffe3d3", ink: "#c2582b" },
  sky: { bg: "#dfeaff", ink: "#3b67c4" },
  butter: { bg: "#fff1c2", ink: "#a37a00" },
  lilac: { bg: "#e8defe", ink: "#7451c9" },
  mint: { bg: "#d9f2e1", ink: "#2e8a4f" },
} as const;

export type Tint = keyof typeof PALETTE;

/** Icons offered by the new habit picker (stored by name). */
export const ICONS: Record<string, LucideIcon> = {
  water: GlassWater,
  run: Footprints,
  read: BookOpen,
  meditate: Brain,
  greens: Salad,
  stretch: PersonStanding,
  gym: Dumbbell,
  journal: PenLine,
  fruit: Apple,
  music: Music,
  sunrise: Sun,
  sleep: Moon,
};

export const FREQUENCIES = ["Every day", "Weekdays", "3 times a week", "Weekends"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export type Habit = {
  id: string;
  name: string;
  goal: string;
  icon: string;
  tint: Tint;
  time: string;
  frequency: Frequency;
  streak: number;
  best: number;
  /** Mon..Sun of this week; index 6 is today. */
  week: boolean[];
  photo?: string;
  note: string;
};

export const HABITS: Habit[] = [
  { id: "water", name: "Drink water", goal: "8 glasses", icon: "water", tint: "sky", time: "07:00", frequency: "Every day", streak: 18, best: 24, week: [true, true, true, true, true, true, true], photo: img("photo-1548839140-29a749e1cf4d"), note: "A glass before each meal makes it easy." },
  { id: "run", name: "Morning run", goal: "3 km", icon: "run", tint: "peach", time: "06:30", frequency: "Weekdays", streak: 6, best: 14, week: [true, true, false, true, true, false, true], photo: img("photo-1476480862126-209bfaa8edc8"), note: "Lagoon loop, Cocody side. Shoes by the door." },
  { id: "read", name: "Read 20 pages", goal: "20 pages", icon: "read", tint: "butter", time: "21:30", frequency: "Every day", streak: 12, best: 31, week: [true, true, true, true, true, true, false], photo: img("photo-1512820790803-83ca734da794"), note: "Currently: Things Fall Apart, chapter 9." },
  { id: "meditate", name: "Meditate", goal: "10 minutes", icon: "meditate", tint: "lilac", time: "07:15", frequency: "Every day", streak: 9, best: 21, week: [true, false, true, true, true, true, true], photo: img("photo-1506126613408-eca07ce68773"), note: "Breathing count 4, 7, 8 when the day is loud." },
  { id: "greens", name: "Eat greens", goal: "2 servings", icon: "greens", tint: "mint", time: "12:30", frequency: "Every day", streak: 4, best: 10, week: [false, true, true, false, true, true, true], photo: img("photo-1490645935967-10de6ba17061"), note: "Spinach in the attiéké counts." },
  { id: "stretch", name: "Evening stretch", goal: "15 minutes", icon: "stretch", tint: "peach", time: "20:00", frequency: "Every day", streak: 2, best: 8, week: [true, false, false, true, false, true, false], photo: img("photo-1544367567-0f2fcb009e0b"), note: "Hips and lower back, then legs up the wall." },
];

/** This week, Monday to Sunday (Sunday 25 October 2026 is today). */
export const WEEK = [
  { d: "Mon", n: 19 }, { d: "Tue", n: 20 }, { d: "Wed", n: 21 }, { d: "Thu", n: 22 },
  { d: "Fri", n: 23 }, { d: "Sat", n: 24 }, { d: "Sun", n: 25 },
];
export const TODAY = 6;

/** Completion level 0..4 for each day of October 2026 (heatmap). */
export const OCTOBER = [
  3, 4, 2, 4, 3, 1, 2, 4, 4, 3, 0, 2, 4, 4, 3, 4, 2, 1, 3, 4, 4, 2, 4, 4, 3,
];
/** September for the month switch. */
export const SEPTEMBER = [
  2, 1, 3, 2, 0, 1, 2, 3, 3, 2, 4, 1, 0, 2, 3, 3, 4, 2, 2, 3, 1, 0, 2, 3, 4, 3, 2, 4, 3, 3,
];

export const FRIENDS = [
  { name: "Ama", avatar: img("photo-1494790108377-be9c29b29330", 160) },
  { name: "Yao", avatar: img("photo-1500648767791-00dcc994a43e", 160) },
  { name: "Kofi", avatar: img("photo-1507003211169-0a1dd7228f2d", 160) },
];

export type Tab = "home" | "habits" | "stats" | "profile";

/** URL of each tab. Route path = kebab name of the screen file. */
export const PATHS: Record<Tab, string> = { home: "/", habits: "/habits", stats: "/stats", profile: "/profile" };

export const TITLES: Record<Tab, string> = { home: "Today", habits: "Habits", stats: "Stats", profile: "Profile" };

/** Tab matching the current URL (falls back to Today). */
export function tabFromPath(pathname: string): Tab {
  const path = pathname.replace(/\/+$/, "") || "/";
  return (Object.keys(PATHS) as Tab[]).find((t) => PATHS[t] === path) ?? "home";
}
