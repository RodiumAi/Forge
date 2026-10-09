import {
  Award,
  Ban,
  BookOpen,
  Contrast,
  Droplet,
  Dumbbell,
  Flame,
  Flower2,
  Mountain,
  RotateCcw,
  Sunrise,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const ONBOARD_KEY = "loop_onboard_done";

export const SLIDES = [
  { kicker: "Welcome", title: "Build habits that stick", body: "Pick a few small routines and check them off each day. Loop keeps the momentum going." },
  { kicker: "Streaks", title: "Never break the chain", body: "Every day you show up grows your streak. Watch the flame count climb and the loop close." },
  { kicker: "Gentle nudges", title: "Reminders, not pressure", body: "Soft nudges at the right time. No guilt, no noise — just a quiet tap forward." },
];

export type Tab = "today" | "habits" | "stats" | "profile";

export const TITLES: Record<Tab, string> = { today: "Today", habits: "Habits", stats: "Stats", profile: "Profile" };
export const SUBS: Record<Tab, string> = {
  today: "Tuesday, Sep 19",
  habits: "5 active routines",
  stats: "Last 18 weeks",
  profile: "Maya Okonkwo",
};

export type Habit = {
  id: string;
  name: string;
  Icon: LucideIcon;
  schedule: string;
  streak: number;
  done: boolean;
};

export const INITIAL_HABITS: Habit[] = [
  { id: "water", name: "Drink water", Icon: Droplet, schedule: "8 glasses · Daily", streak: 24, done: true },
  { id: "read", name: "Read 20 min", Icon: BookOpen, schedule: "Evening · Daily", streak: 12, done: true },
  { id: "workout", name: "Workout", Icon: Dumbbell, schedule: "Mon–Fri · 30 min", streak: 6, done: true },
  { id: "meditate", name: "Meditate", Icon: Flower2, schedule: "Morning · 10 min", streak: 41, done: false },
  { id: "sugar", name: "No sugar", Icon: Ban, schedule: "All day · Daily", streak: 3, done: false },
];

/* Heatmap: 7 rows (weekdays) x 18 weeks of graded intensity (0 to 4). */
export const HEAT_ROWS = ["M", "T", "W", "T", "F", "S", "S"];
export const HEAT = [
  [3, 4, 2, 4, 3, 1, 0, 4, 4, 3, 2, 4, 3, 4, 2, 3, 4, 4],
  [2, 3, 4, 3, 4, 2, 1, 3, 4, 4, 3, 2, 4, 3, 4, 4, 3, 4],
  [4, 2, 3, 4, 2, 3, 4, 2, 3, 4, 4, 3, 2, 4, 3, 2, 4, 3],
  [1, 4, 3, 2, 4, 4, 3, 4, 2, 3, 4, 4, 3, 4, 2, 3, 4, 4],
  [3, 3, 4, 4, 3, 2, 4, 3, 4, 2, 3, 4, 4, 3, 4, 4, 2, 4],
  [0, 2, 3, 1, 4, 3, 2, 4, 3, 1, 2, 3, 4, 2, 3, 4, 3, 2],
  [2, 1, 0, 3, 2, 1, 3, 0, 2, 3, 1, 2, 0, 3, 2, 1, 4, 3],
];

export const ACHIEVEMENTS = [
  { Icon: Flame, name: "30-day streak", sub: "Meditate", got: true },
  { Icon: Sunrise, name: "Early bird", sub: "14 mornings in a row", got: true },
  { Icon: Award, name: "Perfect week", sub: "All habits, 7 days", got: true },
  { Icon: Mountain, name: "100 days total", sub: "Almost there — 86", got: false },
];

export const PREFS = [
  { Icon: Contrast, title: "Theme", sub: "Dark · Teal accent", action: "Change" },
  { Icon: RotateCcw, title: "Week starts", sub: "Monday", action: "Edit" },
];

export const AVATAR = "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=70";
