import {
  Cloud, Contrast, Flower, Flower2, Focus, Footprints, Moon, Sun, Trees, Umbrella, Waves,
} from "lucide-react";

export const ONBOARD_KEY = "calmspace_onboard_done";

export const AVATAR_URL =
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=70";

export const SLIDES = [
  { kicker: "Breathe", title: "A calmer mind in minutes", body: "Short guided sessions that fit your day — no experience needed, just a quiet moment." },
  { kicker: "Guided", title: "Follow the breath", body: "Slow, looping breathing exercises to steady your nerves before anything that matters." },
  { kicker: "Rest", title: "Fall asleep, softly", body: "Sleep stories and gentle soundscapes that fade with you into deeper, easier rest." },
];

export type Tab = "home" | "explore" | "sleep" | "profile";

export const TITLES: Record<Tab, string> = { home: "Calm Space", explore: "Explore", sleep: "Sleep", profile: "You" };
export const SUBS: Record<Tab, string> = { home: "Good evening, Noor", explore: "Find your session", sleep: "Wind down for the night", profile: "Noor Haddad" };

export const CATEGORIES = ["Focus", "Anxiety", "Sleep", "Walk"];

export const SHORT_SESSIONS = [
  { name: "Morning clarity", meta: "Focus · 5 min", icon: Sun },
  { name: "Let go of tension", meta: "Anxiety · 8 min", icon: Flower2 },
  { name: "One quiet minute", meta: "Reset · 1 min", icon: Contrast },
];

export const EXPLORE = [
  { name: "Unwind after work", teacher: "with Maya Okonkwo", mins: "12 min", icon: Flower2 },
  { name: "Deep focus flow", teacher: "with Idris Bello", mins: "20 min", icon: Focus },
  { name: "Calm the racing mind", teacher: "with Lena Fischer", mins: "10 min", icon: Flower },
  { name: "Walking meditation", teacher: "with Sofia Marchetti", mins: "15 min", icon: Footprints },
  { name: "Gratitude at dusk", teacher: "with Amara Diallo", mins: "8 min", icon: Moon },
];

export const SOUNDS = [
  { name: "Gentle rain", meta: "Ambience · loops", icon: Umbrella },
  { name: "Ocean waves", meta: "Ambience · loops", icon: Waves },
  { name: "Night forest", meta: "Story · 28 min", icon: Trees },
  { name: "Distant thunder", meta: "Ambience · loops", icon: Cloud },
];
