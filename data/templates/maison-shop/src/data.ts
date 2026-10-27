export const ONBOARD_KEY = "maison_onboard_done";

const img = (id: string, w = 600) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;

/** 420 -> "€420" */
export const euro = (n: number) => `€${n.toLocaleString("en-US")}`;

export const ME = {
  first: "Ama",
  name: "Ama Owusu",
  email: "ama.owusu@maison.mail",
  tier: "Maison Circle",
  points: 1240,
  avatar: img("photo-1531123897727-8f129e1688ce", 160),
};

export const SLIDES = [
  { kicker: "Maison, Paris & Accra", title: "Slow fashion, cut to last", body: "Small runs from independent ateliers, natural fibres and pieces you will still wear in ten years." },
  { kicker: "The edit", title: "A new story every Thursday", body: "Our stylists pair each drop with a short editorial, so you see how it lives before you buy." },
  { kicker: "Free returns", title: "Try it at home, decide calmly", body: "Free delivery over €200 and thirty days to send anything back, collected from your door." },
];

export type Category = "All" | "Coats" | "Dresses" | "Knitwear" | "Trousers" | "Bags" | "Shoes";
export const CATEGORIES: Category[] = ["All", "Coats", "Dresses", "Knitwear", "Trousers", "Bags", "Shoes"];

export type Swatch = { name: string; hex: string };

export type Product = {
  id: string;
  name: string;
  category: Exclude<Category, "All">;
  price: number;
  was?: number;
  badge?: string;
  images: string[];
  colors: Swatch[];
  sizes: string[];
  description: string;
  composition: string;
  fit: string;
};

export const PRODUCTS: Product[] = [
  {
    id: "alba-coat", name: "Alba wrap coat", category: "Coats", price: 420, badge: "New",
    images: [img("photo-1539533018447-63fcce2678e3", 900), img("photo-1485968579580-b6d095142e6e", 900), img("photo-1558769132-cb1aea458c5e", 900)],
    colors: [{ name: "Camel", hex: "#b88a5a" }, { name: "Ecru", hex: "#e9e1d3" }, { name: "Ink", hex: "#22252b" }],
    sizes: ["XS", "S", "M", "L", "XL"],
    description: "A double-faced wool wrap coat with a shawl collar and a self belt. Unlined, so it drapes softly and folds into a suitcase.",
    composition: "80% virgin wool, 20% cashmere. Made in Portugal.", fit: "Relaxed, falls below the knee. Model is 1.76 m and wears S.",
  },
  {
    id: "velours-dress", name: "Velours slip dress", category: "Dresses", price: 290,
    images: [img("photo-1566174053879-31528523f8ae", 900), img("photo-1595777457583-95e059d581b8", 900)],
    colors: [{ name: "Plum", hex: "#5b2142" }, { name: "Rust", hex: "#b4532a" }],
    sizes: ["XS", "S", "M", "L"],
    description: "Bias-cut silk velvet with a cowl back and adjustable straps. Made for long dinners and the walk home after.",
    composition: "82% viscose, 18% silk. Made in France.", fit: "True to size, skims the body. Model is 1.74 m and wears XS.",
  },
  {
    id: "noor-knit", name: "Noor crochet knit", category: "Knitwear", price: 135, badge: "Hand made",
    images: [img("photo-1434389677669-e08b4cac3105", 900), img("photo-1512436991641-6745cdb1723f", 900)],
    colors: [{ name: "Natural", hex: "#efe6d4" }, { name: "Sand", hex: "#d8c3a0" }],
    sizes: ["S", "M", "L"],
    description: "An open crochet poncho knitted by hand in Kumasi, with a fringed hem. Layer it over a slip or a white tee.",
    composition: "100% organic cotton. Hand made in Ghana.", fit: "One relaxed shape, sized for drape.",
  },
  {
    id: "rosa-trouser", name: "Rosa linen trouser", category: "Trousers", price: 110, was: 150, badge: "-25%",
    images: [img("photo-1594633312681-425c7b97ccd1", 900), img("photo-1490481651871-ab68de25d43d", 900)],
    colors: [{ name: "Blush", hex: "#d9a99a" }, { name: "Ecru", hex: "#e9e1d3" }],
    sizes: ["XS", "S", "M", "L", "XL"],
    description: "Washed linen with a soft drawstring waist and gathered cuffs. Cool in Lagos heat, easy in Paris spring.",
    composition: "100% European flax linen.", fit: "Relaxed through the leg, cropped at the ankle.",
  },
  {
    id: "sienna-bag", name: "Sienna top handle", category: "Bags", price: 340,
    images: [img("photo-1584917865442-de89df76afd3", 900), img("photo-1594223274512-ad4803739b7c", 900)],
    colors: [{ name: "Rust", hex: "#b4532a" }, { name: "Petrol", hex: "#1f5d6b" }],
    sizes: ["One size"],
    description: "Vegetable-tanned calf with a structured body, brass lock and a detachable shoulder strap.",
    composition: "Calf leather, cotton lining. Made in Italy.", fit: "26 x 19 x 11 cm, fits a small tablet.",
  },
  {
    id: "lou-bag", name: "Lou rattan bag", category: "Bags", price: 185, badge: "New",
    images: [img("photo-1590874103328-eac38a683ce7", 900), img("photo-1566150905458-1bf1fc113f0d", 900)],
    colors: [{ name: "Tan", hex: "#c98a4b" }],
    sizes: ["One size"],
    description: "Hand-woven rattan with a leather flap and handle. The bag that makes every summer outfit.",
    composition: "Rattan, leather trims.", fit: "28 x 20 x 12 cm.",
  },
  {
    id: "marin-pump", name: "Marin suede pump", category: "Shoes", price: 175,
    images: [img("photo-1515347619252-60a4bf4fff4f", 900), img("photo-1543163521-1bf539c55dd2", 900)],
    colors: [{ name: "Navy", hex: "#22304f" }, { name: "Black", hex: "#161412" }],
    sizes: ["36", "37", "38", "39", "40", "41"],
    description: "A pointed suede pump on a slim 70 mm heel, with a padded leather insole for long days.",
    composition: "Goat suede, leather sole. Made in Spain.", fit: "True to size. Half sizes, take the size up.",
  },
  {
    id: "tom-jacket", name: "Tom biker jacket", category: "Coats", price: 380,
    images: [img("photo-1551028719-00167b16eac5", 900), img("photo-1520975954732-35dd22299614", 900)],
    colors: [{ name: "Black", hex: "#161412" }],
    sizes: ["S", "M", "L", "XL"],
    description: "Soft lambskin biker with asymmetric zip and quilted shoulders. Gets better every year.",
    composition: "100% lambskin, cupro lining.", fit: "Close to the body, size up for layering.",
  },
];

export const productById = (id: string | undefined) => PRODUCTS.find((p) => p.id === id);

export const EDITORIAL = {
  issue: "N°14 · Autumn edit",
  title: "The quiet coat",
  lede: "Camel, cut long, worn with everything. Five pieces for the first cold mornings.",
  cover: img("photo-1485462537746-965f33f7f6a7", 900),
  story: [img("photo-1539109136881-3be0616acf4b", 600), img("photo-1496747611176-843222e1e57c", 600)],
};

export const ORDERS = [
  { id: "MS-20418", date: "Oct 12", items: 2, total: 525, status: "In transit" },
  { id: "MS-19877", date: "Sep 03", items: 1, total: 135, status: "Delivered" },
  { id: "MS-18802", date: "Jul 21", items: 3, total: 610, status: "Delivered" },
];

export const FREE_SHIPPING = 200;
export const SHIPPING = 12;

export type Tab = "home" | "shop" | "bag" | "profile";

/** URL of each tab. Route path = kebab name of the screen file. */
export const PATHS: Record<Tab, string> = { home: "/", shop: "/shop", bag: "/bag", profile: "/profile" };

export const TITLES: Record<Tab, string> = { home: "Maison", shop: "Shop", bag: "Bag", profile: "Profile" };

/** Tab matching the current URL (falls back to Home). */
export function tabFromPath(pathname: string): Tab {
  const path = pathname.replace(/\/+$/, "") || "/";
  return (Object.keys(PATHS) as Tab[]).find((t) => PATHS[t] === path) ?? "home";
}
