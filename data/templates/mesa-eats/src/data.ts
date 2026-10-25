import { Beef, CookingPot, Drumstick, IceCreamCone, Pizza, Salad, Soup, UtensilsCrossed, type LucideIcon } from "lucide-react";

export const ONBOARD_KEY = "mesa_onboard_done";
export const CURRENCY = "FCFA";

const img = (id: string, w = 600) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;

/** 12500 -> "12 500" (non-breaking space, so a price never wraps) */
export function fcfa(n: number) {
  return n.toLocaleString("fr-FR").replace(/\s/g, "\u00a0");
}

export const ME = {
  first: "Inès",
  name: "Inès Carvalho",
  phone: "+225 07 48 21 90 33",
  avatar: img("photo-1494790108377-be9c29b29330", 160),
};

export const ADDRESS = { label: "Home", line: "14 Rue des Jardins, Cocody" };

export const SLIDES = [
  { kicker: "Welcome to Mesa", title: "The best tables in town, at your door", body: "Maquis, pizzerias, ramen bars and bakeries from your neighbourhood, delivered hot.", photo: img("photo-1555939594-58d7cb561ad1", 900) },
  { kicker: "Order in seconds", title: "Tap, tweak, and it's on its way", body: "Save your favourites, adjust quantities and pay with Wave, Orange Money or card.", photo: img("photo-1574071318508-1cdbab80d002", 900) },
  { kicker: "Live tracking", title: "Watch your order cross the city", body: "From the kitchen to your gate, with the courier's name and a real arrival time.", photo: img("photo-1569718212165-3a8278d5f624", 900) },
];

export type Cuisine = "Burgers" | "Pizza" | "African" | "Asian" | "Healthy" | "Chicken" | "Desserts";

export const CATEGORIES: { id: Cuisine | "All"; icon: LucideIcon }[] = [
  { id: "All", icon: UtensilsCrossed },
  { id: "African", icon: CookingPot },
  { id: "Burgers", icon: Beef },
  { id: "Pizza", icon: Pizza },
  { id: "Asian", icon: Soup },
  { id: "Healthy", icon: Salad },
  { id: "Chicken", icon: Drumstick },
  { id: "Desserts", icon: IceCreamCone },
];

export type Dish = { id: string; name: string; desc: string; price: number; photo: string; popular?: boolean };
export type Section = { title: string; dishes: Dish[] };

export type Restaurant = {
  id: string;
  name: string;
  cuisine: Cuisine;
  tagline: string;
  rating: number;
  reviews: string;
  eta: string;
  fee: number;
  photo: string;
  sections: Section[];
};

export const RESTAURANTS: Restaurant[] = [
  {
    id: "maquis-baobab", name: "Maquis Le Baobab", cuisine: "African", tagline: "Grills, braised fish and attiéké since 2009", rating: 4.8, reviews: "1.2k", eta: "25-35 min", fee: 500,
    photo: img("photo-1555939594-58d7cb561ad1", 900),
    sections: [
      { title: "From the grill", dishes: [
        { id: "brochettes", name: "Mixed brochettes", desc: "Beef and chicken skewers, grilled peppers, chili sauce", price: 4500, photo: img("photo-1555939594-58d7cb561ad1"), popular: true },
        { id: "yassa", name: "Chicken yassa", desc: "Slow-cooked onions, lemon, mustard, white rice", price: 5500, photo: img("photo-1604908176997-125f25cc6f3d") },
      ] },
      { title: "Plates", dishes: [
        { id: "gombo", name: "Shrimp gombo", desc: "Okra stew, prawns, scented rice", price: 6500, photo: img("photo-1559847844-5315695dadae") },
        { id: "arachide", name: "Peanut sauce chicken", desc: "Sauce arachide, tender chicken, rice", price: 5000, photo: img("photo-1588166524941-3bf61a9c41db") },
      ] },
    ],
  },
  {
    id: "napoli-72", name: "Napoli 72", cuisine: "Pizza", tagline: "Wood-fired pizza and fresh pasta", rating: 4.7, reviews: "860", eta: "30-40 min", fee: 700,
    photo: img("photo-1574071318508-1cdbab80d002", 900),
    sections: [
      { title: "Pizze", dishes: [
        { id: "margherita", name: "Margherita DOP", desc: "San Marzano tomato, fior di latte, basil", price: 7500, photo: img("photo-1574071318508-1cdbab80d002"), popular: true },
        { id: "pollo", name: "Pollo e cipolla", desc: "Roast chicken, red onion, smoked provola", price: 8900, photo: img("photo-1565299624946-b28f40a0ae38") },
        { id: "quattro", name: "Quattro formaggi", desc: "Mozzarella, gorgonzola, parmesan, fontina", price: 9200, photo: img("photo-1513104890138-7c749659a591") },
      ] },
      { title: "Pasta", dishes: [
        { id: "arrabbiata", name: "Penne arrabbiata", desc: "Spicy tomato, garlic, parsley", price: 6200, photo: img("photo-1621996346565-e3dbc646d9a9") },
        { id: "gamberi", name: "Spaghetti ai gamberi", desc: "Prawns, cherry tomato, chili, white wine", price: 8500, photo: img("photo-1563379926898-05f4575a45d8") },
      ] },
    ],
  },
  {
    id: "smash-club", name: "Smash Club", cuisine: "Burgers", tagline: "Smashed patties, potato buns, crispy edges", rating: 4.9, reviews: "2.4k", eta: "15-25 min", fee: 500,
    photo: img("photo-1568901346375-23c9450c58cd", 900),
    sections: [
      { title: "Burgers", dishes: [
        { id: "classic", name: "Classic smash", desc: "Double patty, cheddar, pickles, club sauce", price: 5900, photo: img("photo-1568901346375-23c9450c58cd"), popular: true },
        { id: "double", name: "Double cheddar", desc: "Aged cheddar, caramelised onions, lettuce", price: 6900, photo: img("photo-1571091718767-18b5b1457add") },
        { id: "bbq", name: "Smoky BBQ", desc: "Bacon, onion rings, smoked BBQ glaze", price: 7200, photo: img("photo-1550547660-d9450f859349") },
      ] },
      { title: "Combos", dishes: [
        { id: "combo", name: "Burger and fries", desc: "Classic smash, skin-on fries, a cold drink", price: 8400, photo: img("photo-1594212699903-ec8a3eca50f5") },
      ] },
    ],
  },
  {
    id: "sora-ramen", name: "Sora Ramen", cuisine: "Asian", tagline: "18-hour broths and hand-rolled maki", rating: 4.8, reviews: "640", eta: "25-35 min", fee: 800,
    photo: img("photo-1569718212165-3a8278d5f624", 900),
    sections: [
      { title: "Ramen", dishes: [
        { id: "tonkotsu", name: "Tonkotsu ramen", desc: "Pork broth, chashu, soft egg, nori", price: 8800, photo: img("photo-1557872943-16a5ac26437e"), popular: true },
        { id: "ebi", name: "Ebi shio ramen", desc: "Light salt broth, prawns, bok choy", price: 9200, photo: img("photo-1569718212165-3a8278d5f624") },
      ] },
      { title: "Sushi", dishes: [
        { id: "maki", name: "Salmon maki (8)", desc: "Salmon, avocado, sesame, spicy mayo", price: 6500, photo: img("photo-1579871494447-9811cf80d66c") },
        { id: "platter", name: "Chef's platter (24)", desc: "Maki, uramaki and nigiri for two", price: 18500, photo: img("photo-1553621042-f6e147245754") },
      ] },
    ],
  },
  {
    id: "green-bowl", name: "Green Bowl", cuisine: "Healthy", tagline: "Bowls, salads and cold-pressed juices", rating: 4.6, reviews: "510", eta: "20-30 min", fee: 0,
    photo: img("photo-1512621776951-a57141f2eefd", 900),
    sections: [
      { title: "Bowls", dishes: [
        { id: "rainbow", name: "Rainbow bowl", desc: "Avocado, chickpeas, sweet potato, tahini", price: 5800, photo: img("photo-1512621776951-a57141f2eefd"), popular: true },
        { id: "poke", name: "Salmon poke", desc: "Salmon, egg, corn, edamame, sesame rice", price: 7400, photo: img("photo-1546069901-ba9599a7e63c") },
      ] },
      { title: "Light", dishes: [
        { id: "farfalle", name: "Pesto farfalle salad", desc: "Basil pesto, cherry tomatoes, rocket", price: 4900, photo: img("photo-1473093295043-cdd812d0e601") },
        { id: "toast", name: "Avocado and eggs", desc: "Sourdough, smashed avocado, two soft eggs", price: 4200, photo: img("photo-1482049016688-2d3e1b311543") },
      ] },
    ],
  },
  {
    id: "crispy-coq", name: "Crispy Coq", cuisine: "Chicken", tagline: "Buttermilk fried chicken, 24 spices", rating: 4.5, reviews: "1.8k", eta: "15-20 min", fee: 500,
    photo: img("photo-1626082927389-6cd097cdc6ec", 900),
    sections: [
      { title: "Chicken", dishes: [
        { id: "drumsticks", name: "Crispy drumsticks (4)", desc: "Buttermilk brine, hot honey on the side", price: 5200, photo: img("photo-1626082927389-6cd097cdc6ec"), popular: true },
        { id: "tenders", name: "Tenders and dip", desc: "Six tenders, garlic mayo, lemon", price: 4800, photo: img("photo-1562967914-608f82629710") },
      ] },
    ],
  },
  {
    id: "sweet-spot", name: "The Sweet Spot", cuisine: "Desserts", tagline: "Donuts, layer cakes and sundaes", rating: 4.9, reviews: "930", eta: "20-30 min", fee: 500,
    photo: img("photo-1551024601-bec78aea704b", 900),
    sections: [
      { title: "Sweet things", dishes: [
        { id: "donuts", name: "Donut box (6)", desc: "Glazed, chocolate and sprinkle donuts", price: 6000, photo: img("photo-1551024601-bec78aea704b"), popular: true },
        { id: "cake", name: "Raspberry layer cake", desc: "Vanilla sponge, raspberry cream", price: 3500, photo: img("photo-1565958011703-44f9829ba187") },
        { id: "sundae", name: "Cookie sundae", desc: "Chocolate, cookie crumble, cream", price: 3200, photo: img("photo-1563805042-7684c019e1cb") },
        { id: "pancakes", name: "Pancake stack", desc: "Five pancakes, maple syrup, butter", price: 3900, photo: img("photo-1567620905732-2d1ec7ab7445") },
      ] },
    ],
  },
];

export const PROMO = { title: "30% off bowls", body: "At Green Bowl until 15:00 today", restaurantId: "green-bowl", photo: img("photo-1546069901-ba9599a7e63c", 600) };

export const CUISINE_TILES: { name: Cuisine; photo: string }[] = [
  { name: "Pizza", photo: img("photo-1513104890138-7c749659a591", 400) },
  { name: "Burgers", photo: img("photo-1568901346375-23c9450c58cd", 400) },
  { name: "Asian", photo: img("photo-1579871494447-9811cf80d66c", 400) },
  { name: "Healthy", photo: img("photo-1546069901-ba9599a7e63c", 400) },
  { name: "African", photo: img("photo-1555939594-58d7cb561ad1", 400) },
  { name: "Desserts", photo: img("photo-1565958011703-44f9829ba187", 400) },
];

export const RECENT_SEARCHES = ["Ramen", "Smash Club", "Attiéké", "Pancakes"];

export const DELIVERY_FEE_FALLBACK = 500;
export const SERVICE_RATE = 0.02;
export const TIPS = [0, 300, 500, 1000];

export const COURIER = { name: "Moussa Koné", rating: 4.9, vehicle: "Yellow scooter", avatar: img("photo-1506277886164-e25aa3f4ef7f", 160) };

export const PAST_ORDERS = [
  { id: "o-1042", restaurantId: "napoli-72", date: "Sun 19 Oct", items: "Margherita DOP, Penne arrabbiata", total: 14400 },
  { id: "o-1031", restaurantId: "sora-ramen", date: "Sun 12 Oct", items: "Tonkotsu ramen x2", total: 18400 },
  { id: "o-1019", restaurantId: "sweet-spot", date: "Fri 3 Oct", items: "Donut box (6)", total: 6500 },
];

export const ALL_DISHES: (Dish & { restaurantId: string })[] = RESTAURANTS.flatMap((r) =>
  r.sections.flatMap((s) => s.dishes.map((d) => ({ ...d, restaurantId: r.id }))),
);

export function findRestaurant(id: string | undefined) {
  return RESTAURANTS.find((r) => r.id === id);
}

export type Tab = "home" | "search" | "orders" | "profile";

/** URL of each tab. Route path = kebab name of the screen file. */
export const PATHS: Record<Tab, string> = { home: "/", search: "/search", orders: "/orders", profile: "/profile" };

export const TITLES: Record<Tab, string> = { home: "Mesa", search: "Search", orders: "Orders", profile: "Profile" };

/** Tab matching the current URL (falls back to Home). */
export function tabFromPath(pathname: string): Tab {
  const path = pathname.replace(/\/+$/, "") || "/";
  return (Object.keys(PATHS) as Tab[]).find((t) => PATHS[t] === path) ?? "home";
}
