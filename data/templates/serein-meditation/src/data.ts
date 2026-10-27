import { CloudRain, Flame, Trees, Waves, type LucideIcon } from "lucide-react";

export const ONBOARD_KEY = "serein_onboard_done";

const img = (id: string, w = 160) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;

export const ME = {
  first: "Aïcha",
  name: "Aïcha Mensah",
  since: "Breathing with Serein since March",
  avatar: img("photo-1531123897727-8f129e1688ce"),
};

export const SLIDES = [
  { kicker: "Welcome to Serein", title: "A softer start to", em: "every day", body: "Short guided sessions that fit between a coffee and your first meeting." },
  { kicker: "Follow the orb", title: "Breathe in rhythm,", em: "not in a rush", body: "The orb swells as you inhale and settles as you exhale. That is the whole lesson." },
  { kicker: "Sleep stories", title: "Drift off to", em: "slow voices", body: "Night tales, rain on the roof and ocean swell, with a timer that fades out for you." },
];

export type Category = "Sleep" | "Focus" | "Anxiety" | "Morning";

export type Session = {
  id: string;
  title: string;
  category: Category;
  minutes: number;
  guide: string;
  blurb: string;
  photo: string;
};

export const SESSIONS: Session[] = [
  { id: "soft-landing", title: "Soft landing", category: "Morning", minutes: 10, guide: "Nana Owusu", blurb: "Wake the body gently, set one kind intention for the day.", photo: img("photo-1470252649378-9c29740c9fa8", 900) },
  { id: "still-water", title: "Still water", category: "Focus", minutes: 12, guide: "Elise Martin", blurb: "Count the breath to ten and back. Thoughts become ripples.", photo: img("photo-1508672019048-805c876b67e2", 900) },
  { id: "loosen-the-knot", title: "Loosen the knot", category: "Anxiety", minutes: 8, guide: "Nana Owusu", blurb: "A body scan for the chest and jaw when the day feels tight.", photo: img("photo-1518241353330-0f7941c2d9b5", 900) },
  { id: "forest-walk", title: "Forest walk", category: "Focus", minutes: 15, guide: "Malik Diop", blurb: "Walk an imaginary trail, one footstep for every breath out.", photo: img("photo-1441974231531-c6227db76b6e", 900) },
  { id: "ocean-breath", title: "Ocean breath", category: "Anxiety", minutes: 6, guide: "Elise Martin", blurb: "Long exhales timed to the swell, for the moments before a call.", photo: img("photo-1505142468610-359e7d316be0", 900) },
  { id: "golden-hour", title: "Golden hour", category: "Morning", minutes: 7, guide: "Malik Diop", blurb: "Gratitude in three breaths, facing the light.", photo: img("photo-1506126613408-eca07ce68773", 900) },
  { id: "moon-over-clouds", title: "Moon over clouds", category: "Sleep", minutes: 20, guide: "Nana Owusu", blurb: "Release the day layer by layer until only the moon is left.", photo: img("photo-1532767153582-b1a0e5145009", 900) },
];

export const TODAY_ID = "soft-landing";

export const CATEGORIES: { name: Category; count: number; photo: string }[] = [
  { name: "Sleep", count: 42, photo: img("photo-1532767153582-b1a0e5145009", 600) },
  { name: "Focus", count: 28, photo: img("photo-1508672019048-805c876b67e2", 600) },
  { name: "Anxiety", count: 31, photo: img("photo-1518241353330-0f7941c2d9b5", 600) },
  { name: "Morning", count: 19, photo: img("photo-1470252649378-9c29740c9fa8", 600) },
];

export const RITUAL = [
  { id: "morning", label: "Morning", time: "07:30", done: true },
  { id: "midday", label: "Midday reset", time: "13:00", done: true },
  { id: "wind", label: "Wind down", time: "22:15", done: false },
];

export type Story = { id: string; title: string; narrator: string; minutes: number; photo: string };

export const STORIES: Story[] = [
  { id: "moon-over-clouds", title: "Moon over clouds", narrator: "Nana Owusu", minutes: 20, photo: img("photo-1532767153582-b1a0e5145009", 600) },
  { id: "starfield", title: "The quiet starfield", narrator: "Malik Diop", minutes: 32, photo: img("photo-1419242902214-272b3f66ee7a", 600) },
  { id: "northern-lights", title: "Northern lights, slowly", narrator: "Elise Martin", minutes: 27, photo: img("photo-1483347756197-71ef80e95f73", 600) },
  { id: "night-hill", title: "Night on the hill", narrator: "Nana Owusu", minutes: 24, photo: img("photo-1507400492013-162706c8c05e", 600) },
];

export const TONIGHT: Story = { id: "milky-way", title: "The milky way train", narrator: "Malik Diop", minutes: 35, photo: img("photo-1444703686981-a3abbc4d4fe3", 900) };

export const SOUNDS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "rain", label: "Rain", icon: CloudRain },
  { id: "ocean", label: "Ocean", icon: Waves },
  { id: "fire", label: "Fireplace", icon: Flame },
  { id: "forest", label: "Forest", icon: Trees },
];

/** October practice: day numbers with a session done. */
export const DONE_DAYS = [1, 2, 3, 5, 6, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
export const TODAY_DAY = 25;

export const STATS = [
  { value: "1 240", label: "Minutes" },
  { value: "86", label: "Sessions" },
  { value: "12", label: "Day streak" },
];

export type Tab = "home" | "explore" | "sleep" | "profile";

/** URL of each tab. Route path = kebab name of the screen file. */
export const PATHS: Record<Tab, string> = { home: "/", explore: "/explore", sleep: "/sleep", profile: "/profile" };

export const TITLES: Record<Tab, string> = { home: "Today", explore: "Explore", sleep: "Sleep", profile: "Profile" };

/** Tab matching the current URL (falls back to Home). */
export function tabFromPath(pathname: string): Tab {
  const path = pathname.replace(/\/+$/, "") || "/";
  return (Object.keys(PATHS) as Tab[]).find((t) => PATHS[t] === path) ?? "home";
}

export function findSession(id: string | undefined): Session | undefined {
  const s = SESSIONS.find((x) => x.id === id);
  if (s) return s;
  const story = [TONIGHT, ...STORIES].find((x) => x.id === id);
  return story && { id: story.id, title: story.title, category: "Sleep", minutes: story.minutes, guide: story.narrator, blurb: "A sleep story read slowly, fading out on its own.", photo: story.photo.replace("w=600", "w=900") };
}
