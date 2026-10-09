import { Leaf, LeafyGreen, Sprout } from "lucide-react";

export const ONBOARD_KEY = "fern_onboard_done";

export const SLIDES = [
  { kicker: "Welcome", title: "Never forget to water again", body: "Fern learns each plant's rhythm and nudges you the day a drink is due." },
  { kicker: "Learn", title: "Care guides for every leaf", body: "Light, water and difficulty for hundreds of houseplants — in plain language." },
  { kicker: "Thrive", title: "Watch your jungle flourish", body: "Track streaks, log waterings, and keep every plant green and happy." },
];

export type Tab = "home" | "explore" | "add" | "profile";

export const TITLES: Record<Tab, string> = { home: "Fern", explore: "Explore", add: "Add a plant", profile: "Profile" };
export const SUBS: Record<Tab, string> = { home: "Good morning, Lina", explore: "Care guides", add: "Log a new plant", profile: "Lina Moreau" };

export const DUE = [
  { id: "fiddle", name: "Fiddle Leaf Fig", room: "Living room", icon: Leaf },
  { id: "calathea", name: "Calathea Orbifolia", room: "Bedroom", icon: Sprout },
  { id: "pothos", name: "Golden Pothos", room: "Kitchen shelf", icon: LeafyGreen },
];

export const PLANTS = [
  { name: "Monstera", next: "in 3 days", light: "Bright", icon: Leaf, grad: 0 },
  { name: "Snake Plant", next: "in 9 days", light: "Low light", icon: Sprout, grad: 1 },
  { name: "Peace Lily", next: "Today", light: "Shade", icon: LeafyGreen, grad: 2 },
  { name: "ZZ Plant", next: "in 5 days", light: "Medium", icon: Leaf, grad: 3 },
];

export const GUIDES = [
  { name: "Monstera Deliciosa", diff: "Easy", light: "Bright indirect" },
  { name: "Fiddle Leaf Fig", diff: "Tricky", light: "Bright indirect" },
  { name: "Snake Plant", diff: "Very easy", light: "Low to bright" },
  { name: "Calathea Orbifolia", diff: "Fussy", light: "Medium, no direct" },
  { name: "Golden Pothos", diff: "Easy", light: "Low to bright" },
  { name: "Peace Lily", diff: "Easy", light: "Shade to medium" },
];

export const LIGHTS = ["Low light", "Medium", "Bright indirect", "Full sun"];

export type PlantForm = { name: string; room: string; interval: string; light: string };
export const EMPTY_FORM: PlantForm = { name: "", room: "", interval: "7", light: LIGHTS[2] };
