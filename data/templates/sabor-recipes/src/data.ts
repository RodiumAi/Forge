import { CookingPot, Soup, UtensilsCrossed } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const ONBOARD_KEY = "sabor_onboard_done";

export const SLIDES = [
  { kicker: "Cook tonight", title: "Recipes for real weeknights", body: "Honest dinners you can actually pull off after work — no 40-ingredient marathons." },
  { kicker: "Step by step", title: "Follow along, hands free", body: "Clear steps, timers, and swaps so you always know what happens next in the pan." },
  { kicker: "Save & shop", title: "Keep favorites, shop faster", body: "Bookmark what you love and turn any recipe into a tidy shopping list in a tap." },
];

export type Tab = "home" | "search" | "saved" | "profile";

export const TITLES: Record<Tab, string> = { home: "Sabor", search: "Search", saved: "Saved", profile: "Profile" };
export const SUBS: Record<Tab, string> = { home: "Good evening, Nadia", search: "Find tonight's dinner", saved: "Your cookbook", profile: "Nadia Rahmani" };

export const HERO = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=70";
export const AVATAR = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=200&q=70";
const THUMB_A = "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=200&q=70";
const THUMB_B = "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=200&q=70";

export const CATEGORIES = ["Breakfast", "Quick", "Veggie", "Dessert", "Grill"];
export const CUISINES = ["All", "Italian", "West African", "Thai", "Mexican", "Levantine"];

export type Recipe = { name: string; meta: string; min: number; rating: number; img: string };

export const RECIPES: Recipe[] = [
  { name: "Smoky Tomato Shakshuka", meta: "Breakfast · 2 servings", min: 25, rating: 4.8, img: THUMB_A },
  { name: "Peanut Chicken Bowls", meta: "West African · 4 servings", min: 35, rating: 4.7, img: THUMB_B },
  { name: "Charred Lemon Broccoli", meta: "Veggie · Side", min: 18, rating: 4.6, img: THUMB_A },
  { name: "Brown Butter Banana Bread", meta: "Dessert · 8 slices", min: 55, rating: 4.9, img: THUMB_B },
];

export const SEARCH_RESULTS: Recipe[] = [
  { name: "15-Minute Garlic Noodles", meta: "Quick · Vegetarian", min: 15, rating: 4.7, img: THUMB_B },
  { name: "Weeknight Beef Tacos", meta: "Mexican · 4 servings", min: 30, rating: 4.5, img: THUMB_A },
  { name: "Green Curry with Tofu", meta: "Thai · 3 servings", min: 40, rating: 4.6, img: THUMB_B },
];

export type Saved = { name: string; meta: string; min: number; times: number; img: string };
export const SAVED: Saved[] = [
  { name: "Crispy Chili Fried Rice", meta: "Quick · Dinner", min: 20, times: 6, img: THUMB_A },
  { name: "One-Pot Tomato Orzo", meta: "Veggie · Dinner", min: 28, times: 3, img: THUMB_B },
  { name: "Honey Harissa Salmon", meta: "Grill · Dinner", min: 22, times: 4, img: THUMB_A },
  { name: "Coconut Rice Pudding", meta: "Dessert", min: 35, times: 2, img: THUMB_B },
];

export const SHOPPING = [
  { item: "Roma tomatoes", qty: "6", done: false },
  { item: "Fresh cilantro", qty: "1 bunch", done: true },
  { item: "Coconut milk", qty: "2 cans", done: false },
];

export const ALLERGIES = ["Peanut-free", "Low dairy", "No shellfish"];

export const CHEFS: { name: string; note: string; Icon: LucideIcon }[] = [
  { name: "Amara Okafor", note: "West African comfort", Icon: CookingPot },
  { name: "Leo Bianchi", note: "Fast Italian classics", Icon: UtensilsCrossed },
  { name: "Mei Tan", note: "Weeknight noodles", Icon: Soup },
];

export const WEEK = ["M", "T", "W", "T", "F", "S", "S"];
