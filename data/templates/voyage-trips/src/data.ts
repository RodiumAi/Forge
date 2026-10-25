export const ONBOARD_KEY = "voyage_onboard_done";

const img = (id: string, w = 600) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;

/** Prices are per night, in euros. */
export const euro = (n: number) => `€${n.toLocaleString("en-US")}`;

export const ME = {
  first: "Adjoa",
  name: "Adjoa Mensah",
  city: "Cotonou, Benin",
  since: "Exploring since 2021",
  avatar: img("photo-1531123897727-8f129e1688ce", 160),
};

export const SLIDES = [
  { kicker: "Welcome to Voyage", title: "The world, one quiet escape at a time", body: "Hand-picked places, honest prices per night and stays that feel like a secret." },
  { kicker: "Save as you dream", title: "Keep every place that makes you pause", body: "Tap the heart on any destination and build your shortlist for later." },
  { kicker: "Trips, sorted", title: "Boarding pass and plan in one pocket", body: "Flights, stays and a day-by-day itinerary, ready offline the moment you book." },
];

export type Category = "All" | "Beaches" | "Mountains" | "Cities" | "Islands";
export const CATEGORIES: Category[] = ["All", "Beaches", "Mountains", "Cities", "Islands"];

export type Destination = {
  id: string;
  name: string;
  country: string;
  category: Exclude<Category, "All">;
  photo: string;
  thumb: string;
  rating: number;
  reviews: number;
  price: number;
  flight: string;
  stay: string;
  description: string;
  highlights: string[];
  gallery: string[];
};

export const DESTINATIONS: Destination[] = [
  {
    id: "santorini", name: "Santorini", country: "Greece", category: "Islands",
    photo: img("photo-1570077188670-e3a8d69ac5ff", 900), thumb: img("photo-1570077188670-e3a8d69ac5ff", 300),
    rating: 4.9, reviews: 2148, price: 184, flight: "6h 40m", stay: "Kima cave suites, Oia",
    description: "Whitewashed cliffs above a flooded caldera, sunsets that stop conversations and tiny tavernas where the fish was swimming this morning.",
    highlights: ["Oia sunset", "Caldera sail", "Volcanic beaches", "Wine tasting"],
    gallery: [img("photo-1533105079780-92b9be482077", 300), img("photo-1520250497591-112f2f40a3f4", 300), img("photo-1519046904884-53103b34b206", 300)],
  },
  {
    id: "kyoto", name: "Kyoto", country: "Japan", category: "Cities",
    photo: img("photo-1493976040374-85c8e12f0c0e", 900), thumb: img("photo-1493976040374-85c8e12f0c0e", 300),
    rating: 4.8, reviews: 3410, price: 142, flight: "17h 10m", stay: "Machiya house, Gion",
    description: "Wooden lanes in Higashiyama, a thousand vermilion gates and tea poured slowly. Kyoto rewards early mornings and unhurried walks.",
    highlights: ["Fushimi Inari", "Gion at dusk", "Tea ceremony", "Arashiyama"],
    gallery: [img("photo-1528164344705-47542687000d", 300), img("photo-1540959733332-eab4deabeeaf", 300), img("photo-1493976040374-85c8e12f0c0e", 300)],
  },
  {
    id: "braies", name: "Lago di Braies", country: "Italy", category: "Mountains",
    photo: img("photo-1501785888041-af3ef285b470", 900), thumb: img("photo-1501785888041-af3ef285b470", 300),
    rating: 4.8, reviews: 986, price: 156, flight: "7h 05m", stay: "Lakeside lodge, Dolomites",
    description: "An emerald lake under the Dolomite walls, wooden rowing boats at the pier and trails that start right at your door.",
    highlights: ["Rowing at dawn", "Seekofel hike", "Alpine spa", "Ladin cuisine"],
    gallery: [img("photo-1476514525535-07fb3b4ae5f1", 300), img("photo-1464822759023-fed622ff2c3b", 300), img("photo-1506905925346-21bda4d32df4", 300)],
  },
  {
    id: "bali", name: "Bali", country: "Indonesia", category: "Islands",
    photo: img("photo-1537996194471-e657df975ab4", 900), thumb: img("photo-1537996194471-e657df975ab4", 300),
    rating: 4.7, reviews: 4120, price: 98, flight: "19h 30m", stay: "Jungle villa, Ubud",
    description: "Lake temples wrapped in mist, rice terraces stepping down the valleys and villas where breakfast floats in the pool.",
    highlights: ["Ulun Danu Beratan", "Rice terraces", "Uluwatu sunset", "Balinese massage"],
    gallery: [img("photo-1518548419970-58e3b4079ab2", 300), img("photo-1571896349842-33c89424de2d", 300), img("photo-1537996194471-e657df975ab4", 300)],
  },
  {
    id: "maldives", name: "Maldives", country: "Baa Atoll", category: "Beaches",
    photo: img("photo-1573843981267-be1999ff37cd", 900), thumb: img("photo-1573843981267-be1999ff37cd", 300),
    rating: 4.9, reviews: 1532, price: 420, flight: "11h 45m", stay: "Overwater villa",
    description: "A ladder from your deck straight into turquoise water, manta rays at Hanifaru Bay and nights with no light but the stars.",
    highlights: ["Overwater villa", "Manta snorkel", "Sandbank picnic", "Sunset dhoni"],
    gallery: [img("photo-1514282401047-d79a71a590e8", 300), img("photo-1507525428034-b723cf961d3e", 300), img("photo-1519046904884-53103b34b206", 300)],
  },
  {
    id: "ait-benhaddou", name: "Aït Benhaddou", country: "Morocco", category: "Mountains",
    photo: img("photo-1489749798305-4fea3ae63d43", 900), thumb: img("photo-1489749798305-4fea3ae63d43", 300),
    rating: 4.6, reviews: 712, price: 76, flight: "5h 20m", stay: "Kasbah riad",
    description: "A clay ksar glowing at the foot of the High Atlas, mint tea on rooftops and the Sahara a short drive south.",
    highlights: ["Ksar at sunrise", "Atlas drive", "Desert camp", "Rooftop dinners"],
    gallery: [img("photo-1473496169904-658ba7c44d8a", 300), img("photo-1539635278303-d4002c07eae3", 300), img("photo-1489749798305-4fea3ae63d43", 300)],
  },
  {
    id: "iceland", name: "Seljalandsfoss", country: "Iceland", category: "Mountains",
    photo: img("photo-1476610182048-b716b8518aae", 900), thumb: img("photo-1476610182048-b716b8518aae", 300),
    rating: 4.8, reviews: 1204, price: 168, flight: "9h 50m", stay: "Glass cabin, South coast",
    description: "Waterfalls you can walk behind, black sand beaches and, if the sky is kind, the northern lights over your cabin roof.",
    highlights: ["Walk behind the falls", "Northern lights", "Black sand beach", "Hot springs"],
    gallery: [img("photo-1531366936337-7c912a4589a7", 300), img("photo-1504829857797-ddff29c27927", 300), img("photo-1476610182048-b716b8518aae", 300)],
  },
  {
    id: "porto", name: "Porto", country: "Portugal", category: "Cities",
    photo: img("photo-1555881400-74d7acaacd8b", 900), thumb: img("photo-1555881400-74d7acaacd8b", 300),
    rating: 4.7, reviews: 2256, price: 112, flight: "6h 15m", stay: "Riverside loft, Ribeira",
    description: "Tiled facades tumbling down to the Douro, port lodges across the bridge and pastéis de nata still warm at 8 am.",
    highlights: ["Ribeira walk", "Port cellars", "Douro valley", "Azulejo hunt"],
    gallery: [img("photo-1488646953014-85cb44e25828", 300), img("photo-1530521954074-e64f6810b32d", 300), img("photo-1555881400-74d7acaacd8b", 300)],
  },
];

export const byId = (id: string | undefined) => DESTINATIONS.find((d) => d.id === id);

/** Short escapes listed under the carousel on Explore. */
export const ESCAPES = ["porto", "ait-benhaddou", "braies"];

export const TRIP = {
  destination: "santorini",
  dates: "Nov 14 to Nov 19",
  countdown: 12,
  flight: { code: "AF 1832", from: "COO", fromCity: "Cotonou", to: "JTR", toCity: "Santorini", depart: "07:40", arrive: "16:20", gate: "B12", seat: "14A", boarding: "07:05", cls: "Economy" },
  itinerary: [
    { day: "Fri 14", time: "16:20", title: "Land in Santorini", note: "Private transfer to Oia, 25 min" },
    { day: "Fri 14", time: "19:30", title: "Check in at Kima suites", note: "Cave suite with plunge pool" },
    { day: "Sat 15", time: "10:00", title: "Caldera catamaran", note: "Hot springs swim, lunch on board" },
    { day: "Sun 16", time: "18:45", title: "Sunset at the castle", note: "Arrive early for the west wall" },
    { day: "Tue 18", time: "13:00", title: "Santo Wines tasting", note: "Six Assyrtiko pours, table booked" },
  ],
};

/** Check-in choices on the booking screen. */
export const DATES = [
  { id: "nov14", label: "Fri", date: 14, month: "Nov" },
  { id: "nov15", label: "Sat", date: 15, month: "Nov" },
  { id: "nov21", label: "Fri", date: 21, month: "Nov" },
  { id: "nov22", label: "Sat", date: 22, month: "Nov" },
  { id: "nov28", label: "Fri", date: 28, month: "Nov" },
  { id: "dec05", label: "Fri", date: 5, month: "Dec" },
  { id: "dec12", label: "Fri", date: 12, month: "Dec" },
];

export const NIGHTS = [3, 5, 7, 10];

export const PAST_TRIPS = [
  { id: "p1", place: "Porto, Portugal", dates: "June 2026", nights: 4, rating: "4.9", photo: img("photo-1555881400-74d7acaacd8b", 300) },
  { id: "p2", place: "Aït Benhaddou, Morocco", dates: "Feb 2026", nights: 3, rating: "4.7", photo: img("photo-1489749798305-4fea3ae63d43", 300) },
  { id: "p3", place: "Kyoto, Japan", dates: "Oct 2025", nights: 8, rating: "5.0", photo: img("photo-1493976040374-85c8e12f0c0e", 300) },
];

export type Tab = "home" | "saved" | "trips" | "profile";

/** URL of each tab. Route path = kebab name of the screen file. */
export const PATHS: Record<Tab, string> = { home: "/", saved: "/saved", trips: "/trips", profile: "/profile" };

export const TITLES: Record<Tab, string> = { home: "Explore", saved: "Saved", trips: "Trips", profile: "Profile" };

/** Tab matching the current URL (falls back to Home). */
export function tabFromPath(pathname: string): Tab {
  const path = pathname.replace(/\/+$/, "") || "/";
  return (Object.keys(PATHS) as Tab[]).find((t) => PATHS[t] === path) ?? "home";
}
