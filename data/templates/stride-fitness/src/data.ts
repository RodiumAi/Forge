export const ONBOARD_KEY = "stride_onboard_done";

const img = (id: string, w = 160) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;

export const ME = {
  first: "Kwame",
  name: "Kwame Asante",
  club: "Lagos Night Runners",
  level: "Pace setter",
  avatar: img("photo-1522529599102-193c0d76b5b6"),
};

export const SLIDES = [
  { kicker: "Welcome to Stride", title: "Every step counts. We count them.", body: "Runs, lifts and long walks, closed into three rings you can read in a second.", photo: img("photo-1594882645126-14020914d58d", 900) },
  { kicker: "Train with a plan", title: "Programs built by real coaches", body: "Intervals, strength blocks and mobility, scaled to the week you actually have.", photo: img("photo-1517836357463-d25dfeac3438", 900) },
  { kicker: "Run live", title: "One tap. Then just run.", body: "Big numbers, live pace and splits, readable mid-stride under the midday sun.", photo: img("photo-1552674605-db6ffd4facb5", 900) },
];

export type Goals = { move: number; exercise: number; stand: number };
export const GOALS: Goals = { move: 600, exercise: 45, stand: 12 };
export const START: Goals = { move: 486, exercise: 38, stand: 9 };

export type Run = { id: string; title: string; when: string; km: number; time: string; pace: string };

export const RUNS: Run[] = [
  { id: "r1", title: "Bar Beach loop", when: "Yesterday, 06:10", km: 8.4, time: "42:16", pace: "5:02" },
  { id: "r2", title: "Tempo on Ozumba", when: "Wed, 18:40", km: 6.0, time: "28:44", pace: "4:47" },
  { id: "r3", title: "Easy recovery", when: "Mon, 06:30", km: 5.2, time: "29:55", pace: "5:45" },
];

export type Kind = "Run" | "Strength" | "HIIT" | "Mobility";

export type Exercise = { name: string; detail: string };

export type Workout = {
  id: string;
  title: string;
  kind: Kind;
  coach: string;
  minutes: number;
  kcal: number;
  level: "Beginner" | "Intermediate" | "Advanced";
  photo: string;
  exercises: Exercise[];
};

export const WORKOUTS: Workout[] = [
  {
    id: "tempo-intervals", title: "Tempo intervals", kind: "Run", coach: "Coach Ada Nwosu", minutes: 42, kcal: 520, level: "Intermediate",
    photo: img("photo-1461896836934-ffe607ba8211", 900),
    exercises: [
      { name: "Easy warm-up jog", detail: "10 min, conversational" },
      { name: "Strides", detail: "4 x 20 s, walk back" },
      { name: "Tempo block", detail: "3 x 6 min at 4:40/km" },
      { name: "Float recovery", detail: "2 min between blocks" },
      { name: "Cool-down", detail: "8 min easy + calves" },
    ],
  },
  {
    id: "iron-basics", title: "Iron basics", kind: "Strength", coach: "Coach Femi Bello", minutes: 50, kcal: 410, level: "Beginner",
    photo: img("photo-1517836357463-d25dfeac3438", 900),
    exercises: [
      { name: "Goblet squat", detail: "4 x 10, 16 kg" },
      { name: "Romanian deadlift", detail: "4 x 8, 40 kg" },
      { name: "Push-up", detail: "3 x 12" },
      { name: "Single-arm row", detail: "3 x 10 each side" },
      { name: "Farmer carry", detail: "4 x 30 m" },
    ],
  },
  {
    id: "burn-30", title: "Burn 30", kind: "HIIT", coach: "Coach Lina Haddad", minutes: 30, kcal: 380, level: "Advanced",
    photo: img("photo-1599058917212-d750089bc07e", 900),
    exercises: [
      { name: "Battle ropes", detail: "6 x 30 s on / 30 s off" },
      { name: "Burpees", detail: "5 x 12" },
      { name: "Kettlebell swing", detail: "5 x 15, 20 kg" },
      { name: "Mountain climbers", detail: "4 x 40 s" },
    ],
  },
  {
    id: "hill-repeats", title: "Hill repeats", kind: "Run", coach: "Coach Ada Nwosu", minutes: 38, kcal: 470, level: "Advanced",
    photo: img("photo-1530143311094-34d807799e8f", 900),
    exercises: [
      { name: "Warm-up jog", detail: "12 min easy" },
      { name: "Hill sprints", detail: "8 x 45 s uphill, jog down" },
      { name: "Flat strides", detail: "4 x 20 s" },
      { name: "Cool-down", detail: "8 min easy" },
    ],
  },
  {
    id: "pull-day", title: "Pull day", kind: "Strength", coach: "Coach Femi Bello", minutes: 45, kcal: 360, level: "Intermediate",
    photo: img("photo-1541534741688-6078c6bfb5c5", 900),
    exercises: [
      { name: "Overhead press", detail: "5 x 5, 35 kg" },
      { name: "Pull-up", detail: "4 x 6" },
      { name: "Barbell row", detail: "4 x 8, 50 kg" },
      { name: "Face pull", detail: "3 x 15" },
    ],
  },
  {
    id: "core-reset", title: "Core reset", kind: "Mobility", coach: "Coach Lina Haddad", minutes: 20, kcal: 140, level: "Beginner",
    photo: img("photo-1518611012118-696072aa579a", 900),
    exercises: [
      { name: "Cat-cow", detail: "2 x 10 slow" },
      { name: "Bird dog", detail: "3 x 8 each side" },
      { name: "Hip flexor stretch", detail: "2 x 45 s each side" },
      { name: "Dead bug", detail: "3 x 10" },
    ],
  },
];

export const NEXT_ID = "tempo-intervals";

export const WEEK = [
  { d: "Mon", km: 5.2 }, { d: "Tue", km: 0 }, { d: "Wed", km: 6.0 }, { d: "Thu", km: 3.1 },
  { d: "Fri", km: 8.4 }, { d: "Sat", km: 12.6 }, { d: "Sun", km: 7.3 },
];

export type Period = "Week" | "Month" | "Year";

export const PERIODS: Record<Period, { km: string; delta: string; bars: { d: string; km: number }[]; summary: { label: string; value: string }[] }> = {
  Week: {
    km: "42.6", delta: "+18% vs last week", bars: WEEK.map((w) => ({ d: w.d.slice(0, 1), km: w.km })),
    summary: [{ label: "Runs", value: "6" }, { label: "Time", value: "3h 41m" }, { label: "Avg pace", value: "5:11" }, { label: "Elevation", value: "312 m" }],
  },
  Month: {
    km: "168.4", delta: "+9% vs September", bars: [{ d: "W1", km: 38.2 }, { d: "W2", km: 44.9 }, { d: "W3", km: 42.7 }, { d: "W4", km: 42.6 }],
    summary: [{ label: "Runs", value: "23" }, { label: "Time", value: "14h 52m" }, { label: "Avg pace", value: "5:18" }, { label: "Elevation", value: "1 240 m" }],
  },
  Year: {
    km: "1 486", delta: "On pace for 1 800 km", bars: ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O"].map((d, i) => ({ d, km: [96, 112, 158, 141, 132, 120, 149, 171, 154, 168][i] })),
    summary: [{ label: "Runs", value: "214" }, { label: "Time", value: "131h" }, { label: "Avg pace", value: "5:22" }, { label: "Elevation", value: "9 870 m" }],
  },
};

export const RECORDS = [
  { label: "5K", value: "22:48", when: "Lekki 5K, Sept 14" },
  { label: "10K", value: "48:31", when: "Ikoyi loop, Aug 2" },
  { label: "Half", value: "1:49:20", when: "Lagos Half, March 9" },
  { label: "Longest", value: "26.4 km", when: "Long run, Oct 5" },
];

export const CLUB = [
  { name: "Zainab", km: 54.2, avatar: img("photo-1548690312-e3b507d8c110") },
  { name: "You", km: 42.6, avatar: img("photo-1522529599102-193c0d76b5b6") },
  { name: "Tunde", km: 39.8, avatar: img("photo-1531384441138-2736e62e0919") },
  { name: "Claire", km: 31.5, avatar: img("photo-1580489944761-15a19d654956") },
];

export type Tab = "home" | "workouts" | "stats" | "profile";

/** URL of each tab. Route path = kebab name of the screen file. */
export const PATHS: Record<Tab, string> = { home: "/", workouts: "/workouts", stats: "/stats", profile: "/profile" };

export const TITLES: Record<Tab, string> = { home: "Today", workouts: "Workouts", stats: "Stats", profile: "Profile" };

/** Tab matching the current URL (falls back to Home). */
export function tabFromPath(pathname: string): Tab {
  const path = pathname.replace(/\/+$/, "") || "/";
  return (Object.keys(PATHS) as Tab[]).find((t) => PATHS[t] === path) ?? "home";
}
