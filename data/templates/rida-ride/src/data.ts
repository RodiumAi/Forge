import { Briefcase, BusFront, CarFront, CarTaxiFront, House } from "lucide-react";

export const ONBOARD_KEY = "rida_onboard_done";

export const AVATAR_URL =
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=70";

export const SLIDES = [
  { kicker: "Move now", title: "A ride in minutes", body: "Tap once and a nearby driver is on the way. No calls, no waiting on the curb." },
  { kicker: "No surprises", title: "Upfront prices", body: "See the exact fare before you book — every tier, every trip, locked in." },
  { kicker: "Peace of mind", title: "Track your driver", body: "Watch the car approach in real time and share your route with people you trust." },
];

export type Tab = "home" | "trips" | "activity" | "account";
export type RideId = "eco" | "comfort" | "van";

export const TITLES: Record<Tab, string> = { home: "Rida", trips: "Trips", activity: "Activity", account: "Account" };
export const SUBS: Record<Tab, string> = { home: "Point E · Dakar", trips: "Your rides", activity: "This month", account: "Amine Kada" };

export const RIDES: { id: RideId; name: string; desc: string; price: string; eta: string; icon: typeof CarFront }[] = [
  { id: "eco", name: "Eco", desc: "Affordable, everyday", price: "2,400", eta: "3 min", icon: CarFront },
  { id: "comfort", name: "Comfort", desc: "Newer cars, more room", price: "3,650", eta: "5 min", icon: CarTaxiFront },
  { id: "van", name: "Van", desc: "Up to 6 seats", price: "5,900", eta: "7 min", icon: BusFront },
];

export const TRIPS = [
  { from: "Home", to: "Airport T2", date: "Today · 14:20", fare: "5,900", status: "Upcoming", up: true },
  { from: "Office", to: "Almadies", date: "Yesterday · 19:05", fare: "3,150", status: "Completed", up: false },
  { from: "Plateau", to: "Home", date: "Mon · 08:40", fare: "2,400", status: "Completed", up: false },
  { from: "Mall", to: "Ngor", date: "Sun · 21:15", fare: "4,200", status: "Cancelled", up: false },
];

export const PLACES = [
  { label: "Home", addr: "Rue 12, Point E", icon: House },
  { label: "Work", addr: "Rida HQ, Plateau", icon: Briefcase },
];

export const RECEIPTS = [
  { name: "Airport T2", cat: "Comfort · Today", amt: "5,900" },
  { name: "Almadies", cat: "Eco · Yesterday", amt: "3,150" },
  { name: "Home", cat: "Eco · Mon", amt: "2,400" },
];
