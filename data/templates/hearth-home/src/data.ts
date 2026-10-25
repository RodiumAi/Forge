import {
  Blinds,
  Fan,
  Lamp,
  LampDesk,
  Lightbulb,
  LockKeyhole,
  Speaker,
  Tv,
  type LucideIcon,
} from "lucide-react";

export const ONBOARD_KEY = "hearth_onboard_done";
export const CURRENCY = "FCFA";

const img = (id: string, w = 600) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;

export const ME = {
  first: "Kofi",
  name: "Kofi Mensah",
  role: "Owner, 3 members",
  avatar: img("photo-1507003211169-0a1dd7228f2d", 160),
};

export const HOME = { name: "Villa Cocotiers", city: "Cotonou", outside: 27 };

/** Warm living room photo blurred behind the Home header. */
export const HERO_PHOTO = img("photo-1772208392358-19e96bee3a73", 900);
export const ONBOARD_PHOTO = img("photo-1719887741662-f641ec603471", 900);

export const SLIDES = [
  { kicker: "Welcome home", title: "Every room, one warm glance", body: "Lights, climate, locks and speakers in a single calm screen that fits in your palm." },
  { kicker: "Comfort that learns", title: "It knows how you like evenings", body: "Scenes dim the lamps, cool the bedroom and lock the door before you even ask." },
  { kicker: "Energy, in plain sight", title: "Watch every watt, save every month", body: "Solar first, grid when needed, and a clear bill forecast before the month ends." },
];

export type Room = { id: string; name: string; photo: string; temp: number; humidity: number };

export const ROOMS: Room[] = [
  { id: "living", name: "Living room", photo: img("photo-1618221195710-dd6b41faaea6"), temp: 22.5, humidity: 48 },
  { id: "bedroom", name: "Bedroom", photo: img("photo-1616594039964-ae9021a400a0"), temp: 21, humidity: 52 },
  { id: "kitchen", name: "Kitchen", photo: img("photo-1556911220-bff31c812dba"), temp: 24, humidity: 44 },
  { id: "office", name: "Study", photo: img("photo-1593062096033-9a26b09da705"), temp: 23, humidity: 46 },
  { id: "bath", name: "Bathroom", photo: img("photo-1584622650111-993a426fbf0a"), temp: 25, humidity: 61 },
];

export type Device = {
  id: string;
  name: string;
  room: string;
  icon: LucideIcon;
  on: boolean;
  /** Brightness or level in %, only for dimmable lights. */
  level?: number;
  /** Short state shown when on, for non-dimmable devices. */
  detail?: string;
};

export const DEVICES: Device[] = [
  { id: "d1", name: "Floor lamp", room: "living", icon: Lamp, on: true, level: 70 },
  { id: "d2", name: "Ceiling lights", room: "living", icon: Lightbulb, on: true, level: 45 },
  { id: "d3", name: "Smart TV", room: "living", icon: Tv, on: false, detail: "Netflix" },
  { id: "d4", name: "Sonos One", room: "living", icon: Speaker, on: true, detail: "Playing Fela Kuti" },
  { id: "d5", name: "Bedside lamp", room: "bedroom", icon: Lamp, on: false, level: 30 },
  { id: "d6", name: "Ceiling fan", room: "bedroom", icon: Fan, on: true, detail: "Speed 2" },
  { id: "d7", name: "Blinds", room: "bedroom", icon: Blinds, on: false, detail: "Open 60%" },
  { id: "d8", name: "Pendant lights", room: "kitchen", icon: Lightbulb, on: true, level: 90 },
  { id: "d9", name: "Desk lamp", room: "office", icon: LampDesk, on: false, level: 80 },
  { id: "d10", name: "Front door", room: "living", icon: LockKeyhole, on: true, detail: "Locked" },
  { id: "d11", name: "Mirror light", room: "bath", icon: Lightbulb, on: false, level: 60 },
];

export const SCENES = [
  { id: "evening", label: "Evening" },
  { id: "movie", label: "Movie" },
  { id: "away", label: "Away" },
  { id: "night", label: "Good night" },
] as const;

export type SceneId = (typeof SCENES)[number]["id"];

export const ROOM_SCENES = [
  { id: "relax", label: "Relax", level: 35 },
  { id: "read", label: "Read", level: 75 },
  { id: "bright", label: "Bright", level: 100 },
  { id: "night", label: "Night", level: 10 },
] as const;

/** kWh per day, last 7 days; solar share of each day in %. */
export const ENERGY_WEEK = [
  { d: "Mon", kwh: 7.1, solar: 58 },
  { d: "Tue", kwh: 6.2, solar: 64 },
  { d: "Wed", kwh: 8.4, solar: 49 },
  { d: "Thu", kwh: 5.9, solar: 71 },
  { d: "Fri", kwh: 6.8, solar: 62 },
  { d: "Sat", kwh: 9.2, solar: 55 },
  { d: "Sun", kwh: 6.4, solar: 68 },
];

export const CONSUMERS = [
  { name: "Air conditioning", room: "Bedroom", kwh: 2.6, share: 41, icon: Fan },
  { name: "Fridge and oven", room: "Kitchen", kwh: 1.7, share: 27, icon: Lightbulb },
  { name: "Smart TV", room: "Living room", kwh: 0.9, share: 14, icon: Tv },
  { name: "Lights", room: "Whole home", kwh: 0.7, share: 11, icon: Lamp },
];

export type Tab = "home" | "rooms" | "energy" | "settings";

/** URL of each tab. Route path = kebab name of the screen file. */
export const PATHS: Record<Tab, string> = { home: "/", rooms: "/rooms", energy: "/energy", settings: "/settings" };

export const TITLES: Record<Tab, string> = { home: "Hearth", rooms: "Rooms", energy: "Energy", settings: "Settings" };

/** Tab matching the current URL (falls back to Home). */
export function tabFromPath(pathname: string): Tab {
  const path = pathname.replace(/\/+$/, "") || "/";
  return (Object.keys(PATHS) as Tab[]).find((t) => PATHS[t] === path) ?? "home";
}
